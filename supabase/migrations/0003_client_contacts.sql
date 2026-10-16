-- HolmOS — Pages and forms for clients, with a contact list per client.
--
-- Run this once in the Supabase SQL editor, after 0002.
--
-- A page or form can now belong to one of your clients. Answers to a client's
-- form go to that client's own contact list instead of your pipeline. Pages
-- and forms without a client work exactly as before.

-- ---------------------------------------------------------------------------
-- 1. Contact lists
-- ---------------------------------------------------------------------------

create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  -- Whose contact list this person is on.
  client_id  uuid not null references public.clients (id) on delete cascade,
  name       text,
  email      text,
  phone      text,
  company    text,
  website    text,
  notes      text,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(email, phone, name) is not null)
);

create index contacts_client_idx on public.contacts (client_id, created_at desc);
create index contacts_email_idx on public.contacts (client_id, lower(email));

create table public.contact_events (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  kind       text not null check (kind in ('created', 'form_submitted', 'note')),
  body       text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index contact_events_contact_idx on public.contact_events (contact_id, created_at desc);

create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Which client a page or form belongs to (empty = your own)
-- ---------------------------------------------------------------------------

alter table public.funnels add column client_id uuid references public.clients (id) on delete set null;
alter table public.forms add column client_id uuid references public.clients (id) on delete set null;
alter table public.form_submissions add column contact_id uuid references public.contacts (id) on delete set null;

create index funnels_client_idx on public.funnels (client_id);
create index forms_client_idx on public.forms (client_id);
create index form_submissions_contact_idx on public.form_submissions (contact_id);

-- ---------------------------------------------------------------------------
-- 3. Answers to a client's form land on that client's contact list
-- ---------------------------------------------------------------------------

-- Finds the person on the client's list by email (or phone), or adds them.
-- Existing details are never overwritten, only filled in where empty.
create or replace function public.upsert_contact(p_client_id uuid, p_contact jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_email   text := nullif(lower(trim(p_contact ->> 'email')), '');
  v_phone   text := nullif(trim(p_contact ->> 'phone'), '');
  v_digits  text := right(regexp_replace(coalesce(p_contact ->> 'phone', ''), '\D', '', 'g'), 8);
  v_name    text := nullif(trim(p_contact ->> 'name'), '');
  v_company text := nullif(trim(p_contact ->> 'company'), '');
  v_website text := nullif(trim(p_contact ->> 'website'), '');
  v_id      uuid;
begin
  if v_email is not null then
    select id into v_id from public.contacts
     where client_id = p_client_id and lower(email) = v_email
     order by created_at limit 1;
  end if;
  if v_id is null and length(v_digits) >= 6 then
    select id into v_id from public.contacts
     where client_id = p_client_id
       and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 8) = v_digits
     order by created_at limit 1;
  end if;

  if v_id is null then
    insert into public.contacts (client_id, name, email, phone, company, website)
    values (p_client_id, coalesce(v_name, v_company), v_email, v_phone, v_company, v_website)
    returning id into v_id;
    insert into public.contact_events (contact_id, kind) values (v_id, 'created');
  else
    update public.contacts
       set name    = coalesce(name, v_name, v_company),
           email   = coalesce(email, v_email),
           phone   = coalesce(phone, v_phone),
           company = coalesce(company, v_company),
           website = coalesce(website, v_website)
     where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.record_form_submission(
  p_form_id uuid, p_contact jsonb, p_answers jsonb, p_source_url text default null, p_ip_hash text default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_form    public.forms%rowtype;
  v_client  uuid;
  v_contact uuid;
  v_id      uuid;
begin
  select * into v_form from public.forms where id = p_form_id and is_active;
  if not found then
    raise exception 'form_closed';
  end if;
  if p_ip_hash is not null and (
    select count(*) from public.form_submissions
     where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limited';
  end if;

  if v_form.client_id is null then
    -- Your own form: the person joins your pipeline.
    v_client := public.upsert_lead(p_contact, v_form.lead_stage);
  else
    -- A client's form: the person joins that client's contact list.
    v_contact := public.upsert_contact(v_form.client_id, p_contact);
  end if;

  insert into public.form_submissions (form_id, client_id, contact_id, answers, source_url, ip_hash)
  values (p_form_id, v_client, v_contact, p_answers, p_source_url, p_ip_hash)
  returning id into v_id;
  return jsonb_build_object(
    'submission_id', v_id, 'client_id', v_client, 'contact_id', v_contact, 'owner_client_id', v_form.client_id);
end;
$$;

-- Logs the answers on the client record (your own forms) or the contact (a client's forms).
create or replace function public.log_form_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := (select string_agg((answer ->> 'label') || ': ' || coalesce(answer ->> 'value', ''), E'\n')
                    from jsonb_array_elements(new.answers) as answer);
  v_meta jsonb := jsonb_strip_nulls(jsonb_build_object(
                    'form', (select name from public.forms where id = new.form_id),
                    'form_id', new.form_id,
                    'page', new.source_url));
begin
  if new.client_id is not null then
    insert into public.activities (client_id, kind, body, meta)
    values (new.client_id, 'form_submitted', v_body, v_meta);
  end if;
  if new.contact_id is not null then
    insert into public.contact_events (contact_id, kind, body, meta)
    values (new.contact_id, 'form_submitted', v_body, v_meta);
  end if;
  return new;
end;
$$;

revoke execute on function public.upsert_contact(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_contact(uuid, jsonb) to service_role;
-- record_form_submission keeps its grants (replaced in place), but restate them for safety.
revoke execute on function public.record_form_submission(uuid, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.record_form_submission(uuid, jsonb, jsonb, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Row-level security
--    Admin: everything. Future client logins: read-only, their own list only.
-- ---------------------------------------------------------------------------

alter table public.contacts       enable row level security;
alter table public.contact_events enable row level security;

create policy "view allowed contacts" on public.contacts
  for select to authenticated using (public.can_view_client(client_id));
create policy "admin manages contacts" on public.contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "view allowed contact events" on public.contact_events
  for select to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_id and public.can_view_client(c.client_id)));
create policy "admin manages contact events" on public.contact_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.contacts, public.contact_events from anon;
