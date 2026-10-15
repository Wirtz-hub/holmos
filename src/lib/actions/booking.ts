"use server";

import { after } from "next/server";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/actions/clients";
import { requireAdmin } from "@/lib/auth";
import { afterBookingCancelled } from "@/lib/booking/server";
import { weeklyHoursSchema } from "@/lib/booking/slots";
import { isValidTimeZone } from "@/lib/booking/time";
import { STEP_SLUG } from "@/lib/funnels/schema";
import { STAGE_IDS } from "@/lib/pipeline";
import { PUBLIC_TAGS } from "@/lib/public-data";
import { freeSlug } from "@/lib/slugs";
import type { Stage } from "@/lib/types";

const idSchema = z.uuid();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createCalendarAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, email } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, fieldErrors: { name: "Give the booking page a name" } };

  const { data, error } = await supabase
    .from("booking_calendars")
    .insert({ name: name.slice(0, 120), slug: await freeSlug(supabase, "booking_calendars", name), notify_email: email || null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: `Couldn't create the booking page: ${error?.message ?? "unknown error"}` };
  redirect(`/bookings/calendars/${data.id}`);
}

const minutes = (min: number, max: number, label: string) =>
  z.number().int(`${label} must be whole minutes`).min(min, `${label} must be at least ${min}`).max(max, `${label} can be at most ${max}`);

const calendarSchema = z.object({
  name: z.string().trim().min(1, "Give the booking page a name").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(60, "Keep the address under 60 characters")
    .regex(STEP_SLUG, "Use only lowercase letters, numbers and dashes (e.g. intro-call)"),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => value || null),
  duration_minutes: minutes(5, 480, "The meeting length"),
  buffer_before_minutes: minutes(0, 240, "The break before"),
  buffer_after_minutes: minutes(0, 240, "The break after"),
  slot_interval_minutes: minutes(5, 240, "The start-time step"),
  min_notice_minutes: minutes(0, 43200, "The notice"),
  max_days_ahead: z.number().int().min(1, "Allow booking at least 1 day ahead").max(365, "At most 365 days ahead"),
  time_zone: z.string().refine(isValidTimeZone, "Unknown time zone"),
  availability: weeklyHoursSchema,
  location_type: z.enum(["google_meet", "phone", "in_person", "custom"]),
  location_detail: z
    .string()
    .trim()
    .max(500)
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

export type CalendarInput = z.input<typeof calendarSchema>;

export async function saveCalendarAction(calendarId: string, input: CalendarInput): Promise<FormState> {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(calendarId).success) return { ok: false, message: "Unknown booking page." };
  const parsed = calendarSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, fieldErrors, message: "Check the highlighted settings." };
  }
  if (parsed.data.location_type === "in_person" && !parsed.data.location_detail) {
    return { ok: false, fieldErrors: { location_detail: "Add the address for in-person meetings" } };
  }

  const { error } = await supabase.from("booking_calendars").update(parsed.data).eq("id", calendarId);
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { slug: "Another booking page already uses this address." } };
    return { ok: false, message: `Couldn't save: ${error.message}` };
  }
  updateTag(PUBLIC_TAGS.calendars);
  refresh();
  return { ok: true, message: "Saved" };
}

export async function deleteCalendarAction(calendarId: string): Promise<{ ok: boolean; message?: string }> {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(calendarId).success) return { ok: false, message: "Unknown booking page." };
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("calendar_id", calendarId)
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString());
  if (count) {
    return {
      ok: false,
      message: `This page has ${count} upcoming booking${count === 1 ? "" : "s"}. Cancel ${count === 1 ? "it" : "them"} first, or switch the page off instead.`,
    };
  }
  await supabase.from("booking_calendars").delete().eq("id", calendarId);
  updateTag(PUBLIC_TAGS.calendars);
  redirect("/bookings");
}

export async function cancelBookingAction(bookingId: string, emailGuest: boolean): Promise<{ ok: boolean; message?: string }> {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(bookingId).success) return { ok: false, message: "Unknown booking." };
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .select("id");
  if (error) return { ok: false, message: `Couldn't cancel: ${error.message}` };
  if (!data?.length) return { ok: false, message: "This booking was already cancelled." };
  after(() => afterBookingCancelled(bookingId, { by: "you", emailGuest }));
  refresh();
  return { ok: true };
}

export async function saveCalendarChoicesAction(busyCalendarIds: string[], eventCalendarId: string) {
  const { supabase } = await requireAdmin();
  const ids = z.array(z.string().min(1).max(300)).min(1, "Pick at least one calendar").max(20).safeParse(busyCalendarIds);
  const target = z.string().min(1).max(300).safeParse(eventCalendarId);
  if (!ids.success || !target.success) return { ok: false, message: "Pick at least one calendar." };
  const { error } = await supabase
    .from("calendar_connections")
    .update({ busy_calendar_ids: ids.data, event_calendar_id: target.data })
    .eq("provider", "google");
  refresh();
  return error ? { ok: false, message: `Couldn't save: ${error.message}` } : { ok: true, message: "Saved" };
}

export async function disconnectCalendarAction() {
  const { supabase } = await requireAdmin();
  await supabase.from("calendar_connections").delete().eq("provider", "google");
  refresh();
}
