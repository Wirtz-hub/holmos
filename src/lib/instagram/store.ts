import "server-only";
import { pickContact, type ContactCandidate } from "@/lib/instagram/contacts";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { InstagramError } from "@/lib/instagram/errors";
import { later, normaliseUsername, snippetFor, type Attachment, type Direction } from "@/lib/instagram/messages";
import { parseInstagramWebhook } from "@/lib/instagram/webhook-parse";
import { createAdminClient } from "@/lib/supabase/admin";

const key = () => serverEnv().tokenEncryptionKey;

type Admin = ReturnType<typeof createAdminClient>;

export type SavedMessage = {
  externalId: string;
  direction: Direction;
  text: string | null;
  attachments: Attachment[];
  senderId: string | null;
  sentAt: string;
  isRead?: boolean;
};

export async function saveInstagramConnection(input: {
  externalUserId: string;
  label: string;
  igUserId: string;
  igUsername: string;
  pageId: string;
  pageName: string;
  userAccessToken: string;
  pageAccessToken: string;
  expiresAt: Date | null;
}) {
  const row = {
    external_user_id: input.externalUserId,
    label: input.label,
    ig_user_id: input.igUserId,
    ig_username: input.igUsername,
    page_id: input.pageId,
    page_name: input.pageName,
    user_access_token_enc: encryptSecret(input.userAccessToken, key()),
    page_access_token_enc: encryptSecret(input.pageAccessToken, key()),
    token_expires_at: input.expiresAt?.toISOString() ?? null,
    status: "active",
    last_error: null,
  };
  const { data, error } = await createAdminClient()
    .from("instagram_connections")
    .upsert(row, { onConflict: "ig_user_id" })
    .select("id, ig_username")
    .single();
  if (error || !data) throw new InstagramError(`Couldn't save the Instagram connection: ${error?.message ?? "unknown error"}`);
  return data as { id: string; ig_username: string };
}

export async function markInstagramError(connectionId: string, message: string, needsReconnect: boolean) {
  await createAdminClient()
    .from("instagram_connections")
    .update({ status: needsReconnect ? "needs_reconnect" : "active", last_error: message })
    .eq("id", connectionId);
}

type ConnectionRow = {
  id: string;
  ig_user_id: string;
  ig_username: string;
  page_id: string;
  page_name: string | null;
  page_access_token_enc: string | null;
  status: string;
};

export async function loadInstagramConnection(connectionId: string) {
  const { data, error } = await createAdminClient()
    .from("instagram_connections")
    .select("id, ig_user_id, ig_username, page_id, page_name, page_access_token_enc, status")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw new InstagramError(error.message);
  if (!data) throw new InstagramError("That Instagram login no longer exists.", true);
  return data as ConnectionRow;
}

export function pageAccessToken(connection: ConnectionRow) {
  if (!connection.page_access_token_enc || connection.status === "needs_reconnect") {
    throw new InstagramError("The Instagram login needs to be reconnected on the Inbox page.", true);
  }
  return decryptSecret(connection.page_access_token_enc, key());
}

async function findContactId(admin: Admin, username: string | null) {
  const name = normaliseUsername(username);
  if (!name) return null;
  const like = `"%${name}%"`;
  const { data, error } = await admin
    .from("contacts")
    .select("id, name, notes, website")
    .or(`website.ilike.${like},notes.ilike.${like},name.ilike."${name}"`)
    .limit(30);
  if (error || !data?.length) return null;
  return pickContact(data as ContactCandidate[], name);
}

async function upsertConversation(
  admin: Admin,
  input: {
    connectionId: string;
    threadId: string;
    participantId: string;
    participantUsername: string | null;
    participantName: string | null;
    snippet: string | null;
    lastMessageAt: string | null;
    lastInboundAt: string | null;
    markUnread: boolean;
  },
) {
  const { data: existing, error: readError } = await admin
    .from("dm_conversations")
    .select("id, thread_id, contact_id, participant_username, participant_name, snippet, last_message_at, last_inbound_at, unread")
    .eq("connection_id", input.connectionId)
    .eq("participant_id", input.participantId)
    .maybeSingle();
  if (readError) throw new InstagramError(readError.message);

  const current = existing as {
    id: string;
    thread_id: string;
    contact_id: string | null;
    participant_username: string | null;
    participant_name: string | null;
    snippet: string | null;
    last_message_at: string | null;
    last_inbound_at: string | null;
    unread: boolean;
  } | null;

  const username = input.participantUsername ?? current?.participant_username ?? null;
  let contactId = current?.contact_id ?? null;
  if (!contactId) contactId = await findContactId(admin, username);

  const threadId =
    input.threadId.startsWith("pending:") && current?.thread_id && !current.thread_id.startsWith("pending:")
      ? current.thread_id
      : input.threadId;
  const lastMessageAt = later(current?.last_message_at, input.lastMessageAt);
  const snippet =
    input.lastMessageAt && lastMessageAt === input.lastMessageAt
      ? (input.snippet ?? current?.snippet ?? null)
      : (current?.snippet ?? input.snippet ?? null);

  const row = {
    connection_id: input.connectionId,
    thread_id: threadId,
    participant_id: input.participantId,
    participant_username: username,
    participant_name: input.participantName ?? current?.participant_name ?? null,
    contact_id: contactId,
    snippet,
    last_message_at: lastMessageAt,
    last_inbound_at: later(current?.last_inbound_at, input.lastInboundAt),
    unread: Boolean(current?.unread) || input.markUnread,
  };

  if (current) {
    const { error } = await admin.from("dm_conversations").update(row).eq("id", current.id);
    if (error?.code === "23505") {
      const { error: retry } = await admin.from("dm_conversations").update({ ...row, thread_id: current.thread_id }).eq("id", current.id);
      if (retry) throw new InstagramError(retry.message);
    } else if (error) {
      throw new InstagramError(error.message);
    }
    return current.id;
  }

  const { data, error } = await admin.from("dm_conversations").insert(row).select("id").single();
  if (error?.code === "23505") {
    const { data: raced } = await admin
      .from("dm_conversations")
      .select("id")
      .eq("connection_id", input.connectionId)
      .eq("participant_id", input.participantId)
      .maybeSingle();
    if (raced?.id) return raced.id as string;
  }
  if (error || !data) throw new InstagramError(error?.message ?? "Couldn't save the conversation.");
  return data.id as string;
}

