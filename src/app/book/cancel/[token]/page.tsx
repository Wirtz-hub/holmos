import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CancelBooking } from "@/components/public/cancel-booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeLocation, formatMeetingTime, publicText } from "@/lib/public-text";

// PUBLIC: the cancel link from a booking confirmation email. The token in the
// address is the only key, so only the person who booked can see this.

export const metadata: Metadata = { title: { absolute: "Booking" }, robots: { index: false, follow: false } };

export default function CancelPage({ params }: PageProps<"/book/cancel/[token]">) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-900/5 sm:p-8">
        <Suspense fallback={<div className="h-40" />}>
          <Content params={params} />
        </Suspense>
      </div>
    </main>
  );
}

function isUpcoming(booking: { status: string; starts_at: string }) {
  return booking.status === "confirmed" && new Date(booking.starts_at).getTime() > Date.now();
}

async function Content({ params }: { params: PageProps<"/book/cancel/[token]">["params"] }) {
  const { token } = await params;
  // Whether the meeting is still ahead depends on the current time.
  await connection();
  const booking = /^[0-9a-f]{64}$/.test(token)
    ? (
        await createAdminClient()
          .from("bookings")
          .select("starts_at, status, booking_calendars(name, slug, time_zone, language, location_type, location_detail)")
          .eq("cancel_token", token)
          .maybeSingle()
      ).data
    : null;
  const calendar = booking?.booking_calendars as unknown as
    | { name: string; slug: string; time_zone: string; language: string; location_type: string; location_detail: string | null }
    | undefined;

  if (!booking || !calendar) {
    const text = publicText("da");
    return <p className="text-center text-slate-600">{text.cannotCancel}</p>;
  }
  const text = publicText(calendar.language);
  const upcoming = isUpcoming(booking);

  return (
    <div lang={calendar.language}>
      <h1 className="text-xl font-bold text-slate-900">{text.cancelTitle}</h1>
      <div className="mt-4 space-y-1 text-sm text-slate-700">
        <p className="text-base font-semibold text-slate-900">{calendar.name}</p>
        <p>{formatMeetingTime(booking.starts_at, calendar.time_zone, calendar.language)}</p>
        <p className="text-slate-500">{describeLocation(calendar.location_type, calendar.location_detail, calendar.language)}</p>
      </div>
      <CancelBooking token={token} upcoming={upcoming} language={calendar.language} bookAgainHref={`/book/${calendar.slug}`} />
    </div>
  );
}
