import type { Metadata } from "next";
import { Suspense } from "react";
import { AdAccountsTable } from "@/components/ad-accounts-table";
import { ConnectionCard } from "@/components/connection-card";
import { SyncInsightsCard } from "@/components/sync-insights-button";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { isMissingInsightsTable } from "@/lib/ads/insights";
import { requireAdmin } from "@/lib/auth";
import { listAdAccounts } from "@/lib/data";
import { missingPlatformSettings } from "@/lib/env";
import type { AdConnection, Platform } from "@/lib/types";

export const maxDuration = 300;

export const metadata: Metadata = { title: "Ad accounts" };

/** Only Meta logins really expire (~60 days); Google's short-lived tokens renew themselves. */
function withDaysLeft(connections: AdConnection[]) {
  const now = Date.now();
  return connections.map((connection) => ({
    ...connection,
    daysLeft:
      connection.platform === "meta" && connection.token_expires_at
        ? Math.ceil((new Date(connection.token_expires_at).getTime() - now) / 86_400_000)
        : null,
  }));
}

export default function AdAccountsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdAccounts />
    </Suspense>
  );
}

async function AdAccounts() {
  const { supabase } = await requireAdmin();
  const [connectionsResult, clientsResult, accounts, syncResult] = await Promise.all([
    supabase
      .from("ad_connections")
      .select("id, platform, external_user_id, label, token_expires_at, status, last_error, created_at")
      .order("created_at"),
    supabase.from("clients").select("id, name").order("name"),
    listAdAccounts(),
    supabase.from("ad_insight_syncs").select("ad_account_id, last_success_at, last_error"),
  ]);
  if (connectionsResult.error) throw new Error(connectionsResult.error.message);
  if (syncResult.error && !isMissingInsightsTable(syncResult.error)) throw new Error(syncResult.error.message);
  const connections = withDaysLeft((connectionsResult.data ?? []) as AdConnection[]);
  const clients = (clientsResult.data ?? []) as { id: string; name: string }[];
  const syncRows = (syncResult.data ?? []) as { ad_account_id: string; last_success_at: string | null; last_error: string | null }[];
  const syncByAccount = new Map(syncRows.map((row) => [row.ad_account_id, row]));
  const lastSuccess = syncRows.reduce<string | null>((latest, row) => {
    if (!row.last_success_at) return latest;
    return !latest || row.last_success_at > latest ? row.last_success_at : latest;
  }, null);
  const syncErrors = accounts.flatMap((account) => {
    const message = syncByAccount.get(account.id)?.last_error;
    return message ? [{ name: account.name, platform: account.platform as Platform, message }] : [];
  });

  return (
    <>
      <PageHeader
        title="Ad accounts"
        description="Connect Meta and Google once. Then give each ad account to a client — moving it later never needs a reconnect."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {(["meta", "google"] as const).map((platform) => (
          <ConnectionCard
            key={platform}
            platform={platform}
            connections={connections.filter((c) => c.platform === platform)}
            accountCount={accounts.filter((a) => a.platform === platform).length}
            missingSettings={missingPlatformSettings(platform)}
          />
        ))}
      </div>

      <SyncInsightsCard ready={!syncResult.error} lastSuccess={lastSuccess} errors={syncErrors} />

      <AdAccountsTable accounts={accounts} clients={clients} />
    </>
  );
}
