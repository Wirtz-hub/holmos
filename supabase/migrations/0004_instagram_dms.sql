-- HolmOS — Instagram DMs for @holm_10 (and any other professional account you connect).
--
-- Run this once in the Supabase SQL editor, after 0003.
-- It only adds tables, indexes, policies and functions. It does not change or
-- delete existing rows.
--
-- Messages are copied here so an inbox bot can read them and leave a draft.
-- A draft can be sent to Instagram only after an admin has approved it, and
-- only through mark_dm_draft_sent(), which the app calls after that approval.
-- The bot's key cannot approve or send.

-- ---------------------------------------------------------------------------
-- 1. The Instagram login (a Facebook Page linked to a professional account)
--    Tokens are encrypted by the app, same as ad_connections, and are not
--    readable by a logged-in session.
-- ---------------------------------------------------------------------------

create table public.instagram_connections (
  id                     uuid primary key default gen_random_uuid(),
  external_user_id       text not null,
  label                  text not null,
  ig_user_id             text not null check (length(trim(ig_user_id)) > 0),
  ig_username            text not null check (length(trim(ig_username)) > 0),
  page_id                text not null check (length(trim(page_id)) > 0),
  page_name              text,
  user_access_token_enc  text,
  page_access_token_enc  text,
  token_expires_at       timestamptz,
  status                 text not null default 'active' check (status in ('active', 'needs_reconnect')),
  last_error             text,
  last_synced_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (ig_user_id)
);

create trigger instagram_connections_touch before update on public.instagram_connections
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Conversations and messages
-- ---------------------------------------------------------------------------

create table public.dm_conversations (
  id                   uuid primary key default gen_random_uuid(),
  connection_id        uuid not null references public.instagram_connections (id) on delete cascade,
  -- Meta's conversation id. A webhook can arrive before the sync knows it;
  -- those rows use a temporary id ("pending:<participant>") until sync fills it in.
  thread_id            text not null check (length(trim(thread_id)) > 0),
  -- Instagram-scoped id of the other person. Stable for this professional account.
  participant_id       text not null check (length(trim(participant_id)) > 0),
  participant_username text,
  participant_name     text,
  -- Filled when an existing contact clearly is this Instagram account.
  contact_id           uuid references public.contacts (id) on delete set null,
  snippet              text,
  last_message_at      timestamptz,
  -- The last message THEY sent. Instagram's 24-hour reply window is measured from this.
  last_inbound_at      timestamptz,
  -- True when a message from them is waiting and an admin hasn't opened the thread.
  unread               boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (connection_id, thread_id),
  unique (connection_id, participant_id)
);

create index dm_conversations_last_message_idx on public.dm_conversations (last_message_at desc nulls last);
create index dm_conversations_contact_idx on public.dm_conversations (contact_id);

create trigger dm_conversations_touch before update on public.dm_conversations
  for each row execute function public.touch_updated_at();

create table public.dm_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  -- Meta's message id (mid). Re-delivering a webhook updates this row instead of adding another.
  external_id     text not null check (length(trim(external_id)) > 0),
  direction       text not null check (direction in ('inbound', 'outbound')),
  body            text,
  -- [{ "type": "image", "url": "..." }] — metadata only, never the file itself.
  attachments     jsonb not null default '[]'::jsonb,
  sender_id       text,
  sent_at         timestamptz not null,
  -- Inbound: an admin has opened the thread. Outbound: the other person has seen it.
  is_read         boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (conversation_id, external_id)
);

create index dm_messages_conversation_sent_idx on public.dm_messages (conversation_id, sent_at desc);
create index dm_messages_external_idx on public.dm_messages (external_id);

-- ---------------------------------------------------------------------------
-- 3. Follow-up drafts
--    draft → approved or rejected, and approved → sent.
--    "sent" is refused unless mark_dm_draft_sent() is the one writing it,
--    and that function itself refuses anything that isn't already approved.
--    Approval requires a logged-in admin (auth.uid()); the service key cannot approve.
-- ---------------------------------------------------------------------------

create table public.dm_drafts (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.dm_conversations (id) on delete cascade,
  body                text not null check (length(trim(body)) > 0 and octet_length(body) <= 1000),
  status              text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'sent')),
  source              text not null default 'admin' check (source in ('admin', 'bot')),
  approved_by         uuid references auth.users (id) on delete set null,
  approved_at         timestamptz,
  rejected_by         uuid references auth.users (id) on delete set null,
  rejected_at         timestamptz,
  sent_by             uuid references auth.users (id) on delete set null,
  sent_at             timestamptz,
  send_error          text,
  -- Set while a send is in flight so two clicks can't both reach Instagram.
  send_claimed_at     timestamptz,
  external_message_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index dm_drafts_conversation_idx on public.dm_drafts (conversation_id, created_at desc);
create index dm_drafts_status_idx on public.dm_drafts (status, created_at desc);

create trigger dm_drafts_touch before update on public.dm_drafts
  for each row execute function public.touch_updated_at();

