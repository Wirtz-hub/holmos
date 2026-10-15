import "server-only";
import { addDays } from "@/lib/dates";
import { bookingEmail, bookingIcs, type BookingForEmail, type CalendarForEmail } from "@/lib/booking/emails";
import {
  availableSlots,
  isDueForReminder,
  isSlotAvailable,
  weeklyHoursSchema,
  type Busy,
  type SlotRules,
  type WeeklyHours,
} from "@/lib/booking/slots";
import { localDate, zonedToUtc } from "@/lib/booking/time";
import { sendEmail } from "@/lib/email";
import { busyTimes, createCalendarEvent, deleteCalendarEvent, getCalendarAccess } from "@/lib/google-calendar";
import { escapeHtml } from "@/lib/html";
import { describeLocation, formatMeetingTime } from "@/lib/public-text";
import { createAdminClient } from "@/lib/supabase/admin";
import { appAddress } from "@/lib/urls";

// Booking logic that needs the server: busy times from the database and
// Google Calendar, making and cancelling bookings, and the emails around them.

export type CalendarRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  slot_interval_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  time_zone: string;
  availability: WeeklyHours;
  location_type: "google_meet" | "phone" | "in_person" | "custom";
  location_detail: string | null;
  language: "da" | "en";
  lead_stage: string;
  notify_email: string | null;
  is_active: boolean;
};

export type BookingRow = {
  id: string;
  calendar_id: string;
  client_id: string | null;
  starts_at: string;
  ends_at: string;
  name: string;
  email: string;
  phone: string | null;
  note: string | null;
  status: "confirmed" | "cancelled";
  cancel_token: string;
  google_event_id: string | null;
  google_calendar_id: string | null;
  meeting_url: string | null;
  reminder_sent_at: string | null;
  created_at: string;
};

const EMPTY_WEEK: WeeklyHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

export function toRules(calendar: CalendarRow): SlotRules {
  const hours = weeklyHoursSchema.safeParse(calendar.availability);
  return {
    durationMinutes: calendar.duration_minutes,
    bufferBeforeMinutes: calendar.buffer_before_minutes,
    bufferAfterMinutes: calendar.buffer_after_minutes,
    slotIntervalMinutes: calendar.slot_interval_minutes,
    minNoticeMinutes: calendar.min_notice_minutes,
    maxDaysAhead: calendar.max_days_ahead,
    timeZone: calendar.time_zone,
    availability: hours.success ? (hours.data as WeeklyHours) : EMPTY_WEEK,
  };
}

export function appUrl() {
  return appAddress("");
}

/** An active booking calendar, by address or id. */
export async function getActiveCalendar(key: string): Promise<CalendarRow | null> {
  const admin = createAdminClient();
  const isId = /^[0-9a-f-]{36}$/i.test(key);
  const { data } = await admin
    .from("booking_calendars")
    .select("*")
    .eq(isId ? "id" : "slug", key)
    .eq("is_active", true)
    .maybeSingle();
  return (data as CalendarRow | null) ?? null;
}

/** Time already taken between two dates: confirmed bookings (with buffers) and Google Calendar events. */
async function busyBetween(from: Date, to: Date): Promise<Busy[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("blocked_from, blocked_until")
    .eq("status", "confirmed")
    .lt("blocked_from", to.toISOString())
    .gt("blocked_until", from.toISOString());
  if (error) throw new Error(error.message);
  const busy: Busy[] = (data ?? []).map((b) => ({ start: Date.parse(b.blocked_from), end: Date.parse(b.blocked_until) }));

  try {
    const google = await getCalendarAccess();
    if (google) busy.push(...(await busyTimes(google.token, google.connection.busy_calendar_ids, from, to)));
  } catch (error) {
    // Google being unreachable shouldn't stop people booking; HolmOS's own bookings still count.
    console.error("Couldn't read Google Calendar busy times", error);
  }
  return busy;
}

/** The stretch of time to check for busy-ness for local dates `from`..`to`, with a day's margin. */
function busyWindow(rules: SlotRules, from: string, to: string) {
  return { start: zonedToUtc(addDays(from, -1), "00:00", rules.timeZone), end: zonedToUtc(addDays(to, 2), "00:00", rules.timeZone) };
}

