import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { EmbedFrame } from "@/components/public/embed-frame";
import { BookingWidget } from "@/components/public/booking-widget";
import { RichText } from "@/components/funnels/funnel-view";
import { getPublicCalendar } from "@/lib/public-data";

// PUBLIC: a booking page. Only active booking pages are shown. Add ?embed=1 to
// show just the calendar, for an iframe on another website.

type Props = PageProps<"/book/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const calendar = await getPublicCalendar((await params).slug);
  return {
    title: { absolute: calendar?.name ?? "Not found" },
    description: calendar?.description?.slice(0, 160) || undefined,
    robots: { index: false, follow: false },
  };
}

export default function BookingPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const calendar = await getPublicCalendar(slug);
  if (!calendar) notFound();
  const style = { "--accent": "#1d4669", "--on-accent": "#ffffff" } as CSSProperties;

  if (query.embed === "1") {
    return (
      <EmbedFrame lang={calendar.language} style={style} className="p-1">
        <BookingWidget calendar={calendar} />
      </EmbedFrame>
    );
  }

  return (
    <main lang={calendar.language} style={style} className="min-h-dvh px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-2xl">
        {calendar.description && (
          <div className="mb-6 text-slate-600">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">{calendar.name}</h1>
            <RichText text={calendar.description} />
          </div>
        )}
        <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-900/5 sm:p-6">
          <BookingWidget calendar={calendar} />
        </div>
      </div>
    </main>
  );
}
