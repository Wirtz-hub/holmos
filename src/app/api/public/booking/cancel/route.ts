import { after } from "next/server";
import { afterBookingCancelled } from "@/lib/booking/server";
import { json, readJson } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";

// PUBLIC: the visitor cancels with the secret link from their confirmation
// email. No login — the deliberate exception to requireAdmin().

export async function POST(request: Request) {
  const body = await readJson(request, 2_000);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ ok: false }, 404);

  const { data, error } = await createAdminClient().rpc("cancel_booking_by_token", { p_token: token });
  if (error) {
    console.error("Couldn't cancel a booking", error.message);
    return json({ ok: false }, 500);
  }
  if (!data) return json({ ok: false }, 410);

  const { booking_id } = data as { booking_id: string };
  after(() => afterBookingCancelled(booking_id, { by: "guest", emailGuest: true }));
  return json({ ok: true });
}
