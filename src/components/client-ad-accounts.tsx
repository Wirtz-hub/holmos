"use client";

import { Plug, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Card, CardHeader, cx, inputClass, Notice, PlatformBadge } from "@/components/ui";
import { assignAdAccountAction } from "@/lib/actions/ads";
import { displayAccountId } from "@/lib/ads/display";
import type { AccountWithClient } from "@/lib/data";

export function ClientAdAccounts({ clientId, accounts }: { clientId: string; accounts: AccountWithClient[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const assigned = accounts.filter((a) => a.client_id === clientId);
  const unassigned = accounts.filter((a) => !a.client_id);
  const elsewhere = accounts.filter((a) => a.client_id && a.client_id !== clientId);

  function assign(accountId: string, target: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await assignAdAccountAction(accountId, target).catch(() => ({
        ok: false,
        message: "Couldn't save. Check your connection and try again.",
      }));
      if (!result.ok) setError(result.message ?? "Couldn't save.");
    });
  }

  return (
    <Card>
      <CardHeader
        title="Ad accounts"
        description="Only these accounts show up on this client's dashboard."
      />
      <div className="space-y-4 p-5">
        {assigned.length > 0 ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {assigned.map((account) => (
              <li key={account.id} className="flex items-center gap-3 px-3 py-2.5">
                <PlatformBadge platform={account.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{account.name}</p>
                  <p className="text-xs text-slate-400 tabular">
                    {displayAccountId(account)}
                    {!account.is_active && <span className="ml-2 text-amber-600">· needs reconnecting</span>}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => assign(account.id, null)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={`Remove ${account.name} from this client`}
                  title="Remove from this client"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No ad accounts assigned yet.</p>
        )}

        {accounts.length === 0 ? (
          <Notice>
            <span className="inline-flex items-center gap-1.5">
              <Plug className="size-4" aria-hidden />
              Connect Meta or Google on the{" "}
              <Link href="/ad-accounts" className="font-medium underline underline-offset-2">
                Ad accounts
              </Link>{" "}
              page first.
            </span>
          </Notice>
        ) : (
          (unassigned.length > 0 || elsewhere.length > 0) && (
            <select
              aria-label="Assign an ad account"
              value=""
              disabled={pending}
              onChange={(event) => event.target.value && assign(event.target.value, clientId)}
              className={cx(inputClass, "sm:max-w-sm")}
            >
              <option value="">+ Assign an ad account…</option>
              {unassigned.length > 0 && (
                <optgroup label="Not assigned yet">
                  {unassigned.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.platform === "meta" ? "Meta" : "Google"} · {account.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {elsewhere.length > 0 && (
                <optgroup label="Move from another client">
                  {elsewhere.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.platform === "meta" ? "Meta" : "Google"} · {account.name} (now: {account.client_name})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )
        )}
        {error && <Notice kind="error">{error}</Notice>}
      </div>
    </Card>
  );
}
