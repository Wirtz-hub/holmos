"use client";

import { Video } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, cx } from "@/components/ui";
import { cancelBookingAction } from "@/lib/actions/booking";

export type BookingListItem = {
  id: string;
  when: string;
  day: string;
  name: string;
  email: string;
  phone: string | null;
  note: string | null;
  calendar: string;
  client_id: string | null;
  meeting_url: string | null;
  status: "confirmed" | "cancelled";
  past: boolean;
};

export function BookingList({ items, empty }: { items: BookingListItem[]; empty: string }) {
  if (items.length === 0) return <p className="px-5 py-10 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <ol>
      {items.map((item, i) => {
        const header = i === 0 || items[i - 1].day !== item.day ? item.day : null;
        return (
          <li key={item.id}>
            {header && <p className="border-t border-slate-100 bg-slate-50 px-5 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase first:border-t-0">{header}</p>}
            <BookingRow item={item} />
          </li>
        );
      })}
    </ol>
  );
}

function BookingRow({ item }: { item: BookingListItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cancelled = item.status === "cancelled";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className={cx("text-sm font-semibold tabular", cancelled ? "text-slate-400 line-through" : "text-slate-900")}>
          {item.when} · {item.calendar}
        </p>
        <p className="mt-0.5 text-sm text-slate-600">
          {item.client_id ? (
            <Link href={`/clients/${item.client_id}`} className="font-medium hover:text-brand-700">
              {item.name}
            </Link>
          ) : (
            item.name
          )}{" "}
          · <a href={`mailto:${item.email}`} className="hover:text-brand-700">{item.email}</a>
          {item.phone && <> · {item.phone}</>}
        </p>
        {item.note && <p className="mt-1 text-sm whitespace-pre-wrap text-slate-500">“{item.note}”</p>}
        {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        {cancelled ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Cancelled</span>
        ) : (
          <>
            {item.meeting_url && !item.past && (
              <a href={item.meeting_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                <Video className="size-4" aria-hidden /> Join
              </a>
            )}
            {!item.past && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Cancel ${item.name}'s booking on ${item.day}, ${item.when}? They'll get an email saying it's cancelled.`)) return;
                  startTransition(async () => {
                    const result = await cancelBookingAction(item.id, true);
                    if (!result.ok) setError(result.message ?? "Couldn't cancel.");
                  });
                }}
              >
                {pending ? "Cancelling…" : "Cancel"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
