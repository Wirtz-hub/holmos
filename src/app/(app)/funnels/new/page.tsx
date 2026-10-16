import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewFunnelForm } from "@/components/funnels/new-funnel-form";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { aiProviders } from "@/lib/ai/site-writer";
import { requireAdmin } from "@/lib/auth";
import { TEMPLATES } from "@/lib/funnels/templates";
import { WEBSITE_TEMPLATES } from "@/lib/funnels/website-templates";
import { isStockPhotoSearchOn } from "@/lib/unsplash";

export const metadata: Metadata = { title: "New page" };

// Writing a website with AI can take a couple of minutes.
export const maxDuration = 300;

export default function NewFunnelPage({ searchParams }: PageProps<"/funnels/new">) {
  return (
    <>
      <PageHeader
        back={
          <Link href="/funnels" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" aria-hidden /> Pages & funnels
          </Link>
        }
        title="New page"
        description="A landing page, a full website, or one written for you by AI. You can change everything afterwards."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/funnels/new">["searchParams"] }) {
  const [{ supabase }, query] = await Promise.all([requireAdmin(), searchParams]);
  const { data } = await supabase.from("clients").select("id, name").order("name");
  const clients = (data ?? []) as { id: string; name: string }[];
  // "New page for this client" links from a client's page preselect them.
  const wanted = typeof query.client === "string" ? query.client : "";
  const defaultClientId = clients.some((c) => c.id === wanted) ? wanted : "";

  return (
    <NewFunnelForm
      templates={TEMPLATES.map((t) => ({ ...t }))}
      websiteTemplates={WEBSITE_TEMPLATES}
      clients={clients}
      defaultClientId={defaultClientId}
      ai={aiProviders()}
      photos={isStockPhotoSearchOn()}
    />
  );
}
