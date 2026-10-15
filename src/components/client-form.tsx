"use client";

import { startTransition, useActionState } from "react";
import { Button, Field, inputClass, Notice } from "@/components/ui";
import type { FormState } from "@/lib/actions/clients";
import { CURRENCIES, GOALS, STAGES } from "@/lib/pipeline";
import type { Client } from "@/lib/types";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  client?: Client;
  submitLabel: string;
  showStage?: boolean;
};

export function ClientForm({ action, client, submitLabel, showStage }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form
      // Submitting manually (rather than <form action>) stops React from clearing
      // the fields when the server sends back a validation message.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" htmlFor="name" error={errors.name} className="sm:col-span-2">
          <input id="name" name="name" required defaultValue={client?.name} className={inputClass} placeholder="e.g. Nordlys Tandklinik" />
        </Field>
        <Field label="Contact person" htmlFor="contact_name" error={errors.contact_name}>
          <input id="contact_name" name="contact_name" defaultValue={client?.contact_name ?? ""} className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" name="email" type="email" defaultValue={client?.email ?? ""} className={inputClass} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone}>
          <input id="phone" name="phone" type="tel" defaultValue={client?.phone ?? ""} className={inputClass} />
        </Field>
        <Field label="Website" htmlFor="website" error={errors.website}>
          <input id="website" name="website" defaultValue={client?.website ?? ""} className={inputClass} placeholder="example.dk" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {showStage && (
          <Field label="Pipeline stage" htmlFor="stage">
            <select id="stage" name="stage" defaultValue="new" className={inputClass}>
              {STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Deal value" htmlFor="deal_value" error={errors.deal_value} hint="What the deal is worth to you (e.g. monthly retainer).">
          <div className="flex gap-2">
            <input
              id="deal_value"
              name="deal_value"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              defaultValue={client?.deal_value ?? ""}
              className={inputClass}
            />
            <select name="currency" aria-label="Currency" defaultValue={client?.currency ?? "DKK"} className={`${inputClass} w-24! shrink-0`}>
              {CURRENCIES.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </div>
        </Field>
        <Field
          label="What counts as a result?"
          htmlFor="goal"
          hint="Used on their ad dashboard for results and cost per result."
          className={showStage ? "sm:col-span-2" : undefined}
        >
          <select id="goal" name="goal" defaultValue={client?.goal ?? "lead"} className={inputClass}>
            {GOALS.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.plural}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={errors.notes}>
        <textarea id="notes" name="notes" rows={4} defaultValue={client?.notes ?? ""} className={inputClass} />
      </Field>

      <details className="group rounded-lg border border-slate-200 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 select-none">Advanced result settings</summary>
        <div className="mt-4 space-y-4">
          <Field
            label="Meta: count this action as a result"
            htmlFor="meta_result_action"
            error={errors.meta_result_action}
            hint="Leave empty to use the standard one for the goal. Only needed for custom conversions — the dashboard lists every action Meta reports."
          >
            <input
              id="meta_result_action"
              name="meta_result_action"
              defaultValue={client?.meta_result_action ?? ""}
              className={`${inputClass} font-mono`}
              placeholder="e.g. offsite_conversion.custom.123456789"
            />
          </Field>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="google_count_all_conversions"
              defaultChecked={client?.google_count_all_conversions ?? false}
              className="mt-0.5 size-4 rounded border-slate-300 text-brand-600"
            />
            <span>
              Google: count every conversion as a result
              <span className="block text-xs text-slate-500">
                Use this if the client&apos;s Google Ads conversions aren&apos;t set to a lead, purchase or booking category.
              </span>
            </span>
          </label>
        </div>
      </details>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {state?.ok && state.message && <span className="text-sm text-emerald-700">{state.message}</span>}
      </div>
      {state && !state.ok && state.message && <Notice kind="error">{state.message}</Notice>}
    </form>
  );
}
