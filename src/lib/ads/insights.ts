import { addDays, daysBetween, type DateRange } from "@/lib/dates";
import { META_RESULT_ACTIONS } from "@/lib/ads/results";
import type { InsightLevel } from "@/lib/ads/types";

/**
 * One day of one entity, ready to upsert. `conversions` and `purchases` are the
 * same number: purchase events, with Meta's overlapping action types counted
 * once. Leads and other events stay in `actions` so a goal change never needs
 * a re-fetch. CTR is a ratio (clicks / impressions), not a percentage.
 */
export type InsightDraft = {
  level: InsightLevel;
  externalId: string;
  parentExternalId: string | null;
  name: string;
  date: string;
  spend: number;
  impressions: number;
  reach: number | null;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number;
  purchases: number;
  purchaseValue: number;
  roas: number | null;
  actions: Record<string, number>;
  actionValues: Record<string, number>;
};

export type AccountSyncStatus = "synced" | "error" | "skipped";

export type AccountSyncOutcome = {
  accountId: string;
  name: string;
  platform: "meta" | "google";
  status: AccountSyncStatus;
  rows: number;
  message: string | null;
  range: DateRange | null;
  needsReconnect?: boolean;
};

/** First successful run. Inclusive, ending yesterday. */
export const BACKFILL_DAYS = 30;
/** Later runs. Meta keeps revising the most recent days. */
export const REFRESH_DAYS = 7;

const AD_CHUNK_DAYS = 7;
const UPPER_CHUNK_DAYS = 31;

export function insightWindow(today: string, mode: "backfill" | "refresh"): DateRange {
  const days = mode === "backfill" ? BACKFILL_DAYS : REFRESH_DAYS;
  return { from: addDays(today, -days), to: addDays(today, -1) };
}

export function syncMode(backfilledAt: string | null, forceBackfill: boolean): "backfill" | "refresh" {
  return forceBackfill || !backfilledAt ? "backfill" : "refresh";
}

/** Ad and ad-set rows are the bulky ones, so those requests stay short. */
export function chunkDays(level: InsightLevel) {
  return level === "ad" || level === "adset" ? AD_CHUNK_DAYS : UPPER_CHUNK_DAYS;
}

export function chunkRange(range: DateRange, size: number): DateRange[] {
  if (size < 1) throw new Error("Chunk size must be at least 1.");
  const chunks: DateRange[] = [];
  let from = range.from;
  while (from <= range.to) {
    const tentative = addDays(from, size - 1);
    const to = tentative < range.to ? tentative : range.to;
    chunks.push({ from, to });
    if (to >= range.to) break;
    from = addDays(to, 1);
  }
  return chunks;
}

/**
 * Google's daily sync stays off until someone opts in. The fetch code is real,
 * but production has no Google login yet and a developer token still needs
 * Explorer or Basic access before it can read client accounts.
 */
export function googleInsightsBlocker(): string | null {
  const flag = (process.env.GOOGLE_ADS_INSIGHTS_ENABLED ?? "").trim();
  const token = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "").trim();
  if (flag !== "true") {
    return "Google Ads daily sync is switched off. Set GOOGLE_ADS_INSIGHTS_ENABLED=true after the developer token has Explorer or Basic access.";
  }
  if (!token) return "GOOGLE_ADS_DEVELOPER_TOKEN is not set.";
  return null;
}

export function isMissingInsightsTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /ad_insight_syncs|ad_insights_daily|ad_performance_summary/.test(error.message ?? "")
  );
}

export function describeSync(outcomes: AccountSyncOutcome[]): string {
  if (outcomes.length === 0) return "No active ad accounts to sync.";
  return outcomes
    .map((outcome) => {
      if (outcome.status === "synced") {
        const range = outcome.range ? ` for ${outcome.range.from} to ${outcome.range.to}` : "";
        const noun = outcome.rows === 1 ? "row" : "rows";
        return `${outcome.name}: saved ${outcome.rows} ${noun}${range}.`;
      }
      if (outcome.status === "skipped") return `${outcome.name}: skipped. ${outcome.message ?? ""}`.trim();
      return `${outcome.name}: ${outcome.message ?? "Couldn't sync this account."}`;
    })
    .join(" ");
}

