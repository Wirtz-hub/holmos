import "server-only";
import { serverEnv } from "@/lib/env";
import { osmFilters, overpassQuery } from "@/lib/leads/osm-trades";
import type { Lead } from "@/lib/leads/types";

// Finds businesses by trade and place, anywhere in the world. With
// GOOGLE_MAPS_API_KEY it asks Google Maps (best: phone, website, reviews for
// almost every business). Without it, it falls back to OpenStreetMap, which
// is free but knows fewer businesses.

export class LeadSearchError extends Error {}

export function isGoogleMapsOn() {
  return Boolean(serverEnv().googleMapsApiKey);
}

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
};

const GOOGLE_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "nextPageToken",
].join(",");

async function searchGoogle(query: string, limit: number): Promise<Lead[]> {
  const leads: Lead[] = [];
  let pageToken: string | undefined;
  // Google gives up to 20 per page and 60 in all.
  for (let page = 0; page < 3 && leads.length < limit; page++) {
    let res: Response;
    try {
      res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": serverEnv().googleMapsApiKey, "X-Goog-FieldMask": GOOGLE_FIELDS },
        body: JSON.stringify({ textQuery: query, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
      });
    } catch {
      throw new LeadSearchError("Couldn't reach Google Maps. Try again in a moment.");
    }
    const body = (await res.json().catch(() => ({}))) as { places?: GooglePlace[]; nextPageToken?: string; error?: { message?: string; status?: string } };
    if (res.status === 400 && /api key/i.test(body.error?.message ?? "")) throw new LeadSearchError("Google didn't accept the key. Check GOOGLE_MAPS_API_KEY in Vercel.");
    if (res.status === 403) {
      throw new LeadSearchError("Google Maps said no. Check that “Places API (New)” is switched on for the key's project and that the project has billing set up (SETUP.md 8).");
    }
    if (res.status === 429) throw new LeadSearchError("Google Maps is getting too many searches right now. Try again in a minute.");
    if (!res.ok) throw new LeadSearchError(`Google Maps had a problem (${res.status}${body.error?.message ? `: ${body.error.message}` : ""}).`);

    for (const place of body.places ?? []) {
      if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;
      leads.push({
        id: `google:${place.id}`,
        source: "google",
        name: place.displayName?.text ?? "Unnamed business",
        category: place.primaryTypeDisplayName?.text ?? null,
        address: place.formattedAddress ?? null,
        phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
        email: null,
        website: place.websiteUri ?? null,
        rating: place.rating ?? null,
        reviews: place.userRatingCount ?? null,
        mapsUrl: place.googleMapsUri ?? null,
        clientId: null,
      });
    }
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return leads.slice(0, limit);
}

// OpenStreetMap's rules ask every app to say who it is.
const OSM_HEADERS = { "User-Agent": "HolmOS lead finder (holmnordic.com)", "Accept-Language": "en" };
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

/** The box around a town or region: south, west, north, east. */
async function areaBox(area: string): Promise<[number, number, number, number]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: area, format: "jsonv2", limit: "1" }).toString();
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000), headers: OSM_HEADERS }).catch(() => {
    throw new LeadSearchError("Couldn't reach OpenStreetMap. Try again in a moment.");
  });
  if (!res.ok) throw new LeadSearchError(`OpenStreetMap had a problem finding “${area}” (${res.status}).`);
  const [place] = (await res.json().catch(() => [])) as { boundingbox?: string[]; lat?: string; lon?: string }[];
  if (!place?.boundingbox) throw new LeadSearchError(`Couldn't find “${area}” on the map. Try a town name.`);
  const [south, north, west, east] = place.boundingbox.map(Number);
  // Whole countries are too big for the free map search; look around the middle instead.
  if (north - south > 1 || east - west > 1.6) {
    const lat = Number(place.lat);
    const lon = Number(place.lon);
    return [lat - 0.25, lon - 0.4, lat + 0.25, lon + 0.4];
  }
  return [south, west, north, east];
}

type OsmElement = { type: string; id: number; tags?: Record<string, string> };

async function searchOsm(trade: string, area: string, limit: number): Promise<Lead[]> {
  const query = overpassQuery(osmFilters(trade), await areaBox(area), limit * 2);
  let elements: OsmElement[] | null = null;
  for (const server of OVERPASS) {
    try {
      const res = await fetch(server, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(60_000),
        headers: { ...OSM_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }).toString(),
      });
      if (!res.ok) continue;
      elements = ((await res.json()) as { elements?: OsmElement[] }).elements ?? [];
      break;
    } catch {
      // Try the next server.
    }
  }
  if (!elements) throw new LeadSearchError("The free map search is busy right now. Try again in a minute — or add a Google Maps key for fast, reliable results (SETUP.md 8).");

  const seen = new Set<string>();
  const leads: Lead[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    const key = (t.name ?? "").toLowerCase();
    if (!t.name || seen.has(key)) continue;
    seen.add(key);
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
    const town = [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ");
    const kind = t.healthcare ?? t.amenity ?? t.shop ?? t.craft ?? t.office ?? t.leisure ?? t.tourism ?? null;
    leads.push({
      id: `osm:${el.type}/${el.id}`,
      source: "osm",
      name: t.name,
      category: kind ? kind.replace(/_/g, " ") : null,
      address: [street, town].filter(Boolean).join(", ") || null,
      phone: t.phone ?? t["contact:phone"] ?? null,
      email: t.email ?? t["contact:email"] ?? null,
      website: t.website ?? t["contact:website"] ?? t.url ?? null,
      rating: null,
      reviews: null,
      mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      clientId: null,
    });
    if (leads.length >= limit) break;
  }
  return leads;
}

/** Businesses matching a trade in a place, e.g. ("tandlæge", "Aarhus"). */
export async function searchBusinesses(trade: string, area: string, limit: number): Promise<{ leads: Lead[]; source: Lead["source"] }> {
  if (isGoogleMapsOn()) return { leads: await searchGoogle(`${trade} in ${area}`, limit), source: "google" };
  return { leads: await searchOsm(trade, area, limit), source: "osm" };
}
