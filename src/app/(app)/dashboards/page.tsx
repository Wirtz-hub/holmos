import { ChartColumn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink, Card, EmptyState, PageHeader, PageSkeleton, PlatformBadge } from "@/components/ui";
import { listAdAccounts } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { goalInfo, stageLabel } from "@/lib/pipeline";
import type { Goal, Platform } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboards" };

export default function DashboardsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboards />
    </Suspense>
  );
}

async function Dashboards() {
  const { supabase } = await requireAdmin();
  const [{ data: clients }, accounts] = await Promise.all([
    supabase.from("clients").select("id, name, stage, goal").order("name"),
    listAdAccounts(),
  ]);

  const withAccounts = (clients ?? [])
    .map((client) => ({
      ...(client as { id: string; name: string; stage: string; goal: Goal }),
      accounts: accounts.filter((a) => a.client_id === client.id),
    }))
    .filter((client) => client.accounts.length > 0);
  const without = (clients?.length ?? 0) - withAccounts.length;

  return (
    <>
      <PageHeader
        title="Dashboards"
        description="Every client gets an ad dashboard. These ones have ad accounts assigned."
      />
      {withAccounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ChartColumn className="size-5" />}
            title="No dashboards with data yet"
            action={<ButtonLink href="/ad-accounts">Go to Ad accounts</ButtonLink>}
          >
            Connect Meta or Google, then assign ad accounts to your clients. Their dashboards fill in automatically.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {withAccounts.map((client) => {
            const platforms = [...new Set(client.accounts.map((a) => a.platform))] as Platform[];
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}/dashboard`}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{client.name}</h2>
                  <div className="flex shrink-0 gap-1">
                    {platforms.map((p) => (
                      <PlatformBadge key={p} platform={p} />
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {client.accounts.length} ad account{client.accounts.length === 1 ? "" : "s"} · tracking{" "}
                  {goalInfo(client.goal).plural.toLowerCase()} · {stageLabel(client.stage)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
      {without > 0 && withAccounts.length > 0 && (
        <p className="mt-6 text-sm text-slate-500">
          {without} other client{without === 1 ? " has" : "s have"} no ad accounts yet — assign them on the{" "}
          <Link href="/ad-accounts" className="font-medium text-brand-700 hover:underline">
            Ad accounts
          </Link>{" "}
          page.
        </p>
      )}
    </>
  );
}