export function splitRange(range: DateRange): [DateRange, DateRange] | null {
  const span = daysBetween(range.from, range.to);
  if (span < 1) return null;
  const mid = addDays(range.from, Math.floor(span / 2));
  return [
    { from: range.from, to: mid },
    { from: addDays(mid, 1), to: range.to },
  ];
}

type Action = { action_type?: string; value?: string };

export type MetaInsightEntity = {
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: Action[];
  action_values?: Action[];
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
};

export type GoogleInsightEntity = {
  segments?: { date?: string; conversionActionCategory?: string };
  metrics?: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    conversions?: number | string;
    conversionsValue?: number | string;
  };
  customer?: { id?: string | number; descriptiveName?: string };
  campaign?: { id?: string | number; name?: string };
  adGroup?: { id?: string | number; name?: string };
  adGroupAd?: { ad?: { id?: string | number; name?: string } };
};

const num = (value: string | number | undefined) => {
  const n = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
};

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const textId = (value: string | number | undefined) => (value === undefined ? "" : String(value));

function actionMap(list: Action[] | undefined) {
  const out: Record<string, number> = {};
  for (const item of list ?? []) {
    if (!item.action_type) continue;
    out[item.action_type] = (out[item.action_type] ?? 0) + num(item.value);
  }
  return out;
}

function sumKeys(source: Record<string, number>, keys: string[]) {
  return keys.reduce((total, key) => total + (source[key] ?? 0), 0);
}

/** First Meta purchase group the row actually reports, so overlapping types aren't added together. */
function metaPurchaseKeys(actions: Record<string, number>) {
  return (
    META_RESULT_ACTIONS.purchase.find((keys) => keys.some((key) => (actions[key] ?? 0) > 0)) ??
    META_RESULT_ACTIONS.purchase[0]
  );
}

function ratios(spend: number, impressions: number, clicks: number, purchaseValue: number) {
  return {
    ctr: impressions > 0 ? round(clicks / impressions, 6) : null,
    cpc: clicks > 0 ? round(spend / clicks, 4) : null,
    cpm: impressions > 0 ? round((spend / impressions) * 1000, 4) : null,
    roas: spend > 0 ? round(purchaseValue / spend, 4) : null,
  };
}

function draft(input: {
  level: InsightLevel;
  externalId: string;
  parentExternalId: string | null;
  name: string;
  date: string;
  spend: number;
  impressions: number;
  reach: number | null;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  actions: Record<string, number>;
  actionValues: Record<string, number>;
}): InsightDraft {
  const spend = round(input.spend, 4);
  const purchaseValue = round(input.purchaseValue, 4);
  const purchases = round(input.purchases, 4);
  const impressions = Math.round(input.impressions);
  const clicks = Math.round(input.clicks);
  return {
    level: input.level,
    externalId: input.externalId,
    parentExternalId: input.parentExternalId,
    name: input.name.slice(0, 500),
    date: input.date,
    spend,
    impressions,
    reach: input.reach === null ? null : Math.round(input.reach),
    clicks,
    ...ratios(spend, impressions, clicks, purchaseValue),
    conversions: purchases,
    purchases,
    purchaseValue,
    actions: input.actions,
    actionValues: input.actionValues,
  };
}

function metaIdentity(
  level: InsightLevel,
  row: MetaInsightEntity,
  account: { externalId: string; name: string },
): { externalId: string; name: string; parentExternalId: string | null } | null {
  if (level === "account") {
    return { externalId: account.externalId, name: row.account_name || account.name, parentExternalId: null };
  }
  if (level === "campaign" && row.campaign_id) {
    return { externalId: row.campaign_id, name: row.campaign_name || `Campaign ${row.campaign_id}`, parentExternalId: null };
  }
  if (level === "adset" && row.adset_id) {
    return {
      externalId: row.adset_id,
      name: row.adset_name || `Ad set ${row.adset_id}`,
      parentExternalId: row.campaign_id ?? null,
    };
  }
  if (level === "ad" && row.ad_id) {
    return { externalId: row.ad_id, name: row.ad_name || `Ad ${row.ad_id}`, parentExternalId: row.adset_id ?? null };
  }
  return null;
}

