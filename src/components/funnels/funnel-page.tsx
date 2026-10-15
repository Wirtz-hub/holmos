import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FunnelStepView, signupBlockId } from "@/components/funnels/funnel-view";
import { stepIndexFor, type FunnelDoc } from "@/lib/funnels/schema";
import { getFunnelExtras } from "@/lib/public-data";

// A published funnel step, as visitors see it on /f/<slug> or a custom domain.

export async function FunnelPage({ doc, path, basePath }: { doc: FunnelDoc; path: string[] | undefined; basePath: string }) {
  const stepIndex = stepIndexFor(doc, path);
  if (stepIndex < 0) notFound();
  const { forms, calendars } = await getFunnelExtras(doc);
  return (
    <FunnelStepView
      ctx={{ doc, stepIndex, basePath, interactive: true, forms, calendars, signupBlockId: signupBlockId(doc.steps[stepIndex].blocks) }}
    />
  );
}

export function funnelMetadata(doc: FunnelDoc | undefined, path: string[] | undefined): Metadata {
  const index = doc ? stepIndexFor(doc, path) : -1;
  if (!doc || index < 0) return { title: { absolute: "Not found" }, robots: { index: false } };
  const step = doc.steps[index];
  const hero = step.blocks.find((b) => b.type === "hero");
  const title = step.seoTitle || (hero?.type === "hero" && hero.heading) || step.name;
  const description = step.seoDescription || (hero?.type === "hero" ? hero.text.replace(/\s+/g, " ").slice(0, 160) : "") || undefined;
  const image = hero?.type === "hero" && hero.imageUrl ? hero.imageUrl : undefined;
  return {
    title: { absolute: title },
    description,
    robots: doc.indexable && index === 0 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title, description, images: image ? [image] : undefined },
  };
}
