import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarForm } from "@/components/booking/calendar-form";
import { CopyButton, EmbedCode } from "@/components/embed-code";
import { Card, PageHeader, PageSkeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import type { CalendarRow } from "@/lib/booking/server";
import { appAddress } from "@/lib/urls";

export const metadata: Metadata = { title: "Booking page" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CalendarPage({ params }: PageProps<"/bookings/calendars/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/bookings/calendars/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("booking_calendars").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const calendar = data as CalendarRow;
  const url = appAddress(`/book/${calendar.slug}`);

  const share = (
    <>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Link to share</h2>
        <p className="mt-0.5 text-sm text-slate-500">Send it by email, or add it to your website and email signature.</p>
        <div className="mt-3 flex items-center gap-2">
          <a href={url} target="_blank" rel="noopener" className="inline-flex min-w-0 items-center gap-1 text-sm text-brand-700 hover:underline">
            <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          </a>
          <CopyButton text={url} label="Copy" />
        </div>
        {!calendar.is_active && <p className="mt-2 text-sm text-amber-700">Switched off: the link shows “not available” until you turn it back on.</p>}
      </Card>
      <EmbedCode
        intro="Or show the calendar right inside a website. To put it on one of your HolmOS pages, use the Booking block instead."
        snippets={[
          {
            title: "Script (recommended)",
            description: "Fits the calendar into the page and adjusts its height.",
            code: `<script src="${appAddress("")}/embed/form.js" data-booking="${calendar.slug}" async></script>`,
          },
          {
            title: "Iframe",
            description: "For website builders that don't allow scripts.",
            code: `<iframe src="${url}?embed=1" style="width:100%;height:700px;border:0" title="${calendar.name.replace(/"/g, "&quot;")}"></iframe>`,
          },
        ]}
      />
    </>
  );

  return (
    <>
      <PageHeader
        back={
          <Link href="/bookings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" aria-hidden /> Bookings
          </Link>
        }
        title={calendar.name}
        description="Changes apply to the booking page as soon as you save."
      />
      <CalendarForm
        id={calendar.id}
        initial={{
          name: calendar.name,
          slug: calendar.slug,
          description: calendar.description ?? "",
          duration_minutes: calendar.duration_minutes,
          buffer_before_minutes: calendar.buffer_before_minutes,
          buffer_after_minutes: calendar.buffer_after_minutes,
          slot_interval_minutes: calendar.slot_interval_minutes,
          min_notice_minutes: calendar.min_notice_minutes,
          max_days_ahead: calendar.max_days_ahead,
          time_zone: calendar.time_zone,
          availability: calendar.availability,
          location_type: calendar.location_type,
          location_detail: calendar.location_detail ?? "",
          language: calendar.language,
          lead_stage: calendar.lead_stage as "new",
          notify_email: calendar.notify_email ?? "",
          is_active: calendar.is_active,
        }}
        share={share}
      />
    </>
  );
}
