import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { readInboxThreads } from "@/lib/instagram/read";
import { bearerMatches } from "@/lib/instagram/signature";
import { json } from "@/lib/request";

export async function GET(request: Request, ctx: RouteContext<"/api/inbox/threads/[id]">) {
  if (!bearerMatches(request, serverEnv().inboxApiSecret)) return json({ ok: false }, 401);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return json({ ok: false }, 404);
  const url = new URL(request.url);
  const messages = Number(url.searchParams.get("messages"));
  try {
    const threads = await readInboxThreads({
      conversationId: id,
      limit: 1,
      messageLimit: Number.isInteger(messages) && messages > 0 ? Math.min(messages, 50) : 50,
    });
    if (!threads.length) return json({ ok: false }, 404);
    return json({ thread: threads[0] });
  } catch (error) {
    console.error("Inbox thread failed", error instanceof Error ? error.message : error);
    return json({ ok: false }, 500);
  }
}
