import { describe, expect, it } from "vitest";
import { availableSlots, isDueForReminder, isSlotAvailable, weeklyHoursSchema, type SlotRules, type WeeklyHours } from "@/lib/booking/slots";
import { dayKey, localDate, localTime, zonedToUtc } from "@/lib/booking/time";

const CPH = "Europe/Copenhagen";

const weekdays = (from: string, to: string): WeeklyHours => ({
  mon: [[from, to]],
  tue: [[from, to]],
  wed: [[from, to]],
  thu: [[from, to]],
  fri: [[from, to]],
  sat: [],
  sun: [],
});

const rules = (overrides: Partial<SlotRules> = {}): SlotRules => ({
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  slotIntervalMinutes: 30,
  minNoticeMinutes: 0,
  maxDaysAhead: 60,
  timeZone: CPH,
  availability: weekdays("09:00", "11:00"),
  ...overrides,
});

const times = (slots: string[]) => slots.map((iso) => localTime(new Date(iso), CPH));

describe("time zones", () => {
  it("converts Copenhagen wall-clock time to UTC in summer and winter", () => {
    expect(zonedToUtc("2026-07-01", "09:00", CPH).toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "09:00", CPH).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    // The days the clocks change.
    expect(zonedToUtc("2026-03-29", "09:00", CPH).toISOString()).toBe("2026-03-29T07:00:00.000Z");
    expect(zonedToUtc("2026-10-25", "09:00", CPH).toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });

  it("knows the local date and weekday", () => {
    expect(localDate(new Date("2026-10-19T22:30:00Z"), CPH)).toBe("2026-10-20");
    expect(dayKey("2026-10-19")).toBe("mon");
    expect(dayKey("2026-10-25")).toBe("sun");
  });
});

describe("available booking times", () => {
  const monday = "2026-10-19";
  const sundayBefore = new Date("2026-10-18T12:00:00Z");

  it("offers every interval that fits inside the opening hours", () => {
    const [day] = availableSlots(rules(), { from: monday, to: monday, now: sundayBefore, busy: [] });
    expect(times(day.slots)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("skips weekends, and steps by the chosen interval", () => {
    const days = availableSlots(rules({ durationMinutes: 45, slotIntervalMinutes: 15 }), {
      from: "2026-10-17",
      to: monday,
      now: new Date("2026-10-16T12:00:00Z"),
      busy: [],
    });
    expect(days.map((d) => [d.date, d.slots.length])).toEqual([
      ["2026-10-17", 0],
      ["2026-10-18", 0],
      [monday, 6],
    ]);
    expect(times(days[2].slots)).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00", "10:15"]);
  });

  it("keeps clear of busy time, counting the buffers", () => {
    const busy = [{ start: Date.parse("2026-10-19T08:00:00Z"), end: Date.parse("2026-10-19T08:30:00Z") }]; // 10:00–10:30 local
    const [plain] = availableSlots(rules(), { from: monday, to: monday, now: sundayBefore, busy });
    expect(times(plain.slots)).toEqual(["09:00", "09:30", "10:30"]);

    const [buffered] = availableSlots(rules({ bufferBeforeMinutes: 15, bufferAfterMinutes: 15 }), {
      from: monday,
      to: monday,
      now: sundayBefore,
      busy,
    });
    expect(times(buffered.slots)).toEqual(["09:00"]);
  });

  it("respects minimum notice and how far ahead people can book", () => {
    const now = new Date("2026-10-19T07:10:00Z"); // 09:10 on Monday
    const [today] = availableSlots(rules({ minNoticeMinutes: 60 }), { from: monday, to: monday, now, busy: [] });
    expect(times(today.slots)).toEqual(["10:30"]);

    const days = availableSlots(rules({ maxDaysAhead: 2 }), { from: monday, to: "2026-10-30", now, busy: [] });
    expect(days.map((d) => d.date)).toEqual([monday, "2026-10-20", "2026-10-21"]);
    expect(availableSlots(rules(), { from: "2026-10-12", to: "2026-10-16", now, busy: [] })).toEqual([]);
  });

  it("keeps local opening hours across the change to winter time", () => {
    const sundayChange = rules({ availability: { ...weekdays("09:00", "10:00"), sun: [["09:00", "10:00"]] } });
    const [day] = availableSlots(sundayChange, { from: "2026-10-25", to: "2026-10-25", now: new Date("2026-10-20T00:00:00Z"), busy: [] });
    expect(day.slots).toEqual(["2026-10-25T08:00:00.000Z", "2026-10-25T08:30:00.000Z"]);
  });

  it("checks a chosen time again when the visitor confirms", () => {
    expect(isSlotAvailable(rules(), "2026-10-19T07:30:00.000Z", sundayBefore, [])).toBe(true);
    expect(isSlotAvailable(rules(), "2026-10-19T07:45:00.000Z", sundayBefore, [])).toBe(false);
    expect(isSlotAvailable(rules(), "not a date", sundayBefore, [])).toBe(false);
    const busy = [{ start: Date.parse("2026-10-19T07:30:00Z"), end: Date.parse("2026-10-19T08:00:00Z") }];
    expect(isSlotAvailable(rules(), "2026-10-19T07:30:00.000Z", sundayBefore, busy)).toBe(false);
  });
});

describe("weekly hours", () => {
  it("accepts sensible hours and rejects backwards or overlapping ranges", () => {
    expect(weeklyHoursSchema.safeParse(weekdays("09:00", "17:00")).success).toBe(true);
    expect(weeklyHoursSchema.safeParse(weekdays("17:00", "09:00")).success).toBe(false);
    expect(weeklyHoursSchema.safeParse({ ...weekdays("09:00", "12:00"), mon: [["09:00", "12:00"], ["11:00", "13:00"]] }).success).toBe(false);
    expect(weeklyHoursSchema.safeParse({ ...weekdays("09:00", "12:00"), mon: [["9:00", "12:00"]] }).success).toBe(false);
  });
});

describe("reminders", () => {
  const now = new Date("2026-10-19T05:00:00Z");
  it("sends within a day of the meeting, unless it was booked at the last minute", () => {
    expect(isDueForReminder({ starts_at: "2026-10-19T13:00:00Z", created_at: "2026-10-10T10:00:00Z" }, now)).toBe(true);
    expect(isDueForReminder({ starts_at: "2026-10-20T13:00:00Z", created_at: "2026-10-10T10:00:00Z" }, now)).toBe(false);
    expect(isDueForReminder({ starts_at: "2026-10-19T07:00:00Z", created_at: "2026-10-19T05:00:00Z" }, now)).toBe(false);
    expect(isDueForReminder({ starts_at: "2026-10-19T04:00:00Z", created_at: "2026-10-10T10:00:00Z" }, now)).toBe(false);
  });
});
