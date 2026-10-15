import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/booking/server";
import { isEmailConfigured } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { json } from "@/lib/request";

// Booking reminders, run by Vercel's cron job (see vercel.json). Not a login
// page: Vercel proves it's the caller with the CRON_SECRET setting.

export const maxDuration = 60;

function authorised(request: Request) {
  const secret = serverEnv().cronSecret;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorised(request)) return json({ ok: false }, 401);
  if (!isEmailConfigured()) return json({ ok: true, skipped: "Email isn't set up yet." });
  try {
    return json({ ok: true, ...(await sendDueReminders()) });
  } catch (error) {
    console.error("Sending reminders failed", error);
    return json({ ok: false }, 500);
  }
}
