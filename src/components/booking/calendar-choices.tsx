"use client";

import { useState, useTransition } from "react";
import { Button, cx, inputClass } from "@/components/ui";
import { disconnectCalendarAction, saveCalendarChoicesAction } from "@/lib/actions/booking";

type GoogleCalendar = { id: string; name: string; primary: boolean; canWrite: boolean };

/** Which Google calendars block booking times, and which one new bookings are added to. */
export function CalendarChoices({ calendars, busyIds, eventId }: { calendars: GoogleCalendar[]; busyIds: string[]; eventId: string }) {
  const [busy, setBusy] = useState(busyIds);
  const [target, setTarget] = useState(eventId);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const writable = calendars.filter((c) => c.canWrite);

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Busy times come from</legend>
        <div className="space-y-1.5">
          {calendars.map((calendar) => (
            <label key={calendar.id} className="flex items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={busy.includes(calendar.id)}
                onChange={(e) => setBusy(e.target.checked ? [...busy, calendar.id] : busy.filter((id) => id !== calendar.id))}
                className="size-4 accent-brand-700"
              />
              <span className="truncate">
                {calendar.name}
                {calendar.primary && <span className="text-slate-400"> (main)</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="event-calendar" className="mb-1.5 block text-sm font-medium text-slate-700">
          Add new bookings to
        </label>
        <select id="event-calendar" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
          {writable.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendar.name}
              {calendar.primary ? " (main)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || busy.length === 0}
          onClick={() =>
            startTransition(async () => {
              const result = await saveCalendarChoicesAction(busy, target);
              setMessage({ ok: result.ok, text: result.message ?? "" });
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Disconnect Google Calendar? Booking pages keep working, but won't see your Google events or add new bookings to Google.")) return;
            startTransition(() => disconnectCalendarAction());
          }}
        >
          Disconnect
        </Button>
        {message && <span className={cx("text-sm", message.ok ? "text-emerald-700" : "text-rose-600")}>{message.text}</span>}
      </div>
    </div>
  );
}
