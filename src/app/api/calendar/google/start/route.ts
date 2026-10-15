import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { appOrigin, createOAuthState } from "@/lib/ads/oauth";
import { missingCalendarSettings } from "@/lib/env";
import { encodeFlash, FLASH_COOKIE } from "@/lib/flash";
import { calendarAuthUrl } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  await requireAdmin();

  const missing = missingCalendarSettings();
  if (missing.length) {
    const response = NextResponse.redirect(`${appOrigin(request)}/bookings`);
    response.cookies.set(
      FLASH_COOKIE,
      encodeFlash({ kind: "error", message: `Google Calendar isn't set up yet. Missing settings: ${missing.join(", ")}. See the setup guide.` }),
      { maxAge: 60, path: "/" },
    );
    return response;
  }

  const state = await createOAuthState("calendar", "/api/calendar");
  return NextResponse.redirect(calendarAuthUrl(`${appOrigin(request)}/api/calendar/google/callback`, state));
}
