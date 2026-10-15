import type { DateRange } from "@/lib/dates";
import { formatCustomerId } from "@/lib/ads/display";
import { AdPlatformError, type AccountMetrics, type DailyMetrics, type DiscoveredAdAccount } from "@/lib/ads/types";

// Google Ads API (REST). Docs: developers.google.com/google-ads/api

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  version: string;
};

const SCOPES = ["https://www.googleapis.com/auth/adwords", "openid", "email"];
const MAX_PAGES = 50;

export function googleAuthUrl(cfg: GoogleConfig, redirectUri: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  // Always ask, so Google always sends a refresh token.
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
      cache: "no-store",
    });
  } catch {
    throw new AdPlatformError("Couldn't reach Google. Check your internet connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant") {
      throw new AdPlatformError("Google login has expired or was revoked. Reconnect Google on the Ad accounts page.", true);
    }
    throw new AdPlatformError(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000),
  };
}

export function exchangeGoogleCode(cfg: GoogleConfig, code: string, redirectUri: string) {
  return tokenRequest({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export function refreshGoogleToken(cfg: GoogleConfig, refreshToken: string) {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
}

export async function getGoogleUser(accessToken: string) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new AdPlatformError("Couldn't read the Google account's email address.");
  return (await res.json()) as { sub: string; email?: string };
}

type GoogleAdsErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: { errors?: { errorCode?: Record<string, string>; message?: string }[] }[];
  };
};

const FRIENDLY_GOOGLE_ERRORS: Record<string, string> = {
  DEVELOPER_TOKEN_NOT_APPROVED:
    "Your Google Ads developer token only works with test accounts so far. Apply for Basic (or Explorer) access in the Google Ads API Center.",
  DEVELOPER_TOKEN_PROHIBITED: "This Google Ads developer token can't be used with this Google Cloud project.",
  USER_PERMISSION_DENIED: "The connected Google login doesn't have access to this ad account any more.",
  CUSTOMER_NOT_ENABLED: "This Google Ads account is cancelled or suspended.",
  CUSTOMER_NOT_FOUND: "Google couldn't find this ad account.",
  RESOURCE_EXHAUSTED: "Google Ads is limiting requests right now. Try again in a few minutes.",
};

function toPlatformError(body: GoogleAdsErrorBody, status: number): AdPlatformError {
  const detail = body.error?.details?.flatMap((d) => d.errors ?? [])[0];
  const code = detail?.errorCode ? Object.values(detail.errorCode)[0] : undefined;
  if (code && FRIENDLY_GOOGLE_ERRORS[code]) return new AdPlatformError(FRIENDLY_GOOGLE_ERRORS[code]);
  if (status === 401) return new AdPlatformError("Google login has expired. Reconnect Google on the Ad accounts page.", true);
  if (status === 429) return new AdPlatformError(FRIENDLY_GOOGLE_ERRORS.RESOURCE_EXHAUSTED);
  return new AdPlatformError(`Google Ads said: ${detail?.message ?? body.error?.message ?? `request failed (${status})`}`);
}

function adsHeaders(cfg: GoogleConfig, accessToken: string, loginCustomerId?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": cfg.developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  return headers;
}

async function adsFetch<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    throw new AdPlatformError("Couldn't reach Google Ads. Check your internet connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as GoogleAdsErrorBody & T;
  if (!res.ok || body.error) throw toPlatformError(body, res.status);
  return body;
}

