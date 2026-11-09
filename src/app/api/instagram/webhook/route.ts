import { serverEnv } from "@/lib/env";
import { secretMatches, verifyMetaSignature } from "@/lib/instagram/signature";
import { ingestInstagramWebhook } from "@/lib/instagram/store";

// Meta calls this without a HolmOS login. The verify token answers the
// subscription handshake; the app secret signs every later notification.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = serverEnv().metaWebhookVerifyToken;
  if (mode === "subscribe" && challenge && secretMatches(token, expected)) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = serverEnv().metaAppSecret;
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    await ingestInstagramWebhook(raw);
  } catch (error) {
    console.error("Instagram webhook failed", error instanceof Error ? error.message : error);
    return new Response("Bad request", { status: 400 });
  }
  return new Response("OK", { status: 200 });
}
