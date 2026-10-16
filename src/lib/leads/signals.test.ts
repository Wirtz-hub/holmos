import { describe, expect, it } from "vitest";
import { analyzeHtml, decodeCloudflareEmail, domainOf, findEmails, scoreLead } from "@/lib/leads/signals";
import type { WebsiteCheck } from "@/lib/leads/types";
import { osmFilters, overpassQuery } from "@/lib/leads/osm-trades";

describe("osmFilters", () => {
  it("knows trades in several languages", () => {
    expect(osmFilters("Tandlæge").tags).toContainEqual(["amenity", "dentist"]);
    expect(osmFilters("frisör").tags).toEqual([["shop", "hairdresser"]]);
    expect(osmFilters("plumbers").tags).toEqual([["craft", "plumber"]]);
    expect(osmFilters("tandlæge").namePattern).toBe("tandlæ");
  });

  it("falls back to the name for unknown trades", () => {
    const filters = osmFilters("surfskole");
    expect(filters.tags).toEqual([]);
    expect(overpassQuery(filters, [56, 10, 56.3, 10.3], 40)).toContain('nwr["name"~"surfsko",i]');
  });
});

const base: WebsiteCheck = {
  status: "ok",
  url: "https://example.dk/",
  https: true,
  mobileFriendly: true,
  metaPixel: true,
  googleTag: true,
  googleAds: true,
  builder: null,
  copyrightYear: 2026,
  seconds: 1,
  emails: [],
  phones: [],
  socials: { facebook: "https://facebook.com/x", instagram: null, linkedin: null },
};

describe("analyzeHtml", () => {
  it("spots tracking, phone layout, builder and copyright year", () => {
    const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
      <script src="https://www.googletagmanager.com/gtag/js?id=G-ABC1234567"></script>
      <script>fbq('init', '123');</script></head>
      <body><img src="/wp-content/x.png"><a href="tel:+45 12 34 56 78">Ring</a>
      <a href="https://www.instagram.com/klinik">IG</a><footer>© 2019 Klinik</footer></body></html>`;
    const s = analyzeHtml(html);
    expect(s.mobileFriendly).toBe(true);
    expect(s.googleTag).toBe(true);
    expect(s.metaPixel).toBe(true);
    expect(s.googleAds).toBe(false);
    expect(s.builder).toBe("WordPress");
    expect(s.copyrightYear).toBe(2019);
    expect(s.phones).toEqual(["+4512345678"]);
    expect(s.socials.instagram).toBe("https://www.instagram.com/klinik");
  });

  it("finds a bare page with nothing set up", () => {
    const s = analyzeHtml("<html><body><p>Velkommen</p></body></html>");
    expect(s).toMatchObject({ mobileFriendly: false, metaPixel: false, googleTag: false, builder: null, copyrightYear: null });
  });
});

describe("findEmails", () => {
  it("takes mailto links and text, and skips image names and placeholders", () => {
    const html = `<a href="mailto:Info@Klinik.dk?subject=hi">Skriv</a> kontakt@klinik.dk logo@2x.png name@example.com`;
    expect(findEmails(html)).toEqual(["info@klinik.dk", "kontakt@klinik.dk"]);
  });

  it("decodes Cloudflare-hidden emails", () => {
    // "a@b.dk" XOR 0x42
    const hex = "42" + [..."a@b.dk"].map((c) => (c.charCodeAt(0) ^ 0x42).toString(16).padStart(2, "0")).join("");
    expect(decodeCloudflareEmail(hex)).toBe("a@b.dk");
    expect(findEmails(`<span data-cfemail="${hex}">[email protected]</span>`)).toEqual(["a@b.dk"]);
  });
});

describe("scoreLead", () => {
  it("scores a business without a website highest", () => {
    const none = scoreLead({ rating: 4.8, reviews: 3 }, { ...base, status: "none" });
    expect(none.reasons[0]).toBe("No website");
    expect(none.score).toBe(55);
  });

  it("gives a well set-up business a low score", () => {
    expect(scoreLead({ rating: 4.7, reviews: 200 }, base, 2026).score).toBe(0);
  });

  it("adds up website problems", () => {
    const bad = { ...base, https: false, mobileFriendly: false, metaPixel: false, googleTag: false, googleAds: false, copyrightYear: 2018, seconds: 6, socials: { facebook: null, instagram: null, linkedin: null } };
    const result = scoreLead({ rating: 3.2, reviews: 4 }, bad, 2026);
    expect(result.score).toBe(84);
    expect(result.reasons).toContain("Website looks outdated (© 2018)");
  });
});

describe("domainOf", () => {
  it("normalises addresses", () => {
    expect(domainOf("https://www.Klinik.dk/om-os")).toBe("klinik.dk");
    expect(domainOf("klinik.dk")).toBe("klinik.dk");
    expect(domainOf(null)).toBeNull();
  });
});
