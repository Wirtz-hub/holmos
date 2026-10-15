"use client";

import { CircleCheck } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FormField, PublicFormDef } from "@/lib/forms/schema";
import { publicText } from "@/lib/public-text";

// A form as visitors see it, on a landing page or embedded on another website.

const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[var(--accent,#1d4669)] focus:ring-2 focus:ring-[var(--accent,#1d4669)]/25 focus:outline-none sm:text-sm";

type Props = {
  form: PublicFormDef;
  /** Go to the funnel's next step after sending, instead of the form's own message/redirect. */
  nextHref?: string | null;
  /** Inside an iframe on another website: report height changes and ask the page to redirect. */
  embedded?: boolean;
  /** The page the form is on, when the browser can't tell (inside an iframe). */
  sourceUrl?: string | null;
};

export function PublicForm({ form, nextHref, embedded, sourceUrl }: Props) {
  const text = publicText(form.language);
  const uid = useId();
  const loadedAt = useRef(0);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setMessage(null);
    const hp = (event.currentTarget.elements.namedItem("company_website") as HTMLInputElement | null)?.value ?? "";
    try {
      const res = await fetch(`/api/public/forms/${form.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: values, hp, elapsedMs: Date.now() - loadedAt.current, sourceUrl: sourceUrl || window.location.href }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; redirectUrl?: string | null; errors?: Record<string, string> };
      if (!res.ok || !body.ok) {
        setErrors(body.errors ?? {});
        setMessage(body.errors ? null : (body.message ?? text.formError));
        setStatus("idle");
        return;
      }
      setErrors({});
      const target = nextHref ?? body.redirectUrl ?? null;
      if (target) {
        if (embedded && window.parent !== window) {
          window.parent.postMessage({ type: "holmos:redirect", url: new URL(target, window.location.href).href }, "*");
        } else {
          window.location.href = target;
          return;
        }
      }
      setMessage(body.message ?? "");
      setStatus("done");
    } catch {
      setMessage(text.formError);
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900" role="status">
        <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-sm leading-relaxed whitespace-pre-line">{message}</p>
      </div>
    );
  }

  const set = (id: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [id]: value }));
    if (errors[id]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {form.fields.map((field) => (
        <FieldInput key={field.id} field={field} id={`${uid}-${field.id}`} value={values[field.id]} error={errors[field.id]} onChange={(v) => set(field.id, v)} />
      ))}
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {message && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-full px-6 py-3 text-base font-semibold shadow-sm transition-[filter] hover:brightness-110 disabled:opacity-60"
        style={{ background: "var(--accent, #1d4669)", color: "var(--on-accent, #fff)" }}
      >
        {status === "sending" ? text.sending : form.submit_label}
      </button>
    </form>
  );
}

function FieldInput({
  field,
  id,
  value,
  error,
  onChange,
}: {
  field: FormField;
  id: string;
  value: string | boolean | undefined;
  error?: string;
  onChange: (value: string | boolean) => void;
}) {
  const describedBy = error ? `${id}-error` : undefined;
  const common = { id, name: field.id, required: field.required, "aria-invalid": Boolean(error), "aria-describedby": describedBy };
  const errorText = error && (
    <p id={`${id}-error`} className="mt-1 text-sm text-rose-700">
      {error}
    </p>
  );

  if (field.type === "checkbox") {
    return (
      <div>
        <label htmlFor={id} className="flex items-start gap-2.5 text-sm text-slate-700">
          <input
            {...common}
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-[var(--accent,#1d4669)]"
          />
          <span>
            {field.label}
            {field.required && <span className="text-rose-600"> *</span>}
          </span>
        </label>
        {errorText}
      </div>
    );
  }

  const label = (
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
      {field.label}
      {field.required && <span className="text-rose-600"> *</span>}
    </label>
  );
  const text = typeof value === "string" ? value : "";

  return (
    <div>
      {label}
      {field.type === "textarea" ? (
        <textarea {...common} rows={4} value={text} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      ) : field.type === "select" ? (
        <select {...common} value={text} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">{field.placeholder || "—"}</option>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          autoComplete={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.mapsTo === "name" ? "name" : field.mapsTo === "company" ? "organization" : undefined}
          inputMode={field.type === "phone" ? "tel" : field.type === "email" ? "email" : undefined}
          value={text}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
      {errorText}
    </div>
  );
}
