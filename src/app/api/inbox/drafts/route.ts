import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { draftTextError } from "@/lib/instagram/messages";
import { bearerMatches } from "@/lib/instagram/signature";
import { readJson, json } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";

// Creates a follow-up draft and stops there. Sending happens only when an
// admin approves the draft and then presses Send in HolmOS.

const bodySchema = z.object({
  conversation_id: z.uuid(),
  text: z.string(),
});

export async function POST(request: Request) {
  if (!bearerMatches(request, serverEnv().inboxApiSecret)) return json({ ok: false }, 401);
  const payload = await readJson(request, 8_000);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return json({ ok: false, error: "Send conversation_id and text." }, 400);
  const textError = draftTextError(parsed.data.text);
  if (textError) return json({ ok: false, error: textError }, 400);

  const admin = createAdminClient();
  const { data: conversation, error: missing } = await admin
    .from("dm_conversations")
    .select("id")
    .eq("id", parsed.data.conversation_id)
    .maybeSingle();
  if (missing) return json({ ok: false }, 500);
  if (!conversation) return json({ ok: false, error: "Unknown conversation." }, 404);

  const { data, error } = await admin
    .from("dm_drafts")
    .insert({
      conversation_id: parsed.data.conversation_id,
      body: parsed.data.text.trim(),
      status: "draft",
      source: "bot",
    })
    .select("id, conversation_id, body, status, source, created_at")
    .single();
  if (error || !data) return json({ ok: false }, 500);
  return json(
    {
      draft: {
        id: data.id,
        conversation_id: data.conversation_id,
        text: data.body,
        status: data.status,
        source: data.source,
        created_at: data.created_at,
      },
    },
    201,
  );
}
