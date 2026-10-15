"use client";

import { useState, useTransition } from "react";
import { cx, inputClass } from "@/components/ui";
import { setStageAction } from "@/lib/actions/clients";
import { STAGES } from "@/lib/pipeline";
import type { Stage } from "@/lib/types";

export function StageSelect({ clientId, stage }: { clientId: string; stage: Stage }) {
  const [value, setValue] = useState(stage);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const dot = STAGES.find((s) => s.id === value)?.dot;

  return (
    <div className="relative">
      <span className={cx("pointer-events-none absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full", dot)} aria-hidden />
      <select
        aria-label="Pipeline stage"
        value={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as Stage;
          const previous = value;
          setValue(next);
          setFailed(false);
          startTransition(async () => {
            const result = await setStageAction(clientId, next).catch(() => ({ ok: false }));
            if (!result.ok) {
              setValue(previous);
              setFailed(true);
            }
          });
        }}
        className={cx(inputClass, "h-10 w-44! pl-7 font-medium", failed && "ring-rose-400!")}
      >
        {STAGES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
