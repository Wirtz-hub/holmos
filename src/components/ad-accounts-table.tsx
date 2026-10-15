"use client";

import { Plug, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Card, cx, EmptyState, inputClass, Notice, PlatformBadge } from "@/components/ui";
import { assignAdAccountAction } from "@/lib/actions/ads";
import { displayAccountId } from "@/lib/ads/display";
import type { AccountWithClient } from "@/lib/data";

type Filter = "all" | "unassigned" | "assigned";

const FILTER_LABELS: Record<Filter, string> = { unassigned: "Not assigned", assigned: "Assigned", all: "All" };

export function AdAccountsTable({
  accounts,
  clients,
}: {
  accounts: AccountWithClient[];
  clients: { id: string; name: string }[];
}) {
  const [filter, setFilter] = useState<Filter>(() => (accounts.some((a) => !a.client_id) ? "unassigned" : "all"));
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = {
    all: accounts.length,
    unassigned: accounts.filter((a) => !a.client_id).length,
    assigned: accounts.filter((a) => a.client_id).length,
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        (filter === "all" || (filter === "unassigned" ? !a.client_id : a.client_id)) &&
        (!q ||
          a.name.toLowerCase().includes(q) ||
          a.external_account_id.includes(q.replace(/-/g, "")) ||
          a.client_name?.toLowerCase().includes(q)),
    );
  }, [accounts, filter, query]);

  if (accounts.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Plug className="size-5" />} title="No ad accounts yet">
          Connect Meta or Google above. Every ad account the login can see will appear here, ready to give to a client.
        </EmptyState>
      </Card>
    );
  }

  function assign(accountId: string, clientId: string | null) {
    setError(null);
    setSavingId(accountId);
    startTransition(async () => {
      const result = await assignAdAccountAction(accountId, clientId).catch(() => ({
        ok: false,
        message: "Couldn't save. Check your connection and try again.",
      }));
      if (!result.ok) setError(result.message ?? "Couldn't save.");
      setSavingId(null);
    });
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
        <div className="inline-flex shrink-0 rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="Show">
          {(["unassigned", "assigned", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cx(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {FILTER_LABELS[f]} <span className="text-slate-400 tabular">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search accounts or clients"
            aria-label="Search ad accounts"
            className={cx(inputClass, "pl-9")}
          />
        </div>
      </div>

      {error && (
        <div className="p-4 pb-0">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {visible.map((account) => (
          <li key={account.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <PlatformBadge platform={account.platform} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{account.name}</p>
                <p className="text-xs text-slate-400 tabular">
                  {displayAccountId(account)}
                  {account.currency && ` · ${account.currency}`}
                  {!account.is_active && <span className="text-amber-600"> · can&apos;t reach — reconnect its login</span>}
                </p>
              </div>
            </div>
            <select
              aria-label={`Client for ${account.name}`}
              value={account.client_id ?? ""}
              disabled={savingId === account.id}
              onChange={(event) => assign(account.id, event.target.value || null)}
              className={cx(inputClass, "sm:w-64", !account.client_id && "text-slate-500")}
            >
              <option value="">Not assigned</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          {filter === "unassigned" && !query ? "Every ad account is assigned to a client." : "No ad accounts match."}
        </p>
      )}
    </Card>
  );
}