export function parseMetaInsightRows(
  level: InsightLevel,
  rows: MetaInsightEntity[],
  account: { externalId: string; name: string },
): InsightDraft[] {
  const byKey = new Map<string, InsightDraft>();
  for (const row of rows) {
    if (!row.date_start) continue;
    const identity = metaIdentity(level, row, account);
    if (!identity) continue;
    const actions = actionMap(row.actions);
    const actionValues = actionMap(row.action_values);
    const keys = metaPurchaseKeys(actions);
    const clicks = row.inline_link_clicks !== undefined ? num(row.inline_link_clicks) : num(row.clicks);
    byKey.set(
      `${identity.externalId}|${row.date_start}`,
      draft({
        level,
        ...identity,
        date: row.date_start,
        spend: num(row.spend),
        impressions: num(row.impressions),
        reach: row.reach === undefined ? null : num(row.reach),
        clicks,
        purchases: sumKeys(actions, keys),
        purchaseValue: sumKeys(actionValues, keys),
        actions,
        actionValues,
      }),
    );
  }
  return [...byKey.values()];
}

function googleIdentity(
  level: InsightLevel,
  row: GoogleInsightEntity,
  customerId: string,
): { externalId: string; name: string; parentExternalId: string | null } | null {
  if (level === "account") {
    return {
      externalId: customerId,
      name: row.customer?.descriptiveName || `Google Ads ${customerId}`,
      parentExternalId: null,
    };
  }
  const campaignId = textId(row.campaign?.id);
  if (level === "campaign" && campaignId) {
    return { externalId: campaignId, name: row.campaign?.name || `Campaign ${campaignId}`, parentExternalId: null };
  }
  const adGroupId = textId(row.adGroup?.id);
  if (level === "adset" && adGroupId) {
    return {
      externalId: adGroupId,
      name: row.adGroup?.name || `Ad group ${adGroupId}`,
      parentExternalId: campaignId || null,
    };
  }
  const adId = textId(row.adGroupAd?.ad?.id);
  if (level === "ad" && adId) {
    return {
      externalId: adId,
      name: row.adGroupAd?.ad?.name || `Ad ${adId}`,
      parentExternalId: adGroupId || null,
    };
  }
  return null;
}

const GOOGLE_PURCHASES = ["PURCHASE", "STORE_SALE"];

export function parseGoogleInsightRows(
  level: InsightLevel,
  customerId: string,
  baseRows: GoogleInsightEntity[],
  conversionRows: GoogleInsightEntity[],
): InsightDraft[] {
  const byKey = new Map<string, InsightDraft>();

  const ensure = (row: GoogleInsightEntity, date: string) => {
    const identity = googleIdentity(level, row, customerId);
    if (!identity) return null;
    const key = `${identity.externalId}|${date}`;
    let existing = byKey.get(key);
    if (!existing) {
      existing = draft({
        level,
        ...identity,
        date,
        spend: 0,
        impressions: 0,
        reach: null,
        clicks: 0,
        purchases: 0,
        purchaseValue: 0,
        actions: {},
        actionValues: {},
      });
      byKey.set(key, existing);
    }
    return existing;
  };

  for (const row of baseRows) {
    const date = row.segments?.date;
    if (!date) continue;
    const entry = ensure(row, date);
    if (!entry) continue;
    entry.spend = round(entry.spend + num(row.metrics?.costMicros) / 1_000_000, 4);
    entry.impressions += Math.round(num(row.metrics?.impressions));
    entry.clicks += Math.round(num(row.metrics?.clicks));
  }

  for (const row of conversionRows) {
    const date = row.segments?.date;
    if (!date) continue;
    const entry = ensure(row, date);
    if (!entry) continue;
    const category = row.segments?.conversionActionCategory || "DEFAULT";
    const conversions = num(row.metrics?.conversions);
    const value = num(row.metrics?.conversionsValue);
    entry.actions[category] = round((entry.actions[category] ?? 0) + conversions, 4);
    entry.actionValues[category] = round((entry.actionValues[category] ?? 0) + value, 4);
  }

  return [...byKey.values()].map((entry) => {
    const purchases = sumKeys(entry.actions, GOOGLE_PURCHASES);
    const purchaseValue = sumKeys(entry.actionValues, GOOGLE_PURCHASES);
    return draft({ ...entry, purchases, purchaseValue });
  });
}
