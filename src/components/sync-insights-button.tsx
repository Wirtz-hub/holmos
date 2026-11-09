"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { buttonClass, Card, cx } from "@/components/ui";
import { syncInsightsAction } from "@/lib/actions/ads";
import { formatDateTime } from "@/lib/format";
import type { Platform } from "@/lib/types";

export function SyncInsightsCard({
  ready,
  lastSuccess,
  errors,
}: {
  ready: boolean;
  lastSuccess: string | null;
  errors: { name: string; platform: Platform; message: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <Card className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Performance in the database</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Every morning HolmOS copies spend, clicks and purchases into the database — the last 30 days the first
            time, then the last 7 days, because Meta revises recent numbers. This only reads. Nothing is created,
            edited, paused or spent in Meta or Google.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {ready
              ? lastSuccess
                ? `Last synced ${formatDateTime(lastSuccess)}.`
                : "Not synced yet. The first run pulls the last 30 days."
              : "The database update for this hasn't been run yet. The setup guide (daily ad numbers) has the steps."}
          </p>
        </div>
        <button
          type="button"
          disabled={!ready || pending}
          aria-busy={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              const result = await syncInsightsAction().catch(() => ({
                ok: false,
                message: "Couldn't sync right now. Try again.",
              }));
              setMessage({ ok: result.ok, text: result.message });
            })
          }
          className={buttonClass("secondary", "sm")}
        >
          <RefreshCw className={cx("size-3.5", pending && "animate-spin")} aria-hidden />
          {pending ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {message && (
        <p role="status" className={cx("px-5 pb-4 text-sm", message.ok ? "text-emerald-700" : "text-rose-600")}>
          {message.text}
        </p>
      )}
      {!message && errors.length > 0 && (
        <ul className="space-y-1 px-5 pb-4 text-xs text-rose-600">
          {errors.map((error) => (
            <li key={`${error.platform}-${error.name}`}>
              {error.name}: {error.message}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
