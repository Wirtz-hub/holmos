import { afterEach, describe, expect, it, vi } from "vitest";
import { daysBetween } from "@/lib/dates";
import {
  BACKFILL_DAYS,
  REFRESH_DAYS,
  chunkRange,
  describeSync,
  googleInsightsBlocker,
  insightWindow,
  isMissingInsightsTable,
  parseGoogleInsightRows,
  parseMetaInsightRows,
  splitRange,
  syncMode,
} from "@/lib/ads/insights";

afterEach(() => vi.unstubAllEnvs());

describe("insight windows", () => {
  it("backfills 30 complete days and later refreshes the last 7", () => {
    const backfill = insightWindow("2026-11-09", "backfill");
    const refresh = insightWindow("2026-11-09", "refresh");
    expect(backfill).toEqual({ from: "2026-10-10", to: "2026-11-08" });
    expect(daysBetween(backfill.from, backfill.to) + 1).toBe(BACKFILL_DAYS);
    expect(refresh).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(daysBetween(refresh.from, refresh.to) + 1).toBe(REFRESH_DAYS);
    expect(syncMode(null, false)).toBe("backfill");
    expect(syncMode("2026-11-01T00:00:00.000Z", false)).toBe("refresh");
    expect(syncMode("2026-11-01T00:00:00.000Z", true)).toBe("backfill");
  });

  it("splits a range in half and chunks ad-level dates into weeks", () => {
    expect(splitRange({ from: "2026-11-01", to: "2026-11-01" })).toBeNull();
    expect(splitRange({ from: "2026-11-01", to: "2026-11-08" })).toEqual([
      { from: "2026-11-01", to: "2026-11-04" },
      { from: "2026-11-05", to: "2026-11-08" },
    ]);
    expect(chunkRange({ from: "2026-11-01", to: "2026-11-10" }, 7)).toEqual([
      { from: "2026-11-01", to: "2026-11-07" },
      { from: "2026-11-08", to: "2026-11-10" },
    ]);
  });
});

describe("parseMetaInsightRows", () => {
  it("counts a purchase once, prefers link clicks, and derives CTR, CPC, CPM and ROAS", () => {
    const [row] = parseMetaInsightRows(
      "ad",
      [
        {
          date_start: "2026-10-01",
          campaign_id: "c1",
          adset_id: "s1",
          ad_id: "a1",
          ad_name: "Video",
          spend: "100",
          impressions: "1000",
          reach: "800",
          clicks: "80",
          inline_link_clicks: "25",
          actions: [
            { action_type: "omni_purchase", value: "2" },
            { action_type: "purchase", value: "2" },
            { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
            { action_type: "lead", value: "4" },
          ],
          action_values: [
            { action_type: "omni_purchase", value: "250" },
            { action_type: "purchase", value: "250" },
          ],
        },
      ],
      { externalId: "123", name: "Clinic" },
    );

    expect(row).toMatchObject({
      level: "ad",
      externalId: "a1",
      parentExternalId: "s1",
      name: "Video",
      date: "2026-10-01",
      spend: 100,
      impressions: 1000,
      reach: 800,
      clicks: 25,
      ctr: 0.025,
      cpc: 4,
      cpm: 100,
      purchases: 2,
      conversions: 2,
      purchaseValue: 250,
      roas: 2.5,
    });
    expect(row.actions.lead).toBe(4);
  });

  it("uses the account id for account-level rows and reports zero ROAS when nothing was bought", () => {
    const [row] = parseMetaInsightRows(
      "account",
      [{ date_start: "2026-10-02", spend: "10", impressions: "0", clicks: "0" }],
      { externalId: "123", name: "Clinic" },
    );
    expect(row.externalId).toBe("123");
    expect(row.name).toBe("Clinic");
    expect(row.ctr).toBeNull();
    expect(row.cpc).toBeNull();
    expect(row.roas).toBe(0);
    expect(row.reach).toBeNull();
  });
});

describe("parseGoogleInsightRows", () => {
  it("turns micros into spend and counts purchase categories without adding other conversions", () => {
    const [row] = parseGoogleInsightRows(
      "campaign",
      "1234567890",
      [{ segments: { date: "2026-10-01" }, campaign: { id: "55", name: "Search" }, metrics: { costMicros: "5000000", impressions: "100", clicks: "10" } }],
      [
        { segments: { date: "2026-10-01", conversionActionCategory: "PURCHASE" }, campaign: { id: "55" }, metrics: { conversions: 1, conversionsValue: 20 } },
        { segments: { date: "2026-10-01", conversionActionCategory: "SUBMIT_LEAD_FORM" }, campaign: { id: "55" }, metrics: { conversions: 3, conversionsValue: 0 } },
      ],
    );
    expect(row).toMatchObject({
      level: "campaign",
      externalId: "55",
      name: "Search",
      spend: 5,
      impressions: 100,
      clicks: 10,
      reach: null,
      ctr: 0.1,
      cpc: 0.5,
      cpm: 50,
      purchases: 1,
      conversions: 1,
      purchaseValue: 20,
      roas: 4,
    });
    expect(row.actions).toEqual({ PURCHASE: 1, SUBMIT_LEAD_FORM: 3 });
  });
});

describe("googleInsightsBlocker", () => {
  it("stays off until the flag and a developer token are both set", () => {
    vi.stubEnv("GOOGLE_ADS_INSIGHTS_ENABLED", "");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "token");
    expect(googleInsightsBlocker()).toMatch(/switched off/);
    vi.stubEnv("GOOGLE_ADS_INSIGHTS_ENABLED", "true");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "  ");
    expect(googleInsightsBlocker()).toMatch(/GOOGLE_ADS_DEVELOPER_TOKEN/);
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "token");
    expect(googleInsightsBlocker()).toBeNull();
  });
});

describe("describeSync", () => {
  it("describes a mixed run in one sentence per account", () => {
    expect(
      describeSync([
        { accountId: "1", name: "Clinic", platform: "meta", status: "synced", rows: 1, message: null, range: { from: "2026-10-10", to: "2026-11-08" } },
        { accountId: "2", name: "Search", platform: "google", status: "skipped", rows: 0, message: "Switched off.", range: null },
      ]),
    ).toBe("Clinic: saved 1 row for 2026-10-10 to 2026-11-08. Search: skipped. Switched off.");
  });
});

describe("isMissingInsightsTable", () => {
  it("recognises a migration that has not been run", () => {
    expect(isMissingInsightsTable(null)).toBe(false);
    expect(isMissingInsightsTable({ code: "42P01", message: "missing" })).toBe(true);
    expect(isMissingInsightsTable({ message: 'relation "public.ad_insight_syncs" does not exist' })).toBe(true);
    expect(isMissingInsightsTable({ code: "42501", message: "permission denied" })).toBe(false);
  });
});
