-- HolmOS — Daily ad performance, stored so other tools can query it.
--
-- Run this once in the Supabase SQL editor, after 0003.
-- It only adds tables. The app's daily job (read-only towards Meta and Google)
-- fills them. Upserts use the natural key
-- (ad account, level, platform id, date).

-- ---------------------------------------------------------------------------
-- 1. One row per account / campaign / ad set / ad, per day
--    `adset` means a Meta ad set or a Google ad group.
--    ctr is a ratio (clicks / impressions), not a percentage.
--    conversions and purchases are the same purchase count. Meta reports the
--    same purchase under several action types; those are counted once.
--    Everything else the platform reported (leads, landing-page views, …)
--    is kept in `actions` / `action_values`.
-- ---------------------------------------------------------------------------

create table public.ad_insights_daily (
  id                  uuid primary key default gen_random_uuid(),
  ad_account_id       uuid not null references public.ad_accounts (id) on delete cascade,
  client_id           uuid references public.clients (id) on delete set null,
  platform            text not null check (platform in ('meta', 'google')),
  level               text not null check (level in ('account', 'campaign', 'adset', 'ad')),
  external_id         text not null,
  parent_external_id  text,
  name                text not null default '',
  insight_date        date not null,
  spend               numeric(16, 4) not null default 0,
  impressions         bigint not null default 0,
  reach               bigint,
  clicks              bigint not null default 0,
  ctr                 numeric(12, 6),
  cpc                 numeric(16, 4),
  cpm                 numeric(16, 4),
  conversions         numeric(16, 4) not null default 0,
  purchases           numeric(16, 4) not null default 0,
  purchase_value      numeric(16, 4) not null default 0,
  roas                numeric(16, 4),
  currency            text not null,
  actions             jsonb not null default '{}'::jsonb,
  action_values       jsonb not null default '{}'::jsonb,
  synced_at           timestamptz not null default now(),
  unique (ad_account_id, level, external_id, insight_date)
);

create index ad_insights_daily_client_date_idx on public.ad_insights_daily (client_id, insight_date);
create index ad_insights_daily_account_level_date_idx
  on public.ad_insights_daily (ad_account_id, level, insight_date);

comment on table public.ad_insights_daily is
  'Daily ad performance copied from Meta (and Google, when enabled). Read-only towards the ad platforms. ctr is clicks/impressions. conversions equals purchases.';

-- Which accounts have already had their first 30-day pull.
create table public.ad_insight_syncs (
  ad_account_id   uuid primary key references public.ad_accounts (id) on delete cascade,
  backfilled_at   timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error      text,
  last_range_from date,
  last_range_to   date,
  rows_written    integer,
  updated_at      timestamptz not null default now()
);

create trigger ad_insight_syncs_touch before update on public.ad_insight_syncs
  for each row execute function public.touch_updated_at();

-- Keep the copied client id in step with the account assignment, including
-- rows outside the days the next sync will refresh.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.sync_ad_insight_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is distinct from old.client_id then
    update public.ad_insights_daily
       set client_id = new.client_id
     where ad_account_id = new.id
       and client_id is distinct from new.client_id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_ad_insight_client() from public;

create trigger ad_accounts_insight_client
  after update of client_id on public.ad_accounts
  for each row execute function private.sync_ad_insight_client();

-- ---------------------------------------------------------------------------
-- 2. Last 7 and 30 complete days, for bots
--    Windows end yesterday in Europe/Copenhagen, matching the dashboards.
--    Reach is summed per day, so a person seen on two days counts twice.
-- ---------------------------------------------------------------------------

