-- HolmOS — Phase 2: landing pages and funnels, forms, booking calendars.
--
-- Run this once in the Supabase SQL editor, after 0001.
--
-- Public visitors (the "anon" role) never read these tables directly. They get
-- published content only, through the read functions in section 6. Everything a
-- visitor writes (form answers, bookings) goes through the server, which calls
-- the functions in section 7 with the secret key.

-- ---------------------------------------------------------------------------
-- 1. Activity log: new kinds of entries
-- ---------------------------------------------------------------------------

alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check check (kind in (
  'created', 'stage_changed', 'note', 'call', 'email', 'meeting',
  'ad_account_assigned', 'ad_account_unassigned',
  'form_submitted', 'booking_created', 'booking_cancelled'));

-- Form answers and bookings find existing clients by email.
create index clients_email_idx on public.clients (lower(email));

-- ---------------------------------------------------------------------------
-- 2. Forms
-- ---------------------------------------------------------------------------

create table public.forms (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) > 0),
  -- [{ id, type, label, placeholder, required, options, maps_to }], validated by the app.
  fields          jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  submit_label    text not null default 'Send',
  success_message text not null default 'Thank you! We''ll be in touch soon.',
  redirect_url    text,
  language        text not null default 'da' check (language in ('da', 'en')),
  -- Where new leads land in the pipeline.
  lead_stage      text not null default 'new'
                    check (lead_stage in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  notify_email    text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.form_submissions (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references public.forms (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  -- Snapshot of what was asked and answered: [{ label, value }].
  answers     jsonb not null check (jsonb_typeof(answers) = 'array'),
  source_url  text,
  -- Hashed visitor IP, only used to slow down spam.
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index form_submissions_form_idx on public.form_submissions (form_id, created_at desc);
create index form_submissions_client_idx on public.form_submissions (client_id);
create index form_submissions_ip_idx on public.form_submissions (ip_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Landing pages and funnels
--    A funnel is one or more pages ("steps") shown at /f/<slug> (or on a
--    custom domain). Editing changes `draft`; publishing copies it to
--    `published`, which is the only version visitors can see.
-- ---------------------------------------------------------------------------

create table public.funnels (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  slug          text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  draft         jsonb not null default '{"steps": []}'::jsonb,
  published     jsonb,
  published_at  timestamptz,
  custom_domain text unique
                  check (custom_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Booking calendars and bookings
-- ---------------------------------------------------------------------------

create table public.booking_calendars (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(trim(name)) > 0),
  slug                  text not null unique
                          check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  description           text,
  duration_minutes      integer not null default 30 check (duration_minutes between 5 and 480),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes  integer not null default 0 check (buffer_after_minutes between 0 and 240),
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 240),
  min_notice_minutes    integer not null default 240 check (min_notice_minutes between 0 and 43200),
  max_days_ahead        integer not null default 60 check (max_days_ahead between 1 and 365),
  time_zone             text not null default 'Europe/Copenhagen',
  -- { "mon": [["09:00", "16:00"]], ..., "sun": [] }, validated by the app.
  availability          jsonb not null default '{"mon": [["09:00", "16:00"]], "tue": [["09:00", "16:00"]],
                          "wed": [["09:00", "16:00"]], "thu": [["09:00", "16:00"]], "fri": [["09:00", "15:00"]],
                          "sat": [], "sun": []}'::jsonb,
  location_type         text not null default 'google_meet'
                          check (location_type in ('google_meet', 'phone', 'in_person', 'custom')),
  location_detail       text,
  language              text not null default 'da' check (language in ('da', 'en')),
  lead_stage            text not null default 'new'
                          check (lead_stage in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  notify_email          text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  calendar_id      uuid not null references public.booking_calendars (id) on delete cascade,
  client_id        uuid references public.clients (id) on delete set null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  -- The meeting plus its buffers. No two confirmed bookings may overlap here.
  blocked_from     timestamptz not null,
  blocked_until    timestamptz not null,
  name             text not null,
  email            text not null,
  phone            text,
  note             text,
  status           text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  -- Secret for the visitor's "cancel booking" link.
  cancel_token     text not null unique
                     default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  -- The Google Calendar event made for this booking, and which calendar it's in.
  google_event_id    text,
  google_calendar_id text,
  meeting_url      text,
  reminder_sent_at timestamptz,
  cancelled_at     timestamptz,
  ip_hash          text,
  created_at       timestamptz not null default now(),
  check (ends_at > starts_at),
  check (blocked_from <= starts_at and blocked_until >= ends_at),
  constraint bookings_no_overlap
    exclude using gist (tstzrange(blocked_from, blocked_until) with &&) where (status = 'confirmed')
);

create index bookings_starts_idx on public.bookings (starts_at);
create index bookings_client_idx on public.bookings (client_id);

-- One Google Calendar login. Its tokens are only ever read by the server.
create table public.calendar_connections (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'google' unique check (provider = 'google'),
  external_user_id  text not null,
  email             text,
  access_token_enc  text,
  refresh_token_enc text,
  token_expires_at  timestamptz,
  -- Which calendars block booking times, and which one new bookings go into.
  busy_calendar_ids text[] not null default array['primary'],
  event_calendar_id text not null default 'primary',
  status            text not null default 'active' check (status in ('active', 'needs_reconnect')),
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Housekeeping and activity triggers
-- ---------------------------------------------------------------------------

create trigger forms_touch before update on public.forms
  for each row execute function public.touch_updated_at();
create trigger funnels_touch before update on public.funnels
  for each row execute function public.touch_updated_at();
create trigger booking_calendars_touch before update on public.booking_calendars
  for each row execute function public.touch_updated_at();
create trigger calendar_connections_touch before update on public.calendar_connections
  for each row execute function public.touch_updated_at();

create or replace function public.log_form_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is null then
    return new;
  end if;
  insert into public.activities (client_id, kind, body, meta)
  values (
    new.client_id,
    'form_submitted',
    (select string_agg((answer ->> 'label') || ': ' || coalesce(answer ->> 'value', ''), E'\n')
       from jsonb_array_elements(new.answers) as answer),
    jsonb_strip_nulls(jsonb_build_object(
      'form', (select name from public.forms where id = new.form_id),
      'form_id', new.form_id,
      'page', new.source_url))
  );
  return new;
end;
$$;

create trigger form_submissions_activity
  after insert on public.form_submissions
  for each row execute function public.log_form_submission();

create or replace function public.log_booking_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  details jsonb;
begin
  if new.client_id is null then
    return new;
  end if;
  select jsonb_build_object(
           'calendar', c.name,
           'booking_id', new.id,
           'starts_at', new.starts_at,
           'time_zone', c.time_zone,
           -- A visitor's cancel link runs without a login; you cancel from HolmOS.
           'by', case when auth.uid() is null then 'guest' else 'you' end)
    into details
    from public.booking_calendars c
   where c.id = new.calendar_id;

  if tg_op = 'INSERT' then
    insert into public.activities (client_id, kind, body, meta)
    values (new.client_id, 'booking_created', new.note, details - 'by');
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.activities (client_id, kind, meta)
    values (new.client_id, 'booking_cancelled', details);
  end if;
  return new;
end;
$$;

create trigger bookings_activity
  after insert or update of status on public.bookings
  for each row execute function public.log_booking_activity();

-- ---------------------------------------------------------------------------
-- 6. What visitors can read: published content only
-- ---------------------------------------------------------------------------

create or replace function public.published_funnel(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', id, 'slug', slug, 'custom_domain', custom_domain, 'content', published)
  from public.funnels
  where slug = p_slug and published is not null;
$$;

create or replace function public.published_funnel_for_domain(p_domain text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', id, 'slug', slug, 'custom_domain', custom_domain, 'content', published)
  from public.funnels
  where published is not null
    and custom_domain in (lower(p_domain), regexp_replace(lower(p_domain), '^www\.', ''))
  order by custom_domain = lower(p_domain) desc
  limit 1;
$$;

create or replace function public.public_form(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', id, 'fields', fields, 'submit_label', submit_label, 'success_message', success_message,
    'redirect_url', redirect_url, 'language', language)
  from public.forms
  where id = p_id and is_active;
$$;

-- Looks a calendar up by its address (slug) or its id.
create or replace function public.public_booking_calendar(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', id, 'slug', slug, 'name', name, 'description', description,
    'duration_minutes', duration_minutes, 'time_zone', time_zone, 'location_type', location_type,
    'location_detail', location_detail, 'language', language)
  from public.booking_calendars
  where is_active and (slug = p_key or id::text = p_key)
  limit 1;
$$;

revoke execute on function public.published_funnel(text), public.published_funnel_for_domain(text),
  public.public_form(uuid), public.public_booking_calendar(text) from public;
grant execute on function public.published_funnel(text), public.published_funnel_for_domain(text),
  public.public_form(uuid), public.public_booking_calendar(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. What visitors can write, via the server only (secret key)
-- ---------------------------------------------------------------------------

-- Finds the client by email (or phone), or adds them to the pipeline.
-- Existing details are never overwritten, only filled in where empty.
create or replace function public.upsert_lead(p_contact jsonb, p_stage text default 'new')
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
    select id into v_id from public.clients where lower(email) = v_email order by created_at limit 1;
  end if;
  if v_id is null and length(v_digits) >= 6 then
    select id into v_id from public.clients
     where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 8) = v_digits
     order by created_at limit 1;
  end if;

  if v_id is null then
    insert into public.clients (name, contact_name, email, phone, website, stage, stage_position)
    values (
      coalesce(v_company, v_name, v_email, v_phone, 'New lead'),
      v_name, v_email, v_phone, v_website, p_stage,
      coalesce((select min(stage_position) from public.clients where stage = p_stage) - 1, 0)
    )
    returning id into v_id;
  else
    update public.clients
       set contact_name = coalesce(contact_name, v_name),
           email        = coalesce(email, v_email),
           phone        = coalesce(phone, v_phone),
           website      = coalesce(website, v_website)
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
  v_form   public.forms%rowtype;
  v_client uuid;
  v_id     uuid;
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

  v_client := public.upsert_lead(p_contact, v_form.lead_stage);
  insert into public.form_submissions (form_id, client_id, answers, source_url, ip_hash)
  values (p_form_id, v_client, p_answers, p_source_url, p_ip_hash)
  returning id into v_id;
  return jsonb_build_object('submission_id', v_id, 'client_id', v_client);
end;
$$;

create or replace function public.book_slot(
  p_calendar_id uuid, p_starts_at timestamptz, p_contact jsonb, p_note text default null, p_ip_hash text default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_cal     public.booking_calendars%rowtype;
  v_client  uuid;
  v_booking public.bookings%rowtype;
begin
  select * into v_cal from public.booking_calendars where id = p_calendar_id and is_active;
  if not found then
    raise exception 'calendar_closed';
  end if;
  if p_starts_at <= now() then
    raise exception 'slot_in_past';
  end if;
  if nullif(trim(p_contact ->> 'email'), '') is null or nullif(trim(p_contact ->> 'name'), '') is null then
    raise exception 'contact_missing';
  end if;
  if p_ip_hash is not null and (
    select count(*) from public.bookings
     where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited';
  end if;

  v_client := public.upsert_lead(p_contact, v_cal.lead_stage);
  begin
    insert into public.bookings (
      calendar_id, client_id, starts_at, ends_at, blocked_from, blocked_until, name, email, phone, note, ip_hash)
    values (
      v_cal.id, v_client, p_starts_at,
      p_starts_at + make_interval(mins => v_cal.duration_minutes),
      p_starts_at - make_interval(mins => v_cal.buffer_before_minutes),
      p_starts_at + make_interval(mins => v_cal.duration_minutes + v_cal.buffer_after_minutes),
      trim(p_contact ->> 'name'), lower(trim(p_contact ->> 'email')),
      nullif(trim(p_contact ->> 'phone'), ''), nullif(trim(p_note), ''), p_ip_hash)
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  return jsonb_build_object(
    'booking_id', v_booking.id, 'client_id', v_client, 'cancel_token', v_booking.cancel_token,
    'starts_at', v_booking.starts_at, 'ends_at', v_booking.ends_at);
end;
$$;

-- The visitor's own cancel link. Only upcoming, confirmed bookings.
create or replace function public.cancel_booking_by_token(p_token text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where cancel_token = p_token and status = 'confirmed' and starts_at > now()
  returning * into v_booking;
  if not found then
    return null;
  end if;
  return jsonb_build_object('booking_id', v_booking.id);
end;
$$;

revoke execute on function public.upsert_lead(jsonb, text),
  public.record_form_submission(uuid, jsonb, jsonb, text, text),
  public.book_slot(uuid, timestamptz, jsonb, text, text),
  public.cancel_booking_by_token(text) from public, anon, authenticated;
grant execute on function public.upsert_lead(jsonb, text),
  public.record_form_submission(uuid, jsonb, jsonb, text, text),
  public.book_slot(uuid, timestamptz, jsonb, text, text),
  public.cancel_booking_by_token(text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Row-level security
--    Admin: everything. Future client logins: read-only access to their own
--    form answers and bookings, like the activity log.
-- ---------------------------------------------------------------------------

alter table public.forms                enable row level security;
alter table public.form_submissions     enable row level security;
alter table public.funnels              enable row level security;
alter table public.booking_calendars    enable row level security;
alter table public.bookings             enable row level security;
alter table public.calendar_connections enable row level security;

create policy "admin manages forms" on public.forms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "view allowed submissions" on public.form_submissions
  for select to authenticated using (client_id is not null and public.can_view_client(client_id));
create policy "admin manages submissions" on public.form_submissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin manages funnels" on public.funnels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin manages booking calendars" on public.booking_calendars
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "view allowed bookings" on public.bookings
  for select to authenticated using (client_id is not null and public.can_view_client(client_id));
create policy "admin manages bookings" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin views calendar connection" on public.calendar_connections
  for select to authenticated using (public.is_admin());
create policy "admin changes calendar choices" on public.calendar_connections
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin removes calendar connection" on public.calendar_connections
  for delete to authenticated using (public.is_admin());

revoke all on public.forms, public.form_submissions, public.funnels, public.booking_calendars,
  public.bookings, public.calendar_connections from anon;

-- Google tokens stay with the server, as with the ad platform tokens.
revoke all on public.calendar_connections from authenticated;
grant select (id, provider, external_user_id, email, token_expires_at, busy_calendar_ids, event_calendar_id,
              status, last_error, created_at, updated_at)
  on public.calendar_connections to authenticated;
grant update (busy_calendar_ids, event_calendar_id) on public.calendar_connections to authenticated;
grant delete on public.calendar_connections to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Image storage for pages (Supabase Storage). Files are public, like the
--    pages they appear on; only the server uploads.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('page-images', 'page-images', true)
    on conflict (id) do nothing;
  end if;
end;
$$;
