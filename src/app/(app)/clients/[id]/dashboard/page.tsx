import { ArrowLeft, Plug } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { RangeFrame } from "@/components/dashboard/range-frame";
import { ReportView } from "@/components/dashboard/report-view";
import { ButtonLink, Card, EmptyState, PageHeader, PageSkeleton, Skeleton } from "@/components/ui";
import { getClientReport } from "@/lib/ads/client-report";
import { requireAdmin } from "@/lib/auth";
import { getClientOr404 } from "@/lib/data";
import { formatRange, resolveRange, todayIn, type DateRange } from "@/lib/dates";
import { goalInfo } from "@/lib/pipeline";
import type { Client } from "@/lib/types";

export const metadata: Metadata = { title: "Ad dashboard" };

export default function ClientDashboardPage({ params, searchParams }: PageProps<"/clients/[id]/dashboard">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function Dashboard({
  params,
  searchParams,
}: {
  params: PageProps<"/clients/[id]/dashboard">["params"];
  searchParams: PageProps<"/clients/[id]/dashboard">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const client = await getClientOr404(id);
  const today = todayIn();
  const { range, preset } = resolveRange({ preset: first(query.preset), from: first(query.from), to: first(query.to) }, today);
  const goal = goalInfo(client.goal);

  return (
    <>
      <PageHeader
        back={
          <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" aria-hidden /> {client.name}
          </Link>
        }
        title={`${client.name} — ad results`}
        description={`${formatRange(range)} · results counted as ${goal.plural.toLowerCase()}`}
      />
      <RangeFrame controls={<DateRangePicker key={`${range.from}:${range.to}`} preset={preset} range={range} today={today} />}>
        <Suspense fallback={<ReportSkeleton />}>
          <Report client={client} range={range} />
        </Suspense>
      </RangeFrame>
    </>
  );
}

async function Report({ client, range }: { client: Client; range: DateRange }) {
  const { supabase } = await requireAdmin();
  const { count } = await supabase
    .from("ad_accounts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id);

  if (!count) {
    return (
      <Card>
        <EmptyState
          icon={<Plug className="size-5" />}
          title="No ad accounts assigned yet"
          action={<ButtonLink href={`/clients/${client.id}`}>Assign an ad account</ButtonLink>}
        >
          This dashboard only shows ad accounts assigned to {client.name}. Assign one from their client page — it takes
          two clicks.
        </EmptyState>
      </Card>
    );
  }

  const report = await getClientReport(client, range);
  return <ReportView report={report} goal={client.goal} />;
}

function ReportSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading ad results">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-40" />
    </div>
  );
}
