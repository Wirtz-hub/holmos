import "server-only";
import { lookup } from "node:dns/promises";
import { isPrivateAddress, readPage, websiteUrl } from "@/lib/ai/page-text";

// Reads a client's current website so the AI can reuse what it says.
// Only public addresses are fetched, with limits on time, size and pages.

const MAX_BYTES = 1_500_000;
const MAX_TEXT = 40_000;
const EXTRA_PAGES = 4;

export class WebsiteReadError extends Error {}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new WebsiteReadError("That address isn't a public website.");
  const addresses = await lookup(host, { all: true }).catch(() => {
    throw new WebsiteReadError(`Couldn't find ${url.hostname}. Check the address.`);
  });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new WebsiteReadError("That address isn't a public website.");
}

async function fetchHtml(start: URL): Promise<{ url: URL; html: string }> {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HolmOS website reader)", Accept: "text/html,application/xhtml+xml" },
    }).catch(() => {
      throw new WebsiteReadError(`Couldn't reach ${url.hostname}. Is the website online?`);
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      const target = next ? websiteUrl(new URL(next, url).toString()) : null;
      if (!target) throw new WebsiteReadError("The website sent us somewhere we can't follow.");
      url = target;
      continue;
    }
    if (!res.ok) throw new WebsiteReadError(`The website answered with an error (${res.status}).`);
    if (!/html/i.test(res.headers.get("content-type") ?? "")) throw new WebsiteReadError("That address isn't a web page.");
    return { url, html: await readLimited(res) };
  }
  throw new WebsiteReadError("The website redirects too many times.");
}

async function readLimited(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

export type WebsiteText = { url: string; text: string; colours: string[] };

/** The text of a website's front page plus a few useful pages (about, services, contact, prices). */
export async function readWebsite(address: string): Promise<WebsiteText> {
  const start = websiteUrl(address);
  if (!start) throw new WebsiteReadError("That doesn't look like a website address.");

  const front = await fetchHtml(start);
  const page = readPage(front.html, front.url);
  const extra = await Promise.all(
    page.links.slice(0, EXTRA_PAGES).map(async (link) => {
      try {
        const sub = await fetchHtml(new URL(link));
        return { url: sub.url.toString(), info: readPage(sub.html, sub.url) };
      } catch {
        return null;
      }
    }),
  );

  // Menus and footers repeat on every page; keep each line once.
  const seen = new Set<string>();
  const section = (url: string, title: string, description: string, text: string) => {
    const lines = text.split("\n").filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [`=== ${url}`, title && `Title: ${title}`, description && `Description: ${description}`, ...lines].filter(Boolean).join("\n");
  };
  const parts = [section(front.url.toString(), page.title, page.description, page.text)];
  for (const sub of extra) if (sub) parts.push(section(sub.url, sub.info.title, sub.info.description, sub.info.text));

  const text = parts.join("\n\n").slice(0, MAX_TEXT);
  if (text.replace(/\s/g, "").length < 100) {
    throw new WebsiteReadError("The website has almost no text we can read (it may be built with JavaScript only). Describe the business in the fields instead.");
  }
  return { url: front.url.toString(), text, colours: page.colours };
}
