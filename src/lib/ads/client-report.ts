import "server-only";
import { requireAdmin } from "@/lib/auth";
import { isValidIsoDate, type DateRange } from "@/lib/dates";
import type { AdAccount, Client } from "@/lib/types";
import { googleConfig, metaConfig } from "@/lib/ads/config";
import { getAccessToken } from "@/lib/ads/connections";
import { fetchGoogleAccountMetrics } from "@/lib/ads/google";
import { fetchMetaAccountMetrics } from "@/lib/ads/meta";
import { buildClientReport } from "@/lib/ads/report";
import { AdPlatformError, type AccountFetchResult } from "@/lib/ads/types";

async function fetchAccount(
  account: AdAccount,
  range: DateRange,
  fallbackCurrency: string,
  tokens: Map<string, Promise<string>>,
): Promise<AccountFetchResult> {
  const base = {
    accountId: account.id,
    externalId: account.external_account_id,
    name: account.name,
    platform: account.platform,
    currency: account.currency ?? fallbackCurrency,
  };
  const platformName = account.platform === "meta" ? "Meta" : "Google";

  if (!account.connection_id) {
    return {
      ...base,
      metrics: null,
      error: `No ${platformName} login can reach this account right now. Reconnect ${platformName} on the Ad accounts page.`,
      needsReconnect: true,
    };
  }

  try {
    // One token lookup (and at most one Google refresh) per login, shared by its accounts.
    let token = tokens.get(account.connection_id);
    if (!token) {
      token = getAccessToken(account.connection_id);
      tokens.set(account.connection_id, token);
    }
    const accessToken = await token;

    const metrics =
      account.platform === "meta"
        ? await fetchMetaAccountMetrics(metaConfig(), accessToken, account.external_account_id, range)
        : await fetchGoogleAccountMetrics(
            googleConfig(),
            accessToken,
            account.external_account_id,
            account.login_customer_id,
            range,
          );
    return { ...base, metrics, error: null, needsReconnect: false };
  } catch (error) {
    if (error instanceof AdPlatformError) {
      return { ...base, metrics: null, error: error.message, needsReconnect: error.needsReconnect };
    }
    console.error(`Loading ${platformName} account ${account.external_account_id} failed`, error);
    return { ...base, metrics: null, error: "Something went wrong loading this account.", needsReconnect: false };
  }
}

/** Ad performance for one client — only ever from the accounts assigned to them. */
export async function getClientReport(client: Client, range: DateRange) {
  if (!isValidIsoDate(range.from) || !isValidIsoDate(range.to)) throw new Error("Invalid date range.");
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("ad_accounts")
    .select("*")
    .eq("client_id", client.id)
    .order("platform")
    .order("name");
  if (error) throw new Error(error.message);
  const accounts = (data ?? []) as AdAccount[];

  const tokens = new Map<string, Promise<string>>();
  const fetched = await Promise.all(accounts.map((account) => fetchAccount(account, range, client.currency, tokens)));

  return buildClientReport(
    fetched,
    {
      goal: client.goal,
      metaResultAction: client.meta_result_action,
      googleCountAllConversions: client.google_count_all_conversions,
    },
    range,
  );
}
