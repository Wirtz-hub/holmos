// Turns a trade written in plain words ("tandlæge", "frisör", "plumber") into
// the OpenStreetMap tags that mark such businesses, plus a name pattern.
// Pure, so it can be tested.

type Trade = { words: string[]; tags: [string, string][] };

// Words in English, Danish, Swedish, Norwegian and German. Matched by prefix.
const TRADES: Trade[] = [
  { words: ["dentist", "tandlæge", "tandklinik", "tandläkare", "tannlege", "zahnarzt"], tags: [["amenity", "dentist"], ["healthcare", "dentist"]] },
  { words: ["doctor", "læge", "lægehus", "läkare", "lege", "arzt", "clinic", "klinik"], tags: [["amenity", "doctors"], ["amenity", "clinic"], ["healthcare", "doctor"]] },
  { words: ["physio", "fysioterapeut", "fysioterapi", "sjukgymnast", "physiotherap"], tags: [["healthcare", "physiotherapist"]] },
  { words: ["chiropract", "kiropraktor", "chiropraktik"], tags: [["healthcare", "chiropractor"]] },
  { words: ["optician", "optiker"], tags: [["shop", "optician"]] },
  { words: ["vet", "dyrlæge", "veterinär", "veterinær", "tierarzt", "dyreklinik"], tags: [["amenity", "veterinary"]] },
  { words: ["hairdresser", "barber", "frisør", "frisör", "frisor", "friseur", "salon"], tags: [["shop", "hairdresser"]] },
  { words: ["beauty", "skønhed", "kosmetolog", "kosmetik", "nail", "negle", "spa"], tags: [["shop", "beauty"], ["leisure", "spa"]] },
  { words: ["massage", "massør"], tags: [["shop", "massage"]] },
  { words: ["tattoo", "tatovør", "tatuering"], tags: [["shop", "tattoo"]] },
  { words: ["gym", "fitness", "fitnesscenter", "træningscenter", "crossfit"], tags: [["leisure", "fitness_centre"]] },
  { words: ["yoga"], tags: [["sport", "yoga"]] },
  { words: ["restaurant", "spisested"], tags: [["amenity", "restaurant"]] },
  { words: ["cafe", "café", "kaffe", "coffee"], tags: [["amenity", "cafe"]] },
  { words: ["bar", "pub", "værtshus"], tags: [["amenity", "bar"], ["amenity", "pub"]] },
  { words: ["bakery", "bager", "bageri", "bäckerei", "konditori"], tags: [["shop", "bakery"], ["shop", "pastry"]] },
  { words: ["pizza", "pizzeria"], tags: [["cuisine", "pizza"]] },
  { words: ["hotel"], tags: [["tourism", "hotel"]] },
  { words: ["plumber", "vvs", "blikkenslager", "rørlægger", "rörmokare", "rørlegger", "klempner", "sanitär"], tags: [["craft", "plumber"]] },
  { words: ["electrician", "elektriker", "el-installatør", "elinstallatør"], tags: [["craft", "electrician"]] },
  { words: ["carpenter", "tømrer", "snedker", "snickare", "tømrer", "zimmerer", "tischler", "schreiner"], tags: [["craft", "carpenter"], ["craft", "joiner"]] },
  { words: ["painter", "maler", "målare"], tags: [["craft", "painter"]] },
  { words: ["roofer", "tagdækker", "takläggare", "dachdecker"], tags: [["craft", "roofer"]] },
  { words: ["mason", "murer", "murare", "maurer"], tags: [["craft", "bricklayer"], ["craft", "stonemason"]] },
  { words: ["locksmith", "låsesmed", "låssmed", "schlüssel"], tags: [["shop", "locksmith"], ["craft", "locksmith"]] },
  { words: ["gardener", "anlægsgartner", "gartner", "trädgård", "landscap"], tags: [["craft", "gardener"], ["shop", "garden_centre"]] },
  { words: ["cleaning", "rengøring", "städ", "reinigung"], tags: [["shop", "dry_cleaning"], ["office", "cleaning"]] },
  { words: ["mechanic", "autoværksted", "værksted", "bilverkstad", "bilverksted", "werkstatt", "car repair"], tags: [["shop", "car_repair"]] },
  { words: ["car dealer", "bilforhandler", "bilhandlare", "autohaus"], tags: [["shop", "car"]] },
  { words: ["lawyer", "advokat", "jurist", "anwalt", "rechtsanwalt"], tags: [["office", "lawyer"]] },
  { words: ["accountant", "revisor", "bogholder", "redovisning", "steuerberater"], tags: [["office", "accountant"], ["office", "tax_advisor"]] },
  { words: ["real estate", "ejendomsmægler", "mægler", "mäklare", "megler", "immobilien"], tags: [["office", "estate_agent"]] },
  { words: ["insurance", "forsikring", "försäkring", "versicherung"], tags: [["office", "insurance"]] },
  { words: ["florist", "blomster", "blomsterhandel", "blumen"], tags: [["shop", "florist"]] },
  { words: ["clothes", "tøj", "tøjbutik", "kläder", "mode", "fashion", "boutique"], tags: [["shop", "clothes"], ["shop", "boutique"]] },
  { words: ["furniture", "møbler", "möbler", "møbel"], tags: [["shop", "furniture"]] },
  { words: ["jewel", "smykker", "guldsmed", "juvelér", "smycken", "schmuck"], tags: [["shop", "jewelry"]] },
  { words: ["butcher", "slagter", "slakter", "metzger"], tags: [["shop", "butcher"]] },
  { words: ["bike", "cykel", "cykelhandler", "cykelsmed", "fahrrad"], tags: [["shop", "bicycle"]] },
  { words: ["kindergarten", "børnehave", "vuggestue", "förskola", "barnehage", "kita"], tags: [["amenity", "kindergarten"]] },
  { words: ["driving school", "køreskole", "trafikskola", "kjøreskole", "fahrschule"], tags: [["amenity", "driving_school"]] },
];

/** Tags to look for and a name pattern, for a trade written in plain words. */
export function osmFilters(trade: string): { tags: [string, string][]; namePattern: string } {
  const text = trade.trim().toLowerCase();
  const tags = TRADES.filter((t) =>
    t.words.some((word) => text.startsWith(word) || (text.length >= 4 && word.startsWith(text)) || text.includes(` ${word}`)),
  ).flatMap((t) => t.tags);
  // Matching on the name catches businesses not tagged by trade, e.g. "Tandlægerne Nord". Overpass regexes are POSIX.
  const stem = text.length > 6 ? text.slice(0, Math.max(5, text.length - 2)) : text;
  return { tags: [...new Map(tags.map((t) => [t.join("="), t])).values()], namePattern: stem.replace(/[^\p{L}\p{N} ]/gu, "") };
}

/** An Overpass query for those filters inside a box (south, west, north, east). */
export function overpassQuery(filters: ReturnType<typeof osmFilters>, box: [number, number, number, number], limit: number) {
  const b = box.map((n) => n.toFixed(5)).join(",");
  const parts = filters.tags.map(([key, value]) => `nwr["${key}"="${value}"]["name"](${b});`);
  if (filters.namePattern.length >= 3) {
    parts.push(`nwr["name"~"${filters.namePattern}",i][~"^(amenity|shop|craft|office|healthcare|leisure|tourism)$"~"."](${b});`);
  }
  return `[out:json][timeout:50];(${parts.join("")});out center tags ${limit};`;
}