export async function freeSlots(calendar: CalendarRow, from: string, to: string) {
  const rules = toRules(calendar);
  const { start, end } = busyWindow(rules, from, to);
  const busy = await busyBetween(start, end);
  return availableSlots(rules, { from, to, now: new Date(), busy });
}

export class BookingError extends Error {
  constructor(
    readonly code: "slot_taken" | "calendar_closed" | "rate_limited" | "invalid",
    message: string,
  ) {
    super(message);
  }
}

const forEmail = (calendar: CalendarRow): CalendarForEmail => ({
  name: calendar.name,
  slug: calendar.slug,
  time_zone: calendar.time_zone,
  language: calendar.language,
  location_type: calendar.location_type,
  location_detail: calendar.location_detail,
});

export async function createBooking(
  calendar: CalendarRow,
  input: { startsAt: string; name: string; email: string; phone: string; note: string; ipHash: string | null },
) {
  const rules = toRules(calendar);
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) throw new BookingError("invalid", "Pick a time.");
  const date = localDate(start, rules.timeZone);
  const range = busyWindow(rules, date, date);
  const busy = await busyBetween(range.start, range.end);
  if (!isSlotAvailable(rules, start.toISOString(), new Date(), busy)) {
    throw new BookingError("slot_taken", "That time is no longer available.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("book_slot", {
    p_calendar_id: calendar.id,
    p_starts_at: start.toISOString(),
    p_contact: { name: input.name, email: input.email, phone: input.phone },
    p_note: input.note || null,
    p_ip_hash: input.ipHash,
  });
  if (error) {
    if (/slot_taken|slot_in_past/.test(error.message)) throw new BookingError("slot_taken", "That time is no longer available.");
    if (/rate_limited/.test(error.message)) throw new BookingError("rate_limited", "Too many bookings.");
    if (/calendar_closed/.test(error.message)) throw new BookingError("calendar_closed", "This calendar is closed.");
    throw new Error(error.message);
  }
  const result = data as { booking_id: string; client_id: string; cancel_token: string; starts_at: string; ends_at: string };

  // Add it to Google Calendar (with a Meet link if chosen). The booking stands even if this fails.
  let meetingUrl: string | null = null;
  try {
    const google = await getCalendarAccess();
    if (google) {
      const where = describeLocation(calendar.location_type, calendar.location_detail, "en");
      const event = await createCalendarEvent(google.token, google.connection.event_calendar_id, {
        requestId: result.booking_id,
        summary: `${calendar.name}: ${input.name}`,
        description: [
          `Booked through HolmOS by ${input.name} (${input.email}${input.phone ? `, ${input.phone}` : ""}).`,
          input.note ? `\nNote: ${input.note}` : "",
          `\nClient: ${appUrl()}/clients/${result.client_id}`,
        ].join(""),
        start: result.starts_at,
        end: result.ends_at,
        attendeeEmail: input.email,
        location: calendar.location_type === "google_meet" ? undefined : where,
        meet: calendar.location_type === "google_meet",
      });
      meetingUrl = event.meetingUrl;
      await admin
        .from("bookings")
        .update({ google_event_id: event.id, google_calendar_id: google.connection.event_calendar_id, meeting_url: meetingUrl })
        .eq("id", result.booking_id);
    }
  } catch (error) {
    console.error("Couldn't add the booking to Google Calendar", error);
  }

  const booking: BookingForEmail = {
    id: result.booking_id,
    starts_at: result.starts_at,
    ends_at: result.ends_at,
    name: input.name,
    email: input.email,
    meeting_url: meetingUrl,
    cancel_token: result.cancel_token,
  };
  return { booking, clientId: result.client_id };
}

