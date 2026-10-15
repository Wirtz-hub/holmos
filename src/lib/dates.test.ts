import { describe, expect, it } from "vitest";
import { eachDay, isValidIsoDate, presetRange, resolveRange, todayIn } from "@/lib/dates";

describe("presetRange", () => {
  const today = "2026-10-15";
  it("'last N days' are full days ending yesterday", () => {
    expect(presetRange("7d", today)).toEqual({ from: "2026-10-08", to: "2026-10-14" });
    expect(eachDay(presetRange("30d", today))).toHaveLength(30);
  });
  it("this month runs to today", () => {
    expect(presetRange("this_month", today)).toEqual({ from: "2026-10-01", to: "2026-10-15" });
  });
  it("last month handles the year boundary", () => {
    expect(presetRange("last_month", "2027-01-05")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("resolveRange", () => {
  const today = "2026-10-15";
  it("defaults to the last 30 days", () => {
    expect(resolveRange({}, today)).toEqual({ preset: "30d", range: { from: "2026-09-15", to: "2026-10-14" } });
  });
  it("accepts a custom range, swapping reversed dates and clamping the future", () => {
    expect(resolveRange({ from: "2026-12-01", to: "2026-10-01" }, today)).toEqual({
      preset: "custom",
      range: { from: "2026-10-01", to: "2026-10-15" },
    });
  });
  it("ignores garbage (which also keeps it out of API queries)", () => {
    expect(resolveRange({ from: "2026-02-30", to: "x' OR 1=1" }, today).preset).toBe("30d");
    expect(isValidIsoDate("2026-02-30")).toBe(false);
  });
  it("caps very long ranges", () => {
    const { range } = resolveRange({ from: "2020-01-01", to: "2026-10-01" }, today);
    expect(eachDay(range).length).toBe(401);
  });
});

it("todayIn uses the agency time zone", () => {
  // 23:30 UTC on 14 Oct is already 15 Oct in Copenhagen (UTC+2 in October).
  expect(todayIn("Europe/Copenhagen", new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-15");
});
