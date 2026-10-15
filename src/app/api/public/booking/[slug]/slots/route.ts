import type { NextRequest } from "next/server";
import { freeSlots, getActiveCalendar } from "@/lib/booking/server";
import { addDays, isValidIsoDate } from "@/lib/dates";
import { json } from "@/lib/request";

// PUBLIC: the free times on a booking page, for up to two weeks from `from`.
// Returns start times only — never who booked or what's in the calendar.

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const calendar = await getActiveCalendar(slug);
  if (!calendar) return json({ ok: false }, 404);

  const query = request.nextUrl.searchParams;
  const from = query.get("from");
  const days = Math.min(Math.max(Number(query.get("days")) || 7, 1), 14);
  if (!isValidIsoDate(from)) return json({ ok: false }, 400);

  try {
    const result = await freeSlots(calendar, from, addDays(from, days - 1));
    return json({ ok: true, timeZone: calendar.time_zone, days: result });
  } catch (error) {
    console.error("Couldn't work out free times", error);
    return json({ ok: false }, 500);
  }
}
