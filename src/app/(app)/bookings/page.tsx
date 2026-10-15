import { CalendarDays, CircleCheck, CircleDashed, ExternalLink, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BookingList, type BookingListItem } from "@/components/booking/booking-list";
import { CalendarChoices } from "@/components/booking/calendar-choices";
import { CopyButton } from "@/components/embed-code";
import { NewItemForm } from "@/components/new-item-form";
import { ButtonLink, Card, CardHeader, cx, EmptyState, PageHeader, PageSkeleton, buttonClass } from "@/components/ui";
import { createCalendarAction } from "@/lib/actions/booking";
import { requireAdmin } from "@/lib/auth";
import { missingCalendarSettings, missingEmailSettings, serverEnv } from "@/lib/env";
import { CalendarError, getCalendarAccess, listCalendars } from "@/lib/google-calendar";
import { appAddress } from "@/lib/urls";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Bookings />
    </Suspense>
  );
}

type Row = {
  id: string;
  starts_at: string;
  ends_at: string;
  name: string;
  email: string;
  phone: string | null;
  note: string | null;
  status: "confirmed" | "cancelled";
  client_id: string | null;
  meeting_url: string | null;
  booking_calendars: { name: string; time_zone: string } | null;
};

function toItem(row: Row, now: number): BookingListItem {
  const tz = row.booking_calendars?.time_zone ?? "Europe/Copenhagen";
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  return {
    id: row.id,
    day: new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date(row.starts_at)),
    when: `${time(row.starts_at)}–${time(row.ends_at)}`,
    name: row.name,
    email: row.email,
    phone: row.phone,
    note: row.note,
    calendar: row.booking_calendars?.name ?? "Booking",
    client_id: row.client_id,
    meeting_url: row.meeting_url,
    status: row.status,
    past: new Date(row.ends_at).getTime() < now,
  };
}

const BOOKING_COLUMNS = "id, starts_at, ends_at, name, email, phone, note, status, client_id, meeting_url, booking_calendars(name, time_zone)";

/** Upcoming bookings, and the last 30 days of past and cancelled ones. */
async function loadBookings(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const [upcoming, recent] = await Promise.all([
    supabase.from("bookings").select(BOOKING_COLUMNS).eq("status", "confirmed").gte("ends_at", nowIso).order("starts_at").limit(100),
    supabase
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .or(`status.eq.cancelled,ends_at.lt.${nowIso}`)
      .gte("starts_at", new Date(now - 30 * 86_400_000).toISOString())
      .order("starts_at", { ascending: false })
      .limit(30),
  ]);
  if (upcoming.error) throw new Error(upcoming.error.message);
  return {
    upcoming: ((upcoming.data ?? []) as unknown as Row[]).map((row) => toItem(row, now)),
    recent: ((recent.data ?? []) as unknown as Row[]).map((row) => toItem(row, now)),
  };
}

