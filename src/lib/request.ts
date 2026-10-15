import "server-only";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env";

// Helpers for the public endpoints that take form answers and bookings.

/** A one-way fingerprint of the visitor's IP address, used only to slow down spam. */
export function visitorIpHash(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
  if (!ip) return null;
  return createHash("sha256")
    .update(`${ip}|${serverEnv().tokenEncryptionKey || "holmos"}`)
    .digest("hex")
    .slice(0, 32);
}

/** The JSON body, or null if it's missing, malformed or larger than `maxBytes`. */
export async function readJson(request: Request, maxBytes = 32_000): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  try {
    const raw = await request.text();
    if (raw.length > maxBytes) return null;
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Simple bot checks: a hidden field people never fill in, and a minimum time
 * between the page loading and the answer being sent.
 */
export function looksLikeBot(body: Record<string, unknown>) {
  if (typeof body.hp === "string" && body.hp.trim() !== "") return true;
  const elapsed = Number(body.elapsedMs);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 1500;
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
