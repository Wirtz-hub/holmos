import { describe, expect, it } from "vitest";
import { countResults, resultKeysFor } from "@/lib/ads/results";
import type { DailyMetrics } from "@/lib/ads/types";

const day = (conversions: Record<string, number>): DailyMetrics => ({
  date: "2026-10-01",
  spend: 0,
  impressions: 0,
  clicks: 0,
  conversions,
});

describe("resultKeysFor — Meta", () => {
  it("uses the aggregate 'lead' action and never adds its overlapping variants", () => {
    const daily = [day({ lead: 5, "offsite_conversion.fb_pixel_lead": 3, "onsite_conversion.lead_grouped": 2, link_click: 40 })];
    const keys = resultKeysFor("meta", daily, { goal: "lead" });
    expect(keys).toEqual(["lead"]);
    expect(countResults(daily[0].conversions, keys)).toBe(5);
  });

  it("falls back to form leads + website leads when there is no aggregate", () => {
    const daily = [day({ "offsite_conversion.fb_pixel_lead": 3, "onsite_conversion.lead_grouped": 2 })];
    const keys = resultKeysFor("meta", daily, { goal: "lead" });
    expect(countResults(daily[0].conversions, keys)).toBe(5);
  });

  it("chooses one action group for the whole range, even if some days lack it", () => {
    const daily = [day({ omni_purchase: 2, purchase: 2 }), day({})];
    expect(resultKeysFor("meta", daily, { goal: "purchase" })).toEqual(["omni_purchase"]);
  });

  it("respects a per-client override for custom conversions", () => {
    const daily = [day({ lead: 9, "offsite_conversion.custom.123": 4 })];
    const keys = resultKeysFor("meta", daily, { goal: "booking", metaResultAction: " offsite_conversion.custom.123 " });
    expect(countResults(daily[0].conversions, keys)).toBe(4);
  });

  it("counts zero (not someone else's goal) when the goal's action isn't reported", () => {
    const daily = [day({ lead: 9 })];
    expect(countResults(daily[0].conversions, resultKeysFor("meta", daily, { goal: "booking" }))).toBe(0);
  });
});

describe("resultKeysFor — Google", () => {
  it("maps conversion categories to the client's goal", () => {
    const conversions = { SUBMIT_LEAD_FORM: 3, PHONE_CALL_LEAD: 2, PURCHASE: 7, PAGE_VIEW: 100 };
    expect(countResults(conversions, resultKeysFor("google", [], { goal: "lead" }))).toBe(5);
    expect(countResults(conversions, resultKeysFor("google", [], { goal: "purchase" }))).toBe(7);
    expect(countResults(conversions, resultKeysFor("google", [], { goal: "booking" }))).toBe(0);
  });

  it("can count every conversion when the client opts in", () => {
    const conversions = { DEFAULT: 4, PURCHASE: 1.5 };
    expect(countResults(conversions, resultKeysFor("google", [], { goal: "lead", googleCountAllConversions: true }))).toBe(5.5);
  });
});
