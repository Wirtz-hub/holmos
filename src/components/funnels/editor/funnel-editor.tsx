"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Columns2,
  Copy,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  MapPin,
  Megaphone,
  MoreHorizontal,
  Plus,
  Quote,
  Settings2,
  Tag,
  Trash2,
  TrendingUp,
  Type,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { BlockSettings, type EditorCalendar, type EditorForm } from "@/components/funnels/editor/block-settings";
import { PageSettings } from "@/components/funnels/editor/page-settings";
import { BlockView, FunnelFrame, signupBlockId, type FunnelContext } from "@/components/funnels/funnel-view";
import { SiteFooter, SiteHeader } from "@/components/funnels/site-chrome";
import { Button, buttonClass, cx, Notice } from "@/components/ui";
import { deleteFunnelAction, duplicateFunnelAction, publishFunnelAction, saveFunnelDraftAction, unpublishFunnelAction } from "@/lib/actions/funnels";
import type { FormField } from "@/lib/forms/schema";
import { BLOCK_LABELS, newBlock, newId, newStep, slugify, type Block, type BlockType, type FunnelDoc, type Step } from "@/lib/funnels/schema";

const BLOCK_ICONS: Record<BlockType, typeof Type> = {
  hero: LayoutTemplate,
  text: Type,
  image: ImageIcon,
  form: ClipboardList,
  cta: Megaphone,
  testimonials: Quote,
  booking: CalendarDays,
  features: LayoutGrid,
  split: Columns2,
  faq: CircleHelp,
  pricing: Tag,
  team: Users,
  contact: MapPin,
  gallery: Images,
  stats: TrendingUp,
};
const BLOCK_GROUPS: { label: string; types: BlockType[] }[] = [
  { label: "Basics", types: ["hero", "text", "split", "image", "cta"] },
  { label: "Sell", types: ["features", "pricing", "testimonials", "stats", "faq"] },
  { label: "Get in touch", types: ["form", "contact", "booking", "team", "gallery"] },
];

/** Deep equality that ignores the order of object keys (the database reorders them). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Tidies step addresses typed half-way (e.g. ending in "-") before saving. */
function cleanForSave(doc: FunnelDoc): FunnelDoc {
  return { ...doc, steps: doc.steps.map((step, i) => ({ ...step, slug: slugify(step.slug) || `step-${i + 1}` })) };
}

type SaveState = { kind: "saved" | "saving" | "unsaved" } | { kind: "error"; message: string };

export type EditorProps = {
  funnel: { id: string; name: string; slug: string; client_id: string | null };
  clients: { id: string; name: string }[];
  initialDoc: FunnelDoc;
  publishedDoc: FunnelDoc | null;
  forms: (EditorForm & { fields: FormField[]; submit_label: string })[];
  calendars: (EditorCalendar & { slug: string; duration_minutes: number })[];
  /** The page's public address, e.g. https://holmos.vercel.app/f/offer or https://tilbud.example.dk */
  publicBase: string;
  settings: ReactNode;
};

