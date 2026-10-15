import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewFunnelForm } from "@/components/funnels/new-funnel-form";
import { PageHeader } from "@/components/ui";
import { TEMPLATES } from "@/lib/funnels/templates";

export const metadata: Metadata = { title: "New page" };

export default function NewFunnelPage() {
  return (
    <>
      <PageHeader
        back={
          <Link href="/funnels" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" aria-hidden /> Pages & funnels
          </Link>
        }
        title="New page"
        description="Pick a starting point. You can change everything afterwards."
      />
      <NewFunnelForm templates={TEMPLATES.map((t) => ({ ...t }))} />
    </>
  );
}
