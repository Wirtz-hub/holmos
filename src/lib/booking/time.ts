// Time zone arithmetic without a date library. Booking pages work in the
// calendar's own time zone (e.g. Europe/Copenhagen), across summer time changes.

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string) {
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock date and time at `date` in `timeZone`. */
export function zonedParts(date: Date, timeZone: string) {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second };
}

/** How far `timeZone` is ahead of UTC at `date`, in milliseconds. */
export function offsetMs(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-20" + "09:30" in Copenhagen → the matching instant. */
export function zonedToUtc(isoDate: string, time: string, timeZone: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallClock = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset on either side of a summer-time change.
  let guess = wallClock - offsetMs(new Date(wallClock), timeZone);
  guess = wallClock - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The calendar date (YYYY-MM-DD) at `date` in `timeZone`. */
export function localDate(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The wall-clock time (HH:MM) at `date` in `timeZone`. */
export function localTime(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function dayKey(isoDate: string): DayKey {
  const [y, m, d] = isoDate.split("-").map(Number);
  // getUTCDay: 0 = Sunday.
  return DAY_KEYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

export function minutesOf(time: string) {
  const [hh, mm] = time.split(":").map(Number);
  return hh * 60 + mm;
}
