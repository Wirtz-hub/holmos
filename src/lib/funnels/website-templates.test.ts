import { describe, expect, it } from "vitest";
import { funnelDocSchema, type FunnelDoc } from "@/lib/funnels/schema";
import { fillTemplateIds, templateUsesForm } from "@/lib/funnels/templates";
import { buildSite, buildWebsite, templateContent, WEBSITE_TEMPLATES, type WebsiteTemplateId } from "@/lib/funnels/website-templates";

/** Stands in for the stock photo search: every "unsplash:…" becomes a photo address, or "" when none is found. */
function withPhotos(doc: FunnelDoc, found: boolean): FunnelDoc {
  return JSON.parse(JSON.stringify(doc), (_key, value) =>
    typeof value === "string" && value.startsWith("unsplash:") ? (found ? "https://images.unsplash.com/photo-1?ixid=x&w=1600" : "") : value,
  );
}

const ids = WEBSITE_TEMPLATES.map((t) => t.id.slice("site-".length) as WebsiteTemplateId);

describe("website templates", () => {
  it.each(ids)("%s builds a valid four-page website", (id) => {
    const doc = buildWebsite(id, "Hansen & Co");
    expect(doc.steps.map((s) => s.name)).toEqual(["Forside", "Ydelser", "Om os", "Kontakt"]);
    expect(doc.site.header.enabled).toBe(true);
    expect(doc.site.header.businessName).toBe("Hansen & Co");
    expect(templateUsesForm(doc)).toBe(true);
    for (const found of [true, false]) {
      const result = funnelDocSchema.safeParse(withPhotos(doc, found));
      expect(result.success, JSON.stringify(result.error?.issues[0])).toBe(true);
    }
  });

  it("puts the business name into the text and leaves no {business} markers", () => {
    const json = JSON.stringify(buildWebsite("dentist", "Tandlæge Hansen"));
    expect(json).toContain("Tandlæge Hansen");
    expect(json).not.toContain("{business}");
  });

  it("links buttons to the contact page and gives the contact block the page's form", () => {
    const doc = buildWebsite("builder", "Byg ApS");
    const contactId = doc.steps[3].id;
    const hero = doc.steps[0].blocks[0];
    expect(hero.type === "hero" && hero.button).toEqual({ target: "step", stepId: contactId, url: "" });
    expect(doc.site.header.button.stepId).toBe(contactId);

    const filled = fillTemplateIds(doc, { formId: "11111111-1111-4111-8111-111111111111" });
    const contact = filled.steps[3].blocks.find((b) => b.type === "contact");
    expect(contact?.type === "contact" && contact.formId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("leaves out sections that have nothing in them", () => {
    const content = {
      ...templateContent("consultant", "Rådgiver"),
      stats: [],
      testimonials: [],
      pricing: [],
      team: [],
      gallery: [],
      faq: [],
    };
    const types = buildSite(content, "en").steps.flatMap((s) => s.blocks.map((b) => b.type));
    for (const missing of ["stats", "testimonials", "pricing", "team", "gallery", "faq"]) expect(types).not.toContain(missing);
    expect(types).toContain("features");
  });

  it("writes its own labels in English for English sites", () => {
    const doc = buildSite(templateContent("fitness", "Strong"), "en");
    expect(doc.language).toBe("en");
    expect(doc.steps.map((s) => s.slug)).toEqual(["home", "services", "about", "contact"]);
    expect(JSON.stringify(doc)).toContain("About Strong");
  });
});
