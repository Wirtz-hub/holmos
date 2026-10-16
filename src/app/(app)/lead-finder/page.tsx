import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadFinder } from "@/components/leads/lead-finder";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { aiProviders } from "@/lib/ai/ask";
import { requireAdmin } from "@/lib/auth";
import { isGoogleMapsOn } from "@/lib/leads/search";

export const metadata: Metadata = { title: "Lead finder" };

// The free map search can take over a minute when its servers are busy.
export const maxDuration = 120;

export default function LeadFinderPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Finder />
    </Suspense>
  );
}

async function Finder() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Lead finder"
        description="Find businesses anywhere in the world, see which ones need help with their marketing, and put the best ones in your pipeline."
      />
      <LeadFinder googleMaps={isGoogleMapsOn()} ai={aiProviders()} />
    </>
  );
}
