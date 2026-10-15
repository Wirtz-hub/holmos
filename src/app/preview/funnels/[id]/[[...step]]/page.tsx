import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FunnelPage } from "@/components/funnels/funnel-page";
import { requireAdmin } from "@/lib/auth";
import { funnelDocSchema } from "@/lib/funnels/schema";

// Your unpublished changes, exactly as visitors would see them. Signed-in admin only.

export const metadata: Metadata = { title: "Preview" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PreviewPage({ params }: PageProps<"/preview/funnels/[id]/[[...step]]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/preview/funnels/[id]/[[...step]]">["params"] }) {
  const { id, step } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("funnels").select("name, draft").eq("id", id).maybeSingle();
  if (!data) notFound();
  const doc = funnelDocSchema.safeParse(data.draft);

  return (
    <>
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-1 bg-amber-100 px-4 py-2 text-sm text-amber-950 shadow-sm">
        <Link href={`/funnels/${id}`} className="inline-flex items-center gap-1 font-medium hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Back to editing
        </Link>
        <span>
          Preview of <strong>{data.name}</strong> with your latest changes. Visitors see the published version. Forms here are real: sending one
          adds a lead.
        </span>
      </div>
      {doc.success ? (
        <FunnelPage doc={doc.data} path={step} basePath={`/preview/funnels/${id}`} />
      ) : (
        <p className="p-8 text-center text-slate-600">This page has a problem that stops it from showing: {doc.error.issues[0]?.message}</p>
      )}
    </>
  );
}
