import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FunnelPage, funnelMetadata } from "@/components/funnels/funnel-page";
import { getPublishedFunnel } from "@/lib/public-data";

// PUBLIC: a published landing page or funnel step. Only the published version
// is ever shown (see getPublishedFunnel).

type Props = PageProps<"/f/[slug]/[[...step]]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, step } = await params;
  return funnelMetadata((await getPublishedFunnel(slug))?.content, step);
}

export default function PublishedFunnelPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Props["params"] }) {
  const { slug, step } = await params;
  const funnel = await getPublishedFunnel(slug);
  if (!funnel) notFound();
  return <FunnelPage doc={funnel.content} path={step} basePath={`/f/${funnel.slug}`} />;
}
