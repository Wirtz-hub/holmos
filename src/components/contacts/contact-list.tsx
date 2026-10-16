"use client";

import { ChevronDown, ClipboardList, Search, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, cx, inputClass } from "@/components/ui";
import { deleteContactAction } from "@/lib/actions/contacts";
import { formatDateTime } from "@/lib/format";

export type ContactEvent = { id: string; kind: "created" | "form_submitted" | "note"; body: string | null; meta: Record<string, string>; created_at: string };

export type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  created_at: string;
  events: ContactEvent[];
};

/** A client's contact list: search, open a person to see what they sent, delete. */
export function ContactList({ contacts }: { contacts: ContactRow[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    // Links from a form's answers point at #contact-<id>: open that person.
    const id = window.location.hash.match(/^#contact-(.+)$/)?.[1];
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the address is browser-only
    setOpen(id);
    document.getElementById(`contact-${id}`)?.scrollIntoView({ block: "start" });
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => [c.name, c.email, c.phone, c.company].some((v) => v?.toLowerCase().includes(q)));
  }, [contacts, query]);

  return (
    <div>
      <div className="border-b border-slate-100 p-4">
        <label className="relative block max-w-sm">
          <span className="sr-only">Search contacts</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or phone" className={cx(inputClass, "pl-9")} />
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">{contacts.length ? "Nobody matches that search." : "No contacts yet."}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((contact) => (
            <ContactItem key={contact.id} contact={contact} open={open === contact.id} onToggle={() => setOpen(open === contact.id ? null : contact.id)} />
          ))}
        </ul>
      )}
      {contacts.length > 0 && (
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
          {shown.length === contacts.length ? `${contacts.length} contacts` : `${shown.length} of ${contacts.length} contacts`}
        </p>
      )}
    </div>
  );
}

function ContactItem({ contact, open, onToggle }: { contact: ContactRow; open: boolean; onToggle: () => void }) {
  const [pending, startTransition] = useTransition();
  const answers = contact.events.filter((e) => e.kind === "form_submitted").length;
  const title = contact.name ?? contact.email ?? contact.phone ?? "Unnamed";

  return (
    <li id={`contact-${contact.id}`} className="scroll-mt-20">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
          <span className="block truncate text-sm text-slate-500">
            {[contact.email, contact.phone, contact.company].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
          <span className="hidden sm:inline">
            {answers === 1 ? "1 answer" : `${answers} answers`} · added {formatDateTime(contact.created_at)}
          </span>
          <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="space-y-4 bg-slate-50/60 px-5 pt-1 pb-4">
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {contact.email && (
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd>
                  <a href={`mailto:${contact.email}`} className="text-brand-700 hover:underline">
                    {contact.email}
                  </a>
                </dd>
              </div>
            )}
            {contact.phone && (
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd>
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="text-brand-700 hover:underline">
                    {contact.phone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <ol className="space-y-3">
            {contact.events.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", event.kind === "created" ? "bg-brand-50 text-brand-700" : "bg-teal-50 text-teal-700")}>
                  {event.kind === "created" ? <UserPlus className="size-3.5" aria-hidden /> : <ClipboardList className="size-3.5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium text-slate-800">
                      {event.kind === "created" ? "Added to the list" : `Filled in “${event.meta.form ?? "a form"}”`}
                    </p>
                    <time dateTime={event.created_at} className="text-xs text-slate-400 tabular">
                      {formatDateTime(event.created_at)}
                    </time>
                  </div>
                  {event.body && <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">{event.body}</p>}
                  {event.meta.page && <p className="mt-1 truncate text-xs text-slate-400">From {event.meta.page}</p>}
                </div>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete ${title} and everything they sent? This can't be undone.`)) return;
              startTransition(async () => {
                await deleteContactAction(contact.id);
              });
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            {pending ? "Deleting…" : "Delete contact"}
          </Button>
        </div>
      )}
    </li>
  );
}
