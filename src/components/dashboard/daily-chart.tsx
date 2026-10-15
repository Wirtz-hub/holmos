"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, cx } from "@/components/ui";
import type { DayPoint, PlatformDay } from "@/lib/ads/report";
import { addDays, formatDay } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import type { Platform } from "@/lib/types";

type Metric = keyof PlatformDay;

const SERIES: Record<Platform, { label: string; color: string }> = {
  meta: { label: "Meta", color: "var(--color-meta)" },
  google: { label: "Google", color: "var(--color-google)" },
};

const WEEKLY_AFTER_DAYS = 92;

type Row = { date: string; meta: number; google: number };

/** Monday of the week the date falls in. */
function weekStart(iso: string) {
  const weekday = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(iso, -weekday);
}

function toRows(daily: DayPoint[], metric: Metric, weekly: boolean): Row[] {
  const rows = new Map<string, Row>();
  for (const day of daily) {
    const key = weekly ? weekStart(day.date) : day.date;
    const row = rows.get(key) ?? { date: key, meta: 0, google: 0 };
    row.meta += day.meta[metric];
    row.google += day.google[metric];
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** Column segment: 2px surface gap between stacked fills, 4px rounded top on the topmost one only. */
function segment(series: Platform, platforms: Platform[]) {
  return function Segment(props: unknown) {
    const { x, y, width, height, fill, payload } = props as {
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      payload: Row;
    };
    if (!height || height <= 0 || !width) return <g />;
    const hasGoogleAbove = series === "meta" && platforms.includes("google") && payload.google > 0;
    const top = hasGoogleAbove ? y + 2 : y;
    const h = Math.max(0, y + height - top);
    if (h <= 0) return <g />;
    const r = hasGoogleAbove ? 0 : Math.min(4, width / 2, h);
    const bottom = top + h;
    const d = `M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${bottom} Z`;
    return <path d={d} fill={fill} />;
  };
}

export function DailyChart({
  daily,
  platforms,
  currency,
  resultsLabel,
}: {
  daily: DayPoint[];
  platforms: Platform[];
  currency: string;
  resultsLabel: string;
}) {
  const [metric, setMetric] = useState<Metric>("spend");
  const weekly = daily.length > WEEKLY_AFTER_DAYS;
  const rows = useMemo(() => toRows(daily, metric, weekly), [daily, metric, weekly]);
  const series = (["meta", "google"] as const).filter((p) => platforms.includes(p));

  const metrics: { id: Metric; label: string }[] = [
    { id: "spend", label: "Spend" },
    { id: "results", label: resultsLabel },
    { id: "clicks", label: "Clicks" },
    { id: "impressions", label: "Impressions" },
  ];
  const format = (value: number, compact = false) =>
    metric === "spend" ? formatMoney(value, currency, { compact }) : formatNumber(value, { compact, decimals: compact ? 1 : undefined });
  const dateLabel = (iso: string) => (weekly ? `Week of ${formatDay(iso)}` : formatDay(iso, { weekday: "short", day: "numeric", month: "short" }));
  const metricLabel = metrics.find((m) => m.id === metric)!.label;
  const allZero = rows.every((row) => row.meta === 0 && row.google === 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {metricLabel} per {weekly ? "week" : "day"}
          </h2>
          {series.length > 1 && (
            <ul className="flex items-center gap-3 text-xs text-slate-600" aria-label="Legend">
              {series.map((p) => (
                <li key={p} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: SERIES[p].color }} aria-hidden />
                  {SERIES[p].label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="Metric">
          {metrics.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={metric === m.id}
              onClick={() => setMetric(m.id)}
              className={cx(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                metric === m.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-72 px-2 pt-4 pb-2">
        {allZero && (
          <p className="absolute inset-0 z-10 grid place-items-center text-sm text-slate-400">
            No {metricLabel.toLowerCase()} in this period
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 12, bottom: 0, left: 4 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#e9ecf0" />
            <XAxis
              dataKey="date"
              tickFormatter={(iso: string) => formatDay(iso)}
              tickLine={false}
              axisLine={{ stroke: "#d6dae0" }}
              tick={{ fontSize: 12, fill: "#64748b" }}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(value: number) => format(value, true)}
              tickLine={false}
              axisLine={false}
              width={68}
              tick={{ fontSize: 12, fill: "#64748b" }}
              allowDecimals={metric === "spend"}
            />
            <Tooltip
              cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
              isAnimationActive={false}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Row;
                return (
                  <div className="min-w-40 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
                    <p className="mb-1.5 text-slate-500">{dateLabel(String(label))}</p>
                    {series.map((p) => (
                      <p key={p} className="flex items-center gap-2 py-0.5">
                        <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES[p].color }} aria-hidden />
                        <span className="font-semibold text-slate-900 tabular">{format(row[p])}</span>
                        <span className="text-slate-500">{SERIES[p].label}</span>
                      </p>
                    ))}
                    {series.length > 1 && (
                      <p className="mt-1 border-t border-slate-100 pt-1 text-slate-600">
                        Total <span className="font-semibold text-slate-900 tabular">{format(row.meta + row.google)}</span>
                      </p>
                    )}
                  </div>
                );
              }}
            />
            {series.map((p) => (
              <Bar
                key={p}
                dataKey={p}
                name={SERIES[p].label}
                stackId="platforms"
                fill={SERIES[p].color}
                maxBarSize={24}
                isAnimationActive={false}
                shape={segment(p, series)}
                activeBar={{ fillOpacity: 0.85 }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="border-t border-slate-100 px-5 py-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-slate-500 select-none hover:text-slate-800">
          Show as table
        </summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white text-slate-500">
              <tr>
                <th className="py-1.5 pr-4 font-medium">{weekly ? "Week of" : "Date"}</th>
                {series.map((p) => (
                  <th key={p} className="py-1.5 pr-4 text-right font-medium">
                    {SERIES[p].label}
                  </th>
                ))}
                {series.length > 1 && <th className="py-1.5 text-right font-medium">Total</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 tabular">
              {rows.map((row) => (
                <tr key={row.date}>
                  <td className="py-1.5 pr-4">{formatDay(row.date, { day: "numeric", month: "short", year: "numeric" })}</td>
                  {series.map((p) => (
                    <td key={p} className="py-1.5 pr-4 text-right">
                      {format(row[p])}
                    </td>
                  ))}
                  {series.length > 1 && <td className="py-1.5 text-right">{format(row.meta + row.google)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
