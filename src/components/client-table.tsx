"use client";

import { ChartColumn, Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ButtonLink, Card, cx, EmptyState, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { STAGES } from "@/lib/pipeline";
import type { Stage } from "@/lib/types";

export type ClientRow = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  stage: Stage;
  deal_value: number | null;
  currency: string;
  adAccountCount: number;
};

export function ClientTable({ rows }: { rows: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage | "all">("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (stage === "all" || row.stage === stage) &&
        (!q || [row.name, row.contact_name, row.email, row.phone].some((value) => value?.toLowerCase().includes(q))),
    );
  }, [rows, query, stage]);

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Users className="size-5" />}
          title="No clients yet"
          action={<ButtonLink href="/clients/new">Add your first client</ButtonLink>}
        >
          Add a lead or client to start tracking them through your pipeline.
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email or phone"
            aria-label="Search clients"
            className={cx(inputClass, "pl-9")}
          />
        </div>
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value as Stage | "all")}
          aria-label="Filter by stage"
          className={cx(inputClass, "sm:w-48")}
        >
          <option value="all">All stages</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Contact</th>
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Deal value</th>
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Ad accounts</th>
              <th className="px-4 py-2.5">
                <span className="sr-only">Dashboard</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => {
              const stageInfo = STAGES.find((s) => s.id === row.stage);
              return (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="max-w-40 px-4 py-3 sm:max-w-64">
                    <Link href={`/clients/${row.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-slate-700">
                      <span className={cx("size-2 rounded-full", stageInfo?.dot)} aria-hidden />
                      {stageInfo?.label}
                    </span>
                  </td>
                  <td className="hidden max-w-64 px-4 py-3 text-slate-600 md:table-cell">
                    <span className="block truncate">{row.contact_name ?? row.email ?? "–"}</span>
                    {row.contact_name && row.email && <span className="block truncate text-xs text-slate-400">{row.email}</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-right whitespace-nowrap text-slate-700 tabular sm:table-cell">
                    {row.deal_value !== null ? formatMoney(Number(row.deal_value), row.currency) : "–"}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-slate-600 tabular sm:table-cell">{row.adAccountCount || "–"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${row.id}/dashboard`}
                      className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-brand-700 hover:text-brand-600"
                    >
                      <ChartColumn className="size-3.5" aria-hidden />
                      <span className="sr-only sm:not-sr-only">Dashboard</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No clients match.</p>}
      </div>
    </Card>
  );
}
