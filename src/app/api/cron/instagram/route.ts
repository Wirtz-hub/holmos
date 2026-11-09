import { serverEnv } from "@/lib/env";
import { syncAllInstagramConnections } from "@/lib/instagram/sync";
import { bearerMatches } from "@/lib/instagram/signature";
import { json } from "@/lib/request";

// Daily backfill of recent Instagram threads. Webhooks cover the live ones.
// Vercel proves it's the caller with CRON_SECRET (see vercel.json).

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!bearerMatches(request, serverEnv().cronSecret)) return json({ ok: false }, 401);
  try {
    return json({ ok: true, results: await syncAllInstagramConnections() });
  } catch (error) {
    console.error("Instagram sync failed", error instanceof Error ? error.message : error);
    return json({ ok: false }, 500);
  }
}
