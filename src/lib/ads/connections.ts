import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { serverEnv, type Platform } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { googleConfig, metaConfig } from "@/lib/ads/config";
import { listGoogleAdAccounts, refreshGoogleToken } from "@/lib/ads/google";
import { listMetaAdAccounts } from "@/lib/ads/meta";
import { AdPlatformError, type DiscoveredAdAccount } from "@/lib/ads/types";

// Everything that touches ad platform tokens lives here and uses the secret
// Supabase key. Callers must have passed requireAdmin() first.

const key = () => serverEnv().tokenEncryptionKey;

export async function saveConnection(input: {
  platform: Platform;
  externalUserId: string;
  label: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date | null;
}): Promise<string> {
  const row: Record<string, unknown> = {
    platform: input.platform,
    external_user_id: input.externalUserId,
    label: input.label,
    access_token_enc: encryptSecret(input.accessToken, key()),
    token_expires_at: input.expiresAt?.toISOString() ?? null,
    status: "active",
    last_error: null,
  };
  // Google only sends a refresh token on first consent; never overwrite a good one with nothing.
  if (input.refreshToken) row.refresh_token_enc = encryptSecret(input.refreshToken, key());

  const { data, error } = await createAdminClient()
    .from("ad_connections")
    .upsert(row, { onConflict: "platform,external_user_id" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Couldn't save the connection: ${error?.message}`);
  return data.id as string;
}

/**
 * Store what the login can see. Existing accounts keep their client
 * assignment; accounts the login can no longer reach are marked inactive.
 */
export async function syncAdAccounts(platform: Platform, connectionId: string, accounts: DiscoveredAdAccount[]) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("ad_accounts")
    .select("external_account_id")
    .eq("platform", platform)
    .in("external_account_id", accounts.length ? accounts.map((a) => a.externalId) : ["-"]);
  const known = new Set((existing ?? []).map((row) => row.external_account_id as string));

  if (accounts.length) {
    const { error } = await admin.from("ad_accounts").upsert(
      accounts.map((account) => ({
        platform,
        external_account_id: account.externalId,
        name: account.name,
        currency: account.currency,
        timezone: account.timezone,
        login_customer_id: account.loginCustomerId ?? null,
        connection_id: connectionId,
        is_active: true,
      })),
      { onConflict: "platform,external_account_id" },
    );
    if (error) throw new Error(`Couldn't save ad accounts: ${error.message}`);
  }

  let stale = admin.from("ad_accounts").update({ is_active: false }).eq("connection_id", connectionId);
  if (accounts.length) {
    stale = stale.not("external_account_id", "in", `(${accounts.map((a) => `"${a.externalId}"`).join(",")})`);
  }
  await stale;

  return { found: accounts.length, added: accounts.filter((a) => !known.has(a.externalId)).length };
}

export async function markNeedsReconnect(connectionId: string, message: string) {
  await createAdminClient()
    .from("ad_connections")
    .update({ status: "needs_reconnect", last_error: message })
    .eq("id", connectionId);
}

/** A working access token for the connection, refreshing Google's when needed. */
export async function getAccessToken(connectionId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("ad_connections")
    .select("id, platform, access_token_enc, refresh_token_enc, token_expires_at")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn) throw new AdPlatformError("This ad login was removed. Reconnect it on the Ad accounts page.", true);

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : null;

  if (conn.platform === "meta") {
    if (!conn.access_token_enc || (expiresAt !== null && expiresAt <= Date.now())) {
      const message = "Meta login has expired. Reconnect Meta on the Ad accounts page.";
      await markNeedsReconnect(conn.id, message);
      throw new AdPlatformError(message, true);
    }
    return decryptSecret(conn.access_token_enc, key());
  }

  if (conn.access_token_enc && expiresAt !== null && expiresAt - Date.now() > 120_000) {
    return decryptSecret(conn.access_token_enc, key());
  }
  if (!conn.refresh_token_enc) {
    const message = "Google login needs to be reconnected.";
    await markNeedsReconnect(conn.id, message);
    throw new AdPlatformError(message, true);
  }
  try {
    const fresh = await refreshGoogleToken(googleConfig(), decryptSecret(conn.refresh_token_enc, key()));
    await admin
      .from("ad_connections")
      .update({
        access_token_enc: encryptSecret(fresh.accessToken, key()),
        token_expires_at: fresh.expiresAt.toISOString(),
        status: "active",
        last_error: null,
      })
      .eq("id", conn.id);
    return fresh.accessToken;
  } catch (error) {
    if (error instanceof AdPlatformError && error.needsReconnect) await markNeedsReconnect(conn.id, error.message);
    throw error;
  }
}

export function discoverAdAccounts(platform: Platform, accessToken: string) {
  return platform === "meta"
    ? listMetaAdAccounts(metaConfig(), accessToken)
    : listGoogleAdAccounts(googleConfig(), accessToken);
}

/** Re-check which ad accounts an existing login can see (e.g. after a new client shares access). */
export async function refreshConnectionAccounts(connectionId: string) {
  const { data: conn } = await createAdminClient()
    .from("ad_connections")
    .select("id, platform")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn) throw new AdPlatformError("That login no longer exists.");
  try {
    const token = await getAccessToken(conn.id);
    const accounts = await discoverAdAccounts(conn.platform as Platform, token);
    return await syncAdAccounts(conn.platform as Platform, conn.id, accounts);
  } catch (error) {
    if (error instanceof AdPlatformError && error.needsReconnect) await markNeedsReconnect(conn.id, error.message);
    throw error;
  }
}
