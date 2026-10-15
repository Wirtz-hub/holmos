"use client";

import { useState } from "react";
import { publicText } from "@/lib/public-text";

export function CancelBooking({ token, upcoming, language, bookAgainHref }: { token: string; upcoming: boolean; language: string; bookAgainHref: string }) {
  const text = publicText(language);
  const [state, setState] = useState<"idle" | "sending" | "done" | "gone" | "error">(upcoming ? "idle" : "gone");

  async function cancel() {
    setState("sending");
    try {
      const res = await fetch("/api/public/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : res.status === 410 ? "gone" : "error");
    } catch {
      setState("error");
    }
  }

  const bookAgain = (
    <a href={bookAgainHref} className="mt-4 inline-block text-sm font-medium text-[#1d4669] underline">
      {text.bookAgain}
    </a>
  );

  if (state === "done") {
    return (
      <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
        <p className="font-semibold">{text.cancelled}</p>
        <p className="mt-1">{text.cancelledText}</p>
        {bookAgain}
      </div>
    );
  }
  if (state === "gone") {
    return (
      <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
        <p>{text.cannotCancel}</p>
        {bookAgain}
      </div>
    );
  }
  return (
    <div className="mt-6">
      {state === "error" && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {text.formError}
        </p>
      )}
      <button
        type="button"
        onClick={cancel}
        disabled={state === "sending"}
        className="w-full rounded-full bg-rose-700 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-rose-600 disabled:opacity-60"
      >
        {state === "sending" ? text.cancelling : text.cancelButton}
      </button>
    </div>
  );
}
