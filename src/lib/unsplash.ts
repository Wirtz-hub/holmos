import "server-only";
import { serverEnv } from "@/lib/env";
import type { FunnelDoc, PhotoCredit } from "@/lib/funnels/schema";

// Free stock photos from Unsplash (unsplash.com/developers). Unsplash asks
// apps to show its own image addresses (no copying), to credit the
// photographer, and to tell it when a photo is used. Without
// UNSPLASH_ACCESS_KEY, photo search is off and new websites start without
// pictures.

const API = "https://api.unsplash.com";

/** Template and AI pictures are written as "unsplash:<search words>" until real photos are picked. */
export const STOCK_PREFIX = "unsplash:";

export type StockPhoto = {
  id: string;
  /** The picture to show on the page. */
  url: string;
  /** A small version for the picker. */
  thumb: string;
  alt: string;
  credit: PhotoCredit;
  /** Called when the photo is used, as Unsplash requires. */
  downloadLocation: string;
};

export type Orientation = "landscape" | "portrait" | "squarish";

export function isStockPhotoSearchOn() {
  return Boolean(serverEnv().unsplashAccessKey);
}

class UnsplashError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(url: string): Promise<T> {
  const key = serverEnv().unsplashAccessKey;
  if (!key) throw new UnsplashError("Stock photos aren't set up yet.", 0);
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 403 || res.status === 429) {
    throw new UnsplashError("Unsplash's hourly limit is reached. Try again in a while.", res.status);
  }
  if (res.status === 401) throw new UnsplashError("Unsplash didn't accept the access key. Check UNSPLASH_ACCESS_KEY.", res.status);
  if (!res.ok) throw new UnsplashError(`Unsplash answered with an error (${res.status}).`, res.status);
  return (await res.json()) as T;
}

type ApiPhoto = {
  id: string;
  alt_description: string | null;
  description: string | null;
  urls: { raw: string; small: string; thumb: string };
  links: { download_location?: string };
  user: { name: string; links: { html: string } };
};

function toStockPhoto(photo: ApiPhoto): StockPhoto {
  // Unsplash resizes on the fly; keep its tracking parameters on the address.
  const url = `${photo.urls.raw}${photo.urls.raw.includes("?") ? "&" : "?"}w=1600&q=80&fit=max&auto=format`;
  return {
    id: photo.id,
    url,
    thumb: photo.urls.small,
    alt: (photo.alt_description ?? photo.description ?? "").slice(0, 300),
    credit: { url, name: photo.user.name.slice(0, 120), link: photo.user.links.html },
    downloadLocation: photo.links.download_location ?? `${API}/photos/${encodeURIComponent(photo.id)}/download`,
  };
}

export async function searchStockPhotos(
  query: string,
  { page = 1, perPage = 18, orientation }: { page?: number; perPage?: number; orientation?: Orientation } = {},
): Promise<{ photos: StockPhoto[]; totalPages: number }> {
  const params = new URLSearchParams({ query, page: String(page), per_page: String(perPage), content_filter: "high" });
  if (orientation) params.set("orientation", orientation);
  const result = await call<{ total_pages: number; results: ApiPhoto[] }>(`${API}/search/photos?${params}`);
  return { photos: result.results.map(toStockPhoto), totalPages: result.total_pages };
}

/** Unsplash counts a "download" each time a photo is put on a page. */
export async function markStockPhotoUsed(downloadLocation: string) {
  let url: URL;
  try {
    url = new URL(downloadLocation);
  } catch {
    return;
  }
  if (url.protocol !== "https:" || url.hostname !== "api.unsplash.com") return;
  await call(url.toString()).catch(() => undefined);
}

/** Every "unsplash:<search words>" in a page, in order. */
export function stockPlaceholders(doc: FunnelDoc): string[] {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      if (value.startsWith(STOCK_PREFIX)) found.push(value);
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(doc);
  return found;
}

function replaceStrings(value: unknown, replace: (text: string) => string): unknown {
  if (typeof value === "string") return replace(value);
  if (Array.isArray(value)) return value.map((item) => replaceStrings(item, replace));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceStrings(item, replace)]));
  }
  return value;
}

/**
 * Swaps every "unsplash:<search words>" for a real photo and credits its
 * photographer. Pictures that can't be found are left empty.
 */
export async function fillStockPhotos(doc: FunnelDoc): Promise<{ doc: FunnelDoc; missing: number }> {
  const wanted = stockPlaceholders(doc);
  if (!wanted.length) return { doc, missing: 0 };

  // One search per distinct set of words; repeats get the next photo.
  const queries = [...new Set(wanted.map((w) => w.slice(STOCK_PREFIX.length).trim()))];
  const results = new Map<string, StockPhoto[]>();
  if (isStockPhotoSearchOn()) {
    await Promise.all(
      queries.map(async (query) => {
        const found = await searchStockPhotos(query, { perPage: 10, orientation: "landscape" }).catch(() => null);
        results.set(query, found?.photos ?? []);
      }),
    );
  }

  const usedIds = new Set<string>();
  const picked = new Map<string, StockPhoto>();
  let missing = 0;
  const filled = replaceStrings(doc, (text) => {
    if (!text.startsWith(STOCK_PREFIX)) return text;
    const photo = (results.get(text.slice(STOCK_PREFIX.length).trim()) ?? []).find((p) => !usedIds.has(p.id));
    if (!photo) {
      missing++;
      return "";
    }
    usedIds.add(photo.id);
    picked.set(photo.id, photo);
    return photo.url;
  }) as FunnelDoc;

  const photos = [...picked.values()];
  await Promise.all(photos.map((photo) => markStockPhotoUsed(photo.downloadLocation)));
  return {
    doc: { ...filled, photoCredits: [...filled.photoCredits, ...photos.map((p) => p.credit)].slice(-200) },
    missing,
  };
}
