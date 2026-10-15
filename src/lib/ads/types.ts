import type { Platform } from "@/lib/types";

/** One day of performance for one ad account, as the platform reported it. */
export type DailyMetrics = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  /**
   * Raw conversion counts keyed by the platform's own name for them:
   * Meta action types ("lead", "omni_purchase", …) or Google Ads conversion
   * categories ("SUBMIT_LEAD_FORM", "PURCHASE", …). Mapping these to the
   * client's goal happens later, so changing the goal never needs a re-fetch.
   */
  conversions: Record<string, number>;
};

export type AccountMetrics = {
  daily: DailyMetrics[];
  /** Unique people reached over the whole range (Meta only). */
  reach: number | null;
};

export type AccountFetchResult = {
  accountId: string;
  externalId: string;
  name: string;
  platform: Platform;
  currency: string;
  metrics: AccountMetrics | null;
  error: string | null;
  needsReconnect: boolean;
};

export class AdPlatformError extends Error {
  constructor(
    message: string,
    readonly needsReconnect = false,
  ) {
    super(message);
    this.name = "AdPlatformError";
  }
}

export type DiscoveredAdAccount = {
  externalId: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  loginCustomerId?: string | null;
};
