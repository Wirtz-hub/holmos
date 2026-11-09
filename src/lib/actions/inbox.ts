"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { InstagramError } from "@/lib/instagram/errors";
import { draftTextError } from "@/lib/instagram/messages";
import { sendApprovedDraft } from "@/lib/instagram/send";
import { syncInstagramConnection } from "@/lib/instagram/sync";
import { createAdminClient } from "@/lib/supabase/admin";

const idSchema = z.uuid();

function fail(message: string) {
  return { ok: false as const, message };
}

export async function syncInstagramAction(connectionId: string) {
  await requireAdmin();
  if (!idSchema.safeParse(connectionId).success) return fail("Unknown Instagram login.");
  try {
    const result = await syncInstagramConnection(connectionId);
    refresh();
    return {
      ok: true as const,
      message: `Synced ${result.conversations} conversation${result.conversations === 1 ? "" : "s"} (${result.messages} recent messages).`,
    };
  } catch (error) {
    refresh();
    return fail(error instanceof InstagramError ? error.message : "Couldn't sync Instagram. Try again.");
  }
}

export async function disconnectInstagramAction(connectionId: string) {
  await requireAdmin();
  if (!idSchema.safeParse(connectionId).success) return fail("Unknown Instagram login.");
  const { error } = await createAdminClient().from("instagram_connections").delete().eq("id", connectionId);
  refresh();
  if (error) return fail("Couldn't disconnect Instagram. Try again.");
  return { ok: true as const, message: "Instagram disconnected. Nothing was deleted on Instagram or in your contact lists." };
}

export async function createDraftAction(conversationId: string, body: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(conversationId).success) return fail("Unknown conversation.");
  const textError = draftTextError(body);
  if (textError) return fail(textError);
  const { error } = await supabase.from("dm_drafts").insert({
    conversation_id: conversationId,
    body: body.trim(),
    status: "draft",
    source: "admin",
  });
  if (error) return fail("Couldn't save the draft. Try again.");
  refresh();
  return { ok: true as const, message: "Draft saved. Nothing has been sent." };
}

export async function approveDraftAction(draftId: string) {
  const { supabase, userId } = await requireAdmin();
  if (!idSchema.safeParse(draftId).success) return fail("Unknown draft.");
  const { data, error } = await supabase
    .from("dm_drafts")
    .update({ status: "approved", approved_by: userId })
    .eq("id", draftId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return fail("Couldn't approve that draft. Try again.");
  if (!data) return fail("That draft can't be approved. It may already have been reviewed.");
  refresh();
  return { ok: true as const, message: "Approved. It is not sent until you press Send." };
}

export async function rejectDraftAction(draftId: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(draftId).success) return fail("Unknown draft.");
  const { data, error } = await supabase
    .from("dm_drafts")
    .update({ status: "rejected" })
    .eq("id", draftId)
    .in("status", ["draft", "approved"])
    .select("id")
    .maybeSingle();
  if (error) return fail("Couldn't reject that draft. Try again.");
  if (!data) return fail("That draft can't be rejected.");
  refresh();
  return { ok: true as const, message: "Draft rejected. Nothing was sent." };
}

/** Sends only a draft this admin already approved. Approving and sending are separate steps. */
export async function sendDraftAction(draftId: string) {
  const { userId } = await requireAdmin();
  if (!idSchema.safeParse(draftId).success) return fail("Unknown draft.");
  try {
    await sendApprovedDraft(draftId, userId);
    refresh();
    return { ok: true as const, message: "Sent on Instagram." };
  } catch (error) {
    refresh();
    return fail(error instanceof InstagramError ? error.message : "Couldn't send that reply. Try again.");
  }
}

export async function markConversationReadAction(conversationId: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(conversationId).success) return;
  await supabase.from("dm_messages").update({ is_read: true }).eq("conversation_id", conversationId).eq("direction", "inbound");
  await supabase.from("dm_conversations").update({ unread: false }).eq("id", conversationId);
  refresh();
}
