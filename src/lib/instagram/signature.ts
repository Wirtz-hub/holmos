import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Compare two secrets without leaking which one was longer. */
export function secretMatches(given: string, expected: string) {
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function bearerMatches(request: Request, secret: string) {
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return secretMatches(given, secret);
}

/** Meta signs webhook bodies as `sha256=<hex>` with the app secret. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string) {
  if (!appSecret || !header) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
