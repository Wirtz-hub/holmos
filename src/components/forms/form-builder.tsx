"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { FormPreview } from "@/components/funnels/funnel-view";
import { OWNER_HINT, OwnerSelect, type ClientOption } from "@/components/owner-select";
import { Button, Card, CardHeader, cx, Field, inputClass, Notice } from "@/components/ui";
import { deleteFormAction, saveFormAction, type FormInput } from "@/lib/actions/forms";
import { FIELD_TYPES, MAPS_TO, newField, type FieldType, type FormField } from "@/lib/forms/schema";
import { STAGES } from "@/lib/pipeline";

type FormRow = Omit<FormInput, "fields" | "redirect_url" | "notify_email" | "client_id"> & {
  client_id: string;
  id: string;
  fields: FormField[];
  redirect_url: string;
  notify_email: string;
};

export function FormBuilder({
  initial,
  clients,
  answerCount,
  share,
  answers,
}: {
  initial: FormRow;
  clients: ClientOption[];
  answerCount: number;
  share: ReactNode;
  answers: ReactNode;
}) {
  const dndId = useId();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [tab, setTab] = useState<"questions" | "settings" | "share" | "answers">("questions");
  const [open, setOpen] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null>(null);
  const [saving, startSaving] = useTransition();
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (patch: Partial<FormRow>) => {
    setForm((current) => ({ ...current, ...patch }));
    setResult(null);
  };
  const setField = (id: string, patch: Partial<FormField>) => set({ fields: form.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });

  function save() {
    startSaving(async () => {
      const { id, ...input } = form;
      const outcome = await saveFormAction(id, input);
      setResult(outcome ?? null);
      if (outcome?.ok) setSaved(form);
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = form.fields.findIndex((f) => f.id === active.id);
    const to = form.fields.findIndex((f) => f.id === over.id);
    set({ fields: arrayMove(form.fields, from, to) });
  }

  function addField(type: FieldType) {
    const field = newField(type, form.language);
    set({ fields: [...form.fields, field] });
    setOpen(field.id);
  }

  const errors = result?.fieldErrors ?? {};

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/forms" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" aria-hidden /> Forms
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-semibold tracking-tight text-slate-900">
            <span className="truncate">{saved.name}</span>
            <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-medium", saved.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
              {saved.is_active ? "Taking answers" : "Switched off"}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dirty && <span className="text-sm text-amber-700">Unsaved changes</span>}
          {!dirty && result?.ok && <span className="text-sm text-emerald-700">Saved</span>}
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {result && !result.ok && (
        <div className="mb-4">
          <Notice kind="error">{result.message ?? "Check the highlighted settings."}</Notice>
        </div>
      )}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {(
          [
            ["questions", "Questions"],
            ["settings", "Settings"],
            ["share", "Share & embed"],
            ["answers", `Answers (${answerCount})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cx(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              tab === id ? "border-brand-700 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-3">
            {errors.fields && <Notice kind="error">{errors.fields}</Notice>}
            <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={form.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {form.fields.map((field) => (
                  <FieldCard
                    key={field.id}
                    field={field}
                    open={open === field.id}
                    onToggle={() => setOpen(open === field.id ? null : field.id)}
                    onChange={(patch) => setField(field.id, patch)}
                    onRemove={() => set({ fields: form.fields.filter((f) => f.id !== field.id) })}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <AddField onAdd={addField} />
          </div>
          <div>
            <Card className="lg:sticky lg:top-4">
              <CardHeader title="Preview" description="How visitors see it. Your page's main colour is used for the button." />
              <div className="p-5" style={{ "--accent": "#1d4669", "--on-accent": "#fff" } as CSSProperties}>
                <FormPreview fields={form.fields} submitLabel={form.submit_label} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <Card className="max-w-3xl">
          <div className="space-y-5 p-5">
            <Field label="Name" htmlFor="name" error={errors.name} hint="Only you see this.">
              <input id="name" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className={inputClass} />
            </Field>
            <Field label="Belongs to" htmlFor="client_id" hint={OWNER_HINT}>
              <OwnerSelect clients={clients} value={form.client_id} onChange={(client_id) => set({ client_id })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button text" htmlFor="submit_label" error={errors.submit_label}>
                <input id="submit_label" value={form.submit_label} onChange={(e) => set({ submit_label: e.target.value })} maxLength={60} className={inputClass} />
              </Field>
              <Field label="Language visitors see" htmlFor="language" hint="For error messages like “Please fill this in”.">
                <select id="language" value={form.language} onChange={(e) => set({ language: e.target.value as "da" | "en" })} className={inputClass}>
                  <option value="da">Danish</option>
                  <option value="en">English</option>
                </select>
              </Field>
            </div>
            <Field label="Thank-you message" htmlFor="success_message" error={errors.success_message} hint="Shown after someone sends the form.">
              <textarea id="success_message" rows={3} value={form.success_message} onChange={(e) => set({ success_message: e.target.value })} className={inputClass} />
            </Field>
            <Field
              label="Or send them to a page instead"
              htmlFor="redirect_url"
              error={errors.redirect_url}
              hint="Optional, e.g. a thank-you page on the client's website. Starts with https://"
            >
              <input id="redirect_url" value={form.redirect_url} onChange={(e) => set({ redirect_url: e.target.value.trim() })} placeholder="https://" className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {form.client_id ? (
                <p className="self-center rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  People who answer are added to the contact list of{" "}
                  <strong>{clients.find((c) => c.id === form.client_id)?.name ?? "this client"}</strong>.
                </p>
              ) : (
                <Field label="New leads go to" htmlFor="lead_stage" hint="Pipeline stage for people who aren't clients yet. Existing clients stay where they are.">
                  <select id="lead_stage" value={form.lead_stage} onChange={(e) => set({ lead_stage: e.target.value as FormRow["lead_stage"] })} className={inputClass}>
                    {STAGES.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Email me each answer at" htmlFor="notify_email" error={errors.notify_email} hint="Leave empty for no emails. Needs email set up (see the setup guide).">
                <input id="notify_email" type="email" value={form.notify_email} onChange={(e) => set({ notify_email: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="mt-0.5 size-4 accent-brand-700" />
              <span>
                Taking answers
                <span className="block text-xs text-slate-500">Switch off to hide the form everywhere it&apos;s used, without deleting it.</span>
              </span>
            </label>
          </div>
          <div className="flex justify-end border-t border-slate-100 px-5 py-4">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                if (window.confirm(`Delete “${saved.name}”? Its answers are deleted too, but the clients and their activity logs stay.`)) {
                  void deleteFormAction(form.id);
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Delete form
            </Button>
          </div>
        </Card>
      )}

      {tab === "share" && share}
      {tab === "answers" && answers}
    </div>
  );
}

function FieldCard({
  field,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  field: FormField;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const uid = useId();
  const typeLabel = FIELD_TYPES.find((t) => t.id === field.type)?.label;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx("rounded-xl border bg-white shadow-sm", open ? "border-brand-200" : "border-slate-200", isDragging && "z-10 opacity-60")}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
          aria-label={`Drag to move “${field.label}”`}
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1 text-left" aria-expanded={open}>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-slate-900">
              {field.label || "Untitled question"}
              {field.required && <span className="text-rose-600"> *</span>}
            </span>
            <span className="text-xs text-slate-500">{typeLabel}</span>
          </span>
          <ChevronDown className={cx("size-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        <button type="button" onClick={onRemove} className="grid size-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Remove “${field.label}”`}>
          <Trash2 className="size-4" />
        </button>
      </div>
      {open && (
        <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2">
          <Field label="Question" htmlFor={`${uid}-label`} className="sm:col-span-2">
            <input id={`${uid}-label`} value={field.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={200} className={inputClass} />
          </Field>
          <Field label="Type of answer" htmlFor={`${uid}-type`}>
            <select
              id={`${uid}-type`}
              value={field.type}
              onChange={(e) => {
                const type = e.target.value as FieldType;
                onChange({ type, options: type === "select" ? (field.options.length ? field.options : ["Option 1", "Option 2"]) : [], mapsTo: type === "email" || type === "phone" ? "" : field.mapsTo });
              }}
              className={inputClass}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          {field.type !== "checkbox" && (
            <Field label="Hint inside the box" htmlFor={`${uid}-placeholder`} hint="Optional">
              <input id={`${uid}-placeholder`} value={field.placeholder} onChange={(e) => onChange({ placeholder: e.target.value })} maxLength={200} className={inputClass} />
            </Field>
          )}
          {field.type === "select" && (
            <Field label="Choices" htmlFor={`${uid}-options`} hint="One per line." className="sm:col-span-2">
              <textarea
                id={`${uid}-options`}
                rows={4}
                value={field.options.join("\n")}
                onChange={(e) => onChange({ options: e.target.value.split("\n").map((o) => o.slice(0, 200)).slice(0, 50) })}
                onBlur={(e) => onChange({ options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean) })}
                className={inputClass}
              />
            </Field>
          )}
          {(field.type === "text" || field.type === "textarea" || field.type === "select") && (
            <Field label="Save the answer as the client's" htmlFor={`${uid}-maps`} hint="Fills in the client record, if it's empty.">
              <select id={`${uid}-maps`} value={field.mapsTo} onChange={(e) => onChange({ mapsTo: e.target.value as FormField["mapsTo"] })} className={inputClass}>
                {MAPS_TO.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {(field.type === "email" || field.type === "phone") && (
            <p className="self-end text-xs text-slate-500">
              {field.type === "email" ? "Email" : "Phone"} answers are always saved on the client, and used to recognise people who&apos;ve been in touch before.
            </p>
          )}
          <label className="flex items-center gap-2.5 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={field.required} onChange={(e) => onChange({ required: e.target.checked })} className="size-4 accent-brand-700" />
            Required
          </label>
        </div>
      )}
    </div>
  );
}

function AddField({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 p-3">
      <p className="mb-2 flex items-center gap-1.5 px-1 text-sm font-medium text-slate-700">
        <Plus className="size-4" aria-hidden /> Add a question
      </p>
      <div className="flex flex-wrap gap-2">
        {FIELD_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onAdd(type.id)}
            className="rounded-lg bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
}