export function FunnelEditor({ funnel, clients, initialDoc, publishedDoc, forms, calendars, publicBase, settings }: EditorProps) {
  const dndId = useId();
  const [doc, setDoc] = useState(initialDoc);
  const [published, setPublished] = useState(publishedDoc);
  const [tab, setTab] = useState<"edit" | "settings">("edit");
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"none" | "settings" | "add">("none");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "saved" });
  const [publishing, startPublishing] = useTransition();
  const [problems, setProblems] = useState<string[]>([]);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const docRef = useRef(doc);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const saving = useRef<Promise<boolean> | null>(null);
  const scrollTo = useRef<string | null>(null);

  const step = doc.steps[Math.min(stepIndex, doc.steps.length - 1)];
  const selected = step.blocks.find((b) => b.id === selectedId) ?? null;
  const live = published !== null;
  const upToDate = live && same(cleanForSave(doc), published);

  function update(change: (current: FunnelDoc) => FunnelDoc) {
    const next = change(docRef.current);
    docRef.current = next;
    version.current += 1;
    setDoc(next);
    setSaveState({ kind: "unsaved" });
  }

  const updateStep = (change: (step: Step) => Step) =>
    update((d) => ({ ...d, steps: d.steps.map((s, i) => (i === stepIndex ? change(s) : s)) }));

  async function save(): Promise<boolean> {
    if (saving.current) await saving.current;
    if (version.current === savedVersion.current) return true;
    const target = version.current;
    setSaveState({ kind: "saving" });
    const run = saveFunnelDraftAction(funnel.id, cleanForSave(docRef.current))
      .then((result) => {
        if (!result.ok) {
          setSaveState({ kind: "error", message: result.message });
          return false;
        }
        savedVersion.current = target;
        setSaveState(version.current === target ? { kind: "saved" } : { kind: "unsaved" });
        return true;
      })
      .catch(() => {
        setSaveState({ kind: "error", message: "Couldn't save. Check your connection." });
        return false;
      });
    saving.current = run;
    const ok = await run;
    saving.current = null;
    return ok;
  }

  // Autosave a moment after the last change.
  useEffect(() => {
    if (version.current === savedVersion.current) return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save() reads the latest doc from a ref
  }, [doc]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (version.current !== savedVersion.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    if (!scrollTo.current) return;
    document.getElementById(`block-${scrollTo.current}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    scrollTo.current = null;
  });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setSheet("none");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function select(id: string | null) {
    setSelectedId(id);
    setSheet(id ? "settings" : "none");
  }

  function addBlock(type: BlockType, index?: number) {
    const block = newBlock(type, doc.language);
    const ownForm = forms.find((f) => f.is_active && (f.client_id ?? null) === (funnel.client_id ?? null))?.id ?? null;
    if (type === "form") (block as Extract<Block, { type: "form" }>).formId = ownForm;
    if (type === "contact") (block as Extract<Block, { type: "contact" }>).formId = ownForm;
    if (type === "booking" && calendars.length) (block as Extract<Block, { type: "booking" }>).calendarId = calendars.find((c) => c.is_active)?.id ?? null;
    updateStep((s) => {
      const selectedIndex = s.blocks.findIndex((b) => b.id === selectedId);
      const at = index ?? (selectedIndex >= 0 ? selectedIndex + 1 : s.blocks.length);
      const blocks = [...s.blocks];
      blocks.splice(at, 0, block);
      return { ...s, blocks };
    });
    scrollTo.current = block.id;
    select(block.id);
  }

  function moveBlock(id: string, by: number) {
    updateStep((s) => {
      const from = s.blocks.findIndex((b) => b.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= s.blocks.length) return s;
      return { ...s, blocks: arrayMove(s.blocks, from, to) };
    });
    scrollTo.current = id;
  }

  function duplicateBlock(id: string) {
    const original = step.blocks.find((b) => b.id === id);
    if (!original) return;
    const copy = { ...structuredClone(original), id: newId() };
    updateStep((s) => {
      const blocks = [...s.blocks];
      blocks.splice(blocks.findIndex((b) => b.id === id) + 1, 0, copy);
      return { ...s, blocks };
    });
    select(copy.id);
  }

  function deleteBlock(id: string) {
    const index = step.blocks.findIndex((b) => b.id === id);
    const block = step.blocks[index];
    if (!block) return;
    const stepId = step.id;
    updateStep((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id) }));
    select(null);
    setToast({
      text: `${BLOCK_LABELS[block.type].label} block removed.`,
      undo: () =>
        update((d) => ({
          ...d,
          steps: d.steps.map((s) => {
            if (s.id !== stepId) return s;
            const blocks = [...s.blocks];
            blocks.splice(Math.min(index, blocks.length), 0, block);
            return { ...s, blocks };
          }),
        })),
    });
  }

  function addStep() {
    if (doc.steps.length >= 10) return;
    const n = doc.steps.length + 1;
    const taken = new Set(doc.steps.map((s) => s.slug));
    let slug = `step-${n}`;
    for (let i = n; taken.has(slug); i++) slug = `step-${i + 1}`;
    const fresh = newStep(doc.language === "da" ? `Trin ${n}` : `Step ${n}`, slug, [newBlock("text", doc.language)]);
    update((d) => ({ ...d, steps: [...d.steps, fresh] }));
    setStepIndex(doc.steps.length);
    select(null);
  }

  function moveStep(to: number) {
    update((d) => ({ ...d, steps: arrayMove(d.steps, stepIndex, to) }));
    setStepIndex(to);
  }

  function deleteStep() {
    if (doc.steps.length <= 1) return;
    const removed = doc.steps[stepIndex];
    const at = stepIndex;
    update((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== at) }));
    setStepIndex(Math.max(0, at - 1));
    select(null);
    setToast({
      text: `Step “${removed.name}” deleted.`,
      undo: () => {
        update((d) => {
          const steps = [...d.steps];
          steps.splice(Math.min(at, steps.length), 0, removed);
          return { ...d, steps };
        });
        setStepIndex(at);
      },
    });
  }

  function publish() {
    setProblems([]);
    startPublishing(async () => {
      if (!(await save())) return;
      const result = await publishFunnelAction(funnel.id);
      if (result.ok) {
        setPublished(cleanForSave(docRef.current));
        setToast({ text: live ? "Changes published. Visitors see them now." : "Published! The page is live." });
      } else if (result.problems) {
        setProblems(result.problems);
      } else {
        setToast({ text: result.message ?? "Couldn't publish. Try again." });
      }
    });
  }

  function unpublish() {
    if (!window.confirm("Take the page offline? Visitors will see “page not available” until you publish again.")) return;
    startPublishing(async () => {
      const result = await unpublishFunnelAction(funnel.id);
      if (result.ok) {
        setPublished(null);
        setToast({ text: "The page is offline now." });
      }
    });
  }

  async function openPreview() {
    await save();
    window.open(`/preview/funnels/${funnel.id}${stepIndex > 0 ? `/${step.slug}` : ""}`, "_blank", "noopener");
  }

  // Drag and drop: new blocks from the list on the left, or reordering on the page.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(event: DragStartEvent) {
    setDragging(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null);
  }

  function onDragEnd(event: DragEndEvent) {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    setDragging(null);
    setOverId(null);
    if (!over) return;
    if (active.startsWith("new:")) {
      const index = over === "canvas-end" ? step.blocks.length : step.blocks.findIndex((b) => b.id === over);
      addBlock(active.slice(4) as BlockType, index < 0 ? step.blocks.length : index);
      return;
    }
    if (active === over) return;
    updateStep((s) => {
      const from = s.blocks.findIndex((b) => b.id === active);
      const to = over === "canvas-end" ? s.blocks.length - 1 : s.blocks.findIndex((b) => b.id === over);
      return from < 0 || to < 0 ? s : { ...s, blocks: arrayMove(s.blocks, from, to) };
    });
  }

  const ctx: FunnelContext = {
    doc,
    stepIndex,
    basePath: "",
    interactive: false,
    forms: Object.fromEntries(forms.map((f) => [f.id, { id: f.id, name: f.name, fields: f.fields, submit_label: f.submit_label }])),
    calendars: Object.fromEntries(calendars.map((c) => [c.id, c])),
    signupBlockId: signupBlockId(step.blocks),
  };

  const draggingLabel = dragging?.startsWith("new:")
    ? BLOCK_LABELS[dragging.slice(4) as BlockType].label
    : dragging
      ? BLOCK_LABELS[step.blocks.find((b) => b.id === dragging)?.type ?? "text"].label
      : null;

  return (
    <div>
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/funnels" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" aria-hidden /> Pages & funnels
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-semibold tracking-tight text-slate-900">
            <span className="truncate">{funnel.name}</span>
            <StatusChip live={live} upToDate={upToDate} />
          </h1>
          <p className="mt-1 text-sm">
            <SaveStatus state={saveState} onRetry={() => void save()} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void openPreview()}>
            <Eye className="size-4" aria-hidden /> Preview
          </Button>
          {live && (
            <a href={publicBase} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              Open live page
            </a>
          )}
          <Button type="button" onClick={publish} disabled={publishing || (live && upToDate)}>
            {publishing ? "Publishing…" : !live ? "Publish" : upToDate ? "Published" : "Publish changes"}
          </Button>
          <details className="relative">
            <summary className={cx(buttonClass("ghost"), "list-none [&::-webkit-details-marker]:hidden")} aria-label="More actions">
              <MoreHorizontal className="size-5" />
            </summary>
            <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              {live && (
                <button type="button" onClick={unpublish} className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">
                  Take offline
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await save();
                  await duplicateFunnelAction(funnel.id);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                Make a copy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete “${funnel.name}”? Its address stops working. Form answers and leads are kept.`)) {
                    version.current = savedVersion.current;
                    void deleteFunnelAction(funnel.id);
                  }
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
              >
                Delete page
              </button>
            </div>
          </details>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="mb-4">
          <Notice kind="warning">
            <p className="font-medium">Fix these first, so visitors don&apos;t see a broken page:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        {(
          [
            ["edit", "Edit page"],
            ["settings", "Address & domain"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === id ? "border-brand-700 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        settings
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)_20rem] xl:grid-cols-[13rem_minmax(0,1fr)_22rem]">
            {/* Block list (desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="mb-2 px-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Add a block</p>
                <p className="mb-3 px-1 text-xs text-slate-500">Drag onto the page, or click.</p>
                <div className="space-y-3">
                  {BLOCK_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{group.label}</p>
                      <div className="space-y-0.5">
                        {group.types.map((type) => (
                          <PaletteItem key={type} type={type} onAdd={() => addBlock(type)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* The page */}
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                {doc.steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStepIndex(i);
                      select(null);
                    }}
                    className={cx(
                      "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                      i === stepIndex ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {i + 1}. {s.name}
                  </button>
                ))}
                {doc.steps.length < 10 && (
                  <button
                    type="button"
                    onClick={addStep}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
                  >
                    <Plus className="size-4" aria-hidden /> Add step
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setSheet("settings");
                  }}
                  className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <Settings2 className="size-4" aria-hidden /> Page settings
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <FunnelFrame doc={doc} className="min-h-[60vh]">
                  {doc.site.header.enabled && (
                    <ChromeArea label="Edit the menu" onSelect={() => select(null)}>
                      <SiteHeader ctx={ctx} />
                    </ChromeArea>
                  )}
                  <SortableContext items={step.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                    {step.blocks.map((block, i) => (
                      <SortableBlock
                        key={block.id}
                        block={block}
                        ctx={ctx}
                        selected={block.id === selectedId}
                        dropBefore={Boolean(dragging?.startsWith("new:")) && overId === block.id}
                        isFirst={i === 0}
                        isLast={i === step.blocks.length - 1}
                        onSelect={() => select(block.id)}
                        onMove={(by) => moveBlock(block.id, by)}
                        onDuplicate={() => duplicateBlock(block.id)}
                        onDelete={() => deleteBlock(block.id)}
                      />
                    ))}
                  </SortableContext>
                  <CanvasEnd empty={step.blocks.length === 0} highlight={overId === "canvas-end" && Boolean(dragging)} onAdd={() => setSheet("add")} />
                  <ChromeArea label="Edit the footer" onSelect={() => select(null)}>
                    <SiteFooter ctx={ctx} />
                  </ChromeArea>
                </FunnelFrame>
              </div>
            </div>

            {/* Settings: a column on desktop, a sheet from the bottom on phones */}
            <aside
              className={cx(
                sheet === "settings"
                  ? "fixed inset-x-0 bottom-0 z-40 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-4 shadow-2xl"
                  : "hidden",
                "lg:static lg:z-auto lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
              )}
            >
              <div className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:p-4 lg:shadow-sm">
                <div className="mb-3 flex justify-end lg:hidden">
                  <Button type="button" size="sm" onClick={() => setSheet("none")}>
                    Done
                  </Button>
                </div>
                {selected ? (
                  <BlockSettings
                    block={selected}
                    onChange={(block) => updateStep((s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === block.id ? block : b)) }))}
                    steps={doc.steps}
                    stepIndex={stepIndex}
                    forms={forms}
                    calendars={calendars}
                    owner={{ clientId: funnel.client_id, clients }}
                    onCredit={(credit) =>
                      update((d) => ({ ...d, photoCredits: [...d.photoCredits.filter((c) => c.url !== credit.url), credit].slice(-200) }))
                    }
                  />
                ) : (
                  <PageSettings
                    doc={doc}
                    stepIndex={stepIndex}
                    publicBase={publicBase}
                    onStepChange={(next) => updateStep(() => next)}
                    onDocChange={(patch) => update((d) => ({ ...d, ...patch }))}
                    onMoveStep={moveStep}
                    onDeleteStep={deleteStep}
                  />
                )}
              </div>
            </aside>
          </div>

          <DragOverlay>
            {draggingLabel && (
              <div className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white shadow-lg">{draggingLabel}</div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add-block sheet (phones) */}
      {tab === "edit" && (
        <>
          <button
            type="button"
            onClick={() => setSheet("add")}
            className="fixed right-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-lg lg:hidden"
          >
            <Plus className="size-4" aria-hidden /> Add block
          </button>
          {sheet === "add" && (
            <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-slate-200 bg-white p-4 shadow-2xl lg:hidden">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Add a block{selected ? " below the selected one" : ""}</p>
                <button type="button" onClick={() => setSheet(selected ? "settings" : "none")} className="rounded p-1 text-slate-500" aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>
              <div className="max-h-[60dvh] space-y-3 overflow-y-auto">
                {BLOCK_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{group.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.types.map((type) => {
                        const Icon = BLOCK_ICONS[type];
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => addBlock(type)}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                          >
                            <Icon className="size-4 shrink-0 text-brand-700" aria-hidden />
                            {BLOCK_LABELS[type].label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-20 z-50 flex justify-center lg:bottom-6" role="status">
          <div className="flex items-center gap-4 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="font-semibold text-brand-200 hover:text-white"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ live, upToDate }: { live: boolean; upToDate: boolean }) {
  const [label, tone] = !live
    ? ["Draft — not published", "bg-slate-100 text-slate-600"]
    : upToDate
      ? ["Live", "bg-emerald-50 text-emerald-700"]
      : ["Live · changes not published yet", "bg-amber-50 text-amber-800"];
  return <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{label}</span>;
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state.kind === "error") {
    return (
      <span className="text-rose-600">
        Not saved: {state.message}{" "}
        <button type="button" onClick={onRetry} className="underline">
          Try again
        </button>
      </span>
    );
  }
  return (
    <span className="text-slate-500">
      {state.kind === "saving" ? "Saving…" : state.kind === "unsaved" ? "Unsaved changes" : "All changes saved"}
      <span className="hidden sm:inline"> · visitors only see changes after you publish</span>
    </span>
  );
}

function PaletteItem({ type, onAdd }: { type: BlockType; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `new:${type}` });
  const Icon = BLOCK_ICONS[type];
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onAdd}
      {...attributes}
      {...listeners}
      title={BLOCK_LABELS[type].hint}
      className={cx(
        "flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700">
        <Icon className="size-4" aria-hidden />
      </span>
      {BLOCK_LABELS[type].label}
    </button>
  );
}

/** The menu or footer on the canvas: shown as on the page, and clicking opens the page settings. */
function ChromeArea({ label, onSelect, children }: { label: string; onSelect: () => void; children: ReactNode }) {
  return (
    <div className="group relative">
      <div className="pointer-events-none select-none" aria-hidden>
        {children}
      </div>
      <button
        type="button"
        onClick={onSelect}
        aria-label={label}
        className="absolute inset-0 z-[1] w-full outline-none hover:ring-2 hover:ring-brand-200 hover:ring-inset focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      />
    </div>
  );
}

function CanvasEnd({ empty, highlight, onAdd }: { empty: boolean; highlight: boolean; onAdd: () => void }) {
  const { setNodeRef } = useDroppable({ id: "canvas-end" });
  return (
    <div ref={setNodeRef} className="p-4">
      <div
        className={cx(
          "grid place-items-center rounded-xl border-2 border-dashed text-center text-sm transition-colors",
          empty ? "h-48" : "h-16",
          highlight ? "border-brand-500 bg-brand-50 text-brand-700" : "border-current/15 opacity-70",
        )}
      >
        {empty ? (
          <div>
            <p>This step is empty.</p>
            <button type="button" onClick={onAdd} className="mt-1 font-medium underline lg:hidden">
              Add a block
            </button>
            <p className="hidden lg:block">Drag a block here from the list on the left.</p>
          </div>
        ) : (
          <span className="hidden lg:inline">Drop here to add at the end</span>
        )}
      </div>
    </div>
  );
}

function SortableBlock({
  block,
  ctx,
  selected,
  dropBefore,
  isFirst,
  isLast,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: Block;
  ctx: FunnelContext;
  selected: boolean;
  dropBefore: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMove: (by: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const label = BLOCK_LABELS[block.type].label;
  const tool = "grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30";

  return (
    <div
      ref={setNodeRef}
      id={`block-${block.id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx("group relative", isDragging && "z-10 opacity-40")}
    >
      {dropBefore && <div className="absolute inset-x-4 -top-0.5 z-20 h-1 rounded-full bg-brand-500" />}
      <div className="pointer-events-none select-none" aria-hidden>
        <BlockView block={block} ctx={ctx} />
      </div>
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Edit ${label} block`}
        className={cx(
          "absolute inset-0 z-[1] w-full outline-none",
          selected ? "ring-2 ring-brand-500 ring-inset" : "hover:ring-2 hover:ring-brand-200 hover:ring-inset focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset",
        )}
      />
      <span
        className={cx(
          "pointer-events-none absolute top-2 left-2 z-[2] rounded-md bg-brand-700 px-2 py-0.5 text-xs font-medium text-white",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        {label}
      </span>
      <div
        className={cx(
          "absolute top-2 right-2 z-[2] flex items-center gap-0.5 rounded-lg bg-white p-0.5 shadow-md ring-1 ring-slate-200",
          selected ? "opacity-100" : "opacity-100 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100",
        )}
      >
        <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} className={cx(tool, "cursor-grab touch-none active:cursor-grabbing")} aria-label={`Drag to move the ${label} block`}>
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={isFirst} className={tool} aria-label="Move up">
          <ArrowUp className="size-4" />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={isLast} className={tool} aria-label="Move down">
          <ArrowDown className="size-4" />
        </button>
        <button type="button" onClick={onDuplicate} className={tool} aria-label="Duplicate">
          <Copy className="size-4" />
        </button>
        <button type="button" onClick={onDelete} className={cx(tool, "hover:bg-rose-50 hover:text-rose-700")} aria-label="Delete block">
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
