"use client";

import { ArrowDown, ArrowUp, ImageUp, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { StockPhotoPicker } from "@/components/funnels/editor/stock-photo-picker";
import { cx, inputClass } from "@/components/ui";
import { ACCENTS, type ButtonTarget, type PhotoCredit, type Step } from "@/lib/funnels/schema";

// Small inputs used by the page editor's settings panels.

function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {children}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <input id={id} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  hint,
  rows = 4,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  rows?: number;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <textarea id={id} rows={rows} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { id: T; label: string }[];
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 rounded border-slate-300 accent-brand-700" />
      <span>
        {label}
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function ButtonTargetInput({ value, onChange, steps, stepIndex }: { value: ButtonTarget; onChange: (value: ButtonTarget) => void; steps: Step[]; stepIndex: number }) {
  const isLast = stepIndex === steps.length - 1;
  const options = [
    { id: "next", label: isLast ? "Next step (this is the last step, so: the form)" : `Next step (${steps[stepIndex + 1]?.name})` },
    { id: "form", label: "The form or booking calendar on this page" },
    ...(steps.length > 1 ? [{ id: "step", label: "A specific step" }] : []),
    { id: "url", label: "Another website" },
  ] as { id: ButtonTarget["target"]; label: string }[];
  return (
    <div className="space-y-3">
      <Select label="When clicked, go to" value={value.target} onChange={(target) => onChange({ ...value, target })} options={options} />
      {value.target === "step" && (
        <Select
          label="Which step"
          value={value.stepId}
          onChange={(stepId) => onChange({ ...value, stepId })}
          options={[{ id: "", label: "Choose a step…" }, ...steps.map((s) => ({ id: s.id, label: s.name }))]}
        />
      )}
      {value.target === "url" && (
        <TextInput label="Website address" value={value.url} placeholder="https://" onChange={(url) => onChange({ ...value, url: url.trim() })} />
      )}
    </div>
  );
}

export function ImageInput({
  label,
  value,
  onChange,
  hint,
  onCredit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  /** Called when a stock photo is picked, so its photographer can be credited. Also turns on photo search. */
  onCredit?: (credit: PhotoCredit) => void;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch("/api/uploads/image", { method: "POST", body });
      const result = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string };
      if (!res.ok || !result.url) setError(result.message ?? "Couldn't upload the image.");
      else onChange(result.url);
    } catch {
      setError("Couldn't upload the image. Check your connection.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      {value && (
        <div className="relative mb-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded or linked image */}
          <img src={value} alt="" className="max-h-40 w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1.5 right-1.5 rounded-full bg-white/90 p-1 text-slate-600 shadow hover:text-rose-700"
            aria-label="Remove picture"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50 disabled:opacity-60"
        >
          {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ImageUp className="size-4" aria-hidden />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {onCredit && (
          <button
            type="button"
            onClick={() => setSearching((open) => !open)}
            aria-expanded={searching}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
          >
            <Search className="size-4" aria-hidden /> Find
          </button>
        )}
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="or paste an image address"
          className={inputClass}
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      {searching && onCredit && (
        <StockPhotoPicker
          onPick={(url, credit) => {
            onChange(url);
            onCredit(credit);
          }}
          onClose={() => setSearching(false)}
        />
      )}
    </div>
  );
}

/** A list of similar items (services, questions, prices…): edit, reorder, add and remove. */
export function ListEditor<T>({
  items,
  onChange,
  itemLabel,
  newItem,
  max,
  addLabel,
  children,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  itemLabel: (index: number) => string;
  newItem: () => T;
  max: number;
  addLabel: string;
  children: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const tool = "rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30";
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">{itemLabel(i)}</span>
            <div className="flex">
              <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} className={tool} aria-label="Move up">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} className={tool} aria-label="Move down">
                <ArrowDown className="size-4" />
              </button>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className={cx(tool, "hover:bg-rose-50 hover:text-rose-700")} aria-label="Remove">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          {children(item, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))))}
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, newItem()])} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-600">
          <Plus className="size-4" aria-hidden /> {addLabel}
        </button>
      )}
    </div>
  );
}

export function AccentPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>Main colour</Label>
      <div className="flex flex-wrap items-center gap-2">
        {ACCENTS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cx("size-8 rounded-full ring-offset-2 transition", value.toLowerCase() === color ? "ring-2 ring-slate-900" : "hover:scale-110")}
            style={{ background: color }}
            aria-label={`Use ${color}`}
            aria-pressed={value.toLowerCase() === color}
          />
        ))}
        <label className="relative inline-flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-slate-300" title="Pick any colour">
          <span className="sr-only">Pick any colour</span>
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
          <span className="size-full" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
        </label>
      </div>
    </div>
  );
}
