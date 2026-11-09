import "server-only";
import { AGENCY_TIME_ZONE, todayIn, type DateRange } from "@/lib/dates";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { googleConfig, metaConfig } from "@/lib/ads/config";
import { getAccessToken, markNeedsReconnect } from "@/lib/ads/connections";
import { fetchGoogleInsights } from "@/lib/ads/google";
import {
  chunkDays,
  chunkRange,
  describeSync,
  googleInsightsBlocker,
  insightWindow,
  isMissingInsightsTable,
  parseGoogleInsightRows,
  parseMetaInsightRows,
  splitRange,
  syncMode,
  type AccountSyncOutcome,
  type InsightDraft,
} from "@/lib/ads/insights";
import { fetchMetaInsights } from "@/lib/ads/meta";
import { AdPlatformError, InsightTruncatedError, type InsightLevel } from "@/lib/ads/types";
import type { Platform } from "@/lib/types";

// Daily copy of ad performance into Postgres.
//
// Vercel cron (not a Supabase edge function) because the OAuth tokens are
// decrypted here, with TOKEN_ENCRYPTION_KEY, by the same helpers the dashboards
// already use. A database function can't see those tokens.
//
// Read-only towards the ad platforms: Meta is fetched with GET /insights, and
// Google (only when GOOGLE_ADS_INSIGHTS_ENABLED=true) with GAQL search. This
// file never creates, edits, pauses or spends.

const LEVELS: InsightLevel[] = ["account", "campaign", "adset", "ad"];
const UPSERT_BATCH = 200;

export type SyncAdInsightsResult = {
  ok: boolean;
  skipped?: string;
  accounts: AccountSyncOutcome[];
  message: string;
};

type AccountRow = {
  id: string;
  platform: Platform;
  external_account_id: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  connection_id: string | null;
  login_customer_id: string | null;
  client_id: string | null;
};

type Admin = ReturnType<typeof createAdminClient>;

function accountToday(timezone: string | null) {
  try {
    return todayIn(timezone || AGENCY_TIME_ZONE);
  } catch {
    return todayIn(AGENCY_TIME_ZONE);
  }
}

