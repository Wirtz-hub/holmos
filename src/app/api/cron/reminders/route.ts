import { sendDueReminders } from "@/lib/booking/server";
import { authorisedCron } from "@/lib/cron";
import { isEmailConfigured } from "@/lib/email";
import { json } from "@/lib/request";

// Booking reminders, run by Vercel's cron job (see vercel.json). Not a login
// page: Vercel proves it's the caller with the CRON_SECRET setting.

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorisedCron(request)) return json({ ok: false }, 401);
  if (!isEmailConfigured()) return json({ ok: true, skipped: "Email isn't set up yet." });
  try {
    return json({ ok: true, ...(await sendDueReminders()) });
  } catch (error) {
    console.error("Sending reminders failed", error);
    return json({ ok: false }, 500);
  }
}