async function Bookings() {
  const { supabase } = await requireAdmin();
  const [calendarsResult, { upcoming, recent }, connectionResult] = await Promise.all([
    supabase.from("booking_calendars").select("id, name, slug, duration_minutes, is_active").order("name"),
    loadBookings(supabase),
    supabase.from("calendar_connections").select("email, status, last_error, busy_calendar_ids, event_calendar_id").eq("provider", "google").maybeSingle(),
  ]);
  if (calendarsResult.error) throw new Error(calendarsResult.error.message);
  const calendars = calendarsResult.data ?? [];

  return (
    <>
      <PageHeader title="Bookings" description="Booking pages people use to grab a time with you, and everything that's been booked." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Coming up" description="Times are shown in each booking page's time zone." />
            <BookingList items={upcoming} empty="Nothing booked yet. Share a booking page to get started." />
          </Card>
          {recent.length > 0 && (
            <Card>
              <details>
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900 select-none">Past and cancelled (last 30 days)</summary>
                <BookingList items={recent} empty="" />
              </details>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Booking pages" description="Each one is a type of meeting, with its own length and opening hours." />
            {calendars.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-5" />} title="No booking pages yet">
                Make one below, e.g. “Free intro call”.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {calendars.map((calendar) => {
                  const url = appAddress(`/book/${calendar.slug}`);
                  return (
                    <li key={calendar.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`/bookings/calendars/${calendar.id}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700">
                            {calendar.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {calendar.duration_minutes} min · {calendar.is_active ? "open for bookings" : <span className="text-amber-700">switched off</span>}
                          </p>
                        </div>
                        <ButtonLink href={`/bookings/calendars/${calendar.id}`} variant="secondary" size="sm">
                          Edit
                        </ButtonLink>
                      </div>
                      {calendar.is_active && (
                        <div className="mt-2 flex items-center gap-2">
                          <a href={url} target="_blank" rel="noopener" className="inline-flex min-w-0 items-center gap-1 truncate text-sm text-brand-700 hover:underline">
                            <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                          </a>
                          <CopyButton text={url} label="Copy link" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-slate-100 p-4">
              <NewItemForm action={createCalendarAction} buttonLabel="New booking page" placeholder="e.g. Free intro call" />
            </div>
          </Card>

          <Suspense fallback={<Card className="h-40" />}>
            <GoogleCalendarCard connection={connectionResult.data} />
          </Suspense>
          <DeliveryCard />
        </div>
      </div>
    </>
  );
}

function StatusLine({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: ReactNode }) {
  const Icon = ok ? CircleCheck : warn ? TriangleAlert : CircleDashed;
  return (
    <p className={cx("flex items-start gap-2 text-sm", ok ? "text-emerald-800" : warn ? "text-amber-800" : "text-slate-600")}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

async function GoogleCalendarCard({
  connection,
}: {
  connection: { email: string | null; status: string; last_error: string | null; busy_calendar_ids: string[]; event_calendar_id: string } | null;
}) {
  const missing = missingCalendarSettings();
  let body: ReactNode;

  if (missing.length) {
    body = (
      <StatusLine>
        Not set up yet. Add these settings in Vercel first (the setup guide shows how): <span className="font-mono text-xs">{missing.join(", ")}</span>
      </StatusLine>
    );
  } else if (!connection) {
    body = (
      <>
        <StatusLine>Not connected. Connect it so your Google events block booking times, and new bookings land in your calendar with a Meet link.</StatusLine>
        <a href="/api/calendar/google/start" className={cx(buttonClass("primary", "sm"), "mt-3")}>
          Connect Google Calendar
        </a>
      </>
    );
  } else if (connection.status !== "active") {
    body = (
      <>
        <StatusLine warn>{connection.last_error ?? "Google Calendar needs reconnecting."} Until then, only HolmOS bookings block times.</StatusLine>
        <a href="/api/calendar/google/start" className={cx(buttonClass("primary", "sm"), "mt-3")}>
          Reconnect
        </a>
      </>
    );
  } else {
    const calendars = await loadGoogleCalendars();
    body = (
      <div className="space-y-4">
        <StatusLine ok>Connected as {connection.email ?? "your Google account"}.</StatusLine>
        {"error" in calendars ? (
          <StatusLine warn>{calendars.error}</StatusLine>
        ) : (
          <CalendarChoices calendars={calendars.list} busyIds={connection.busy_calendar_ids} eventId={connection.event_calendar_id} />
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title="Google Calendar" />
      <div className="p-5">{body}</div>
    </Card>
  );
}

async function loadGoogleCalendars(): Promise<{ list: Awaited<ReturnType<typeof listCalendars>> } | { error: string }> {
  try {
    const access = await getCalendarAccess();
    if (!access) return { error: "Google Calendar needs reconnecting." };
    return { list: await listCalendars(access.token) };
  } catch (error) {
    return { error: error instanceof CalendarError ? error.message : "Couldn't load your calendars right now." };
  }
}

function DeliveryCard() {
  const emailMissing = missingEmailSettings();
  const cron = Boolean(serverEnv().cronSecret);
  return (
    <Card>
      <CardHeader title="Emails and reminders" />
      <div className="space-y-2 p-5">
        {emailMissing.length === 0 ? (
          <StatusLine ok>Confirmation and cancellation emails are on (sent with Resend).</StatusLine>
        ) : (
          <StatusLine warn>
            Emails are off, so people get no confirmation. Add <span className="font-mono text-xs">{emailMissing.join(", ")}</span> in Vercel (see the
            setup guide).
          </StatusLine>
        )}
        {cron && emailMissing.length === 0 ? (
          <StatusLine ok>Reminders go out every morning for meetings in the next 24 hours.</StatusLine>
        ) : (
          <StatusLine warn={emailMissing.length === 0}>
            Reminders are off.{" "}
            {cron ? "They start once emails are on." : <>Add the <span className="font-mono text-xs">CRON_SECRET</span> setting in Vercel to turn them on.</>}
          </StatusLine>
        )}
      </div>
    </Card>
  );
}