function friendly(error: unknown) {
  if (error instanceof AdPlatformError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong syncing this account.";
}

function batches<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function record(admin: Admin, row: Record<string, unknown>) {
  const { error } = await admin.from("ad_insight_syncs").upsert(row, { onConflict: "ad_account_id" });
  if (error) throw new Error(`Couldn't save the sync status: ${error.message}`);
}

async function fetchLevel(account: AccountRow, token: string, level: InsightLevel, range: DateRange): Promise<InsightDraft[]> {
  const who = { externalId: account.external_account_id, name: account.name };
  if (account.platform === "meta") {
    const rows = await fetchMetaInsights(metaConfig(), token, account.external_account_id, level, range);
    return parseMetaInsightRows(level, rows, who);
  }
  const { base, conversions } = await fetchGoogleInsights(
    googleConfig(),
    token,
    account.external_account_id,
    account.login_customer_id,
    level,
    range,
  );
  return parseGoogleInsightRows(level, account.external_account_id, base, conversions);
}

/** Shorten the range until a single request can return every page. */
async function loadChunk(account: AccountRow, token: string, level: InsightLevel, range: DateRange): Promise<InsightDraft[]> {
  try {
    return await fetchLevel(account, token, level, range);
  } catch (error) {
    const halves = error instanceof InsightTruncatedError ? splitRange(range) : null;
    if (!halves) throw error;
    const left = await loadChunk(account, token, level, halves[0]);
    const right = await loadChunk(account, token, level, halves[1]);
    return [...left, ...right];
  }
}

async function replaceWindow(
  admin: Admin,
  account: AccountRow,
  level: InsightLevel,
  chunk: DateRange,
  drafts: InsightDraft[],
  syncedAt: string,
) {
  const unique = new Map<string, Record<string, unknown>>();
  for (const draft of drafts) {
    if (draft.date < chunk.from || draft.date > chunk.to) continue;
    unique.set(`${draft.level}|${draft.externalId}|${draft.date}`, {
      ad_account_id: account.id,
      client_id: account.client_id,
      platform: account.platform,
      level: draft.level,
      external_id: draft.externalId,
      parent_external_id: draft.parentExternalId,
      name: draft.name,
      insight_date: draft.date,
      spend: draft.spend,
      impressions: draft.impressions,
      reach: draft.reach,
      clicks: draft.clicks,
      ctr: draft.ctr,
      cpc: draft.cpc,
      cpm: draft.cpm,
      conversions: draft.conversions,
      purchases: draft.purchases,
      purchase_value: draft.purchaseValue,
      roas: draft.roas,
      currency: account.currency || "DKK",
      actions: draft.actions,
      action_values: draft.actionValues,
      synced_at: syncedAt,
    });
  }

  for (const batch of batches([...unique.values()], UPSERT_BATCH)) {
    const { error } = await admin
      .from("ad_insights_daily")
      .upsert(batch, { onConflict: "ad_account_id,level,external_id,insight_date" });
    if (error) throw new Error(`Couldn't save insights: ${error.message}`);
  }

  // Drop rows in this window that the platform no longer reports. Only runs
  // after a complete read, so a truncated response can't wipe good data.
  const { error: deleteError } = await admin
    .from("ad_insights_daily")
    .delete()
    .eq("ad_account_id", account.id)
    .eq("level", level)
    .gte("insight_date", chunk.from)
    .lte("insight_date", chunk.to)
    .lt("synced_at", syncedAt);
  if (deleteError) throw new Error(`Couldn't refresh insights: ${deleteError.message}`);
  return unique.size;
}

async function syncAccount(
  admin: Admin,
  account: AccountRow,
  token: string,
  forceBackfill: boolean,
  backfilledAt: string | null,
): Promise<AccountSyncOutcome> {
  const mode = syncMode(backfilledAt, forceBackfill);
  const range = insightWindow(accountToday(account.timezone), mode);
  const started = new Date().toISOString();
  try {
    let rows = 0;
    for (const level of LEVELS) {
      for (const chunk of chunkRange(range, chunkDays(level))) {
        const drafts = await loadChunk(account, token, level, chunk);
        rows += await replaceWindow(admin, account, level, chunk, drafts, started);
      }
    }
    await record(admin, {
      ad_account_id: account.id,
      last_attempt_at: started,
      last_success_at: started,
      last_error: null,
      last_range_from: range.from,
      last_range_to: range.to,
      rows_written: rows,
      ...(mode === "backfill" ? { backfilled_at: started } : {}),
    });
    return {
      accountId: account.id,
      name: account.name,
      platform: account.platform,
      status: "synced",
      rows,
      message: null,
      range,
    };
  } catch (error) {
    const message = friendly(error).slice(0, 500);
    if (error instanceof AdPlatformError && error.needsReconnect && account.connection_id) {
      await markNeedsReconnect(account.connection_id, message);
    }
    try {
      await record(admin, {
        ad_account_id: account.id,
        last_attempt_at: started,
        last_error: message,
        last_range_from: range.from,
        last_range_to: range.to,
      });
    } catch (writeError) {
      console.error("Couldn't store the insight sync error", writeError);
    }
    return {
      accountId: account.id,
      name: account.name,
      platform: account.platform,
      status: "error",
      rows: 0,
      message,
      range,
      needsReconnect: error instanceof AdPlatformError && error.needsReconnect,
    };
  }
}

function outcome(account: AccountRow, status: AccountSyncOutcome["status"], message: string): AccountSyncOutcome {
  return {
    accountId: account.id,
    name: account.name,
    platform: account.platform,
    status,
    rows: 0,
    message,
    range: null,
  };
}

/**
 * Copy recent performance for every active ad account.
 * The cron job passes no options: 30 days the first time an account succeeds,
 * then the last 7 days. The admin button passes `backfill` so it always
 * re-reads 30 days.
 */
export async function syncAdInsights(options?: { backfill?: boolean }): Promise<SyncAdInsightsResult> {
  const env = serverEnv();
  if (!env.supabaseSecretKey || !env.tokenEncryptionKey) {
    const missing = !env.supabaseSecretKey ? "SUPABASE_SECRET_KEY" : "TOKEN_ENCRYPTION_KEY";
    const message = `${missing} is not set.`;
    return { ok: false, skipped: message, accounts: [], message };
  }

  const admin = createAdminClient();
  const { data: accountRows, error: accountError } = await admin
    .from("ad_accounts")
    .select("id, platform, external_account_id, name, currency, timezone, connection_id, login_customer_id, client_id")
    .eq("is_active", true)
    .order("name");
  if (accountError) throw new Error(accountError.message);
  const accounts = (accountRows ?? []) as AccountRow[];
  if (accounts.length === 0) {
    const message = "No active ad accounts to sync.";
    return { ok: true, accounts: [], message };
  }

  const { data: syncRows, error: syncError } = await admin
    .from("ad_insight_syncs")
    .select("ad_account_id, backfilled_at")
    .in(
      "ad_account_id",
      accounts.map((account) => account.id),
    );
  if (isMissingInsightsTable(syncError)) {
    const message = "Run supabase/migrations/0004_ad_insights.sql in the Supabase SQL editor, then sync again.";
    return { ok: false, skipped: message, accounts: [], message };
  }
  if (syncError) throw new Error(syncError.message);

  const backfilled = new Map(
    (syncRows ?? []).map((row) => [row.ad_account_id as string, (row.backfilled_at as string | null) ?? null]),
  );
  const googleBlocker = googleInsightsBlocker();
  const outcomes: AccountSyncOutcome[] = [];
  const byConnection = new Map<string, AccountRow[]>();

  for (const account of accounts) {
    if (!account.connection_id) {
      const message = "No ad login can reach this account. Reconnect it on the Ad accounts page.";
      await record(admin, { ad_account_id: account.id, last_attempt_at: new Date().toISOString(), last_error: message });
      outcomes.push(outcome(account, "error", message));
      continue;
    }
    const group = byConnection.get(account.connection_id) ?? [];
    group.push(account);
    byConnection.set(account.connection_id, group);
  }

  for (const [connectionId, group] of byConnection) {
    const platform = group[0]?.platform;
    if (platform === "google" && googleBlocker) {
      for (const account of group) outcomes.push(outcome(account, "skipped", googleBlocker));
      continue;
    }
    if (platform === "meta" && (!env.metaAppId || !env.metaAppSecret)) {
      const message = "META_APP_ID or META_APP_SECRET is not set.";
      for (const account of group) {
        await record(admin, { ad_account_id: account.id, last_attempt_at: new Date().toISOString(), last_error: message });
        outcomes.push(outcome(account, "error", message));
      }
      continue;
    }

    let token: string;
    try {
      token = await getAccessToken(connectionId);
    } catch (error) {
      const message = friendly(error).slice(0, 500);
      // getAccessToken already records an expired login. A network blip must not.
      if (error instanceof AdPlatformError && error.needsReconnect) await markNeedsReconnect(connectionId, message);
      for (const account of group) {
        await record(admin, { ad_account_id: account.id, last_attempt_at: new Date().toISOString(), last_error: message });
        outcomes.push({ ...outcome(account, "error", message), needsReconnect: error instanceof AdPlatformError && error.needsReconnect });
      }
      continue;
    }

    let tokenDead: string | null = null;
    for (const account of group) {
      if (tokenDead) {
        await record(admin, { ad_account_id: account.id, last_attempt_at: new Date().toISOString(), last_error: tokenDead });
        outcomes.push({ ...outcome(account, "error", tokenDead), needsReconnect: true });
        continue;
      }
      const result = await syncAccount(admin, account, token, options?.backfill ?? false, backfilled.get(account.id) ?? null);
      if (result.needsReconnect && result.message) tokenDead = result.message;
      outcomes.push(result);
    }
  }

  const message = describeSync(outcomes);
  return { ok: outcomes.every((item) => item.status !== "error"), accounts: outcomes, message };
}
