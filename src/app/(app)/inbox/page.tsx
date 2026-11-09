import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InstagramConnectLink, InstagramConnectionActions } from "@/components/inbox/inbox-controls";
import { Card, EmptyState, Notice, PageHeader, PageSkeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { missingInstagramSettings, serverEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { messagingWindow } from "@/lib/instagram/window";

export const metadata: Metadata = { title: "Instagram" };

type Connection = {
  id: string;
  label: string;
  ig_username: string;
  page_name: string | null;
  status: string;
  last_error: string | null;
  last_synced_at: string | null;
  token_expires_at: string | null;
};

type Conversation = {
  id: string;
  participant_username: string | null;
  participant_name: string | null;
  snippet: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  unread: boolean;
  contact_id: string | null;
};

export default function InboxPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Inbox />
    </Suspense>
  );
}

async function Inbox() {
  const { supabase } = await requireAdmin();
  const missing = missingInstagramSettings();
  const env = serverEnv();
  const [connectionsResult, conversationsResult] = await Promise.all([
    supabase
      .from("instagram_connections")
      .select("id, label, ig_username, page_name, status, last_error, last_synced_at, token_expires_at")
      .order("created_at"),
    supabase
      .from("dm_conversations")
      .select("id, participant_username, participant_name, snippet, last_message_at, last_inbound_at, unread, contact_id")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100),
  ]);
  if (connectionsResult.error) throw new Error(connectionsResult.error.message);
  if (conversationsResult.error) throw new Error(conversationsResult.error.message);
  const connections = (connectionsResult.data ?? []) as Connection[];
  const conversations = (conversationsResult.data ?? []) as Conversation[];

  return (
    <>
      <PageHeader
        title="Instagram"
        description="Direct messages for the connected professional account. Drafts stay here until you approve one and then press Send."
        actions={missing.length === 0 ? <InstagramConnectLink connected={connections.length > 0} /> : undefined}
      />

      {missing.length > 0 && (
        <div className="mb-6">
          <Notice kind="warning">
            Instagram is not set up yet. Add {missing.join(", ")} first. The setup guide lists where to find them.
          </Notice>
        </div>
      )}

      {missing.length === 0 && !env.metaWebhookVerifyToken && (
        <div className="mb-6">
          <Notice>
            Live messages need <span className="font-mono text-xs">META_WEBHOOK_VERIFY_TOKEN</span>. Until then, use Sync now to
            copy recent conversations.
          </Notice>
        </div>
      )}

      <div className="mb-8 grid gap-4">
        {connections.length === 0 ? (
          <Card>
            <EmptyState icon={<MessageCircle className="size-5" />} title="Instagram isn't connected">
              Connect the Facebook login that manages the Page linked to @holm_10. HolmOS never replies by itself.
            </EmptyState>
          </Card>
        ) : (
          connections.map((connection) => (
            <Card key={connection.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">@{connection.ig_username}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {connection.page_name ? `${connection.page_name} · ` : ""}
                    {connection.label}
                    {connection.last_synced_at ? ` · synced ${formatDateTime(connection.last_synced_at)}` : " · not synced yet"}
                  </p>
                  {connection.status === "needs_reconnect" && (
                    <p className="mt-2 text-sm text-rose-600">{connection.last_error ?? "Reconnect Instagram to keep reading messages."}</p>
                  )}
                  {connection.status === "active" && connection.last_error && (
                    <p className="mt-2 text-sm text-amber-800">{connection.last_error}</p>
                  )}
                </div>
                <InstagramConnectionActions connectionId={connection.id} />
              </div>
            </Card>
          ))
        )}
      </div>

      <Card>
        {conversations.length === 0 ? (
          <EmptyState icon={<MessageCircle className="size-5" />} title="No conversations yet">
            After you connect, Sync now copies recent threads. New messages arrive on their own once the Meta webhook is on.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {conversations.map((conversation) => {
              const window = messagingWindow(conversation.last_inbound_at);
              const name = conversation.participant_username
                ? `@${conversation.participant_username}`
                : conversation.participant_name || "Instagram user";
              return (
                <li key={conversation.id}>
                  <Link href={`/inbox/${conversation.id}`} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        {conversation.unread && <span className="size-2 rounded-full bg-brand-600" aria-label="Unread" />}
                        <span className="text-sm font-semibold text-slate-900">{name}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-slate-500">{conversation.snippet || "No text"}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-slate-500">
                      <span className="block">{conversation.last_message_at ? formatDateTime(conversation.last_message_at) : ""}</span>
                      <span className={window.open ? "text-emerald-700" : "text-amber-800"}>
                        {window.open ? "Reply window open" : "Window closed"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
