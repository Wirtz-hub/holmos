"use client";

import { Plus } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { OwnerSelect, type ClientOption } from "@/components/owner-select";
import { Button, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/actions/clients";

/** "New form" / "New booking page": a button that opens a one-line name field. */
export function NewItemForm({
  action,
  buttonLabel,
  placeholder,
  withLanguage,
  clients,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  buttonLabel: string;
  placeholder: string;
  withLanguage?: boolean;
  /** When given, also asks who the new item belongs to. */
  clients?: ClientOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {buttonLabel}
      </Button>
    );
  }

  const error = state?.fieldErrors?.name ?? (state && !state.ok ? state.message : undefined);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex max-w-2xl flex-wrap items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="min-w-48 flex-1">
        <label htmlFor="new-item-name" className="sr-only">
          Name
        </label>
        <input id="new-item-name" name="name" required autoFocus maxLength={120} placeholder={placeholder} className={inputClass} />
        {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      </div>
      {clients && (
        <div className="w-full sm:w-auto sm:min-w-64">
          <label htmlFor="new-item-owner" className="sr-only">
            Belongs to
          </label>
          <OwnerSelect id="new-item-owner" clients={clients} />
        </div>
      )}
      {withLanguage && (
        <select name="language" defaultValue="da" aria-label="Language visitors see" className={`${inputClass} w-32!`}>
          <option value="da">Danish</option>
          <option value="en">English</option>
        </select>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
