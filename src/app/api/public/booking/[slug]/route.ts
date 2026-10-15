import { after, type NextRequest } from "next/server";
import { BookingError, createBooking, getActiveCalendar, sendBookingCreatedEmails } from "@/lib/booking/server";
import { isEmailConfigured } from "@/lib/email";
import { publicText } from "@/lib/public-text";
import { json, looksLikeBot, readJson, visitorIpHash } from "@/lib/request";

// PUBLIC: a visitor books a time. No login — the deliberate exception to
// requireAdmin(). The time is checked again against the calendar's rules and
// busy times, and the database refuses double bookings on its own.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s().-]{6,25}$/;

const field = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const calendar = await getActiveCalendar(slug);
  const text = publicText(calendar?.language);
  if (!calendar) return json({ ok: false, message: text.calendarUnavailable }, 404);

  const body = await readJson(request);
  if (!body) return json({ ok: false, message: text.formError }, 400);
  if (looksLikeBot(body)) return json({ ok: false, message: text.formError }, 400);

  const input = {
    startsAt: field(body.startsAt, 40),
    name: field(body.name, 200),
    email: field(body.email, 320).toLowerCase(),
    phone: field(body.phone, 40),
    note: field(body.note, 2000),
  };
  const errors: Record<string, string> = {};
  if (!input.name) errors.name = text.required;
  if (!EMAIL.test(input.email)) errors.email = input.email ? text.badEmail : text.required;
  if (calendar.location_type === "phone" && !input.phone) errors.phone = text.required;
  if (input.phone && (!PHONE.test(input.phone) || input.phone.replace(/\D/g, "").length < 6)) errors.phone = text.badPhone;
  if (Object.keys(errors).length) return json({ ok: false, errors }, 400);

  try {
    const { booking, clientId } = await createBooking(calendar, { ...input, ipHash: visitorIpHash(request) });
    after(() => sendBookingCreatedEmails(calendar, booking, clientId, { phone: input.phone, note: input.note }));
    return json({
      ok: true,
      booking: { startsAt: booking.starts_at, endsAt: booking.ends_at, meetingUrl: booking.meeting_url },
      emailSent: isEmailConfigured(),
    });
  } catch (error) {
    if (error instanceof BookingError) {
      const status = { slot_taken: 409, calendar_closed: 410, rate_limited: 429, invalid: 400 }[error.code];
      const message = { slot_taken: text.slotTaken, calendar_closed: text.calendarUnavailable, rate_limited: text.tooMany, invalid: text.chooseTime }[
        error.code
      ];
      return json({ ok: false, code: error.code, message }, status);
    }
    console.error("Booking failed", error);
    return json({ ok: false, message: text.formError }, 500);
  }
}
