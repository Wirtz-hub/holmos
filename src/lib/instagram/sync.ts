import "server-only";
import { instagramConfig } from "@/lib/instagram/config";
import { InstagramError } from "@/lib/instagram/errors";
import { listInstagramConversations, lookupInstagramUsername } from "@/lib/instagram/graph";
import { normaliseUsername, otherParticipant } from "@/lib/instagram/messages";
import { loadInstagramConnection, markInstagramError, pageAccessToken, saveThreadMessages } from "@/lib/instagram/store";
import { createAdminClient } from "@/lib/supabase/admin";

/** Copy recent Instagram threads into HolmOS. Safe to run again: messages are matched on Meta's id. */
export async function syncInstagramConnection(connectionId: string) {
  const connection = await loadInstagramConnection(connectionId);
  const token = pageAccessToken(connection);
  let conversations;
  try {
    conversations = await listInstagramConversations(instagramConfig(), token, connection.page_id, connection.ig_user_id);
  } catch (error) {
    if (error instanceof InstagramError) await markInstagramError(connection.id, error.message, error.needsReconnect);
    throw error;
  }

  let messageCount = 0;
  for (const conversation of conversations) {
    const person = otherParticipant(conversation.participants, connection.ig_user_id, connection.page_id);
    if (!person) continue;
    const fromMessage = conversation.messages.find((message) => message.direction === "inbound" && message.senderUsername)?.senderUsername;
    let username = normaliseUsername(person.username) ?? fromMessage ?? null;
    if (!username) username = await lookupInstagramUsername(instagramConfig(), token, person.id);

    await saveThreadMessages({
      connectionId: connection.id,
      threadId: conversation.threadId,
      participantId: person.id,
      participantUsername: username,
      participantName: person.name ?? null,
      messages: conversation.messages.map((message) => ({
        externalId: message.externalId,
        direction: message.direction,
        text: message.text,
        attachments: message.attachments,
        senderId: message.senderId,
        sentAt: message.sentAt,
      })),
    });
    messageCount += conversation.messages.length;
  }

  await createAdminClient()
    .from("instagram_connections")
    .update({ last_synced_at: new Date().toISOString(), status: "active", last_error: null })
    .eq("id", connection.id);

  return { conversations: conversations.length, messages: messageCount };
}

export async function syncAllInstagramConnections() {
  const { data, error } = await createAdminClient().from("instagram_connections").select("id").eq("status", "active");
  if (error) throw new InstagramError(error.message);
  const results: { id: string; conversations?: number; messages?: number; error?: string }[] = [];
  for (const row of data ?? []) {
    try {
      const synced = await syncInstagramConnection(row.id as string);
      results.push({ id: row.id as string, ...synced });
    } catch (error) {
      results.push({ id: row.id as string, error: error instanceof Error ? error.message : "Sync failed." });
    }
  }
  return results;
}
