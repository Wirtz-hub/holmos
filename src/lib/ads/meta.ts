import { createHmac } from "node:crypto";
import type { DateRange } from "@/lib/dates";
import { AdPlatformError, type AccountMetrics, type DailyMetrics, type DiscoveredAdAccount } from "@/lib/ads/types";

// Meta Marketing API (Graph API). Docs: developers.facebook.com/docs/marketing-api

export type MetaConfig = { appId: string; appSecret: string; version: string; loginConfigId?: string };

const MAX_PAGES = 25;

export function metaAuthUrl(cfg: MetaConfig, redirectUri: string, state: string) {
  const url = new URL(`https://www.facebook.com/${cfg.version}/dialog/oauth`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  // Business-type Meta apps use "Facebook Login for Business" configurations.
  if (cfg.loginConfigId) url.searchParams.set("config_id", cfg.loginConfigId);
  else url.searchParams.set("scope", "ads_read,business_management");
  return url.toString();
}

type GraphError = { message?: string; code?: number; error_subcode?: number; type?: string };

function toPlatformError(error: GraphError | undefined, status: number): AdPlatformError {
  const code = error?.code;
  if (code === 190 || code === 102 || status === 401) {
    return new AdPlatformError("Meta login has expired or was revoked. Reconnect Meta on the Ad accounts page.", true);
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80004) {
    return new AdPlatformError("Meta is limiting requests right now. Try again in a few minutes.");
  }
  if (code === 10 || code === 200 || code === 275) {
    return new AdPlatformError("The connected Meta login doesn't have permission to read this ad account.");
  }
  return new AdPlatformError(`Meta said: ${error?.message ?? `request failed (${status})`}`);
}

async function graph<T>(cfg: MetaConfig, url: URL, accessToken?: string): Promise<T> {
  const headers: HeadersInit = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
    url.searchParams.set("appsecret_proof", createHmac("sha256", cfg.appSecret).update(accessToken).digest("hex"));
  }
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch {
    throw new AdPlatformError("Couldn't reach Meta. Check your internet connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: GraphError } & T;
  if (!res.ok || body.error) throw toPlatformError(body.error, res.status);
  return body;
}

async function graphAll<T>(cfg: MetaConfig, url: URL, accessToken: string): Promise<T[]> {
  const items: T[] = [];
  let next: URL | null = url;
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const body: { data?: T[]; paging?: { next?: string } } = await graph(cfg, next, accessToken);
    items.push(...(body.data ?? []));
    next = body.paging?.next ? new URL(body.paging.next) : null;
    // Never forward a token that Meta may have echoed into the next-page URL.
    next?.searchParams.delete("access_token");
  }
  return items;
}

const graphUrl = (cfg: MetaConfig, path: string, params: Record<string, string> = {}) => {
  const url = new URL(`https://graph.facebook.com/${cfg.version}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
};

/** Swap the login code for a long-lived (~60 day) user token. */
export async function exchangeMetaCode(cfg: MetaConfig, code: string, redirectUri: string) {
  const short = await graph<{ access_token: string }>(
    cfg,
    graphUrl(cfg, "oauth/access_token", {
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      redirect_uri: redirectUri,
      code,
    }),
  );
  const long = await graph<{ access_token: string; expires_in?: number }>(
    cfg,
    graphUrl(cfg, "oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: short.access_token,
    }),
  );
  return {
    accessToken: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
  };
}

export async function getMetaUser(cfg: MetaConfig, accessToken: string) {
  return graph<{ id: string; name?: string }>(cfg, graphUrl(cfg, "me", { fields: "id,name" }), accessToken);
}

type MetaAdAccountRow = {
  account_id: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
};

const ACCOUNT_FIELDS = "account_id,name,currency,timezone_name,account_status";
const CLOSED = 101;

/** Every ad account the login can reach: personally, or through a Business Manager. */
export async function listMetaAdAccounts(cfg: MetaConfig, accessToken: string): Promise<DiscoveredAdAccount[]> {
  const rows = await graphAll<MetaAdAccountRow>(
    cfg,
    graphUrl(cfg, "me/adaccounts", { fields: ACCOUNT_FIELDS, limit: "200" }),
    accessToken,
  );

  try {
    const businesses = await graphAll<{ id: string }>(
      cfg,
      graphUrl(cfg, "me/businesses", { fields: "id", limit: "100" }),
      accessToken,
    );
    for (const business of businesses) {
      for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
        try {
          rows.push(
            ...(await graphAll<MetaAdAccountRow>(
              cfg,
              graphUrl(cfg, `${business.id}/${edge}`, { fields: ACCOUNT_FIELDS, limit: "200" }),
              accessToken,
            )),
          );
        } catch {
          // Missing business permission for this edge — personal access still counts.
        }
      }
    }
  } catch {
    // business_management not granted — fall back to personally assigned accounts.
  }

  const unique = new Map<string, DiscoveredAdAccount>();
  for (const row of rows) {
    if (!row.account_id || row.account_status === CLOSED || unique.has(row.account_id)) continue;
    unique.set(row.account_id, {
      externalId: row.account_id,
      name: row.name || `Ad account ${row.account_id}`,
      currency: row.currency ?? null,
      timezone: row.timezone_name ?? null,
    });
  }
  return [...unique.values()];
}

export type MetaInsightRow = {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  reach?: string;
  actions?: { action_type: string; value: string }[];
};

const num = (value: string | number | undefined) => {
  const n = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(n) ? n : 0;
};

export function parseMetaInsights(rows: MetaInsightRow[]): DailyMetrics[] {
  return rows.map((row) => {
    const conversions: Record<string, number> = {};
    for (const action of row.actions ?? []) conversions[action.action_type] = num(action.value);
    return {
      date: row.date_start,
      spend: num(row.spend),
      impressions: num(row.impressions),
      // Link clicks match what clients mean by "clicks" (and Google's definition) better than all clicks.
      clicks: row.inline_link_clicks !== undefined ? num(row.inline_link_clicks) : num(row.clicks),
      conversions,
    };
  });
}

export async function fetchMetaAccountMetrics(
  cfg: MetaConfig,
  accessToken: string,
  externalAccountId: string,
  range: DateRange,
): Promise<AccountMetrics> {
  const common = {
    level: "account",
    time_range: JSON.stringify({ since: range.from, until: range.to }),
    use_account_attribution_setting: "true",
    limit: "500",
  };
  const path = `act_${externalAccountId}/insights`;

  const [dailyRows, totalRows] = await Promise.all([
    graphAll<MetaInsightRow>(
      cfg,
      graphUrl(cfg, path, {
        ...common,
        fields: "spend,impressions,clicks,inline_link_clicks,actions",
        time_increment: "1",
      }),
      accessToken,
    ),
    // Reach only makes sense over the whole range (people aren't additive across days).
    graphAll<MetaInsightRow>(cfg, graphUrl(cfg, path, { ...common, fields: "reach" }), accessToken),
  ]);

  return {
    daily: parseMetaInsights(dailyRows),
    reach: totalRows.length ? num(totalRows[0].reach) : 0,
  };
}
