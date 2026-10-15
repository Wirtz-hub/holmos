import type { Metadata } from "next";
import { Suspense } from "react";
import { AdAccountsTable } from "@/components/ad-accounts-table";
import { ConnectionCard } from "@/components/connection-card";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listAdAccounts } from "@/lib/data";
import { missingPlatformSettings } from "@/lib/env";
import type { AdConnection } from "@/lib/types";

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
  const [connectionsResult, clientsResult, accounts] = await Promise.all([
    supabase
      .from("ad_connections")
      .select("id, platform, external_user_id, label, token_expires_at, status, last_error, created_at")
      .order("created_at"),
    supabase.from("clients").select("id, name").order("name"),
    listAdAccounts(),
  ]);
  if (connectionsResult.error) throw new Error(connectionsResult.error.message);
  const connections = withDaysLeft((connectionsResult.data ?? []) as AdConnection[]);
  const clients = (clientsResult.data ?? []) as { id: string; name: string }[];

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

      <AdAccountsTable accounts={accounts} clients={clients} />
    </>
  );
}
