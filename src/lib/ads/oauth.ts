import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { serverEnv, type Platform } from "@/lib/env";

// CSRF protection for the OAuth round-trip: a random state value lives in a
// short-lived cookie and must come back unchanged from Meta/Google.
// `name` is the platform ("meta", "google") or "calendar" for Google Calendar,
// and `path` is where that login's routes live.

const cookieName = (name: string) => `holmos_oauth_${name}`;

export async function createOAuthState(name: string, path = "/api/oauth") {
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(cookieName(name), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path,
    maxAge: 600,
  });
  return state;
}

export async function consumeOAuthState(name: string, returned: string | null, path = "/api/oauth") {
  const store = await cookies();
  const expected = store.get(cookieName(name))?.value;
  store.delete({ name: cookieName(name), path });
  if (!expected || !returned) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(returned);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function appOrigin(request: NextRequest) {
  return (serverEnv().appUrl || request.nextUrl.origin).replace(/\/$/, "");
}

export function oauthRedirectUri(platform: Platform, request: NextRequest) {
  return `${appOrigin(request)}/api/oauth/${platform}/callback`;
}
