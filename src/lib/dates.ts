// Date ranges for the ad dashboards. All dates are plain YYYY-MM-DD strings
// (inclusive on both ends), which is what both ad platforms expect.

export type DateRange = { from: string; to: string };

export const AGENCY_TIME_ZONE = "Europe/Copenhagen";

export const PRESETS = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
] as const;

export type PresetId = (typeof PRESETS)[number]["id"];
export const DEFAULT_PRESET: PresetId = "30d";
export const MAX_RANGE_DAYS = 400;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in the agency's time zone, as YYYY-MM-DD. */
export function todayIn(timeZone = AGENCY_TIME_ZONE, now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtcDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  return toIso(toUtcDate(value)) === value;
}

/** Like the ad platforms, "last N days" means N full days, ending yesterday. */
export function presetRange(preset: PresetId, today: string): DateRange {
  const yesterday = addDays(today, -1);
  switch (preset) {
    case "7d":
      return { from: addDays(today, -7), to: yesterday };
    case "30d":
      return { from: addDays(today, -30), to: yesterday };
    case "90d":
      return { from: addDays(today, -90), to: yesterday };
    case "this_month":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case "last_month": {
      const firstOfThisMonth = `${today.slice(0, 8)}01`;
      const lastOfPrevMonth = addDays(firstOfThisMonth, -1);
      return { from: `${lastOfPrevMonth.slice(0, 8)}01`, to: lastOfPrevMonth };
    }
  }
}

/** Turn URL search params into a safe, bounded date range. */
export function resolveRange(
  params: { preset?: string; from?: string; to?: string },
  today: string,
): { range: DateRange; preset: PresetId | "custom" } {
  const { from, to } = params;
  if (isValidIsoDate(from) && isValidIsoDate(to)) {
    let start = from <= to ? from : to;
    let end = from <= to ? to : from;
    if (end > today) end = today;
    if (start > end) start = end;
    if (daysBetween(start, end) > MAX_RANGE_DAYS) start = addDays(end, -MAX_RANGE_DAYS);
    return { range: { from: start, to: end }, preset: "custom" };
  }
  const preset = PRESETS.some((p) => p.id === params.preset) ? (params.preset as PresetId) : DEFAULT_PRESET;
  return { range: presetRange(preset, today), preset };
}

/** Every date in the range, in order. */
export function eachDay(range: DateRange): string[] {
  const days: string[] = [];
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) days.push(day);
  return days;
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(toUtcDate(iso));
}

export function formatRange(range: DateRange) {
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  const start = formatDay(range.from, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  const end = formatDay(range.to, { day: "numeric", month: "short", year: "numeric" });
  return range.from === range.to ? end : `${start} – ${end}`;
}
