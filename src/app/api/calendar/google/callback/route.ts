import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { appOrigin, consumeOAuthState } from "@/lib/ads/oauth";
import { encodeFlash, FLASH_COOKIE, type Flash } from "@/lib/flash";
import { CALENDAR_SCOPES, CalendarError, exchangeCalendarCode, saveCalendarConnection } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  await requireAdmin();

  const back = (flash: Flash) => {
    const response = NextResponse.redirect(`${appOrigin(request)}/bookings`);
    response.cookies.set(FLASH_COOKIE, encodeFlash(flash), { maxAge: 60, path: "/" });
    return response;
  };

  const query = request.nextUrl.searchParams;
  if (!(await consumeOAuthState("calendar", query.get("state"), "/api/calendar"))) {
    return back({ kind: "error", message: "The Google connection took too long or didn't match. Please try again." });
  }
  if (query.get("error")) return back({ kind: "error", message: "Google Calendar connection was cancelled." });
  const code = query.get("code");
  if (!code) return back({ kind: "error", message: "Google didn't send back a login code. Please try again." });

  // Google lets people untick permissions on the consent screen; both calendar ones are needed.
  const granted = (query.get("scope") ?? "").split(" ");
  const missing = CALENDAR_SCOPES.filter((scope) => scope.includes("/calendar") && !granted.includes(scope));
  if (missing.length) {
    return back({
      kind: "error",
      message: "HolmOS needs both calendar permissions (see your calendars, and add events). Connect again and leave them ticked.",
    });
  }

  try {
    const result = await exchangeCalendarCode(code, `${appOrigin(request)}/api/calendar/google/callback`);
    await saveCalendarConnection({
      externalUserId: result.user.sub,
      email: result.user.email ?? null,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    });
    return back({ kind: "success", message: `Google Calendar connected as ${result.user.email ?? "your Google account"}.` });
  } catch (error) {
    if (!(error instanceof CalendarError)) console.error("Google Calendar connection failed", error);
    return back({
      kind: "error",
      message: error instanceof CalendarError ? error.message : "Something went wrong connecting Google Calendar. Please try again.",
    });
  }
}
