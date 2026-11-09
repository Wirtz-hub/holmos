import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DraftComposer, DraftList, MarkConversationRead } from "@/components/inbox/thread-actions";
import { Card, Notice, PageHeader, PageSkeleton, cx } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { messagingWindow } from "@/lib/instagram/window";

export const metadata: Metadata = { title: "Conversation" };

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  attachments: { type?: string; url?: string | null }[];
  sent_at: string;
  is_read: boolean;
};

type Draft = {
  id: string;
  body: string;
  status: "draft" | "approved" | "rejected" | "sent";
  source: string;
  send_error: string | null;
  created_at: string;
};

export default function ConversationPage({ params }: PageProps<"/inbox/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: PageProps<"/inbox/[id]">["params"] }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("dm_conversations")
    .select("id, participant_username, participant_name, participant_id, contact_id, last_inbound_at, unread")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const contactResult = data.contact_id
    ? await supabase.from("contacts").select("name, client_id").eq("id", data.contact_id).maybeSingle()
    : { data: null, error: null };
  if (contactResult.error) throw new Error(contactResult.error.message);

  const [messagesResult, draftsResult] = await Promise.all([
    supabase
      .from("dm_messages")
      .select("id, direction, body, attachments, sent_at, is_read")
      .eq("conversation_id", id)
      .order("sent_at", { ascending: true })
      .limit(200),
    supabase
      .from("dm_drafts")
      .select("id, body, status, source, send_error, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (messagesResult.error) throw new Error(messagesResult.error.message);
  if (draftsResult.error) throw new Error(draftsResult.error.message);

  const contact = contactResult.data as { name: string | null; client_id: string } | null;
  const name = data.participant_username ? `@${data.participant_username}` : data.participant_name || "Instagram user";
  const window = messagingWindow(data.last_inbound_at as string | null);
  const messages = (messagesResult.data ?? []) as Message[];
  const drafts = (draftsResult.data ?? []) as Draft[];

  return (
    <>
      <MarkConversationRead conversationId={id} unread={Boolean(data.unread)} />
      <PageHeader
        back={
          <Link href="/inbox" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Instagram
          </Link>
        }
        title={name}
        description={
          contact ? (
            <Link href={`/clients/${contact.client_id}/contacts`} className="text-brand-700 hover:underline">
              Contact: {contact.name || "linked contact"}
            </Link>
          ) : (
            "No matching contact yet. A contact is linked when their notes or website contain this Instagram handle."
          )
        }
      />

      {!window.open && (
        <div className="mb-6">
          <Notice kind="warning">{window.error}</Notice>
        </div>
      )}
      {window.open && window.closesAt && (
        <div className="mb-6">
          <Notice>Reply window open until {formatDateTime(window.closesAt)}. Sending still needs an approved draft and a press of Send.</Notice>
        </div>
      )}

      <Card className="mb-6">
        {messages.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No messages copied yet.</p>
        ) : (
          <ol className="flex flex-col gap-3 px-5 py-4">
            {messages.map((message) => (
              <li key={message.id} className={cx("max-w-[40rem]", message.direction === "outbound" && "self-end")}>
                <div
                  className={cx(
                    "rounded-2xl px-4 py-2.5 text-sm",
                    message.direction === "outbound" ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-800",
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.body || attachmentLabel(message.attachments)}</p>
                </div>
                <p className={cx("mt-1 text-xs text-slate-400", message.direction === "outbound" && "text-right")}>
                  {message.direction === "outbound" ? "You" : name}
                  {" · "}
                  {formatDateTime(message.sent_at)}
                  {message.direction === "outbound" && message.is_read ? " · Seen" : ""}
                  {message.direction === "inbound" && !message.is_read ? " · Unread" : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Drafts</h2>
          <p className="mt-0.5 text-sm text-slate-500">Approve a draft first. Send is a separate step, and only works inside the 24-hour window.</p>
        </div>
        <DraftList drafts={drafts} windowError={window.error} />
        <DraftComposer conversationId={id} />
      </Card>
    </>
  );
}

function attachmentLabel(attachments: { type?: string }[]) {
  const type = attachments[0]?.type;
  if (!type) return "Attachment";
  if (type === "deleted") return "Message deleted";
  if (type === "unsupported") return "Instagram couldn't share this message";
  return `[${type}]`;
}