create or replace function public.guard_dm_draft_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception 'dm_draft_must_start_as_draft';
    end if;
    new.approved_by := null;
    new.approved_at := null;
    new.rejected_by := null;
    new.rejected_at := null;
    new.sent_by := null;
    new.sent_at := null;
    new.external_message_id := null;
    new.send_claimed_at := null;
    return new;
  end if;

  if new.body is distinct from old.body and old.status <> 'draft' then
    raise exception 'dm_draft_body_locked';
  end if;

  if new.status is not distinct from old.status then
    if new.external_message_id is distinct from old.external_message_id
       and current_setting('holmos.allow_dm_send', true) is distinct from 'on' then
      raise exception 'dm_draft_send_locked';
    end if;
    return new;
  end if;

  if old.status = 'sent' or old.status = 'rejected' then
    raise exception 'dm_draft_is_closed';
  end if;

  if new.status = 'approved' and old.status = 'draft' then
    if auth.uid() is null or (new.approved_by is not null and new.approved_by is distinct from auth.uid()) then
      raise exception 'dm_draft_approval_requires_admin';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
    return new;
  end if;

  if new.status = 'rejected' and old.status in ('draft', 'approved') then
    if auth.uid() is null then
      raise exception 'dm_draft_rejection_requires_admin';
    end if;
    new.rejected_by := auth.uid();
    new.rejected_at := now();
    return new;
  end if;

  if new.status = 'sent' and old.status = 'approved' then
    if current_setting('holmos.allow_dm_send', true) is distinct from 'on' then
      raise exception 'dm_draft_send_requires_approval_action';
    end if;
    new.sent_at := coalesce(new.sent_at, now());
    return new;
  end if;

  raise exception 'dm_draft_invalid_transition';
end;
$$;

create trigger dm_drafts_guard before insert or update on public.dm_drafts
  for each row execute function public.guard_dm_draft_status();

-- Claims an approved draft for a few minutes. A second send while this is set does nothing.
create or replace function public.claim_dm_draft_send(p_id uuid)
returns table (body text, conversation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_conversation uuid;
begin
  update public.dm_drafts d
     set send_claimed_at = now(),
         send_error = null
   where d.id = p_id
     and d.status = 'approved'
     and (d.send_claimed_at is null or d.send_claimed_at < now() - interval '2 minutes')
  returning d.body, d.conversation_id into v_body, v_conversation;

  if not found then
    raise exception 'dm_draft_not_sendable';
  end if;

  body := v_body;
  conversation_id := v_conversation;
  return next;
end;
$$;

create or replace function public.release_dm_draft_send(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_drafts
     set send_claimed_at = null,
         send_error = left(coalesce(p_error, 'Could not send.'), 500)
   where id = p_id
     and status = 'approved';
end;
$$;

-- The only way a draft becomes "sent". Call it after Instagram has accepted the message.
create or replace function public.mark_dm_draft_sent(p_id uuid, p_external_message_id text, p_sent_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('holmos.allow_dm_send', 'on', true);
  update public.dm_drafts
     set status = 'sent',
         external_message_id = p_external_message_id,
         sent_by = p_sent_by,
         sent_at = now(),
         send_error = null,
         send_claimed_at = null
   where id = p_id
     and status = 'approved';
  if not found then
    raise exception 'dm_draft_not_approved';
  end if;
end;
$$;

revoke all on function public.claim_dm_draft_send(uuid) from public, anon, authenticated;
revoke all on function public.release_dm_draft_send(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_dm_draft_sent(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_dm_draft_send(uuid) to service_role;
grant execute on function public.release_dm_draft_send(uuid, text) to service_role;
grant execute on function public.mark_dm_draft_sent(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Row-level security
--    This inbox is HolmNordic's, not a client's. Only the admin can see it.
-- ---------------------------------------------------------------------------

alter table public.instagram_connections enable row level security;
alter table public.dm_conversations       enable row level security;
alter table public.dm_messages            enable row level security;
alter table public.dm_drafts              enable row level security;

create policy "admin reads instagram connections" on public.instagram_connections
  for select to authenticated using (public.is_admin());
create policy "admin deletes instagram connections" on public.instagram_connections
  for delete to authenticated using (public.is_admin());

create policy "admin reads dm conversations" on public.dm_conversations
  for select to authenticated using (public.is_admin());
create policy "admin updates dm conversations" on public.dm_conversations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin reads dm messages" on public.dm_messages
  for select to authenticated using (public.is_admin());
create policy "admin updates dm messages" on public.dm_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin reads dm drafts" on public.dm_drafts
  for select to authenticated using (public.is_admin());
create policy "admin inserts dm drafts" on public.dm_drafts
  for insert to authenticated with check (public.is_admin());
create policy "admin updates dm drafts" on public.dm_drafts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.instagram_connections, public.dm_conversations, public.dm_messages, public.dm_drafts from anon;

revoke all on public.instagram_connections from authenticated;
grant select (
  id, external_user_id, label, ig_user_id, ig_username, page_id, page_name,
  token_expires_at, status, last_error, last_synced_at, created_at, updated_at
) on public.instagram_connections to authenticated;
grant delete on public.instagram_connections to authenticated;
