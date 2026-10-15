"use client";

import { createContext, use, useTransition, type ReactNode, type TransitionStartFunction } from "react";
import { cx } from "@/components/ui";

const RangeTransition = createContext<{ pending: boolean; start: TransitionStartFunction } | null>(null);

export function useRangeTransition() {
  const value = use(RangeTransition);
  if (!value) throw new Error("useRangeTransition must be used inside <RangeFrame>");
  return value;
}

/** While a new date range loads, the old numbers stay put (dimmed) instead of flashing a skeleton. */
export function RangeFrame({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  const [pending, start] = useTransition();
  return (
    <RangeTransition value={{ pending, start }}>
      {controls}
      <div aria-busy={pending} className={cx("transition-opacity", pending && "pointer-events-none opacity-50")}>
        {children}
      </div>
    </RangeTransition>
  );
}