/** Emails after a new booking: a confirmation to the visitor and a heads-up to you. */
export async function sendBookingCreatedEmails(calendar: CalendarRow, booking: BookingForEmail, clientId: string, extra: { phone: string; note: string }) {
  const email = bookingEmail("confirm", booking, forEmail(calendar), appUrl());
  await sendEmail({
    to: booking.email,
    ...email,
    replyTo: calendar.notify_email,
    attachments: [{ filename: "invite.ics", content: bookingIcs(booking, forEmail(calendar)), contentType: "text/calendar" }],
    idempotencyKey: `booking-confirm-${booking.id}`,
  });
  if (calendar.notify_email) {
    const when = formatMeetingTime(booking.starts_at, calendar.time_zone, "en");
    const lines = [
      `${booking.name} booked “${calendar.name}” for ${when}.`,
      `Email: ${booking.email}`,
      extra.phone ? `Phone: ${extra.phone}` : "",
      extra.note ? `Note: ${extra.note}` : "",
      booking.meeting_url ? `Meeting link: ${booking.meeting_url}` : "",
      `Client record: ${appUrl()}/clients/${clientId}`,
    ].filter(Boolean);
    await sendEmail({
      to: calendar.notify_email,
      subject: `New booking: ${booking.name} – ${when}`,
      text: lines.join("\n"),
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">${lines.map((l) => escapeHtml(l)).join("<br>")}</div>`,
      replyTo: booking.email,
      idempotencyKey: `booking-notify-${booking.id}`,
    });
  }
}

/**
 * After a booking is cancelled (by the visitor or by you): remove the Google
 * event and let the other side know.
 */
export async function afterBookingCancelled(bookingId: string, opts: { by: "guest" | "you"; emailGuest: boolean }) {
  const admin = createAdminClient();
  const { data } = await admin.from("bookings").select("*, booking_calendars(*)").eq("id", bookingId).maybeSingle();
  if (!data) return;
  const { booking_calendars: calendar, ...booking } = data as BookingRow & { booking_calendars: CalendarRow };

  if (booking.google_event_id) {
    try {
      const google = await getCalendarAccess();
      if (google) await deleteCalendarEvent(google.token, booking.google_calendar_id ?? google.connection.event_calendar_id, booking.google_event_id);
    } catch (error) {
      console.error("Couldn't remove the Google Calendar event", error);
    }
  }

  const forGuest: BookingForEmail = { ...booking };
  if (opts.emailGuest) {
    await sendEmail({
      to: booking.email,
      ...bookingEmail("cancel", forGuest, forEmail(calendar), appUrl()),
      replyTo: calendar.notify_email,
      attachments: [{ filename: "cancel.ics", content: bookingIcs(forGuest, forEmail(calendar), { cancelled: true }), contentType: "text/calendar" }],
      idempotencyKey: `booking-cancel-${booking.id}`,
    });
  }
  if (opts.by === "guest" && calendar.notify_email) {
    const when = formatMeetingTime(booking.starts_at, calendar.time_zone, "en");
    const text = `${booking.name} (${booking.email}) cancelled “${calendar.name}” on ${when}.`;
    await sendEmail({
      to: calendar.notify_email,
      subject: `Cancelled: ${booking.name} – ${when}`,
      text,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px">${escapeHtml(text)}</div>`,
      idempotencyKey: `booking-cancel-notify-${booking.id}`,
    });
  }
}

/** Sends due reminders. Called by the daily Vercel cron job. */
export async function sendDueReminders(now = new Date()) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("*, booking_calendars(*)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + 24 * 3_600_000).toISOString());
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as (BookingRow & { booking_calendars: CalendarRow })[]) {
    const { booking_calendars: calendar, ...booking } = row;
    if (!isDueForReminder(booking, now)) continue;
    // Claim it first, so two runs never send the same reminder twice.
    const { data: claimed } = await admin
      .from("bookings")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", booking.id)
      .is("reminder_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    const result = await sendEmail({
      to: booking.email,
      ...bookingEmail("reminder", booking, forEmail(calendar), appUrl()),
      replyTo: calendar.notify_email,
      idempotencyKey: `booking-reminder-${booking.id}`,
    });
    if (result.sent) {
      sent++;
    } else {
      failed++;
      await admin.from("bookings").update({ reminder_sent_at: null }).eq("id", booking.id);
    }
  }
  return { sent, failed };
}
