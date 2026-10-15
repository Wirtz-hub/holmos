"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { decodeFlash, FLASH_COOKIE, type Flash } from "@/lib/flash";

function readAndClearFlash(): Flash | null {
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${FLASH_COOKIE}=`))
    ?.slice(FLASH_COOKIE.length + 1);
  if (!raw) return null;
  document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
  return decodeFlash(raw);
}

/** Shows a one-time message left by a redirect (e.g. after connecting Meta or Google). */
export function FlashMessage() {
  const [flash, setFlash] = useState<Flash | null>(null);

  useEffect(() => {
    // Reading a cookie is a browser-only side effect, so it has to happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlash(readAndClearFlash());
  }, []);

  useEffect(() => {
    if (flash?.kind !== "success") return;
    const timer = setTimeout(() => setFlash(null), 8000);
    return () => clearTimeout(timer);
  }, [flash]);

  if (!flash) return null;
  const Icon = flash.kind === "success" ? CircleCheck : CircleAlert;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6" role="status">
      <div
        className={cx(
          "flex max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ring-1",
          flash.kind === "success" ? "bg-white text-slate-800 ring-emerald-200" : "bg-white text-slate-800 ring-rose-200",
        )}
      >
        <Icon className={cx("mt-0.5 size-4 shrink-0", flash.kind === "success" ? "text-emerald-600" : "text-rose-600")} />
        <p className="flex-1">{flash.message}</p>
        <button type="button" onClick={() => setFlash(null)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
