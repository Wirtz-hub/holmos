import type { Goal, Platform } from "@/lib/types";
import type { DailyMetrics } from "@/lib/ads/types";

/** Per-client settings that decide what counts as a "result". */
export type ResultSettings = {
  goal: Goal;
  metaResultAction?: string | null;
  googleCountAllConversions?: boolean;
};

/**
 * Meta reports the same conversion under several overlapping action types
 * (e.g. "lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"
 * often carry the same people). Summing them double-counts, so we use the
 * first group in this list that the account actually reports.
 */
export const META_RESULT_ACTIONS: Record<Goal, string[][]> = {
  lead: [
    ["lead"],
    ["onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"],
    ["leadgen_grouped"],
    ["onsite_conversion.lead"],
  ],
  purchase: [["omni_purchase"], ["purchase"], ["offsite_conversion.fb_pixel_purchase"], ["onsite_web_purchase"]],
  booking: [["schedule_total"], ["schedule_website"], ["offsite_conversion.fb_pixel_schedule"], ["schedule"]],
};

/** Google Ads conversion action categories that count towards each goal. */
export const GOOGLE_RESULT_CATEGORIES: Record<Goal, string[]> = {
  lead: [
    "SUBMIT_LEAD_FORM",
    "PHONE_CALL_LEAD",
    "IMPORTED_LEAD",
    "QUALIFIED_LEAD",
    "CONVERTED_LEAD",
    "CONTACT",
    "REQUEST_QUOTE",
    "SIGNUP",
    "LEAD",
  ],
  purchase: ["PURCHASE", "STORE_SALE"],
  booking: ["BOOK_APPOINTMENT"],
};

function sumKeys(conversions: Record<string, number>, keys: string[]) {
  return keys.reduce((total, key) => total + (conversions[key] ?? 0), 0);
}

/**
 * Decide, once per account and range, which conversion keys count as results.
 * Choosing per account (not per day) keeps a day-by-day chart consistent.
 */
export function resultKeysFor(platform: Platform, daily: DailyMetrics[], settings: ResultSettings): string[] | "all" {
  if (platform === "google") {
    return settings.googleCountAllConversions ? "all" : GOOGLE_RESULT_CATEGORIES[settings.goal];
  }

  const override = settings.metaResultAction?.trim();
  if (override) return [override];

  const reported = new Set<string>();
  for (const day of daily) {
    for (const [key, value] of Object.entries(day.conversions)) if (value > 0) reported.add(key);
  }
  const group = META_RESULT_ACTIONS[settings.goal].find((keys) => keys.some((key) => reported.has(key)));
  return group ?? META_RESULT_ACTIONS[settings.goal][0];
}

export function countResults(conversions: Record<string, number>, keys: string[] | "all"): number {
  if (keys === "all") return Object.values(conversions).reduce((total, value) => total + value, 0);
  return sumKeys(conversions, keys);
}
