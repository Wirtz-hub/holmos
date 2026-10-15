import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/env";
import type { PublicFormDef } from "@/lib/forms/schema";
import { funnelDocSchema, referencedIds, STEP_SLUG, type FunnelDoc, type Language } from "@/lib/funnels/schema";

// What public pages read. Everything goes through the database's public read
// functions as a visitor (no login), so only published content can come back.
// Results are cached briefly and refreshed the moment you publish.

export const PUBLIC_TAGS = { funnels: "public-funnels", forms: "public-forms", calendars: "public-calendars" } as const;

// At most a minute old, even if an instant refresh is missed.
const PUBLIC_LIFE = { stale: 60, revalidate: 60, expire: 86_400 };

function visitorClient() {
  return createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type PublishedFunnel = { id: string; slug: string; custom_domain: string | null; content: FunnelDoc };

function toFunnel(data: unknown): PublishedFunnel | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { id: string; slug: string; custom_domain: string | null; content: unknown };
  const content = funnelDocSchema.safeParse(row.content);
  if (!content.success) {
    console.error(`Published funnel ${row.slug} has invalid content`, content.error.issues[0]);
    return null;
  }
  return { id: row.id, slug: row.slug, custom_domain: row.custom_domain, content: content.data };
}

export async function getPublishedFunnel(slug: string): Promise<PublishedFunnel | null> {
  "use cache";
  cacheLife(PUBLIC_LIFE);
  cacheTag(PUBLIC_TAGS.funnels);
  if (!isSupabaseConfigured() || !STEP_SLUG.test(slug)) return null;
  const { data, error } = await visitorClient().rpc("published_funnel", { p_slug: slug });
  if (error) throw new Error(error.message);
  return toFunnel(data);
}

export async function getPublishedFunnelForDomain(domain: string): Promise<PublishedFunnel | null> {
  "use cache";
  cacheLife(PUBLIC_LIFE);
  cacheTag(PUBLIC_TAGS.funnels);
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await visitorClient().rpc("published_funnel_for_domain", { p_domain: domain });
  if (error) throw new Error(error.message);
  return toFunnel(data);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPublicForm(id: string): Promise<PublicFormDef | null> {
  "use cache";
  cacheLife(PUBLIC_LIFE);
  cacheTag(PUBLIC_TAGS.forms);
  if (!isSupabaseConfigured() || !UUID.test(id)) return null;
  const { data, error } = await visitorClient().rpc("public_form", { p_id: id });
  if (error) throw new Error(error.message);
  return (data as PublicFormDef | null) ?? null;
}

export type PublicCalendar = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  time_zone: string;
  location_type: string;
  location_detail: string | null;
  language: Language;
};

/** An active booking calendar, by its address or id. */
export async function getPublicCalendar(key: string): Promise<PublicCalendar | null> {
  "use cache";
  cacheLife(PUBLIC_LIFE);
  cacheTag(PUBLIC_TAGS.calendars);
  if (!isSupabaseConfigured() || !(UUID.test(key) || STEP_SLUG.test(key))) return null;
  const { data, error } = await visitorClient().rpc("public_booking_calendar", { p_key: key });
  if (error) throw new Error(error.message);
  return (data as PublicCalendar | null) ?? null;
}

/** The forms and calendars a funnel's blocks use, keyed by id. Missing or switched-off ones are left out. */
export async function getFunnelExtras(doc: FunnelDoc) {
  const { formIds, calendarIds } = referencedIds(doc);
  const [forms, calendars] = await Promise.all([
    Promise.all(formIds.map((id) => getPublicForm(id))),
    Promise.all(calendarIds.map((id) => getPublicCalendar(id))),
  ]);
  return {
    forms: Object.fromEntries(forms.filter((f): f is PublicFormDef => Boolean(f)).map((f) => [f.id, f])),
    calendars: Object.fromEntries(calendars.filter((c): c is PublicCalendar => Boolean(c)).map((c) => [c.id, c])),
  };
}
