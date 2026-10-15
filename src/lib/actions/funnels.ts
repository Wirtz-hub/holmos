"use server";

import { resolveCname, resolve4 } from "node:dns/promises";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/actions/clients";
import { requireAdmin } from "@/lib/auth";
import { defaultFields } from "@/lib/forms/schema";
import { funnelDocSchema, STEP_SLUG, type FunnelDoc } from "@/lib/funnels/schema";
import { buildTemplate, fillTemplateIds, TEMPLATES, templateUsesForm, type TemplateId } from "@/lib/funnels/templates";
import { DOMAIN_PATTERN, normaliseDomain } from "@/lib/hosts";
import { PUBLIC_TAGS } from "@/lib/public-data";
import { freeSlug } from "@/lib/slugs";

const idSchema = z.uuid();

function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  return issue?.message ?? "Something in the page isn't valid.";
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the page a name").max(120),
  template: z.enum(TEMPLATES.map((t) => t.id) as [TemplateId, ...TemplateId[]]),
  language: z.enum(["da", "en"]),
});

export async function createFunnelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, email } = await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    template: formData.get("template"),
    language: formData.get("language"),
  });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { name, template, language } = parsed.data;

  let doc = buildTemplate(template, language);
  let formId: string | null = null;
  if (templateUsesForm(doc)) {
    const { data: form, error } = await supabase
      .from("forms")
      .insert({
        name: `${name} – form`,
        fields: defaultFields(language),
        language,
        success_message: language === "da" ? "Tak! Vi vender tilbage hurtigst muligt." : "Thank you! We'll be in touch soon.",
        notify_email: email || null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, message: `Couldn't create the page's form: ${error.message}` };
    formId = form.id;
    updateTag(PUBLIC_TAGS.forms);
  }
  const { data: calendar } = await supabase.from("booking_calendars").select("id").eq("is_active", true).order("created_at").limit(1).maybeSingle();
  doc = fillTemplateIds(doc, { formId, calendarId: calendar?.id ?? null });

  const { data, error } = await supabase
    .from("funnels")
    .insert({ name, slug: await freeSlug(supabase, "funnels", name), draft: doc })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: `Couldn't create the page: ${error?.message ?? "unknown error"}` };
  redirect(`/funnels/${data.id}`);
}

export type SaveResult = { ok: true; savedAt: string } | { ok: false; message: string };

/** Autosave from the editor. Visitors don't see it until you publish. */
export async function saveFunnelDraftAction(funnelId: string, doc: unknown): Promise<SaveResult> {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(funnelId).success) return { ok: false, message: "Unknown page." };
  const parsed = funnelDocSchema.safeParse(doc);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const { data, error } = await supabase.from("funnels").update({ draft: parsed.data }).eq("id", funnelId).select("updated_at").single();
  if (error) return { ok: false, message: `Couldn't save: ${error.message}` };
  return { ok: true, savedAt: data.updated_at };
}

/** Things that would look broken to visitors, in plain words. */
function publishProblems(doc: FunnelDoc) {
  const problems: string[] = [];
  for (const step of doc.steps) {
    for (const block of step.blocks) {
      if (block.type === "form" && !block.formId) problems.push(`Choose a form for the form block on “${step.name}”.`);
      if (block.type === "booking" && !block.calendarId) problems.push(`Choose a booking page for the booking block on “${step.name}”.`);
      if (block.type === "image" && !block.url) problems.push(`Add a picture to the image block on “${step.name}”, or remove it.`);
      if ((block.type === "hero" || block.type === "cta") && block.buttonLabel && block.button.target === "url" && !block.button.url) {
        problems.push(`A button on “${step.name}” goes to a website, but no address is filled in.`);
      }
    }
  }
  return problems;
}

