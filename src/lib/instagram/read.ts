import "server-only";
import { messagingWindow } from "@/lib/instagram/window";
import { createAdminClient } from "@/lib/supabase/admin";

type MessageRow = {
  id: string;
  external_id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  attachments: unknown;
  sent_at: string;
  is_read: boolean;
};

type DraftRow = {
  id: string;
  body: string;
  status: string;
  source: string;
  created_at: string;
  send_error: string | null;
};

type ConversationRow = {
  id: string;
  thread_id: string;
  participant_id: string;
  participant_username: string | null;
  participant_name: string | null;
  contact_id: string | null;
  snippet: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  unread: boolean;
};

function publicMessage(message: MessageRow) {
  return {
    id: message.id,
    external_id: message.external_id,
    direction: message.direction,
    text: message.body,
    attachments: message.attachments ?? [],
    sent_at: message.sent_at,
    is_read: message.is_read,
  };
}

function publicDraft(draft: DraftRow) {
  return {
    id: draft.id,
    text: draft.body,
    status: draft.status,
    source: draft.source,
    created_at: draft.created_at,
    send_error: draft.send_error,
  };
}

function publicThread(conversation: ConversationRow, messages: MessageRow[], drafts: DraftRow[]) {
  const window = messagingWindow(conversation.last_inbound_at);
  return {
    id: conversation.id,
    thread_id: conversation.thread_id,
    participant: {
      id: conversation.participant_id,
      username: conversation.participant_username,
      name: conversation.participant_name,
    },
    contact_id: conversation.contact_id,
    snippet: conversation.snippet,
    last_message_at: conversation.last_message_at,
    last_inbound_at: conversation.last_inbound_at,
    unread: conversation.unread,
    messaging_window_hours: 24,
    window_open: window.open,
    window_closes_at: window.closesAt,
    messages: messages.map(publicMessage),
    drafts: drafts.map(publicDraft),
  };
}

/** Recent threads for the inbox bot. Tokens are never included. */
export async function readInboxThreads(options: { conversationId?: string; limit: number; messageLimit: number }) {
  const admin = createAdminClient();
  let query = admin
    .from("dm_conversations")
    .select(
      "id, thread_id, participant_id, participant_username, participant_name, contact_id, snippet, last_message_at, last_inbound_at, unread",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(options.limit);
  if (options.conversationId) query = query.eq("id", options.conversationId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const conversations = (data ?? []) as ConversationRow[];
  if (!conversations.length) return [];

  const ids = conversations.map((conversation) => conversation.id);
  const [messageGroups, draftsResult] = await Promise.all([
    Promise.all(
      conversations.map(async (conversation) => {
        const { data: rows, error: messageError } = await admin
          .from("dm_messages")
          .select("id, external_id, direction, body, attachments, sent_at, is_read")
          .eq("conversation_id", conversation.id)
          .order("sent_at", { ascending: false })
          .limit(options.messageLimit);
        if (messageError) throw new Error(messageError.message);
        return [conversation.id, ((rows ?? []) as MessageRow[]).slice().reverse()] as const;
      }),
    ),
    admin
      .from("dm_drafts")
      .select("id, conversation_id, body, status, source, created_at, send_error")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  if (draftsResult.error) throw new Error(draftsResult.error.message);

  const messagesByConversation = new Map<string, MessageRow[]>(messageGroups);
  const draftsByConversation = new Map<string, DraftRow[]>();
  for (const row of draftsResult.data ?? []) {
    const list = draftsByConversation.get(row.conversation_id as string) ?? [];
    list.push(row as DraftRow);
    draftsByConversation.set(row.conversation_id as string, list);
  }

  return conversations.map((conversation) =>
    publicThread(
      conversation,
      (messagesByConversation.get(conversation.id) ?? []).slice().reverse(),
      draftsByConversation.get(conversation.id) ?? [],
    ),
  );
}
