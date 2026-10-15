"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { cx, Notice } from "@/components/ui";
import { moveClientAction } from "@/lib/actions/clients";
import { formatMoney } from "@/lib/format";
import { sumByCurrency } from "@/lib/money";
import { planDrop, STAGES, type DropTarget } from "@/lib/pipeline";
import type { Stage } from "@/lib/types";

export type PipelineCard = {
  id: string;
  name: string;
  contact_name: string | null;
  stage: Stage;
  stage_position: number;
  deal_value: number | null;
  currency: string;
};

// Prefer the card under the pointer over the column it sits in.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const card = hits.find((hit) => String(hit.id).startsWith("card:"));
  if (card) return [card];
  return hits.length ? hits : rectIntersection(args);
};

function toTarget(id: string): DropTarget | null {
  if (id.startsWith("card:")) return { type: "card", id: id.slice(5) };
  if (id.startsWith("col:")) return { type: "column", stage: id.slice(4) as Stage };
  return null;
}

export function PipelineBoard({ initialCards }: { initialCards: PipelineCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [synced, setSynced] = useState(initialCards);
  if (synced !== initialCards) {
    // Fresh data from the server (e.g. after navigating back) replaces local state.
    setSynced(initialCards);
    setCards(initialCards);
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const lastDragEnd = useRef(0);
  // A stable id keeps dnd-kit's accessibility ids identical on server and client.
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setError(null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    lastDragEnd.current = Date.now();
    const target = event.over ? toTarget(String(event.over.id)) : null;
    if (!target) return;

    const id = String(event.active.id);
    const plan = planDrop(cards, id, target);
    if (!plan) return;

    const previous = cards;
    setCards((current) =>
      current.map((card) => (card.id === id ? { ...card, stage: plan.stage, stage_position: plan.position } : card)),
    );
    startTransition(async () => {
      const ok = await moveClientAction(id, plan.stage, plan.position)
        .then((result) => result.ok)
        .catch(() => false);
      if (!ok) {
        setCards(previous);
        setError("That move didn't save. Check your connection and try again.");
      }
    });
  }

  const active = activeId ? cards.find((card) => card.id === activeId) : null;
  const recentlyDragged = () => Date.now() - lastDragEnd.current < 250;

  return (
    <>
      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 xl:grid xl:grid-cols-6 xl:overflow-visible">
          {STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              cards={cards
                .filter((card) => card.stage === stage.id)
                .sort((a, b) => a.stage_position - b.stage_position)}
              recentlyDragged={recentlyDragged}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{active ? <CardBody card={active} lifted /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

function Column({
  stage,
  cards,
  recentlyDragged,
}: {
  stage: (typeof STAGES)[number];
  cards: PipelineCard[];
  recentlyDragged: () => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage.id}` });
  const total = sumByCurrency(cards, true);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.label} column`}
      className={cx(
        "flex w-72 shrink-0 snap-start flex-col rounded-xl bg-slate-100/80 p-2 transition-shadow xl:w-auto",
        isOver && "ring-2 ring-brand-200",
      )}
    >
      <header className="px-2 pt-1 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx("size-2 shrink-0 rounded-full", stage.dot)} aria-hidden />
          <h2 className="truncate text-sm font-semibold text-slate-800">{stage.label}</h2>
          <span className="ml-auto rounded-full bg-white px-1.5 text-xs font-medium text-slate-500 tabular">{cards.length}</span>
        </div>
        <p className="mt-0.5 h-4 truncate pl-4 text-xs text-slate-500 tabular">{total ?? ""}</p>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2">
        {cards.map((card) => (
          <DraggableCard key={card.id} card={card} recentlyDragged={recentlyDragged} />
        ))}
        {cards.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
            Drop cards here
          </p>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ card, recentlyDragged }: { card: PipelineCard; recentlyDragged: () => boolean }) {
  const router = useRouter();
  const drag = useDraggable({ id: card.id });
  const drop = useDroppable({ id: `card:${card.id}` });

  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...drag.attributes}
      {...drag.listeners}
      onClick={() => {
        if (!recentlyDragged()) router.push(`/clients/${card.id}`);
      }}
      className={cx(
        "relative cursor-grab touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:cursor-grabbing",
        drag.isDragging && "opacity-40",
        drop.isOver && !drag.isDragging && "before:absolute before:inset-x-1 before:-top-1.5 before:h-0.5 before:rounded-full before:bg-brand-500",
      )}
    >
      <CardBody card={card} recentlyDragged={recentlyDragged} />
    </div>
  );
}

function CardBody({ card, lifted, recentlyDragged }: { card: PipelineCard; lifted?: boolean; recentlyDragged?: () => boolean }) {
  return (
    <article
      className={cx(
        "rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm",
        lifted ? "rotate-1 shadow-lg ring-1 ring-brand-200" : "hover:border-slate-300",
      )}
    >
      <Link
        href={`/clients/${card.id}`}
        onClick={(event) => {
          event.stopPropagation();
          if (recentlyDragged?.()) event.preventDefault();
        }}
        className="line-clamp-2 block text-sm font-medium break-words text-slate-900 hover:text-brand-700"
        draggable={false}
      >
        {card.name}
      </Link>
      {card.contact_name && <p className="mt-0.5 truncate text-xs text-slate-500">{card.contact_name}</p>}
      {card.deal_value !== null && (
        <p className="mt-2 text-xs font-medium text-slate-700 tabular">{formatMoney(Number(card.deal_value), card.currency)}</p>
      )}
    </article>
  );
}
