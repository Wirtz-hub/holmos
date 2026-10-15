import { z } from "zod";
import { addDays, eachDay } from "@/lib/dates";
import { DAY_KEYS, dayKey, localDate, minutesOf, zonedToUtc, type DayKey } from "@/lib/booking/time";

// Which start times a booking page offers. Pure functions, so they're easy to test.

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

const rangeSchema = z
  .tuple([z.string().regex(TIME), z.string().regex(TIME)])
  .refine(([start, end]) => minutesOf(start) < minutesOf(end), "Each time range must end after it starts");

export const weeklyHoursSchema = z
  .object(Object.fromEntries(DAY_KEYS.map((day) => [day, z.array(rangeSchema).max(6)])) as Record<DayKey, z.ZodArray<typeof rangeSchema>>)
  .refine(
    (hours) =>
      DAY_KEYS.every((day) => {
        const sorted = [...hours[day]].sort((a, b) => minutesOf(a[0]) - minutesOf(b[0]));
        return sorted.every((range, i) => i === 0 || minutesOf(sorted[i - 1][1]) <= minutesOf(range[0]));
      }),
    "Time ranges on the same day can't overlap",
  );

export type WeeklyHours = Record<DayKey, [string, string][]>;

export type SlotRules = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  slotIntervalMinutes: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  timeZone: string;
  availability: WeeklyHours;
};

/** A busy stretch of time, in epoch milliseconds. */
export type Busy = { start: number; end: number };

export type DaySlots = { date: string; slots: string[] };

/** The last date (YYYY-MM-DD, calendar time zone) a visitor may book. */
export function lastBookableDate(rules: SlotRules, now: Date) {
  return addDays(localDate(now, rules.timeZone), rules.maxDaysAhead);
}

/** The stretch a meeting starting at `start` blocks, including its buffers. */
export function blockedRange(rules: SlotRules, start: number): Busy {
  return {
    start: start - rules.bufferBeforeMinutes * 60_000,
    end: start + (rules.durationMinutes + rules.bufferAfterMinutes) * 60_000,
  };
}

/**
 * Free start times for each date from `from` to `to` (calendar time zone),
 * honouring weekly hours, minimum notice, how far ahead people may book, and
 * busy time (other bookings and Google Calendar events).
 */
export function availableSlots(rules: SlotRules, input: { from: string; to: string; now: Date; busy: Busy[] }): DaySlots[] {
  const { now, busy } = input;
  const today = localDate(now, rules.timeZone);
  const first = input.from < today ? today : input.from;
  const lastAllowed = lastBookableDate(rules, now);
  const last = input.to > lastAllowed ? lastAllowed : input.to;
  if (first > last) return [];

  const earliest = now.getTime() + rules.minNoticeMinutes * 60_000;
  const duration = rules.durationMinutes * 60_000;
  const step = rules.slotIntervalMinutes * 60_000;

  return eachDay({ from: first, to: last }).map((date) => {
    const slots: string[] = [];
    for (const [from, to] of rules.availability[dayKey(date)] ?? []) {
      // "24:00" rolls over to midnight, which Date.UTC handles.
      const windowEnd = zonedToUtc(date, to, rules.timeZone).getTime();
      for (let start = zonedToUtc(date, from, rules.timeZone).getTime(); start + duration <= windowEnd; start += step) {
        if (start < earliest) continue;
        const blocked = blockedRange(rules, start);
        if (busy.some((b) => b.start < blocked.end && b.end > blocked.start)) continue;
        slots.push(new Date(start).toISOString());
      }
    }
    return { date, slots };
  });
}

/** Is `startIso` one of the offered times right now? Used again when the visitor confirms. */
export function isSlotAvailable(rules: SlotRules, startIso: string, now: Date, busy: Busy[]) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return false;
  const date = localDate(start, rules.timeZone);
  const [day] = availableSlots(rules, { from: date, to: date, now, busy });
  return Boolean(day?.slots.includes(start.toISOString()));
}

/** Reminders go out within a day of the meeting, unless it was booked at the last minute. */
export const REMINDER_WINDOW_HOURS = 24;
export const SKIP_REMINDER_IF_BOOKED_WITHIN_HOURS = 3;

export function isDueForReminder(booking: { starts_at: string; created_at: string }, now: Date) {
  const start = new Date(booking.starts_at).getTime();
  const created = new Date(booking.created_at).getTime();
  return (
    start > now.getTime() &&
    start - now.getTime() <= REMINDER_WINDOW_HOURS * 3_600_000 &&
    start - created > SKIP_REMINDER_IF_BOOKED_WITHIN_HOURS * 3_600_000
  );
}
