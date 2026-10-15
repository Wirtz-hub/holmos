"use client";

import { CalendarDays } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useRangeTransition } from "@/components/dashboard/range-frame";
import { Button, cx, inputClass } from "@/components/ui";
import { PRESETS, type DateRange, type PresetId } from "@/lib/dates";

export function DateRangePicker({ preset, range, today }: { preset: PresetId | "custom"; range: DateRange; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pending, start } = useRangeTransition();
  const [showCustom, setShowCustom] = useState(preset === "custom");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  function go(query: Record<string, string>) {
    start(() => router.push(`${pathname}?${new URLSearchParams(query)}`, { scroll: false }));
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-2">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <select
          aria-label="Date range"
          value={showCustom ? "custom" : preset}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "custom") return setShowCustom(true);
            setShowCustom(false);
            go({ preset: value });
          }}
          className={cx(inputClass, "h-10 w-48! pl-9 font-medium")}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom range…</option>
        </select>
      </div>

      {showCustom && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (from && to) go({ from, to });
          }}
        >
          <label className="text-xs text-slate-500">
            From
            <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className={cx(inputClass, "mt-1 h-10")} />
          </label>
          <label className="text-xs text-slate-500">
            To
            <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className={cx(inputClass, "mt-1 h-10")} />
          </label>
          <Button type="submit" variant="secondary" disabled={!from || !to}>
            Apply
          </Button>
        </form>
      )}
      {pending && <span className="pb-2.5 text-xs text-slate-500">Loading…</span>}
    </div>
  );
}