export async function publishFunnelAction(funnelId: string): Promise<{ ok: boolean; message?: string; problems?: string[] }> {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(funnelId).success) return { ok: false, message: "Unknown page." };
  const { data: funnel } = await supabase.from("funnels").select("draft").eq("id", funnelId).maybeSingle();
  if (!funnel) return { ok: false, message: "This page no longer exists." };
  const parsed = funnelDocSchema.safeParse(funnel.draft);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const problems = publishProblems(parsed.data);
  if (problems.length) return { ok: false, problems };

  const { error } = await supabase
    .from("funnels")
    .update({ published: parsed.data, published_at: new Date().toISOString() })
    .eq("id", funnelId);
  if (error) return { ok: false, message: `Couldn't publish: ${error.message}` };
  updateTag(PUBLIC_TAGS.funnels);
  refresh();
  return { ok: true };
}

export async function unpublishFunnelAction(funnelId: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(funnelId).success) return { ok: false };
  const { error } = await supabase.from("funnels").update({ published: null, published_at: null }).eq("id", funnelId);
  updateTag(PUBLIC_TAGS.funnels);
  refresh();
  return { ok: !error };
}

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Give the page a name").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(60, "Keep the address under 60 characters")
    .regex(STEP_SLUG, "Use only lowercase letters, numbers and dashes (e.g. spring-offer)"),
  custom_domain: z
    .string()
    .transform(normaliseDomain)
    .refine((value) => value === "" || DOMAIN_PATTERN.test(value), "That doesn't look like a domain. Use something like tilbud.example.dk")
    .transform((value) => value || null),
});

export async function saveFunnelSettingsAction(funnelId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(funnelId).success) return { ok: false, message: "Unknown page." };
  const parsed = settingsSchema.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    custom_domain: formData.get("custom_domain") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, fieldErrors };
  }

  const { error } = await supabase.from("funnels").update(parsed.data).eq("id", funnelId);
  if (error) {
    if (error.code === "23505") {
      const field = error.message.includes("custom_domain") ? "custom_domain" : "slug";
      return {
        ok: false,
        fieldErrors: { [field]: field === "slug" ? "Another page already uses this address." : "Another page already uses this domain." },
      };
    }
    return { ok: false, message: `Couldn't save: ${error.message}` };
  }
  updateTag(PUBLIC_TAGS.funnels);
  refresh();
  return { ok: true, message: "Saved" };
}

export async function duplicateFunnelAction(funnelId: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(funnelId).success) return;
  const { data: funnel } = await supabase.from("funnels").select("name, slug, draft").eq("id", funnelId).maybeSingle();
  if (!funnel) return;
  const { data } = await supabase
    .from("funnels")
    .insert({ name: `${funnel.name} (copy)`, slug: await freeSlug(supabase, "funnels", `${funnel.slug}-copy`), draft: funnel.draft })
    .select("id")
    .single();
  if (data) redirect(`/funnels/${data.id}`);
}

export async function deleteFunnelAction(funnelId: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(funnelId).success) return;
  await supabase.from("funnels").delete().eq("id", funnelId);
  updateTag(PUBLIC_TAGS.funnels);
  redirect("/funnels");
}

/** Looks the domain up in DNS to see whether it points at Vercel yet. */
export async function checkDomainAction(domain: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const host = normaliseDomain(domain);
  if (!DOMAIN_PATTERN.test(host)) return { ok: false, message: "Save a domain first." };

  const none: string[] = [];
  const [cnames, addresses] = await Promise.all([resolveCname(host).catch(() => none), resolve4(host).catch(() => none)]);
  if (cnames.some((name) => /vercel-dns/i.test(name)) || addresses.includes("76.76.21.21")) {
    return { ok: true, message: "The domain points at Vercel. If you've also added it in Vercel, the page is live there." };
  }
  if (!cnames.length && !addresses.length) {
    return { ok: false, message: "This domain doesn't point anywhere yet. DNS changes can take up to a few hours to show up." };
  }
  return {
    ok: false,
    message: `The domain points somewhere else (${[...cnames, ...addresses].slice(0, 3).join(", ")}). Follow the steps above to point it at Vercel.`,
  };
}
