import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FunnelContext } from "@/components/funnels/funnel-parts";
import { SiteFooter } from "@/components/funnels/site-chrome";
import { buildWebsite } from "@/lib/funnels/website-templates";

function footerFor(language: "da" | "en") {
  const doc = buildWebsite("restaurant", "Test");
  const url = "https://images.unsplash.com/photo-1?ixid=x&w=1600";
  doc.language = language;
  doc.steps[0].blocks = doc.steps[0].blocks.map((b) => (b.type === "hero" ? { ...b, imageUrl: url } : b));
  doc.photoCredits = [
    { url, name: "Anne Spratt", link: "https://unsplash.com/@anne" },
    { url: "https://images.unsplash.com/not-on-the-page", name: "Not Used", link: "https://unsplash.com/@nope" },
  ];
  const ctx: FunnelContext = { doc, stepIndex: 0, basePath: "/f/test", interactive: false, forms: {}, calendars: {}, signupBlockId: null };
  return renderToStaticMarkup(createElement(SiteFooter, { ctx }));
}

describe("photo credits", () => {
  it("credits the photographer and Unsplash, both linked, as Unsplash requires", () => {
    const html = footerFor("da");
    expect(html).toContain("Billeder af");
    expect(html).toContain('href="https://unsplash.com/@anne?utm_source=holmos&amp;utm_medium=referral"');
    expect(html).toMatch(/på <a href="https:\/\/unsplash\.com\/\?utm_source=holmos&amp;utm_medium=referral"[^>]*>Unsplash<\/a>/);
  });

  it("only credits photos still on the page", () => {
    expect(footerFor("en")).not.toContain("Not Used");
    expect(footerFor("en")).toContain("Photos by");
  });
});
