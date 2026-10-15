import { describe, expect, it } from "vitest";
import { planDrop } from "@/lib/pipeline";
import type { Stage } from "@/lib/types";

const card = (id: string, stage: Stage, stage_position: number) => ({ id, stage, stage_position });
const cards = [card("a", "new", 0), card("b", "new", 1), card("c", "new", 2), card("x", "won", 5)];

describe("planDrop", () => {
  it("dropping on a card in another column takes that card's slot", () => {
    expect(planDrop(cards, "x", { type: "card", id: "b" })).toEqual({ stage: "new", position: 0.5 });
  });
  it("dropping on the first card puts it at the top", () => {
    expect(planDrop(cards, "x", { type: "card", id: "a" })).toEqual({ stage: "new", position: -1 });
  });
  it("moving down within a column lands below the target", () => {
    expect(planDrop(cards, "a", { type: "card", id: "b" })).toEqual({ stage: "new", position: 1.5 });
    expect(planDrop(cards, "a", { type: "card", id: "c" })).toEqual({ stage: "new", position: 3 });
  });
  it("moving up within a column lands above the target", () => {
    expect(planDrop(cards, "c", { type: "card", id: "a" })).toEqual({ stage: "new", position: -1 });
  });
  it("dropping on a column appends to the end", () => {
    expect(planDrop(cards, "a", { type: "column", stage: "won" })).toEqual({ stage: "won", position: 6 });
    expect(planDrop(cards, "a", { type: "column", stage: "lost" })).toEqual({ stage: "lost", position: 0 });
  });
  it("ignores no-op drops", () => {
    expect(planDrop(cards, "a", { type: "card", id: "a" })).toBeNull();
    expect(planDrop(cards, "a", { type: "column", stage: "new" })).toBeNull();
  });
});
