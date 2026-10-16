import { isIP } from "node:net";

// Turns a web page's HTML into plain text the AI can read. Pure functions,
// so they can be tested without the internet.

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  aelig: "æ", AElig: "Æ", oslash: "ø", Oslash: "Ø", aring: "å", Aring: "Å", auml: "ä", ouml: "ö", uuml: "ü", eacute: "é",
  copy: "©", reg: "®", trade: "™", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", middot: "·", euro: "€",
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code] ?? match;
  });
}

const BLOCK_TAGS = /<\/?(p|div|section|article|header|footer|main|aside|nav|h[1-6]|li|ul|ol|tr|td|th|table|br|hr|blockquote|address|dd|dt|figcaption)\b[^>]*>/gi;

/** The readable text of a page, one paragraph per line. */
export function htmlToText(html: string) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<h([1-6])\b[^>]*>/gi, (_m, level: string) => `\n${"#".repeat(Number(level))} `)
    .replace(BLOCK_TAGS, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !/^#+$/.test(line))
    .join("\n");
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeEntities(match?.[2] ?? match?.[3] ?? match?.[4] ?? "").trim();
}

function metaContent(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attr(tag, "name").toLowerCase() === key || attr(tag, "property").toLowerCase() === key) return attr(tag, "content");
  }
  return "";
}

// Pages worth reading besides the front page, in Danish and English.
const USEFUL_PATHS = /(om-?os|about|kontakt|contact|ydelser|services|behandling|priser|pris|prices|pricing|team|medarbejdere|menu|produkter|products|faq|sporgsmal)/i;

export type PageInfo = { title: string; description: string; text: string; links: string[]; colours: string[] };

/** What a page says, which of its own pages are worth reading too, and its brand colours. */
export function readPage(html: string, pageUrl: URL): PageInfo {
  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const description = metaContent(html, "description") || metaContent(html, "og:description");

  const links = new Set<string>();
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attr(tag, "href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    let target: URL;
    try {
      target = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (target.hostname.replace(/^www\./, "") !== pageUrl.hostname.replace(/^www\./, "")) continue;
    if (!/^https?:$/.test(target.protocol) || /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?)$/i.test(target.pathname)) continue;
    if (!USEFUL_PATHS.test(target.pathname)) continue;
    target.hash = "";
    target.search = "";
    if (target.toString() !== pageUrl.toString()) links.add(target.toString());
  }

  // Brand colours: the browser theme colour first, then the most used strong colours in the page's own CSS.
  const counts = new Map<string, number>();
  const css = [...(html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []), ...(html.match(/style\s*=\s*"[^"]*"/gi) ?? [])].join(" ");
  for (const [, hex] of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const full = (hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex).toLowerCase();
    if (isStrongColour(full)) counts.set(`#${full}`, (counts.get(`#${full}`) ?? 0) + 1);
  }
  const theme = metaContent(html, "theme-color").toLowerCase();
  const colours = [
    ...(/^#[0-9a-f]{6}$/.test(theme) && isStrongColour(theme.slice(1)) ? [theme] : []),
    ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([colour]) => colour),
  ].filter((c, i, all) => all.indexOf(c) === i);

  return { title, description, text: htmlToText(html), links: [...links].slice(0, 12), colours: colours.slice(0, 5) };
}

/** Leaves out white, black and greys, which say nothing about a brand. */
function isStrongColour(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min > 40 && max > 40 && min < 235;
}

/** "example.dk" or "https://example.dk/side" → a web address, or null if it isn't one. */
export function websiteUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".") || url.username || url.password) return null;
    if (url.port && url.port !== "80" && url.port !== "443") return null;
    return url;
  } catch {
    return null;
  }
}

/** True for addresses inside a private network or this computer, which must never be fetched. */
export function isPrivateAddress(address: string) {
  const kind = isIP(address);
  if (kind === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (kind === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith("ff");
  }
  return true;
}
