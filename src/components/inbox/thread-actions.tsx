"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, buttonClass } from "@/components/ui";
import {
  approveDraftAction,
  createDraftAction,
  markConversationReadAction,
  rejectDraftAction,
  sendDraftAction,
} from "@/lib/actions/inbox";

export function MarkConversationRead({ conversationId, unread }: { conversationId: string; unread: boolean }) {
  const started = useRef(false);
  useEffect(() => {
    if (!unread || started.current) return;
    started.current = true;
    void markConversationReadAction(conversationId);
  }, [conversationId, unread]);
  return null;
}

type Draft = {
  id: string;
  body: string;
  status: "draft" | "approved" | "rejected" | "sent";
  source: string;
  send_error: string | null;
};

export function DraftList({ drafts, windowError }: { drafts: Draft[]; windowError: string | null }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (draftId: string, action: (id: string) => Promise<{ ok: boolean; message: string }>) => {
    setMessage(null);
    setPendingId(draftId);
    startTransition(async () => {
      const result = await action(draftId);
      setMessage({ ok: result.ok, text: result.message });
      setPendingId(null);
    });
  };

  if (!drafts.length) return null;

  return (
    <ul className="divide-y divide-slate-100">
      {drafts.map((draft) => {
        const busy = pending && pendingId === draft.id;
        return (
          <li key={draft.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{labelFor(draft.status)}</span>
              <span>{draft.source === "bot" ? "From the inbox bot" : "Written here"}</span>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap text-slate-800">{draft.body}</p>
            {draft.send_error && draft.status !== "sent" && <p className="mt-2 text-sm text-rose-600">{draft.send_error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {draft.status === "draft" && (
                <button type="button" className={buttonClass("primary", "sm")} disabled={busy} onClick={() => run(draft.id, approveDraftAction)}>
                  Approve
                </button>
              )}
              {draft.status === "approved" && (
                <button
                  type="button"
                  className={buttonClass("primary", "sm")}
                  disabled={busy || Boolean(windowError)}
                  title={windowError ?? undefined}
                  onClick={() => run(draft.id, sendDraftAction)}
                >
                  Send
                </button>
              )}
              {(draft.status === "draft" || draft.status === "approved") && (
                <button type="button" className={buttonClass("danger", "sm")} disabled={busy} onClick={() => run(draft.id, rejectDraftAction)}>
                  Reject
                </button>
              )}
            </div>
            {draft.status === "approved" && windowError && <p className="mt-2 text-sm text-amber-800">{windowError}</p>}
          </li>
        );
      })}
      {message && <li className={message.ok ? "px-5 py-3 text-sm text-slate-600" : "px-5 py-3 text-sm text-rose-600"}>{message.text}</li>}
    </ul>
  );
}

function labelFor(status: Draft["status"]) {
  if (status === "draft") return "Needs approval";
  if (status === "approved") return "Approved — not sent";
  if (status === "sent") return "Sent";
  return "Rejected";
}

export function DraftComposer({ conversationId }: { conversationId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="border-t border-slate-100 px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await createDraftAction(conversationId, body);
          setMessage({ ok: result.ok, text: result.message });
          if (result.ok) setBody("");
        });
      }}
    >
      <label htmlFor="draft-body" className="mb-1.5 block text-sm font-medium text-slate-700">
        New draft
      </label>
      <textarea
        id="draft-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Write the follow-up. Saving it does not send it."
        className="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          Save draft
        </Button>
        {message && <p className={message.ok ? "text-sm text-slate-500" : "text-sm text-rose-600"}>{message.text}</p>}
      </div>
    </form>
  );
}
