import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PipelineBoard, type PipelineCard } from "@/components/pipeline-board";
import { ButtonLink, PageHeader, Skeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { sumByCurrency } from "@/lib/money";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Pipeline />
    </Suspense>
  );
}

async function Pipeline() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, contact_name, stage, stage_position, deal_value, currency")
    .order("stage_position");
  if (error) throw new Error(error.message);
  const cards = (data ?? []) as PipelineCard[];

  const open = cards.filter((card) => card.stage !== "won" && card.stage !== "lost");
  const openValue = sumByCurrency(open);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          cards.length === 0
            ? "Every lead and client lives here. Drag cards between stages as deals move."
            : `${open.length} open deal${open.length === 1 ? "" : "s"}${openValue ? ` worth ${openValue}` : ""}. Drag cards to move them.`
        }
        actions={
          <ButtonLink href="/clients/new">
            <Plus className="size-4" aria-hidden />
            Add lead
          </ButtonLink>
        }
      />
      <PipelineBoard initialCards={cards} />
    </>
  );
}

function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading pipeline">
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-6 h-4 w-80" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-96 w-64 shrink-0 xl:flex-1" />
        ))}
      </div>
    </div>
  );
}