/** Insert or update one message. A repeat of the same Meta id does not clear "read". */
export async function upsertMessage(admin: Admin, conversationId: string, message: SavedMessage) {
  const { data: existing, error: readError } = await admin
    .from("dm_messages")
    .select("id, is_read")
    .eq("conversation_id", conversationId)
    .eq("external_id", message.externalId)
    .maybeSingle();
  if (readError) throw new InstagramError(readError.message);

  const isRead = Boolean((existing as { is_read?: boolean } | null)?.is_read) || Boolean(message.isRead);
  const row = {
    direction: message.direction,
    body: message.text,
    attachments: message.attachments,
    sender_id: message.senderId,
    sent_at: message.sentAt,
    is_read: isRead,
  };

  if (existing) {
    const { error } = await admin.from("dm_messages").update(row).eq("id", (existing as { id: string }).id);
    if (error) throw new InstagramError(error.message);
    return { created: false };
  }

  const { error } = await admin.from("dm_messages").insert({
    conversation_id: conversationId,
    external_id: message.externalId,
    ...row,
  });
  if (error?.code === "23505") return { created: false };
  if (error) throw new InstagramError(error.message);
  return { created: true };
}

export async function saveThreadMessages(input: {
  connectionId: string;
  threadId: string;
  participantId: string;
  participantUsername: string | null;
  participantName: string | null;
  messages: SavedMessage[];
}) {
  const admin = createAdminClient();
  const inbound = input.messages.filter((message) => message.direction === "inbound");
  const newest = input.messages.reduce<string | null>((latest, message) => later(latest, message.sentAt), null);
  const newestInbound = inbound.reduce<string | null>((latest, message) => later(latest, message.sentAt), null);
  const newestMessage = [...input.messages].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];

  let createdInbound = 0;
  const conversationId = await upsertConversation(admin, {
    connectionId: input.connectionId,
    threadId: input.threadId,
    participantId: input.participantId,
    participantUsername: input.participantUsername,
    participantName: input.participantName,
    snippet: newestMessage ? snippetFor(newestMessage.text, newestMessage.attachments) : null,
    lastMessageAt: newest,
    lastInboundAt: newestInbound,
    markUnread: false,
  });

  for (const message of input.messages) {
    const saved = await upsertMessage(admin, conversationId, message);
    if (saved.created && message.direction === "inbound") createdInbound += 1;
  }

  if (createdInbound > 0) {
    await admin.from("dm_conversations").update({ unread: true }).eq("id", conversationId);
  }
  return { conversationId, createdInbound };
}

export async function markOutboundRead(connectionId: string, participantId: string, messageId: string) {
  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("dm_conversations")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (!conversation) return;

  const { data: message } = await admin
    .from("dm_messages")
    .select("sent_at")
    .eq("conversation_id", conversation.id)
    .eq("external_id", messageId)
    .maybeSingle();

  let update = admin
    .from("dm_messages")
    .update({ is_read: true })
    .eq("conversation_id", conversation.id)
    .eq("direction", "outbound");
  if (message?.sent_at) update = update.lte("sent_at", message.sent_at as string);
  else update = update.eq("external_id", messageId);
  await update;
}

export async function ingestInstagramWebhook(rawBody: string) {
  const parsed = parseInstagramWebhook(JSON.parse(rawBody) as unknown);
  if (!parsed.messages.length && !parsed.reads.length) return { messages: 0, reads: 0 };

  const admin = createAdminClient();
  const igIds = [...new Set([...parsed.messages, ...parsed.reads].map((event) => event.igUserId))];
  const { data: connections, error } = await admin
    .from("instagram_connections")
    .select("id, ig_user_id")
    .in("ig_user_id", igIds);
  if (error) throw new InstagramError(error.message);
  const byIg = new Map((connections ?? []).map((row) => [row.ig_user_id as string, row.id as string]));

  let messages = 0;
  for (const message of parsed.messages) {
    const connectionId = byIg.get(message.igUserId);
    if (!connectionId) continue;
    await saveThreadMessages({
      connectionId,
      threadId: `pending:${message.participantId}`,
      participantId: message.participantId,
      participantUsername: null,
      participantName: null,
      messages: [
        {
          externalId: message.externalId,
          direction: message.direction,
          text: message.text,
          attachments: message.attachments,
          senderId: message.direction === "inbound" ? message.participantId : message.igUserId,
          sentAt: message.sentAt,
        },
      ],
    });
    messages += 1;
  }

  let reads = 0;
  for (const receipt of parsed.reads) {
    const connectionId = byIg.get(receipt.igUserId);
    if (!connectionId) continue;
    await markOutboundRead(connectionId, receipt.participantId, receipt.messageId);
    reads += 1;
  }

  return { messages, reads };
}
