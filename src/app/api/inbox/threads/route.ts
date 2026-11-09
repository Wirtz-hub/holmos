import { serverEnv } from "@/lib/env";
import { readInboxThreads } from "@/lib/instagram/read";
import { bearerMatches } from "@/lib/instagram/signature";
import { json } from "@/lib/request";

// Read-only thread list for the inbox bot. The secret can create drafts at
// /api/inbox/drafts. It cannot approve or send a reply.

function authorised(request: Request) {
  return bearerMatches(request, serverEnv().inboxApiSecret);
}

function clamp(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: Request) {
  if (!authorised(request)) return json({ ok: false }, 401);
  const url = new URL(request.url);
  try {
    const threads = await readInboxThreads({
      limit: clamp(url.searchParams.get("limit"), 20, 50),
      messageLimit: clamp(url.searchParams.get("messages"), 15, 50),
    });
    return json({ threads });
  } catch (error) {
    console.error("Inbox thread list failed", error instanceof Error ? error.message : error);
    return json({ ok: false }, 500);
  }
}
