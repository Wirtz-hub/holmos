import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClientForm } from "@/components/client-form";
import { Card, PageHeader, PageSkeleton } from "@/components/ui";
import { createClientAction } from "@/lib/actions/clients";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Add lead" };

export default function NewClientPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewClient />
    </Suspense>
  );
}

async function NewClient() {
  await requireAdmin();
  return (
    <div className="max-w-2xl">
      <PageHeader
        back={
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" aria-hidden /> Pipeline
          </Link>
        }
        title="Add a lead or client"
        description="They get their own record and ad dashboard straight away."
      />
      <Card className="p-5 sm:p-6">
        <ClientForm action={createClientAction} submitLabel="Add to pipeline" showStage />
      </Card>
    </div>
  );
}
