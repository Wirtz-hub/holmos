import "server-only";
import { instagramConfig } from "@/lib/instagram/config";
import { InstagramError } from "@/lib/instagram/errors";
import { sendInstagramText } from "@/lib/instagram/graph";
import { loadInstagramConnection, markInstagramError, pageAccessToken, upsertMessage } from "@/lib/instagram/store";
import { messagingWindow } from "@/lib/instagram/window";
import { createAdminClient } from "@/lib/supabase/admin";

type Claimed = { body: string; conversation_id: string };

async function release(draftId: string, message: string) {
  const { error } = await createAdminClient().rpc("release_dm_draft_send", { p_id: draftId, p_error: message });
  if (error) console.error("Couldn't record the Instagram send error", error.message);
}

/**
 * Send one draft that an admin has already approved.
 * Claiming the row first means a second click can't send it twice.
 */
export async function sendApprovedDraft(draftId: string, adminUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_dm_draft_send", { p_id: draftId });
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (error || !rows.length) {
    throw new InstagramError("This draft isn't approved, or a send is already in progress. Refresh the page and check its status.");
  }
  const claimed = rows[0] as Claimed;

  const { data: conversation, error: conversationError } = await admin
    .from("dm_conversations")
    .select("id, participant_id, connection_id, last_inbound_at")
    .eq("id", claimed.conversation_id)
    .maybeSingle();
  if (conversationError || !conversation) {
    await release(draftId, "That conversation no longer exists.");
    throw new InstagramError("That conversation no longer exists.");
  }

  const window = messagingWindow(conversation.last_inbound_at as string | null);
  if (!window.open) {
    await release(draftId, window.error ?? "Outside Instagram's 24-hour window.");
    throw new InstagramError(window.error ?? "Outside Instagram's 24-hour window.");
  }

  let messageId: string;
  let connection: Awaited<ReturnType<typeof loadInstagramConnection>> | null = null;
  try {
    connection = await loadInstagramConnection(conversation.connection_id as string);
    const sent = await sendInstagramText(
      instagramConfig(),
      pageAccessToken(connection),
      connection.page_id,
      conversation.participant_id as string,
      claimed.body,
    );
    messageId = sent.messageId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram couldn't send that reply.";
    if (connection && error instanceof InstagramError && error.needsReconnect) {
      await markInstagramError(connection.id, message, true);
    }
    await release(draftId, message);
    throw error instanceof InstagramError ? error : new InstagramError(message);
  }

  const marked = await admin.rpc("mark_dm_draft_sent", {
    p_id: draftId,
    p_external_message_id: messageId,
    p_sent_by: adminUserId,
  });
  if (marked.error && !marked.error.message.includes("dm_draft_not_approved")) {
    console.error("Instagram sent the reply but the draft could not be marked sent", marked.error.message);
    throw new InstagramError(
      "Instagram sent the reply, but HolmOS couldn't mark the draft as sent. Check the thread before sending anything else.",
    );
  }

  await upsertMessage(admin, conversation.id as string, {
    externalId: messageId,
    direction: "outbound",
    text: claimed.body,
    attachments: [],
    senderId: connection?.ig_user_id ?? null,
    sentAt: new Date().toISOString(),
  });

  return { messageId };
}
