"use client";

import { RefreshCw, TriangleAlert, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { buttonClass, Card, cx } from "@/components/ui";
import { disconnectAction, refreshConnectionAction } from "@/lib/actions/ads";
import { formatDate } from "@/lib/format";
import type { AdConnection, Platform } from "@/lib/types";

type ConnectionWithExpiry = AdConnection & { daysLeft: number | null };

const COPY: Record<Platform, { name: string; what: string; dot: string }> = {
  meta: { name: "Meta Ads", what: "Facebook & Instagram ad accounts", dot: "bg-meta" },
  google: { name: "Google Ads", what: "Google Ads accounts, including ones under a manager account", dot: "bg-google" },
};


export function ConnectionCard({
  platform,
  connections,
  accountCount,
  missingSettings,
}: {
  platform: Platform;
  connections: ConnectionWithExpiry[];
  accountCount: number;
  missingSettings: string[];
}) {
  const copy = COPY[platform];
  const startHref = `/api/oauth/${platform}/start`;

  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className={cx("size-2.5 rounded-full", copy.dot)} aria-hidden />
            {copy.name}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{copy.what}</p>
        </div>
        {missingSettings.length === 0 && (
          <a href={startHref} className={buttonClass(connections.length ? "secondary" : "primary", "sm")}>
            {connections.length ? "Add another login" : `Connect ${platform === "meta" ? "Meta" : "Google"}`}
          </a>
        )}
      </div>

      {missingSettings.length > 0 ? (
        <div className="mx-5 mb-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          Not set up yet. Add these settings first (the setup guide shows where to find them):
          <ul className="mt-2 space-y-0.5 font-mono text-xs text-slate-700">
            {missingSettings.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      ) : connections.length === 0 ? (
        <p className="mx-5 mb-5 text-sm text-slate-500">
          Not connected. You&apos;ll sign in with {platform === "meta" ? "Facebook" : "Google"} and every ad account that
          login can see shows up below.
        </p>
      ) : (
        <ul className="mt-auto divide-y divide-slate-100 border-t border-slate-100">
          {connections.map((connection) => (
            <ConnectionRow key={connection.id} connection={connection} startHref={startHref} />
          ))}
          <li className="px-5 py-2.5 text-xs text-slate-500">
            {accountCount} ad account{accountCount === 1 ? "" : "s"} found
          </li>
        </ul>
      )}
    </Card>
  );
}

function ConnectionRow({ connection, startHref }: { connection: ConnectionWithExpiry; startHref: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const { daysLeft } = connection;
  const needsReconnect = connection.status === "needs_reconnect" || (daysLeft !== null && daysLeft <= 0);
  const expiringSoon = !needsReconnect && daysLeft !== null && daysLeft <= 10;

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{connection.label}</p>
          <p className={cx("text-xs", needsReconnect ? "text-rose-600" : expiringSoon ? "text-amber-600" : "text-slate-500")}>
            {needsReconnect
              ? "Needs reconnecting"
              : expiringSoon
                ? `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — reconnect to extend`
                : daysLeft !== null && expiresAt
                  ? `Connected · renew by ${formatDate(expiresAt.toISOString())}`
                  : "Connected"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(needsReconnect || expiringSoon) && (
            <a href={startHref} className={buttonClass("primary", "sm")}>
              <TriangleAlert className="size-3.5" aria-hidden />
              Reconnect
            </a>
          )}
          {!needsReconnect && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setMessage(null);
                  const result = await refreshConnectionAction(connection.id).catch(() => ({
                    ok: false,
                    message: "Couldn't check right now. Try again.",
                  }));
                  setMessage({ ok: result.ok, text: result.message ?? "" });
                })
              }
              className={buttonClass("ghost", "sm")}
              title="Look for ad accounts this login has been given access to since connecting"
            >
              <RefreshCw className={cx("size-3.5", pending && "animate-spin")} aria-hidden />
              {pending ? "Checking…" : "Check for new accounts"}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Disconnect ${connection.label}? Client assignments are kept for when you reconnect.`)) return;
              startTransition(async () => {
                const result = await disconnectAction(connection.id).catch(() => ({ ok: false }));
                if (!result.ok) setMessage({ ok: false, text: "Couldn't disconnect. Try again." });
              });
            }}
            className={buttonClass("ghost", "sm")}
            aria-label={`Disconnect ${connection.label}`}
            title="Disconnect"
          >
            <Unplug className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
      {message?.text && <p className={cx("mt-1 text-xs", message.ok ? "text-emerald-700" : "text-rose-600")}>{message.text}</p>}
      {needsReconnect && connection.last_error && <p className="mt-1 text-xs text-slate-500">{connection.last_error}</p>}
    </li>
  );
}