create view public.ad_performance_summary
with (security_invoker = true) as
with bounds as (
  select (timezone('Europe/Copenhagen', now()))::date as today
),
daily as (
  select
    b.today,
    a.id as ad_account_id,
    a.client_id,
    a.platform,
    a.external_account_id,
    a.name as account_name,
    coalesce(a.currency, i.currency) as currency,
    i.level,
    i.external_id,
    i.name,
    i.insight_date,
    i.spend,
    i.impressions,
    i.reach,
    i.clicks,
    i.conversions,
    i.purchases,
    i.purchase_value
  from public.ad_insights_daily i
  join public.ad_accounts a on a.id = i.ad_account_id
  cross join bounds b
  where i.insight_date >= b.today - 30
    and i.insight_date < b.today
)
select
  ad_account_id,
  client_id,
  platform,
  external_account_id,
  account_name,
  currency,
  level,
  external_id,
  (array_agg(name order by insight_date desc))[1] as name,
  today as as_of,
  coalesce(sum(spend) filter (where insight_date >= today - 7), 0) as spend_7d,
  coalesce(sum(impressions) filter (where insight_date >= today - 7), 0) as impressions_7d,
  sum(reach) filter (where insight_date >= today - 7) as reach_7d,
  coalesce(sum(clicks) filter (where insight_date >= today - 7), 0) as clicks_7d,
  case when sum(impressions) filter (where insight_date >= today - 7) > 0
    then (sum(clicks) filter (where insight_date >= today - 7))::numeric
         / (sum(impressions) filter (where insight_date >= today - 7))
    else null end as ctr_7d,
  case when sum(clicks) filter (where insight_date >= today - 7) > 0
    then sum(spend) filter (where insight_date >= today - 7)
         / sum(clicks) filter (where insight_date >= today - 7)
    else null end as cpc_7d,
  case when sum(impressions) filter (where insight_date >= today - 7) > 0
    then sum(spend) filter (where insight_date >= today - 7)
         / sum(impressions) filter (where insight_date >= today - 7) * 1000
    else null end as cpm_7d,
  coalesce(sum(conversions) filter (where insight_date >= today - 7), 0) as conversions_7d,
  coalesce(sum(purchases) filter (where insight_date >= today - 7), 0) as purchases_7d,
  coalesce(sum(purchase_value) filter (where insight_date >= today - 7), 0) as purchase_value_7d,
  case when sum(spend) filter (where insight_date >= today - 7) > 0
    then sum(purchase_value) filter (where insight_date >= today - 7)
         / sum(spend) filter (where insight_date >= today - 7)
    else null end as roas_7d,
  coalesce(sum(spend), 0) as spend_30d,
  coalesce(sum(impressions), 0) as impressions_30d,
  sum(reach) as reach_30d,
  coalesce(sum(clicks), 0) as clicks_30d,
  case when sum(impressions) > 0
    then sum(clicks)::numeric / sum(impressions)
    else null end as ctr_30d,
  case when sum(clicks) > 0
    then sum(spend) / sum(clicks)
    else null end as cpc_30d,
  case when sum(impressions) > 0
    then sum(spend) / sum(impressions) * 1000
    else null end as cpm_30d,
  coalesce(sum(conversions), 0) as conversions_30d,
  coalesce(sum(purchases), 0) as purchases_30d,
  coalesce(sum(purchase_value), 0) as purchase_value_30d,
  case when sum(spend) > 0
    then sum(purchase_value) / sum(spend)
    else null end as roas_30d
from daily
group by
  ad_account_id, client_id, platform, external_account_id, account_name, currency, level, external_id, today;

comment on view public.ad_performance_summary is
  'Last 7 and 30 complete days per account, campaign, ad set and ad. Filter level = ''account'' or ''campaign''. Reach sums daily reach, so people repeat across days.';

-- ---------------------------------------------------------------------------
-- 3. Row-level security
--    Same shape as ad_accounts: admin sees everything, a future client login
--    sees only their own client's rows, visitors see nothing. Writes happen
--    from the server (secret key), which bypasses these policies.
-- ---------------------------------------------------------------------------

alter table public.ad_insights_daily enable row level security;
alter table public.ad_insight_syncs enable row level security;

create policy "view allowed ad insights" on public.ad_insights_daily
  for select to authenticated
  using (public.is_admin() or (client_id is not null and public.can_view_client(client_id)));

create policy "admin reads insight syncs" on public.ad_insight_syncs
  for select to authenticated using (public.is_admin());

revoke all on public.ad_insights_daily, public.ad_insight_syncs from anon, authenticated;
grant select on public.ad_insights_daily, public.ad_insight_syncs to authenticated;

revoke all on public.ad_performance_summary from public, anon, authenticated;
grant select on public.ad_performance_summary to authenticated, service_role;
