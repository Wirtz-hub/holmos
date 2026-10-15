"use client";

import { ImageUp, LoaderCircle, X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { cx, inputClass } from "@/components/ui";
import { ACCENTS, type ButtonTarget, type Step } from "@/lib/funnels/schema";

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

export function ImageInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: ReactNode }) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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
