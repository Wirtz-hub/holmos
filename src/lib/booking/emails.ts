import { escapeHtml } from "@/lib/html";
import { describeLocation, formatMeetingTime, publicText } from "@/lib/public-text";

// Emails to the person who booked (in the booking page's language), plus a
// calendar file so the meeting lands in their own calendar.

export type BookingForEmail = {
  id: string;
  starts_at: string;
  ends_at: string;
  name: string;
  email: string;
  meeting_url: string | null;
  cancel_token: string;
};

export type CalendarForEmail = {
  name: string;
  slug: string;
  time_zone: string;
  language: string;
  location_type: string;
  location_detail: string | null;
};

export type BookingEmailKind = "confirm" | "reminder" | "cancel";

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Calendar lines may be at most 75 bytes; longer ones continue on the next line after a space. */
function fold(line: string) {
  const out: string[] = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char, "utf8") > (out.length ? 74 : 75)) {
      out.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

export function bookingIcs(booking: BookingForEmail, calendar: CalendarForEmail, opts: { cancelled?: boolean; now?: Date } = {}) {
  const where = booking.meeting_url ?? describeLocation(calendar.location_type, calendar.location_detail, calendar.language);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HolmOS//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${booking.id}@holmos`,
    `DTSTAMP:${icsDate((opts.now ?? new Date()).toISOString())}`,
    `DTSTART:${icsDate(booking.starts_at)}`,
    `DTEND:${icsDate(booking.ends_at)}`,
    `SUMMARY:${icsText(calendar.name)}`,
    ...(where ? [`LOCATION:${icsText(where)}`] : []),
    ...(booking.meeting_url ? [`URL:${booking.meeting_url}`] : []),
    `STATUS:${opts.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    `SEQUENCE:${opts.cancelled ? 1 : 0}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** The subject, HTML and plain text for an email to the person who booked. */
export function bookingEmail(kind: BookingEmailKind, booking: BookingForEmail, calendar: CalendarForEmail, appUrl: string) {
  const text = publicText(calendar.language);
  const when = formatMeetingTime(booking.starts_at, calendar.time_zone, calendar.language);
  const where = describeLocation(calendar.location_type, calendar.location_detail, calendar.language);
  const firstName = booking.name.split(/\s+/)[0] || booking.name;
  const what = `${calendar.name} – ${when}`;

  const subject =
    kind === "confirm" ? text.emailConfirmSubject(what) : kind === "reminder" ? text.emailReminderSubject(what) : text.emailCancelSubject(what);
  const intro =
    kind === "confirm" ? text.emailConfirmIntro(firstName) : kind === "reminder" ? text.emailReminderIntro(firstName) : text.emailCancelIntro(firstName);

  const cancelUrl = `${appUrl}/book/cancel/${booking.cancel_token}`;
  const bookUrl = `${appUrl}/book/${calendar.slug}`;
  const rows: [string, string, string | null][] = [
    [text.emailWhen, when, null],
    ...(where ? ([[text.emailWhere, where, null]] as [string, string, null][]) : []),
    ...(booking.meeting_url && kind !== "cancel" ? ([[text.joinMeeting, booking.meeting_url, booking.meeting_url]] as [string, string, string][]) : []),
  ];
  const link: [string, string] = kind === "cancel" ? [text.emailBookAgain, bookUrl] : [text.emailCancelLink, cancelUrl];

  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(calendar.name)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px">
${rows
  .map(
    ([label, value, href]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0">${
        href ? `<a href="${escapeHtml(href)}" style="color:#1d4669">${escapeHtml(value)}</a>` : escapeHtml(value)
      }</td></tr>`,
  )
  .join("\n")}
</table>
<p style="margin:24px 0 0;font-size:14px"><a href="${escapeHtml(link[1])}" style="color:#1d4669">${escapeHtml(link[0])}</a></p>
</div></div></body></html>`;

  const plain = [intro, "", ...rows.map(([label, value]) => `${label}: ${value}`), "", `${link[0]}: ${link[1]}`].join("\n");

  return { subject, html, text: plain };
}
