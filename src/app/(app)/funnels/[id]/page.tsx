import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FunnelEditor } from "@/components/funnels/editor/funnel-editor";
import { FunnelSettingsForm } from "@/components/funnels/funnel-settings-form";
import { PageSkeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import type { FormField } from "@/lib/forms/schema";
import { funnelDocSchema } from "@/lib/funnels/schema";
import { appAddress, funnelAddress } from "@/lib/urls";

export const metadata: Metadata = { title: "Edit page" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditFunnelPage({ params }: PageProps<"/funnels/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/funnels/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [funnelResult, formsResult, calendarsResult] = await Promise.all([
    supabase.from("funnels").select("id, name, slug, custom_domain, draft, published").eq("id", id).maybeSingle(),
    supabase.from("forms").select("id, name, fields, submit_label, is_active").order("name"),
    supabase.from("booking_calendars").select("id, name, slug, duration_minutes, is_active").order("name"),
  ]);
  if (funnelResult.error) throw new Error(funnelResult.error.message);
  const funnel = funnelResult.data;
  if (!funnel) notFound();

  const draft = funnelDocSchema.safeParse(funnel.draft);
  if (!draft.success) throw new Error(`This page's saved content is damaged: ${draft.error.issues[0]?.message}`);
  const published = funnel.published ? funnelDocSchema.safeParse(funnel.published) : null;

  return (
    <FunnelEditor
      key={funnel.id}
      funnel={{ id: funnel.id, name: funnel.name, slug: funnel.slug }}
      initialDoc={draft.data}
      publishedDoc={published?.success ? published.data : null}
      forms={(formsResult.data ?? []) as { id: string; name: string; fields: FormField[]; submit_label: string; is_active: boolean }[]}
      calendars={(calendarsResult.data ?? []) as { id: string; name: string; slug: string; duration_minutes: number; is_active: boolean }[]}
      publicBase={funnelAddress(funnel)}
      settings={<FunnelSettingsForm funnel={funnel} appAddress={appAddress("")} />}
    />
  );
}
