"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { CURRENCIES, STAGE_IDS } from "@/lib/pipeline";
import type { Stage } from "@/lib/types";

export type FormState = { ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((value) => value || null);

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Give the business a name").max(200),
  contact_name: optionalText(200),
  email: z
    .string()
    .trim()
    .max(320)
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "That email address doesn't look right")
    .transform((value) => value || null),
  phone: optionalText(50),
  website: optionalText(500),
  deal_value: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value.replace(",", "."))))
    .refine((value) => value === null || (Number.isFinite(value) && value >= 0), "Enter an amount, like 15000"),
  currency: z.enum(CURRENCIES),
  goal: z.enum(["lead", "purchase", "booking"]),
  notes: optionalText(20000),
  meta_result_action: optionalText(200),
  google_count_all_conversions: z.string().transform((value) => value === "on"),
});

const FIELDS = [...Object.keys(detailsSchema.shape), "stage"];

function readForm(formData: FormData) {
  return Object.fromEntries(FIELDS.map((key) => [key, String(formData.get(key) ?? "")]));
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

const stageSchema = z.enum(STAGE_IDS as [Stage, ...Stage[]]);
const idSchema = z.uuid();

async function topOfColumn(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], stage: Stage) {
  const { data } = await supabase
    .from("clients")
    .select("stage_position")
    .eq("stage", stage)
    .order("stage_position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? Number(data.stage_position) - 1 : 0;
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const input = readForm(formData);
  const parsed = detailsSchema.safeParse(input);
  const stage = stageSchema.safeParse(input.stage || "new");
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  if (!stage.success) return { ok: false, message: "Pick a pipeline stage." };

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, stage: stage.data, stage_position: await topOfColumn(supabase, stage.data) })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: `Couldn't save: ${error?.message ?? "unknown error"}` };

  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(clientId).success) return { ok: false, message: "Unknown client." };
  const parsed = detailsSchema.safeParse(readForm(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const { error } = await supabase.from("clients").update(parsed.data).eq("id", clientId);
  if (error) return { ok: false, message: `Couldn't save: ${error.message}` };
  refresh();
  return { ok: true, message: "Saved" };
}

/** Drag-and-drop on the pipeline board. */
export async function moveClientAction(clientId: string, stage: string, position: number) {
  const { supabase } = await requireAdmin();
  const id = idSchema.safeParse(clientId);
  const target = stageSchema.safeParse(stage);
  if (!id.success || !target.success || !Number.isFinite(position)) return { ok: false };

  const { error } = await supabase
    .from("clients")
    .update({ stage: target.data, stage_position: position })
    .eq("id", id.data);
  return { ok: !error };
}

/** Stage picker on the client page: moves the card to the top of the new column. */
export async function setStageAction(clientId: string, stage: string) {
  const { supabase } = await requireAdmin();
  const id = idSchema.safeParse(clientId);
  const target = stageSchema.safeParse(stage);
  if (!id.success || !target.success) return { ok: false };

  const { error } = await supabase
    .from("clients")
    .update({ stage: target.data, stage_position: await topOfColumn(supabase, target.data) })
    .eq("id", id.data);
  if (!error) refresh();
  return { ok: !error };
}

const activitySchema = z.object({
  kind: z.enum(["note", "call", "email", "meeting"]),
  body: z.string().trim().min(1, "Write something first").max(5000),
});

export async function addActivityAction(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(clientId).success) return { ok: false, message: "Unknown client." };
  const parsed = activitySchema.safeParse({
    kind: String(formData.get("kind") ?? "note"),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const { error } = await supabase.from("activities").insert({ client_id: clientId, ...parsed.data });
  if (error) return { ok: false, message: `Couldn't save: ${error.message}` };
  refresh();
  return { ok: true };
}

export async function deleteClientAction(clientId: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(clientId).success) return;
  await supabase.from("clients").delete().eq("id", clientId);
  redirect("/clients");
}
