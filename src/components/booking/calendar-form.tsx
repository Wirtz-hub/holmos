"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Button, Card, CardHeader, cx, Field, inputClass, Notice } from "@/components/ui";
import { deleteCalendarAction, saveCalendarAction, type CalendarInput } from "@/lib/actions/booking";
import type { WeeklyHours } from "@/lib/booking/slots";
import { DAY_KEYS, type DayKey } from "@/lib/booking/time";
import { STAGES } from "@/lib/pipeline";

type CalendarState = Omit<CalendarInput, "availability" | "description" | "location_detail" | "notify_email"> & {
  availability: WeeklyHours;
  description: string;
  location_detail: string;
  notify_email: string;
};

const DAY_NAMES: Record<DayKey, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

const minutesOptions = (values: number[], format: (n: number) => string) => values.map((n) => ({ value: n, label: format(n) }));
const BUFFERS = minutesOptions([0, 5, 10, 15, 30, 45, 60], (n) => (n === 0 ? "None" : `${n} min`));
const STEPS = minutesOptions([10, 15, 20, 30, 45, 60, 90, 120], (n) => `Every ${n} min`);
const NOTICE = [
  { value: 0, label: "No minimum" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
  { value: 10080, label: "1 week" },
];
const ZONES = ["Europe/Copenhagen", "Europe/Stockholm", "Europe/Oslo", "Europe/Helsinki", "Europe/Berlin", "Europe/Amsterdam", "Europe/London", "UTC"];

function NumberSelect({ id, value, options, onChange }: { id: string; value: number; options: { value: number; label: string }[]; onChange: (n: number) => void }) {
  const all = options.some((o) => o.value === value) ? options : [...options, { value, label: `${value} min` }].sort((a, b) => a.value - b.value);
  return (
    <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass}>
      {all.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CalendarForm({ id, initial, share }: { id: string; initial: CalendarState; share: ReactNode }) {
  const [calendar, setCalendar] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [result, setResult] = useState<{ ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const dirty = JSON.stringify(calendar) !== JSON.stringify(saved);
  const errors = result?.fieldErrors ?? {};

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (patch: Partial<CalendarState>) => {
    setCalendar((c) => ({ ...c, ...patch }));
    setResult(null);
  };
  const setDay = (day: DayKey, ranges: [string, string][]) => set({ availability: { ...calendar.availability, [day]: ranges } });

  function save() {
    startSaving(async () => {
      const outcome = await saveCalendarAction(id, calendar);
      setResult(outcome ?? null);
      if (outcome?.ok) setSaved(calendar);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader title="The meeting" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" error={errors.name} hint="Visitors see this, e.g. “Free 30-minute intro call”." className="sm:col-span-2">
              <input id="name" value={calendar.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className={inputClass} />
            </Field>
            <Field label="Address" htmlFor="slug" error={errors.slug} hint={`/book/${calendar.slug}`} className="sm:col-span-2">
              <input
                id="slug"
                value={calendar.slug}
                onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
                maxLength={60}
                className={inputClass}
              />
            </Field>
            <Field label="Description" htmlFor="description" error={errors.description} hint="Optional. What the meeting is for, and how to prepare." className="sm:col-span-2">
              <textarea id="description" rows={3} value={calendar.description} onChange={(e) => set({ description: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Length" htmlFor="duration" error={errors.duration_minutes}>
              <NumberSelect
                id="duration"
                value={calendar.duration_minutes}
                options={minutesOptions([15, 20, 30, 45, 60, 90, 120], (n) => (n < 60 ? `${n} minutes` : n === 60 ? "1 hour" : `${n / 60} hours`))}
                onChange={(duration_minutes) => set({ duration_minutes })}
              />
            </Field>
            <Field label="Where" htmlFor="location_type">
              <select id="location_type" value={calendar.location_type} onChange={(e) => set({ location_type: e.target.value as CalendarState["location_type"] })} className={inputClass}>
                <option value="google_meet">Google Meet video call (link made automatically)</option>
                <option value="phone">Phone call (you call them)</option>
                <option value="in_person">In person</option>
                <option value="custom">Something else</option>
              </select>
            </Field>
            {calendar.location_type !== "google_meet" && (
              <Field
                label={calendar.location_type === "in_person" ? "Address" : calendar.location_type === "phone" ? "Extra details" : "Where or how"}
                htmlFor="location_detail"
                error={errors.location_detail}
                hint={calendar.location_type === "custom" ? "e.g. a Zoom link. Shown after booking and in emails." : "Optional"}
                className="sm:col-span-2"
              >
                <input id="location_detail" value={calendar.location_detail} onChange={(e) => set({ location_detail: e.target.value })} maxLength={500} className={inputClass} />
              </Field>
            )}
            {calendar.location_type === "google_meet" && (
              <p className="text-xs text-slate-500 sm:col-span-2">Meet links need Google Calendar connected (on the Bookings page).</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Opening hours" description={`When people can book, in ${calendar.time_zone.replace("_", " ")} time.`} />
          {errors.availability && (
            <div className="px-5 pt-4">
              <Notice kind="error">{errors.availability}</Notice>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {DAY_KEYS.map((day) => {
              const ranges = calendar.availability[day] ?? [];
              const open = ranges.length > 0;
              return (
                <li key={day} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3">
                  <label className="flex w-32 shrink-0 items-center gap-2.5 pt-2 text-sm font-medium text-slate-800">
                    <input type="checkbox" checked={open} onChange={(e) => setDay(day, e.target.checked ? [["09:00", "16:00"]] : [])} className="size-4 accent-brand-700" />
                    {DAY_NAMES[day]}
                  </label>
                  <div className="min-w-0 flex-1 space-y-2">
                    {!open && <p className="pt-2 text-sm text-slate-400">Closed</p>}
                    {ranges.map(([from, to], i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          step={900}
                          value={from}
                          aria-label={`${DAY_NAMES[day]} from`}
                          onChange={(e) => setDay(day, ranges.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))}
                          className={cx(inputClass, "w-36!")}
                        />
                        <span className="text-sm text-slate-500">to</span>
                        <input
                          type="time"
                          step={900}
                          value={to}
                          aria-label={`${DAY_NAMES[day]} until`}
                          onChange={(e) => setDay(day, ranges.map((r, j) => (j === i ? [r[0], e.target.value] : r)))}
                          className={cx(inputClass, "w-36!")}
                        />
                        <button
                          type="button"
                          onClick={() => setDay(day, ranges.filter((_, j) => j !== i))}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Remove these hours"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {open && (
                    <div className="flex items-center gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => setDay(day, [...ranges, [ranges[ranges.length - 1]?.[1] ?? "13:00", "17:00"]])}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        <Plus className="size-3.5" aria-hidden /> Add hours
                      </button>
                      {day === "mon" && (
                        <button
                          type="button"
                          onClick={() =>
                            set({
                              availability: {
                                ...calendar.availability,
                                tue: ranges.map((r) => [...r] as [string, string]),
                                wed: ranges.map((r) => [...r] as [string, string]),
                                thu: ranges.map((r) => [...r] as [string, string]),
                                fri: ranges.map((r) => [...r] as [string, string]),
                              },
                            })
                          }
                          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Copy to Tue–Fri
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Booking rules" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Break before each meeting" htmlFor="buffer_before" hint="Kept free, so meetings don't run back to back.">
              <NumberSelect id="buffer_before" value={calendar.buffer_before_minutes} options={BUFFERS} onChange={(buffer_before_minutes) => set({ buffer_before_minutes })} />
            </Field>
            <Field label="Break after each meeting" htmlFor="buffer_after">
              <NumberSelect id="buffer_after" value={calendar.buffer_after_minutes} options={BUFFERS} onChange={(buffer_after_minutes) => set({ buffer_after_minutes })} />
            </Field>
            <Field label="Start times" htmlFor="interval" hint="e.g. every 30 min gives 9:00, 9:30, 10:00…">
              <NumberSelect id="interval" value={calendar.slot_interval_minutes} options={STEPS} onChange={(slot_interval_minutes) => set({ slot_interval_minutes })} />
            </Field>
            <Field label="Minimum notice" htmlFor="notice" hint="How soon before a meeting people can still book it.">
              <NumberSelect id="notice" value={calendar.min_notice_minutes} options={NOTICE} onChange={(min_notice_minutes) => set({ min_notice_minutes })} />
            </Field>
            <Field label="How far ahead people can book" htmlFor="max_days" error={errors.max_days_ahead} hint="In days.">
              <input
                id="max_days"
                type="number"
                min={1}
                max={365}
                value={calendar.max_days_ahead}
                onChange={(e) => set({ max_days_ahead: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Time zone" htmlFor="time_zone" error={errors.time_zone}>
              <select id="time_zone" value={calendar.time_zone} onChange={(e) => set({ time_zone: e.target.value })} className={inputClass}>
                {(ZONES.includes(calendar.time_zone) ? ZONES : [calendar.time_zone, ...ZONES]).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Leads and messages" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Language visitors see" htmlFor="language" hint="For the booking page and the emails people get.">
              <select id="language" value={calendar.language} onChange={(e) => set({ language: e.target.value as "da" | "en" })} className={inputClass}>
                <option value="da">Danish</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label="New leads go to" htmlFor="lead_stage" hint="For people who aren't in your pipeline yet.">
              <select id="lead_stage" value={calendar.lead_stage} onChange={(e) => set({ lead_stage: e.target.value as CalendarState["lead_stage"] })} className={inputClass}>
                {STAGES.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email me new bookings at" htmlFor="notify_email" error={errors.notify_email} hint="Also where replies to booking emails go." className="sm:col-span-2">
              <input id="notify_email" type="email" value={calendar.notify_email} onChange={(e) => set({ notify_email: e.target.value })} className={inputClass} />
            </Field>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={calendar.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="mt-0.5 size-4 accent-brand-700" />
              <span>
                Open for bookings
                <span className="block text-xs text-slate-500">Switch off to hide the page everywhere, without losing its bookings.</span>
              </span>
            </label>
          </div>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {dirty && <span className="text-sm text-amber-700">Unsaved changes</span>}
          {!dirty && result?.ok && <span className="text-sm text-emerald-700">Saved</span>}
          {result && !result.ok && <span className="text-sm text-rose-600">{result.message ?? "Check the highlighted settings."}</span>}
        </div>
      </div>

      <div className="space-y-6">
        {share}
        <Card>
          <CardHeader
            title="Delete booking page"
            description="Only possible when it has no upcoming bookings. Past bookings stay in each client's activity log."
            action={
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={deleting}
                onClick={() => {
                  if (!window.confirm(`Delete “${saved.name}”?`)) return;
                  startDeleting(async () => {
                    const outcome = await deleteCalendarAction(id);
                    if (outcome && !outcome.ok) setResult({ ok: false, message: outcome.message });
                  });
                }}
              >
                <Trash2 className="size-4" aria-hidden /> Delete
              </Button>
            }
          />
        </Card>
      </div>
    </div>
  );
}
