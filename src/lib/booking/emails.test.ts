import { describe, expect, it } from "vitest";
import { bookingEmail, bookingIcs, type BookingForEmail, type CalendarForEmail } from "@/lib/booking/emails";

const booking: BookingForEmail = {
  id: "7d3f6a1e-0000-4000-8000-000000000001",
  starts_at: "2026-10-20T08:00:00.000Z",
  ends_at: "2026-10-20T08:30:00.000Z",
  name: "<b>Ida</b> Holm",
  email: "ida@example.com",
  meeting_url: "https://meet.google.com/abc-defg-hij",
  cancel_token: "a".repeat(64),
};

const calendar: CalendarForEmail = {
  name: "Strategimøde; gratis, 30 min",
  slug: "strategi",
  time_zone: "Europe/Copenhagen",
  language: "da",
  location_type: "google_meet",
  location_detail: null,
};

describe("booking emails", () => {
  it("writes the confirmation in the booking page's language, with a cancel link", () => {
    const email = bookingEmail("confirm", booking, calendar, "https://holmos.example");
    expect(email.subject).toMatch(/^Bekræftet: Strategimøde; gratis, 30 min – tirsdag 20\. oktober/);
    expect(email.subject).toContain("10.00");
    expect(email.text).toContain("https://holmos.example/book/cancel/" + "a".repeat(64));
    expect(email.text).toContain("https://meet.google.com/abc-defg-hij");
    expect(email.html).toContain("Hej &lt;b&gt;Ida&lt;/b&gt;,");
    expect(email.html).not.toContain("<b>Ida</b>");
  });

  it("offers to book again once cancelled, in English when chosen", () => {
    const email = bookingEmail("cancel", booking, { ...calendar, language: "en" }, "https://holmos.example");
    expect(email.subject).toMatch(/^Cancelled: /);
    expect(email.text).toContain("Book a new time: https://holmos.example/book/strategi");
    expect(email.text).not.toContain("meet.google.com");
  });
});

describe("calendar file", () => {
  it("is a valid event with escaped text and folded long lines", () => {
    const ics = bookingIcs(booking, calendar, { now: new Date("2026-10-15T12:00:00Z") });
    expect(ics).toContain("DTSTART:20261020T080000Z\r\n");
    expect(ics).toContain("DTEND:20261020T083000Z\r\n");
    expect(ics).toContain("SUMMARY:Strategimøde\\; gratis\\, 30 min\r\n");
    expect(ics).toContain("UID:7d3f6a1e-0000-4000-8000-000000000001@holmos\r\n");
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);

    const cancelled = bookingIcs(booking, calendar, { cancelled: true });
    expect(cancelled).toContain("METHOD:CANCEL");
    expect(cancelled).toContain("STATUS:CANCELLED");
  });
});
