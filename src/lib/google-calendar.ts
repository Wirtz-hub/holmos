import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Google Calendar: block busy times on booking pages and add new bookings as
// events. One Google login (yours), stored like the ad platform logins:
// tokens encrypted, readable only by the server.

export const CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export class CalendarError extends Error {
  constructor(
    message: string,
    readonly needsReconnect = false,
  ) {
    super(message);
  }
}

export function calendarAuthUrl(redirectUri: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", serverEnv().googleClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(params: Record<string, string>) {
  const env = serverEnv();
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.googleClientId, client_secret: env.googleClientSecret, ...params }),
      cache: "no-store",
    });
  } catch {
    throw new CalendarError("Couldn't reach Google. Try again in a moment.");
  }
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant") {
      throw new CalendarError("Google Calendar login has expired or was removed. Reconnect it on the Bookings page.", true);
    }
    throw new CalendarError(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000),
  };
}

export async function exchangeCalendarCode(code: string, redirectUri: string) {
  const tokens = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new CalendarError("Couldn't read the Google account's email address.");
  const user = (await res.json()) as { sub: string; email?: string };
  return { ...tokens, user };
}

const key = () => serverEnv().tokenEncryptionKey;

export async function saveCalendarConnection(input: {
  externalUserId: string;
  email: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("calendar_connections")
    .select("external_user_id")
    .eq("provider", "google")
    .maybeSingle();

  const row: Record<string, unknown> = {
    provider: "google",
    external_user_id: input.externalUserId,
    email: input.email,
    access_token_enc: encryptSecret(input.accessToken, key()),
    token_expires_at: input.expiresAt.toISOString(),
    status: "active",
    last_error: null,
  };
  if (input.refreshToken) row.refresh_token_enc = encryptSecret(input.refreshToken, key());
  // A different Google account starts again from its own primary calendar.
  if (existing && existing.external_user_id !== input.externalUserId) {
    row.busy_calendar_ids = ["primary"];
    row.event_calendar_id = "primary";
  }

  const { error } = await admin.from("calendar_connections").upsert(row, { onConflict: "provider" });
  if (error) throw new Error(`Couldn't save the Google Calendar login: ${error.message}`);
}

export type CalendarConnection = {
  id: string;
  email: string | null;
  busy_calendar_ids: string[];
  event_calendar_id: string;
  status: "active" | "needs_reconnect";
};

async function markNeedsReconnect(message: string) {
  await createAdminClient().from("calendar_connections").update({ status: "needs_reconnect", last_error: message }).eq("provider", "google");
}

/** The connection and a working access token, or null when Google Calendar isn't connected. */
export async function getCalendarAccess(): Promise<{ connection: CalendarConnection; token: string } | null> {
  const env = serverEnv();
  if (!env.supabaseSecretKey || !env.tokenEncryptionKey || !env.googleClientId) return null;
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("calendar_connections")
    .select("id, email, busy_calendar_ids, event_calendar_id, status, access_token_enc, refresh_token_enc, token_expires_at")
    .eq("provider", "google")
    .maybeSingle();
  if (!conn || conn.status !== "active") return null;

  const connection: CalendarConnection = {
    id: conn.id,
    email: conn.email,
    busy_calendar_ids: conn.busy_calendar_ids ?? ["primary"],
    event_calendar_id: conn.event_calendar_id ?? "primary",
    status: conn.status,
  };
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.access_token_enc && expiresAt - Date.now() > 120_000) {
    return { connection, token: decryptSecret(conn.access_token_enc, key()) };
  }
  if (!conn.refresh_token_enc) {
    await markNeedsReconnect("Google Calendar needs to be reconnected.");
    return null;
  }
  try {
    const fresh = await tokenRequest({ refresh_token: decryptSecret(conn.refresh_token_enc, key()), grant_type: "refresh_token" });
    await admin
      .from("calendar_connections")
      .update({ access_token_enc: encryptSecret(fresh.accessToken, key()), token_expires_at: fresh.expiresAt.toISOString() })
      .eq("id", conn.id);
    return { connection, token: fresh.accessToken };
  } catch (error) {
    if (error instanceof CalendarError && error.needsReconnect) await markNeedsReconnect(error.message);
    throw error;
  }
}

async function calendarApi<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch {
    throw new CalendarError("Couldn't reach Google Calendar.");
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    if (res.status === 401) {
      await markNeedsReconnect("Google Calendar login has expired.");
      throw new CalendarError("Google Calendar login has expired. Reconnect it on the Bookings page.", true);
    }
    throw new CalendarError(`Google Calendar said: ${body.error?.message ?? res.status}`);
  }
  return body;
}

export async function listCalendars(token: string) {
  const body = await calendarApi<{ items?: { id: string; summary: string; primary?: boolean; accessRole: string }[] }>(
    token,
    "/users/me/calendarList?minAccessRole=freeBusyReader",
  );
  return (body.items ?? [])
    .map((c) => ({ id: c.primary ? "primary" : c.id, name: c.summary, primary: Boolean(c.primary), canWrite: c.accessRole === "owner" || c.accessRole === "writer" }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
}

/** Busy stretches in the chosen calendars, in epoch milliseconds. */
export async function busyTimes(token: string, calendarIds: string[], from: Date, to: Date) {
  const body = await calendarApi<{ calendars?: Record<string, { busy?: { start: string; end: string }[] }> }>(token, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: calendarIds.map((id) => ({ id })) }),
  });
  return Object.values(body.calendars ?? {}).flatMap((c) =>
    (c.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
  );
}

export async function createCalendarEvent(
  token: string,
  calendarId: string,
  event: { requestId: string; summary: string; description: string; start: string; end: string; attendeeEmail: string; location?: string; meet: boolean },
) {
  const params = new URLSearchParams({ sendUpdates: "none", ...(event.meet ? { conferenceDataVersion: "1" } : {}) });
  const body = await calendarApi<{ id: string; hangoutLink?: string; htmlLink?: string }>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
        attendees: [{ email: event.attendeeEmail }],
        ...(event.location ? { location: event.location } : {}),
        ...(event.meet ? { conferenceData: { createRequest: { requestId: event.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } } } : {}),
        reminders: { useDefault: true },
      }),
    },
  );
  return { id: body.id, meetingUrl: body.hangoutLink ?? null };
}

export async function deleteCalendarEvent(token: string, calendarId: string, eventId: string) {
  try {
    await calendarApi(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
      method: "DELETE",
    });
  } catch (error) {
    // Already deleted in Google Calendar: nothing to do.
    if (error instanceof CalendarError && /not found|deleted/i.test(error.message)) return;
    throw error;
  }
}
