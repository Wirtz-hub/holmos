import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FunnelPage, funnelMetadata } from "@/components/funnels/funnel-page";
import { getPublishedFunnelForDomain } from "@/lib/public-data";

// PUBLIC: a published funnel on a client's own domain. src/proxy.ts rewrites
// requests for https://<domain>/<step> to /sites/<domain>/<step>.

type Props = PageProps<"/sites/[domain]/[[...step]]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain, step } = await params;
  return funnelMetadata((await getPublishedFunnelForDomain(decodeURIComponent(domain)))?.content, step);
}

export default function CustomDomainPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Props["params"] }) {
  const { domain, step } = await params;
  const funnel = await getPublishedFunnelForDomain(decodeURIComponent(domain));
  if (!funnel) notFound();
  // On its own domain, the funnel's first step is "/" and the others are "/<step>".
  return <FunnelPage doc={funnel.content} path={step} basePath="" />;
}
