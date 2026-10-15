import type { Goal, Stage } from "@/lib/types";

export const STAGES: { id: Stage; label: string; dot: string }[] = [
  { id: "new", label: "New", dot: "bg-slate-400" },
  { id: "contacted", label: "Contacted", dot: "bg-sky-500" },
  { id: "qualified", label: "Qualified", dot: "bg-violet-500" },
  { id: "proposal", label: "Proposal", dot: "bg-amber-500" },
  { id: "won", label: "Won", dot: "bg-emerald-500" },
  { id: "lost", label: "Lost", dot: "bg-rose-400" },
];

export const STAGE_IDS = STAGES.map((stage) => stage.id);

export const CURRENCIES = ["DKK", "EUR", "SEK", "NOK", "USD", "GBP"] as const;

export function stageLabel(stage: string) {
  return STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export const GOALS: { id: Goal; label: string; plural: string; costLabel: string }[] = [
  { id: "lead", label: "Lead", plural: "Leads", costLabel: "Cost per lead" },
  { id: "purchase", label: "Purchase", plural: "Purchases", costLabel: "Cost per purchase" },
  { id: "booking", label: "Booking", plural: "Bookings", costLabel: "Cost per booking" },
];

export function goalInfo(goal: Goal) {
  return GOALS.find((g) => g.id === goal) ?? GOALS[0];
}

/**
 * Sort key for a card dropped between two neighbours. Cards are ordered by
 * ascending position within a column; `before`/`after` are the positions of
 * the cards that will sit directly above and below it (if any).
 */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

type Card = { id: string; stage: Stage; stage_position: number };
export type DropTarget = { type: "card"; id: string } | { type: "column"; stage: Stage };

/**
 * Where a dragged card lands. Dropping on a card puts it in that card's slot
 * (above it, or below it when moving down within the same column); dropping
 * on a column's empty space appends it to the end. Returns null for no-ops.
 */
export function planDrop(cards: Card[], draggedId: string, target: DropTarget): { stage: Stage; position: number } | null {
  const dragged = cards.find((card) => card.id === draggedId);
  if (!dragged) return null;

  const column = (stage: Stage) =>
    cards.filter((card) => card.stage === stage).sort((a, b) => a.stage_position - b.stage_position);

  if (target.type === "column") {
    if (target.stage === dragged.stage) return null;
    const others = column(target.stage);
    return { stage: target.stage, position: positionBetween(others.at(-1)?.stage_position, undefined) };
  }

  if (target.id === draggedId) return null;
  const over = cards.find((card) => card.id === target.id);
  if (!over) return null;

  const full = column(over.stage);
  const movingDown = over.stage === dragged.stage && full.indexOf(dragged) < full.indexOf(over);
  const others = full.filter((card) => card.id !== draggedId);
  const index = others.indexOf(over);

  const position = movingDown
    ? positionBetween(over.stage_position, others[index + 1]?.stage_position)
    : positionBetween(others[index - 1]?.stage_position, over.stage_position);
  return { stage: over.stage, position };
}
