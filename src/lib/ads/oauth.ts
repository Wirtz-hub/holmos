import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { serverEnv, type Platform } from "@/lib/env";

// CSRF protection for the OAuth round-trip: a random state value lives in a
// short-lived cookie and must come back unchanged from Meta/Google.

const cookieName = (platform: Platform) => `holmos_oauth_${platform}`;

export async function createOAuthState(platform: Platform) {
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(cookieName(platform), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth",
    maxAge: 600,
  });
  return state;
}

export async function consumeOAuthState(platform: Platform, returned: string | null) {
  const store = await cookies();
  const expected = store.get(cookieName(platform))?.value;
  store.delete({ name: cookieName(platform), path: "/api/oauth" });
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
