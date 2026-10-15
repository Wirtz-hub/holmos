import "server-only";
import type { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/funnels/schema";

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/** "offer", or "offer-2" if that's taken, and so on. */
export async function freeSlug(supabase: Supabase, table: "funnels" | "booking_calendars", wanted: string) {
  const base = slugify(wanted) || "page";
  const { data } = await supabase.from(table).select("slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((row) => row.slug as string));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}
