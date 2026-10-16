import { decodeEntities } from "@/lib/ai/page-text";
import type { Lead, LeadScore, WebsiteCheck } from "@/lib/leads/types";

// Reads a business's website for signs it needs marketing help, and turns
// what was found into a score. Pure functions, so they can be tested without
// the internet.

export type HtmlSignals = Omit<WebsiteCheck, "status" | "url" | "https" | "seconds">;

const BUILDERS: [string, RegExp][] = [
  ["Wix", /static\.wixstatic\.com|wix-bolt|_wixCssImports|X-Wix/i],
  ["Squarespace", /static1\.squarespace\.com|squarespace-cdn/i],
  ["Shopify", /cdn\.shopify\.com|Shopify\.theme/i],
  ["Webflow", /webflow\.js|data-wf-page/i],
  ["WordPress", /wp-content\/|wp-includes\//i],
  ["Joomla", /\/media\/jui\/|content="Joomla/i],
  ["GoDaddy", /img1\.wsimg\.com|godaddy/i],
  ["Jimdo", /jimdo/i],
  ["One.com", /one\.com\/website-builder|onecom/i],
];

const NOT_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(sentry|wixpress|example|domain|email|yourdomain|sentry-next)\.|^(name|your|email|navn|din)@/i;

/** Emails hidden by Cloudflare's "email protection" are stored as hex, XOR'ed with the first byte. */
export function decodeCloudflareEmail(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2) return "";
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

/** Email addresses on a page, best first: ones in mailto: links, then ones in the text. */
export function findEmails(html: string): string[] {
  const found: string[] = [];
  for (const [, address] of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.push(decodeURIComponent(address));
  for (const [, hex] of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) found.push(decodeCloudflareEmail(hex));
  const text = decodeEntities(html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]+>/g, " "));
  for (const [address] of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) found.push(address);
  return [...new Set(found.map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) && !NOT_EMAIL.test(e)))].slice(0, 5);
}

function findPhones(html: string): string[] {
  const found = [...html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)].map(([, n]) => decodeURIComponent(n).replace(/[^\d+]/g, ""));
  return [...new Set(found.filter((n) => n.replace(/\D/g, "").length >= 6))].slice(0, 3);
}

function findSocial(html: string, pattern: RegExp) {
  for (const [, href] of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    if (pattern.test(href) && !/sharer|share\.php|intent\/|\/plugins\//i.test(href)) return href;
  }
  return null;
}

/** What a page's HTML says about its marketing set-up. */
export function analyzeHtml(html: string): HtmlSignals {
  const years = [...html.matchAll(/(?:©|&copy;|&#169;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map(([, y]) => Number(y)).filter((y) => y > 1995 && y < 2100);
  return {
    mobileFriendly: /<meta[^>]+name\s*=\s*["']viewport["'][^>]*width\s*=\s*device-width/i.test(html) || /<meta[^>]+width\s*=\s*device-width[^>]*name\s*=\s*["']viewport/i.test(html),
    metaPixel: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init/i.test(html),
    googleTag: /googletagmanager\.com\/(gtag\/js|gtm\.js)|google-analytics\.com\/(analytics|ga)\.js|\bG-[A-Z0-9]{6,}\b|\bGTM-[A-Z0-9]{4,}\b/.test(html),
    googleAds: /\bAW-\d{6,}\b|googleadservices\.com/.test(html),
    builder: BUILDERS.find(([, pattern]) => pattern.test(html))?.[0] ?? null,
    copyrightYear: years.length ? Math.max(...years) : null,
    emails: findEmails(html),
    phones: findPhones(html),
    socials: {
      facebook: findSocial(html, /^https?:\/\/(www\.|m\.)?facebook\.com\/(?!tr\b|dialog)/i),
      instagram: findSocial(html, /^https?:\/\/(www\.)?instagram\.com\/[^/]/i),
      linkedin: findSocial(html, /^https?:\/\/([a-z]+\.)?linkedin\.com\/(company|in)\//i),
    },
  };
}

/** How much a business looks like it needs an agency, with the reasons. */
export function scoreLead(lead: Pick<Lead, "rating" | "reviews">, check: WebsiteCheck | null, year = new Date().getFullYear()): LeadScore {
  const points: [number, string][] = [];
  if (check?.status === "none") points.push([45, "No website"]);
  if (check?.status === "down") points.push([35, "Website doesn't open"]);
  if (check?.status === "ok") {
    if (!check.mobileFriendly) points.push([15, "Website isn't made for phones"]);
    if (!check.metaPixel) points.push([10, "No Meta pixel (no Facebook/Instagram ads tracking)"]);
    if (!check.googleTag) points.push([8, "No Google Analytics or Tag Manager"]);
    if (!check.https) points.push([8, "Website isn't secure (no https)"]);
    if (check.copyrightYear && check.copyrightYear <= year - 3) points.push([10, `Website looks outdated (© ${check.copyrightYear})`]);
    if (check.seconds !== null && check.seconds > 4) points.push([6, `Slow website (${check.seconds.toFixed(1)} s)`]);
    if (!check.googleAds) points.push([4, "No sign of Google Ads"]);
    if (!check.socials.facebook && !check.socials.instagram) points.push([5, "No Facebook or Instagram linked"]);
  }
  if (lead.reviews !== null && lead.reviews < 15) points.push([10, `Few Google reviews (${lead.reviews})`]);
  if (lead.rating !== null && lead.reviews && lead.rating < 4) points.push([8, `Low Google rating (${lead.rating.toFixed(1)})`]);

  points.sort((a, b) => b[0] - a[0]);
  return { score: Math.min(100, points.reduce((sum, [p]) => sum + p, 0)), reasons: points.map(([, reason]) => reason) };
}

/** "https://www.Example.dk/side" → "example.dk", for spotting businesses already in the CRM. */
export function domainOf(address: string | null | undefined) {
  if (!address) return null;
  try {
    return new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
