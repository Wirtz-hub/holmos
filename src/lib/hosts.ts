// Which incoming addresses are custom domains pointed at a funnel, as opposed
// to HolmOS's own address. Used by src/proxy.ts, so it must stay dependency-free.

/** The custom domain this request came in on, or null for HolmOS's own address. */
export function customDomainFor(hostHeader: string | null | undefined, appUrl: string | undefined): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!host || !/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) return null;
  if (host === "localhost" || host.endsWith(".localhost") || /^\d+(\.\d+){3}$/.test(host)) return null;
  // Vercel's own addresses (production and previews) always show the app.
  if (host.endsWith(".vercel.app")) return null;
  if (appUrl) {
    try {
      if (new URL(appUrl).hostname.toLowerCase() === host) return null;
    } catch {
      // A malformed APP_URL is reported elsewhere; treat the host as custom.
    }
  }
  return host;
}

/** Paths on a custom domain that go to HolmOS itself rather than to the funnel. */
export function isPassThroughPath(pathname: string) {
  return pathname.startsWith("/api/public/") || pathname.startsWith("/_next/") || pathname.startsWith("/embed/");
}

/** Normalises what someone types as a domain: "https://www.Example.dk/" → "www.example.dk". */
export function normaliseDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export const DOMAIN_PATTERN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
