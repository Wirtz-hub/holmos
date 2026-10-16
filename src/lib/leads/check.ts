import "server-only";
import { fetchHtml } from "@/lib/ai/read-website";
import { readPage, websiteUrl } from "@/lib/ai/page-text";
import { analyzeHtml } from "@/lib/leads/signals";
import type { WebsiteCheck } from "@/lib/leads/types";

// Opens a business's website once (plus its contact page if the front page
// has no email) and notes what its marketing set-up looks like.

const EMPTY = {
  https: false,
  mobileFriendly: false,
  metaPixel: false,
  googleTag: false,
  googleAds: false,
  builder: null,
  copyrightYear: null,
  seconds: null,
  emails: [],
  phones: [],
  socials: { facebook: null, instagram: null, linkedin: null },
} satisfies Omit<WebsiteCheck, "status" | "url">;

export async function checkWebsite(address: string | null): Promise<WebsiteCheck> {
  const start = address ? websiteUrl(address) : null;
  if (!start) return { status: "none", url: null, ...EMPTY };

  const started = Date.now();
  let front: { url: URL; html: string };
  try {
    front = await fetchHtml(start);
  } catch {
    return { status: "down", url: start.toString(), ...EMPTY };
  }
  const seconds = (Date.now() - started) / 1000;
  const signals = analyzeHtml(front.html);

  if (!signals.emails.length) {
    const contact = readPage(front.html, front.url).links.find((link) => /kontakt|contact/i.test(link));
    if (contact) {
      try {
        const page = await fetchHtml(new URL(contact));
        const more = analyzeHtml(page.html);
        signals.emails = more.emails;
        if (!signals.phones.length) signals.phones = more.phones;
      } catch {
        // The front page is enough to go on.
      }
    }
  }

  return { status: "ok", url: front.url.toString(), https: front.url.protocol === "https:", seconds, ...signals };
}
