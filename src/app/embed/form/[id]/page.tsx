import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { EmbedFrame } from "@/components/public/embed-frame";
import { PublicForm } from "@/components/public/public-form";
import { readableOn } from "@/lib/funnels/schema";
import { getPublicForm } from "@/lib/public-data";

// PUBLIC: a form on its own, for embedding on any website (iframe, or the
// script at /embed/form.js, which also resizes the frame). Active forms only.

type Props = PageProps<"/embed/form/[id]">;

export const metadata: Metadata = { title: { absolute: "Form" }, robots: { index: false, follow: false } };

export default function EmbeddedFormPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const form = await getPublicForm(id);
  if (!form) notFound();

  const accent = typeof query.accent === "string" && /^#?[0-9a-f]{6}$/i.test(query.accent) ? `#${query.accent.replace("#", "")}` : "#1d4669";
  const source = typeof query.source === "string" && /^https?:\/\//.test(query.source) ? query.source : null;
  const style = { "--accent": accent, "--on-accent": readableOn(accent) } as CSSProperties;

  return (
    <EmbedFrame lang={form.language} style={style} className="p-1">
      <PublicForm form={form} embedded sourceUrl={source} />
    </EmbedFrame>
  );
}
