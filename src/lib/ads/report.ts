import { eachDay, type DateRange } from "@/lib/dates";
import type { Platform } from "@/lib/types";
import { countResults, resultKeysFor, type ResultSettings } from "@/lib/ads/results";
import type { AccountFetchResult, DailyMetrics } from "@/lib/ads/types";

export type Totals = {
  spend: number;
  impressions: number;
  reach: number | null;
  clicks: number;
  ctr: number | null;
  results: number;
  costPerResult: number | null;
};

export type AccountSummary = {
  accountId: string;
  externalId: string;
  name: string;
  platform: Platform;
  currency: string;
  totals: Totals | null;
  error: string | null;
  needsReconnect: boolean;
  /** Every conversion type the platform reported, with totals — for "what counts as a result?" */
  reportedConversions: Record<string, number>;
  resultKeys: string[] | "all" | null;
};

export type PlatformDay = { spend: number; impressions: number; clicks: number; results: number };
export type DayPoint = { date: string } & Record<Platform, PlatformDay>;

export type CurrencyGroup = {
  currency: string;
  platforms: Platform[];
  totals: Totals;
  daily: DayPoint[];
};

export type ClientReport = {
  range: DateRange;
  groups: CurrencyGroup[];
  accounts: AccountSummary[];
};

const emptyDay = (): PlatformDay => ({ spend: 0, impressions: 0, clicks: 0, results: 0 });

function finishTotals(t: Omit<Totals, "ctr" | "costPerResult">): Totals {
  return {
    ...t,
    ctr: t.impressions > 0 ? t.clicks / t.impressions : null,
    costPerResult: t.results > 0 ? t.spend / t.results : null,
  };
}

function sumDaily(daily: DailyMetrics[], keys: string[] | "all") {
  return daily.reduce(
    (acc, day) => ({
      spend: acc.spend + day.spend,
      impressions: acc.impressions + day.impressions,
      clicks: acc.clicks + day.clicks,
      results: acc.results + countResults(day.conversions, keys),
    }),
    { spend: 0, impressions: 0, clicks: 0, results: 0 },
  );
}

export function buildClientReport(
  fetched: AccountFetchResult[],
  settings: ResultSettings,
  range: DateRange,
): ClientReport {
  const days = eachDay(range);
  const accounts: AccountSummary[] = [];
  const groups = new Map<string, CurrencyGroup & { reachParts: number[] }>();

  for (const account of fetched) {
    if (!account.metrics) {
      accounts.push({
        ...pickAccount(account),
        totals: null,
        reportedConversions: {},
        resultKeys: null,
      });
      continue;
    }

    const { daily, reach } = account.metrics;
    const keys = resultKeysFor(account.platform, daily, settings);
    const sums = sumDaily(daily, keys);
    const reportedConversions: Record<string, number> = {};
    for (const day of daily) {
      for (const [key, value] of Object.entries(day.conversions)) {
        reportedConversions[key] = (reportedConversions[key] ?? 0) + value;
      }
    }

    accounts.push({
      ...pickAccount(account),
      totals: finishTotals({ ...sums, reach }),
      reportedConversions,
      resultKeys: keys,
    });

    let group = groups.get(account.currency);
    if (!group) {
      group = {
        currency: account.currency,
        platforms: [],
        totals: finishTotals({ spend: 0, impressions: 0, clicks: 0, results: 0, reach: null }),
        daily: days.map((date) => ({ date, meta: emptyDay(), google: emptyDay() })),
        reachParts: [],
      };
      groups.set(account.currency, group);
    }
    if (!group.platforms.includes(account.platform)) group.platforms.push(account.platform);
    if (reach !== null) group.reachParts.push(reach);

    const index = new Map(group.daily.map((point, i) => [point.date, i]));
    for (const day of daily) {
      const i = index.get(day.date);
      if (i === undefined) continue;
      const slot = group.daily[i][account.platform];
      slot.spend += day.spend;
      slot.impressions += day.impressions;
      slot.clicks += day.clicks;
      slot.results += countResults(day.conversions, keys);
    }

    const t = group.totals;
    group.totals = finishTotals({
      spend: t.spend + sums.spend,
      impressions: t.impressions + sums.impressions,
      clicks: t.clicks + sums.clicks,
      results: t.results + sums.results,
      // Reach can't be de-duplicated across accounts; summing is an upper bound.
      reach: group.reachParts.length ? group.reachParts.reduce((a, b) => a + b, 0) : null,
    });
  }

  const sortedGroups: CurrencyGroup[] = [...groups.values()]
    .map((group) => ({ currency: group.currency, platforms: group.platforms, totals: group.totals, daily: group.daily }))
    .sort((a, b) => b.totals.spend - a.totals.spend);

  return { range, groups: sortedGroups, accounts };
}

function pickAccount(account: AccountFetchResult) {
  return {
    accountId: account.accountId,
    externalId: account.externalId,
    name: account.name,
    platform: account.platform,
    currency: account.currency,
    error: account.error,
    needsReconnect: account.needsReconnect,
  };
}
