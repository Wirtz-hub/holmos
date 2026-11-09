"use client";

import { RefreshCw, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { disconnectInstagramAction, syncInstagramAction } from "@/lib/actions/inbox";

export function InstagramConnectLink({ connected }: { connected: boolean }) {
  return (
    <a href="/api/oauth/instagram/start" className={buttonClass(connected ? "secondary" : "primary", "sm")}>
      {connected ? "Reconnect" : "Connect Instagram"}
    </a>
  );
}

export function InstagramConnectionActions({ connectionId }: { connectionId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message: string }>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage({ ok: result.ok, text: result.message });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={buttonClass("secondary", "sm")}
        disabled={pending}
        onClick={() => run(() => syncInstagramAction(connectionId))}
      >
        <RefreshCw className="size-3.5" aria-hidden />
        Sync now
      </button>
      <button
        type="button"
        className={buttonClass("danger", "sm")}
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Disconnect this Instagram login? Copied messages are removed. Nothing is deleted on Instagram or in your contacts.")) {
            return;
          }
          run(() => disconnectInstagramAction(connectionId));
        }}
      >
        <Unplug className="size-3.5" aria-hidden />
        Disconnect
      </button>
      {message && <p className={message.ok ? "text-xs text-slate-500" : "text-xs text-rose-600"}>{message.text}</p>}
    </div>
  );
}
