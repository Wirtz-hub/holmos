"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/actions/clients";
import { requireAdmin } from "@/lib/auth";
import { defaultFields, fieldsSchema } from "@/lib/forms/schema";
import { STAGE_IDS } from "@/lib/pipeline";
import { PUBLIC_TAGS } from "@/lib/public-data";
import type { Stage } from "@/lib/types";

const idSchema = z.uuid();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, email } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const language = formData.get("language") === "en" ? "en" : "da";
  if (!name) return { ok: false, fieldErrors: { name: "Give the form a name" } };

  const { data, error } = await supabase
    .from("forms")
    .insert({
      name: name.slice(0, 120),
      fields: defaultFields(language),
      language,
      success_message: language === "da" ? "Tak! Vi vender tilbage hurtigst muligt." : "Thank you! We'll be in touch soon.",
      notify_email: email || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: `Couldn't create the form: ${error?.message ?? "unknown error"}` };
  redirect(`/forms/${data.id}`);
}

const formSchema = z.object({
  name: z.string().trim().min(1, "Give the form a name").max(120),
  fields: fieldsSchema,
  submit_label: z.string().trim().min(1, "The button needs a label").max(60),
  success_message: z.string().trim().min(1, "Write a short thank-you message").max(1000),
  redirect_url: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), "Start the address with https://")
    .transform((value) => value || null),
  language: z.enum(["da", "en"]),
  lead_stage: z.enum(STAGE_IDS as [Stage, ...Stage[]]),
  notify_email: z
    .string()
    .trim()
    .max(320)
    .refine((value) => value === "" || EMAIL.test(value), "That email address doesn't look right")
    .transform((value) => value || null),
  is_active: z.boolean(),
});

export type FormInput = z.input<typeof formSchema>;

export async function saveFormAction(formId: string, input: FormInput): Promise<FormState> {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(formId).success) return { ok: false, message: "Unknown form." };
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, fieldErrors, message: parsed.error.issues[0]?.message };
  }

  const { error } = await supabase.from("forms").update(parsed.data).eq("id", formId);
  if (error) return { ok: false, message: `Couldn't save: ${error.message}` };
  updateTag(PUBLIC_TAGS.forms);
  refresh();
  return { ok: true, message: "Saved" };
}

export async function deleteFormAction(formId: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(formId).success) return;
  await supabase.from("forms").delete().eq("id", formId);
  updateTag(PUBLIC_TAGS.forms);
  redirect("/forms");
}
