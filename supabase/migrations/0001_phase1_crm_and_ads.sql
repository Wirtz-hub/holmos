-- HolmOS — Phase 1: CRM pipeline, ad accounts and the access-control layer.
--
-- Run this once in the Supabase SQL editor (or with `supabase db push`).
-- Create your own login (Authentication → Users → Add user) BEFORE running it:
-- the first user in the project becomes the admin.

-- ---------------------------------------------------------------------------
-- 1. Access layer
--    Kept separate from client data so client logins can be switched on later
--    (per client, via clients.portal_enabled + a row in client_access) without
--    restructuring anything.
-- ---------------------------------------------------------------------------

create table public.app_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         text not null default 'client' check (role in ('admin', 'client')),
  display_name text,
  created_at   timestamptz not null default now()
);

-- Existing users: the oldest one becomes admin, everyone else gets no access.
insert into public.app_users (user_id, role, display_name)
select id,
       case when row_number() over (order by created_at) = 1 then 'admin' else 'client' end,
       email
from auth.users
on conflict (user_id) do nothing;

-- New users: admin only if there is no admin yet. Everyone else is a
-- "client" user, which sees nothing until granted access to a client.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (user_id, role, display_name)
  values (
    new.id,
    case when exists (select 1 from public.app_users where role = 'admin') then 'client' else 'admin' end,
    coalesce(new.raw_user_meta_data ->> 'name', new.email)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. CRM
-- ---------------------------------------------------------------------------

create table public.clients (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null check (length(trim(name)) > 0),
  contact_name             text,
  email                    text,
  phone                    text,
  website                  text,
  stage                    text not null default 'new'
                             check (stage in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  stage_position           double precision not null default 0,
  deal_value               numeric(14, 2),
  currency                 text not null default 'DKK',
  goal                     text not null default 'lead' check (goal in ('lead', 'purchase', 'booking')),
  -- Advanced, optional: which Meta action counts as a result (e.g. a custom conversion).
  meta_result_action       text,
  -- Advanced, optional: count every Google Ads conversion as a result.
  google_count_all_conversions boolean not null default false,
  notes                    text,
  -- Future client logins: flip this on per client to let their users in.
  portal_enabled           boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index clients_stage_idx on public.clients (stage, stage_position);

create table public.client_access (
  user_id    uuid not null references public.app_users (user_id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

create or replace function public.can_view_client(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.client_access ca
    join public.clients c on c.id = ca.client_id
    where ca.user_id = auth.uid()
      and ca.client_id = target
      and c.portal_enabled
  );
$$;

create table public.activities (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  kind       text not null check (kind in (
               'created', 'stage_changed', 'note', 'call', 'email', 'meeting',
               'ad_account_assigned', 'ad_account_unassigned')),
  body       text,
  meta       jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index activities_client_idx on public.activities (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Ad platforms
--    A connection is one OAuth login (a Meta user or a Google user). It can
--    see many ad accounts. Each ad account is assigned to at most one client;
--    reassigning only changes ad_accounts.client_id — no reconnecting.
-- ---------------------------------------------------------------------------

create table public.ad_connections (
  id                uuid primary key default gen_random_uuid(),
  platform          text not null check (platform in ('meta', 'google')),
  external_user_id  text not null,
  label             text not null,
  -- Tokens are encrypted by the app before they are stored, and are never
  -- readable by logged-in users (see the column grants below).
  access_token_enc  text,
  refresh_token_enc text,
  token_expires_at  timestamptz,
  status            text not null default 'active' check (status in ('active', 'needs_reconnect')),
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (platform, external_user_id)
);

create table public.ad_accounts (
  id                  uuid primary key default gen_random_uuid(),
  platform            text not null check (platform in ('meta', 'google')),
  external_account_id text not null,
  name                text not null,
  currency            text,
  timezone            text,
  connection_id       uuid references public.ad_connections (id) on delete set null,
  -- Google only: the account (often a manager account) we log in through.
  login_customer_id   text,
  client_id           uuid references public.clients (id) on delete set null,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (platform, external_account_id)
);

create index ad_accounts_client_idx on public.ad_accounts (client_id);

-- ---------------------------------------------------------------------------
-- 4. Housekeeping triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();
create trigger ad_connections_touch before update on public.ad_connections
  for each row execute function public.touch_updated_at();
create trigger ad_accounts_touch before update on public.ad_accounts
  for each row execute function public.touch_updated_at();

-- Activity log entries the app never has to remember to write.
create or replace function public.log_client_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (client_id, kind, meta, created_by)
    values (new.id, 'created', jsonb_build_object('stage', new.stage), auth.uid());
  elsif new.stage is distinct from old.stage then
    insert into public.activities (client_id, kind, meta, created_by)
    values (new.id, 'stage_changed', jsonb_build_object('from', old.stage, 'to', new.stage), auth.uid());
  end if;
  return new;
end;
$$;

create trigger clients_activity
  after insert or update of stage on public.clients
  for each row execute function public.log_client_activity();

create or replace function public.log_ad_account_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  details jsonb := jsonb_build_object('account', new.name, 'platform', new.platform);
begin
  if new.client_id is distinct from old.client_id then
    -- Skip when the old client is being deleted (the account is unassigned as part of that).
    if old.client_id is not null and exists (select 1 from public.clients where id = old.client_id) then
      insert into public.activities (client_id, kind, meta, created_by)
      values (old.client_id, 'ad_account_unassigned', details, auth.uid());
    end if;
    if new.client_id is not null then
      insert into public.activities (client_id, kind, meta, created_by)
      values (new.client_id, 'ad_account_assigned', details, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

create trigger ad_accounts_assignment
  after update of client_id on public.ad_accounts
  for each row execute function public.log_ad_account_assignment();

-- ---------------------------------------------------------------------------
-- 5. Row-level security
--    Admin: everything. Client users (future): read-only, and only the client
--    records they've been granted, with portal access switched on.
-- ---------------------------------------------------------------------------

alter table public.app_users      enable row level security;
alter table public.client_access  enable row level security;
alter table public.clients        enable row level security;
alter table public.activities     enable row level security;
alter table public.ad_connections enable row level security;
alter table public.ad_accounts    enable row level security;

create policy "own row or admin" on public.app_users
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admin manages users" on public.app_users
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "own grants or admin" on public.client_access
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admin manages grants" on public.client_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "view allowed clients" on public.clients
  for select to authenticated using (public.can_view_client(id));
create policy "admin manages clients" on public.clients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "view allowed activity" on public.activities
  for select to authenticated using (public.can_view_client(client_id));
create policy "admin manages activity" on public.activities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "view allowed ad accounts" on public.ad_accounts
  for select to authenticated
  using (public.is_admin() or (client_id is not null and public.can_view_client(client_id)));
create policy "admin manages ad accounts" on public.ad_accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin views connections" on public.ad_connections
  for select to authenticated using (public.is_admin());
create policy "admin removes connections" on public.ad_connections
  for delete to authenticated using (public.is_admin());

-- Token columns are off-limits to browser/session clients entirely. Only the
-- server (using the secret key) reads or writes them.
revoke all on public.ad_connections from anon, authenticated;
grant select (id, platform, external_user_id, label, token_expires_at, status, last_error, created_at, updated_at)
  on public.ad_connections to authenticated;
grant delete on public.ad_connections to authenticated;

revoke all on public.app_users, public.client_access, public.clients, public.activities, public.ad_accounts from anon;