/** Run a GAQL query and return every row across all pages. */
export async function searchGoogleAds<T>(
  cfg: GoogleConfig,
  accessToken: string,
  customerId: string,
  loginCustomerId: string | null | undefined,
  query: string,
): Promise<T[]> {
  const url = `https://googleads.googleapis.com/${cfg.version}/customers/${customerId}/googleAds:search`;
  const rows: T[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await adsFetch<{ results?: T[]; nextPageToken?: string }>(url, {
      method: "POST",
      headers: adsHeaders(cfg, accessToken, loginCustomerId),
      body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
    });
    rows.push(...(body.results ?? []));
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return rows;
}

type CustomerClientRow = {
  customerClient?: {
    id?: string;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
    manager?: boolean;
    status?: string;
    level?: string;
  };
};

/**
 * Every advertising (non-manager) account the login can reach — directly or
 * under a manager (MCC) account. `loginCustomerId` records which top-level
 * account to go through when reading it later.
 */
export async function listGoogleAdAccounts(cfg: GoogleConfig, accessToken: string): Promise<DiscoveredAdAccount[]> {
  const { resourceNames = [] } = await adsFetch<{ resourceNames?: string[] }>(
    `https://googleads.googleapis.com/${cfg.version}/customers:listAccessibleCustomers`,
    { method: "GET", headers: adsHeaders(cfg, accessToken) },
  );

  const found = new Map<string, DiscoveredAdAccount & { level: number }>();
  let firstError: AdPlatformError | null = null;

  for (const resourceName of resourceNames) {
    const rootId = resourceName.split("/")[1];
    try {
      const rows = await searchGoogleAds<CustomerClientRow>(
        cfg,
        accessToken,
        rootId,
        rootId,
        `SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,
                customer_client.time_zone, customer_client.manager, customer_client.status, customer_client.level
         FROM customer_client`,
      );
      for (const { customerClient: c } of rows) {
        if (!c?.id || c.manager || (c.status && c.status !== "ENABLED")) continue;
        const level = Number(c.level ?? 0);
        const existing = found.get(c.id);
        if (existing && existing.level <= level) continue;
        found.set(c.id, {
          externalId: c.id,
          name: c.descriptiveName || `Google Ads ${formatCustomerId(c.id)}`,
          currency: c.currencyCode ?? null,
          timezone: c.timeZone ?? null,
          loginCustomerId: rootId,
          level,
        });
      }
    } catch (error) {
      // Cancelled or inaccessible top-level accounts are normal; skip them.
      if (!firstError && error instanceof AdPlatformError) firstError = error;
    }
  }

  if (found.size === 0 && firstError) throw firstError;
  return [...found.values()].map((account) => ({
    externalId: account.externalId,
    name: account.name,
    currency: account.currency,
    timezone: account.timezone,
    loginCustomerId: account.loginCustomerId,
  }));
}

export type GoogleBaseRow = {
  segments?: { date?: string };
  metrics?: { costMicros?: string; impressions?: string; clicks?: string };
};

export type GoogleConversionRow = {
  segments?: { date?: string; conversionActionCategory?: string };
  metrics?: { conversions?: number | string };
};

const int = (value: string | number | undefined) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function parseGoogleMetrics(baseRows: GoogleBaseRow[], conversionRows: GoogleConversionRow[]): DailyMetrics[] {
  const byDate = new Map<string, DailyMetrics>();
  const day = (date: string) => {
    let entry = byDate.get(date);
    if (!entry) {
      entry = { date, spend: 0, impressions: 0, clicks: 0, conversions: {} };
      byDate.set(date, entry);
    }
    return entry;
  };

  for (const row of baseRows) {
    if (!row.segments?.date) continue;
    const entry = day(row.segments.date);
    entry.spend += int(row.metrics?.costMicros) / 1_000_000;
    entry.impressions += int(row.metrics?.impressions);
    entry.clicks += int(row.metrics?.clicks);
  }
  for (const row of conversionRows) {
    if (!row.segments?.date) continue;
    const category = row.segments.conversionActionCategory ?? "DEFAULT";
    const entry = day(row.segments.date);
    entry.conversions[category] = (entry.conversions[category] ?? 0) + int(row.metrics?.conversions);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchGoogleAccountMetrics(
  cfg: GoogleConfig,
  accessToken: string,
  customerId: string,
  loginCustomerId: string | null,
  range: DateRange,
): Promise<AccountMetrics> {
  const during = `segments.date BETWEEN '${range.from}' AND '${range.to}'`;
  const [baseRows, conversionRows] = await Promise.all([
    searchGoogleAds<GoogleBaseRow>(
      cfg,
      accessToken,
      customerId,
      loginCustomerId,
      `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks
       FROM customer WHERE ${during}`,
    ),
    // Conversion categories (lead form, purchase, booking…) can only be
    // segmented alongside conversion metrics, hence the second query.
    searchGoogleAds<GoogleConversionRow>(
      cfg,
      accessToken,
      customerId,
      loginCustomerId,
      `SELECT segments.date, segments.conversion_action_category, metrics.conversions
       FROM customer WHERE ${during} AND metrics.conversions > 0`,
    ),
  ]);

  return { daily: parseGoogleMetrics(baseRows, conversionRows), reach: null };
}
