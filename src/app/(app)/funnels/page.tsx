import { ExternalLink, LayoutTemplate, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink, Card, cx, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { funnelAddress } from "@/lib/urls";

export const metadata: Metadata = { title: "Pages & funnels" };

export default function FunnelsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Funnels />
    </Suspense>
  );
}

type Row = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  updated_at: string;
  published_at: string | null;
  draft: { steps?: unknown[] };
  live: boolean;
  changed: boolean;
};

async function Funnels() {
  const { supabase } = await requireAdmin();
  // The database stores both versions with keys in the same order, so comparing them as text works.
  const { data, error } = await supabase.from("funnels").select("id, name, slug, custom_domain, updated_at, published_at, draft, published").order("updated_at", {
    ascending: false,
  });
  if (error) throw new Error(error.message);
  const rows: Row[] = (data ?? []).map(({ published, ...row }) => ({
    ...row,
    live: published !== null,
    changed: published !== null && JSON.stringify(published) !== JSON.stringify(row.draft),
  }));

  return (
    <>
      <PageHeader
        title="Pages & funnels"
        description="Landing pages and step-by-step funnels. Visitors only see what you publish."
        actions={
          <ButtonLink href="/funnels/new">
            <Plus className="size-4" aria-hidden />
            New page
          </ButtonLink>
        }
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LayoutTemplate className="size-5" />}
            title="No pages yet"
            action={<ButtonLink href="/funnels/new">Make your first page</ButtonLink>}
          >
            Start from a template — a lead page, a booking page or a two-step offer — and change the words and pictures.
          </EmptyState>
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <Link href={`/funnels/${row.id}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700">
                  {row.name}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  {(row.draft.steps?.length ?? 1) === 1 ? "1 step" : `${row.draft.steps?.length} steps`} · edited {formatDateTime(row.updated_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cx(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    !row.live ? "bg-slate-100 text-slate-600" : row.changed ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700",
                  )}
                >
                  {!row.live ? "Draft" : row.changed ? "Live · unpublished changes" : "Live"}
                </span>
                {row.live && (
                  <a
                    href={funnelAddress(row)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex max-w-xs items-center gap-1 truncate text-sm text-brand-700 hover:underline"
                  >
                    {funnelAddress(row).replace(/^https?:\/\//, "")}
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </a>
                )}
                <ButtonLink href={`/funnels/${row.id}`} variant="secondary" size="sm">
                  Edit
                </ButtonLink>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
