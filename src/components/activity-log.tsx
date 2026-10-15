"use client";

import { ArrowRightLeft, CalendarCheck, CalendarDays, CalendarX, ClipboardList, Link2, Mail, PhoneCall, Sparkles, StickyNote, Unplug } from "lucide-react";
import { useActionState, useState } from "react";
import { Button, Card, CardHeader, cx, inputClass } from "@/components/ui";
import { addActivityAction } from "@/lib/actions/clients";
import { formatDateTime } from "@/lib/format";
import { stageLabel } from "@/lib/pipeline";
import type { Activity, ActivityKind } from "@/lib/types";

const MANUAL_KINDS = [
  { id: "note", label: "Note", placeholder: "What happened?" },
  { id: "call", label: "Call", placeholder: "What did you talk about?" },
  { id: "email", label: "Email", placeholder: "What was sent or received?" },
  { id: "meeting", label: "Meeting", placeholder: "Who met, and what was agreed?" },
] as const;

const KIND_STYLE: Record<ActivityKind, { icon: typeof StickyNote; tone: string; label: string }> = {
  created: { icon: Sparkles, tone: "bg-brand-50 text-brand-700", label: "Added" },
  stage_changed: { icon: ArrowRightLeft, tone: "bg-violet-50 text-violet-700", label: "Stage" },
  note: { icon: StickyNote, tone: "bg-slate-100 text-slate-600", label: "Note" },
  call: { icon: PhoneCall, tone: "bg-emerald-50 text-emerald-700", label: "Call" },
  email: { icon: Mail, tone: "bg-sky-50 text-sky-700", label: "Email" },
  meeting: { icon: CalendarDays, tone: "bg-amber-50 text-amber-700", label: "Meeting" },
  ad_account_assigned: { icon: Link2, tone: "bg-slate-100 text-slate-600", label: "Ad account" },
  ad_account_unassigned: { icon: Unplug, tone: "bg-slate-100 text-slate-600", label: "Ad account" },
  form_submitted: { icon: ClipboardList, tone: "bg-teal-50 text-teal-700", label: "Form" },
  booking_created: { icon: CalendarCheck, tone: "bg-emerald-50 text-emerald-700", label: "Booking" },
  booking_cancelled: { icon: CalendarX, tone: "bg-rose-50 text-rose-700", label: "Booking" },
};

/** "Tue 20 Oct, 10:00" in the booking page's time zone. */
function meetingTime(iso?: string, timeZone?: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || "Europe/Copenhagen",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const platformName = (platform?: string) => (platform === "google" ? "Google" : "Meta");

function describe(activity: Activity): string {
  const meta = activity.meta ?? {};
  switch (activity.kind) {
    case "created":
      return `Added to the pipeline${meta.stage ? ` as ${stageLabel(meta.stage)}` : ""}`;
    case "stage_changed":
      return `Moved from ${stageLabel(meta.from ?? "")} to ${stageLabel(meta.to ?? "")}`;
    case "ad_account_assigned":
      return `${platformName(meta.platform)} ad account “${meta.account}” assigned`;
    case "ad_account_unassigned":
      return `${platformName(meta.platform)} ad account “${meta.account}” removed`;
    case "form_submitted":
      return `Filled in the form “${meta.form ?? "a form"}”`;
    case "booking_created":
      return `Booked “${meta.calendar}” for ${meetingTime(meta.starts_at, meta.time_zone)}`;
    case "booking_cancelled":
      return `${meta.by === "guest" ? "Cancelled" : "You cancelled"} “${meta.calendar}” on ${meetingTime(meta.starts_at, meta.time_zone)}`;
    default:
      return KIND_STYLE[activity.kind].label;
  }
}

export function ActivityLog({ clientId, activities }: { clientId: string; activities: Activity[] }) {
  const [state, formAction, pending] = useActionState(addActivityAction.bind(null, clientId), null);
  const [kind, setKind] = useState<(typeof MANUAL_KINDS)[number]["id"]>("note");
  const current = MANUAL_KINDS.find((k) => k.id === kind)!;

  return (
    <Card>
      <CardHeader title="Activity" description="Log calls, emails and meetings. Stage moves are logged for you." />
      <form action={formAction} className="space-y-3 border-b border-slate-100 p-5">
        <input type="hidden" name="kind" value={kind} />
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="Type of activity">
          {MANUAL_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              onClick={() => setKind(k.id)}
              className={cx(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                kind === k.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <textarea name="body" rows={3} required placeholder={current.placeholder} aria-label={`${current.label} details`} className={inputClass} />
        {state?.fieldErrors?.body && <p className="text-sm text-rose-600">{state.fieldErrors.body}</p>}
        {state?.message && !state.ok && <p className="text-sm text-rose-600">{state.message}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : `Log ${current.label.toLowerCase()}`}
        </Button>
      </form>

      {activities.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing logged yet.</p>
      ) : (
        <ol className="space-y-4 p-5">
          {activities.map((activity) => {
            const style = KIND_STYLE[activity.kind] ?? KIND_STYLE.note;
            const Icon = style.icon;
            const showBody = ["note", "call", "email", "meeting", "form_submitted", "booking_created"].includes(activity.kind);
            return (
              <li key={activity.id} className="flex gap-3">
                <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", style.tone)}>
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium text-slate-800">{describe(activity)}</p>
                    <time dateTime={activity.created_at} className="text-xs text-slate-400 tabular">
                      {formatDateTime(activity.created_at)}
                    </time>
                  </div>
                  {showBody && activity.body && (
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">{activity.body}</p>
                  )}
                  {activity.kind === "form_submitted" && activity.meta?.page && (
                    <p className="mt-1 truncate text-xs text-slate-400">From {activity.meta.page}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
