"use client";

import { ArrowLeft, CalendarCheck, ChevronLeft, ChevronRight, Clock, MapPin, Video } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { addDays } from "@/lib/dates";
import { localDate } from "@/lib/booking/time";
import type { PublicCalendar } from "@/lib/public-data";
import { describeLocation, formatMeetingTime, publicText } from "@/lib/public-text";

// The booking flow visitors see: pick a day and time, fill in details, done.

type Day = { date: string; slots: string[] };

const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--accent,#1d4669)] focus:ring-2 focus:ring-[var(--accent,#1d4669)]/25 focus:outline-none sm:text-sm";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function BookingWidget({ calendar }: { calendar: PublicCalendar }) {
  const text = publicText(calendar.language);
  const uid = useId();
  const tz = calendar.time_zone;
  const loadedAt = useRef(0);

  const [today, setToday] = useState<string | null>(null);
  const [tzName, setTzName] = useState(tz);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [stage, setStage] = useState<"pick" | "details" | "done">("pick");
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ startsAt: string; meetingUrl: string | null; emailSent: boolean } | null>(null);

  useEffect(() => {
    // "Today" depends on the visitor's clock, so it's worked out in the browser.
    const now = localDate(new Date(), tz);
    loadedAt.current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(now);
    setWeekStart(now);
    setTzName(
      new Intl.DateTimeFormat(text.locale, { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? tz,
    );
  }, [tz, text.locale]);

  const load = useCallback(
    async (from: string) => {
      setDays(null);
      setLoadError(false);
      try {
        const res = await fetch(`/api/public/booking/${calendar.slug}/slots?from=${from}&days=7`);
        const body = (await res.json()) as { ok: boolean; days?: Day[] };
        if (!res.ok || !body.ok || !body.days) throw new Error();
        setDays(body.days);
        setDate((current) => (current && body.days!.some((d) => d.date === current && d.slots.length) ? current : (body.days!.find((d) => d.slots.length)?.date ?? null)));
      } catch {
        setLoadError(true);
      }
    },
    [calendar.slug],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching free times when the week changes
    if (weekStart) void load(weekStart);
  }, [weekStart, load]);

  const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(text.locale, { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const timeLabel = (iso: string) => new Intl.DateTimeFormat(text.locale, { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!slot || sending) return;
    setSending(true);
    setNotice(null);
    const hp = (document.getElementById(`${uid}-hp`) as HTMLInputElement | null)?.value ?? "";
    try {
      const res = await fetch(`/api/public/booking/${calendar.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, startsAt: slot, hp, elapsedMs: Date.now() - loadedAt.current }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
        errors?: Record<string, string>;
        booking?: { startsAt: string; meetingUrl: string | null };
        emailSent?: boolean;
      };
      if (res.ok && body.ok && body.booking) {
        setResult({ ...body.booking, emailSent: body.emailSent !== false });
        setStage("done");
      } else if (body.code === "slot_taken") {
        setNotice(body.message ?? text.slotTaken);
        setSlot(null);
        setStage("pick");
        if (weekStart) void load(weekStart);
      } else {
        setErrors(body.errors ?? {});
        if (!body.errors) setNotice(body.message ?? text.formError);
      }
    } catch {
      setNotice(text.formError);
    } finally {
      setSending(false);
    }
  }

  const location = describeLocation(calendar.location_type, calendar.location_type === "in_person" ? null : calendar.location_detail, calendar.language);

  if (stage === "done" && result) {
    return (
      <div className="px-2 py-6 text-center" role="status">
        <CalendarCheck className="mx-auto size-10 text-emerald-600" aria-hidden />
        <h3 className="mt-3 text-xl font-bold">{text.booked}</h3>
        <p className="mt-2 font-medium">{formatMeetingTime(result.startsAt, tz, calendar.language)}</p>
        <p className="mt-1 text-sm text-slate-600">{result.emailSent ? text.bookedText : text.bookedNoEmail}</p>
        {result.meetingUrl && (
          <a href={result.meetingUrl} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent,#1d4669)] underline">
            <Video className="size-4" aria-hidden />
            {text.joinMeeting}
          </a>
        )}
      </div>
    );
  }

  const header = (
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-600">
      <span className="text-base font-semibold text-slate-900">{calendar.name}</span>
      <span className="inline-flex items-center gap-1.5">
        <Clock className="size-4" aria-hidden />
        {text.minutes(calendar.duration_minutes)}
      </span>
      {location && (
        <span className="inline-flex items-center gap-1.5">
          {calendar.location_type === "google_meet" ? <Video className="size-4" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
          {location}
        </span>
      )}
    </div>
  );

  if (stage === "details" && slot) {
    return (
      <form onSubmit={confirm} noValidate>
        {header}
        <button type="button" onClick={() => setStage("pick")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden />
          {text.back}
        </button>
        <p className="mb-5 rounded-lg px-4 py-3 text-sm font-medium" style={{ background: "color-mix(in srgb, var(--accent, #1d4669) 10%, white)" }}>
          {formatMeetingTime(slot, tz, calendar.language)}
        </p>
        <h3 className="mb-3 text-base font-semibold">{text.yourDetails}</h3>
        <div className="space-y-4">
          {(
            [
              ["name", text.name, "text", "name", true],
              ["email", text.email, "email", "email", true],
              ["phone", calendar.location_type === "phone" ? text.phone : text.phoneOptional, "tel", "tel", calendar.location_type === "phone"],
            ] as const
          ).map(([key, label, type, autoComplete, required]) => (
            <div key={key}>
              <label htmlFor={`${uid}-${key}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                {label}
                {required && <span className="text-rose-600"> *</span>}
              </label>
              <input
                id={`${uid}-${key}`}
                type={type}
                autoComplete={autoComplete}
                required={required}
                value={form[key]}
                aria-invalid={Boolean(errors[key])}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className={inputClass}
              />
              {errors[key] && <p className="mt-1 text-sm text-rose-700">{errors[key]}</p>}
            </div>
          ))}
          <div>
            <label htmlFor={`${uid}-note`} className="mb-1.5 block text-sm font-medium text-slate-700">
              {text.note}
            </label>
            <textarea id={`${uid}-note`} rows={3} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={inputClass} />
          </div>
          <input id={`${uid}-hp`} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px" />
        </div>
        {notice && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {notice}
          </p>
        )}
        <button
          type="submit"
          disabled={sending}
          className="mt-5 w-full rounded-full px-6 py-3 text-base font-semibold shadow-sm transition-[filter] hover:brightness-110 disabled:opacity-60"
          style={{ background: "var(--accent, #1d4669)", color: "var(--on-accent, #fff)" }}
        >
          {sending ? text.booking : text.confirm}
        </button>
      </form>
    );
  }

  const selected = days?.find((d) => d.date === date);
  const canGoBack = Boolean(today && weekStart && weekStart > today);

  return (
    <div>
      {header}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{text.chooseTime}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => weekStart && today && setWeekStart(addDays(weekStart, -7) < today ? today : addDays(weekStart, -7))}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            aria-label={text.previousWeek}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            disabled={!weekStart}
            onClick={() => weekStart && setWeekStart(addDays(weekStart, 7))}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            aria-label={text.nextWeek}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      {notice && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          {notice}
        </p>
      )}

      {loadError ? (
        <p className="py-8 text-center text-sm text-slate-500">{text.formError}</p>
      ) : !days ? (
        <p className="py-8 text-center text-sm text-slate-500" aria-busy="true">
          {text.loadingTimes}
        </p>
      ) : days.length === 0 || days.every((d) => d.slots.length === 0) ? (
        <p className="py-8 text-center text-sm text-slate-500">{text.noTimesWeek}</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 sm:gap-2" role="radiogroup" aria-label={text.chooseTime}>
            {days.map((day) => {
              const free = day.slots.length > 0;
              const active = day.date === date;
              return (
                <button
                  key={day.date}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!free}
                  onClick={() => setDate(day.date)}
                  className={cx(
                    "flex flex-col items-center rounded-xl py-2 text-xs transition-colors sm:text-sm",
                    active ? "font-semibold" : free ? "bg-slate-50 text-slate-800 hover:bg-slate-100" : "text-slate-300",
                  )}
                  style={active ? { background: "var(--accent, #1d4669)", color: "var(--on-accent, #fff)" } : undefined}
                >
                  <span className="capitalize">{dayLabel(day.date, { weekday: "short" }).replace(".", "")}</span>
                  <span className="mt-0.5 text-base font-semibold sm:text-lg">{dayLabel(day.date, { day: "numeric" }).replace(".", "")}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            {selected && selected.slots.length > 0 ? (
              <>
                <p className="mb-2 text-sm font-medium text-slate-700 first-letter:uppercase">{dayLabel(selected.date, { weekday: "long", day: "numeric", month: "long" })}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {selected.slots.map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => {
                        setSlot(iso);
                        setNotice(null);
                        setStage("details");
                      }}
                      className="rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-800 tabular-nums transition-colors hover:border-[var(--accent,#1d4669)] hover:text-[var(--accent,#1d4669)]"
                    >
                      {timeLabel(iso)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-sm text-slate-500">{text.noTimes}</p>
            )}
          </div>
        </>
      )}
      <p className="mt-4 text-xs text-slate-400">{text.timesShownIn(tzName)}</p>
    </div>
  );
}
