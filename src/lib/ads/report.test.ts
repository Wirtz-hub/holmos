import { describe, expect, it } from "vitest";
import { buildClientReport } from "@/lib/ads/report";
import type { AccountFetchResult } from "@/lib/ads/types";

const range = { from: "2026-10-01", to: "2026-10-03" };

const meta: AccountFetchResult = {
  accountId: "a1",
  externalId: "111",
  name: "Clinic — Meta",
  platform: "meta",
  currency: "DKK",
  error: null,
  needsReconnect: false,
  metrics: {
    reach: 900,
    daily: [
      { date: "2026-10-01", spend: 100, impressions: 1000, clicks: 20, conversions: { lead: 2, link_click: 20 } },
      { date: "2026-10-03", spend: 50, impressions: 500, clicks: 5, conversions: { lead: 1 } },
    ],
  },
};

const google: AccountFetchResult = {
  accountId: "a2",
  externalId: "2223334444",
  name: "Clinic — Google",
  platform: "google",
  currency: "DKK",
  error: null,
  needsReconnect: false,
  metrics: {
    reach: null,
    daily: [{ date: "2026-10-02", spend: 150, impressions: 500, clicks: 25, conversions: { SUBMIT_LEAD_FORM: 3, PURCHASE: 9 } }],
  },
};

describe("buildClientReport", () => {
  it("adds up both platforms into one set of totals", () => {
    const report = buildClientReport([meta, google], { goal: "lead" }, range);
    expect(report.groups).toHaveLength(1);
    const totals = report.groups[0].totals;
    expect(totals.spend).toBe(300);
    expect(totals.impressions).toBe(2000);
    expect(totals.clicks).toBe(50);
    expect(totals.ctr).toBeCloseTo(0.025);
    expect(totals.results).toBe(6); // 3 Meta leads + 3 Google lead forms (purchases ignored)
    expect(totals.costPerResult).toBe(50);
    expect(totals.reach).toBe(900);
  });

  it("fills every day in the range, split by platform, for the chart", () => {
    const { daily } = buildClientReport([meta, google], { goal: "lead" }, range).groups[0];
    expect(daily.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(daily[1]).toEqual({
      date: "2026-10-02",
      meta: { spend: 0, impressions: 0, clicks: 0, results: 0 },
      google: { spend: 150, impressions: 500, clicks: 25, results: 3 },
    });
  });

  it("never adds different currencies together", () => {
    const eur = { ...google, accountId: "a3", currency: "EUR" };
    const report = buildClientReport([meta, eur], { goal: "lead" }, range);
    expect(report.groups.map((g) => [g.currency, g.totals.spend])).toEqual([
      ["DKK", 150],
      ["EUR", 150],
    ]);
  });

  it("leaves failed accounts out of the totals but lists them with their error", () => {
    const broken: AccountFetchResult = { ...google, metrics: null, error: "Google login has expired.", needsReconnect: true };
    const report = buildClientReport([meta, broken], { goal: "lead" }, range);
    expect(report.groups[0].totals.spend).toBe(150);
    expect(report.accounts.find((a) => a.accountId === "a2")).toMatchObject({ totals: null, needsReconnect: true });
  });

  it("reports no cost per result when there are no results", () => {
    const report = buildClientReport([meta], { goal: "booking" }, range);
    expect(report.groups[0].totals.results).toBe(0);
    expect(report.groups[0].totals.costPerResult).toBeNull();
  });
});
