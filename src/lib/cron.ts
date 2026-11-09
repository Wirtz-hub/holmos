import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Vercel cron calls these routes with `Authorization: Bearer $CRON_SECRET`.
 * A missing secret refuses everyone, including a cron that was never configured.
 */
export function authorisedCron(request: Request) {
  const secret = serverEnv().cronSecret;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
