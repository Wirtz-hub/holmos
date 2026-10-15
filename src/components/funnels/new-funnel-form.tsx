"use client";

import { CalendarDays, ClipboardList, File, Gift } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Button, Card, cx, Field, inputClass, Notice } from "@/components/ui";
import { createFunnelAction } from "@/lib/actions/funnels";

const ICONS: Record<string, typeof File> = { lead: ClipboardList, booking: CalendarDays, offer: Gift, blank: File };

type Template = { id: string; name: string; description: string; steps: number };

export function NewFunnelForm({ templates }: { templates: Template[] }) {
  const [state, formAction, pending] = useActionState(createFunnelAction, null);
  const [template, setTemplate] = useState(templates[0].id);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="max-w-4xl space-y-6"
    >
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-slate-700">Template</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => {
            const Icon = ICONS[t.id] ?? File;
            const active = template === t.id;
            return (
              <label
                key={t.id}
                className={cx(
                  "flex cursor-pointer gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors",
                  active ? "border-brand-500 ring-2 ring-brand-500" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <input type="radio" name="template" value={t.id} checked={active} onChange={() => setTemplate(t.id)} className="sr-only" />
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{t.name}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{t.description}</span>
                  <span className="mt-1 block text-xs text-slate-400">{t.steps === 1 ? "1 step" : `${t.steps} steps`}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" hint="Only you see this. It also becomes the page's address.">
          <input id="name" name="name" required maxLength={120} className={inputClass} placeholder="e.g. Spring campaign" />
        </Field>
        <Field label="Language visitors see" htmlFor="language" hint="For the template's text, buttons and messages.">
          <select id="language" name="language" defaultValue="da" className={inputClass}>
            <option value="da">Danish</option>
            <option value="en">English</option>
          </select>
        </Field>
      </Card>

      {state && !state.ok && state.message && <Notice kind="error">{state.message}</Notice>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create page"}
      </Button>
    </form>
  );
}
