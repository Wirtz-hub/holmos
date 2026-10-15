import { describe, expect, it } from "vitest";
import { buttonHref, funnelDocSchema, nextStepHref, readableOn, referencedIds, slugify, stepIndexFor } from "@/lib/funnels/schema";
import { buildTemplate, fillTemplateIds, TEMPLATES } from "@/lib/funnels/templates";

const FORM = "7d3f6a1e-0000-4000-8000-000000000001";
const CALENDAR = "7d3f6a1e-0000-4000-8000-000000000002";

describe("templates", () => {
  it("are all valid pages, in both languages", () => {
    for (const template of TEMPLATES) {
      for (const language of ["da", "en"] as const) {
        const doc = buildTemplate(template.id, language);
        expect(funnelDocSchema.safeParse(doc).success, `${template.id}/${language}`).toBe(true);
        expect(doc.steps).toHaveLength(template.steps);
      }
    }
  });

  it("get a form and a booking page filled in when they need one", () => {
    const doc = fillTemplateIds(buildTemplate("lead", "da"), { formId: FORM, calendarId: CALENDAR });
    expect(referencedIds(doc)).toEqual({ formIds: [FORM], calendarIds: [CALENDAR] });
  });
});

describe("links between steps", () => {
  const doc = buildTemplate("offer", "en");
  const [first, second] = doc.steps;

  it("work on HolmOS's address and on a custom domain", () => {
    expect(buttonHref(doc, 0, { target: "next", stepId: "", url: "" }, "/f/offer")).toBe(`/f/offer/${second.slug}`);
    expect(buttonHref(doc, 0, { target: "next", stepId: "", url: "" }, "")).toBe(`/${second.slug}`);
    expect(buttonHref(doc, 1, { target: "step", stepId: first.id, url: "" }, "")).toBe("/");
    expect(buttonHref(doc, 1, { target: "step", stepId: first.id, url: "" }, "/f/offer")).toBe("/f/offer");
    expect(buttonHref(doc, 0, { target: "form", stepId: "", url: "" }, "")).toBe("#signup");
    expect(buttonHref(doc, 1, { target: "next", stepId: "", url: "" }, "")).toBe("#signup");
    expect(buttonHref(doc, 0, { target: "url", stepId: "", url: "https://example.dk" }, "")).toBe("https://example.dk");
    expect(nextStepHref(doc, 0, "/f/offer")).toBe(`/f/offer/${second.slug}`);
    expect(nextStepHref(doc, 1, "/f/offer")).toBeNull();
  });

  it("find the step for an address, and nothing for unknown ones", () => {
    expect(stepIndexFor(doc, undefined)).toBe(0);
    expect(stepIndexFor(doc, [second.slug])).toBe(1);
    // The first step only lives at the main address.
    expect(stepIndexFor(doc, [first.slug])).toBe(-1);
    expect(stepIndexFor(doc, [second.slug, "extra"])).toBe(-1);
    expect(stepIndexFor(doc, ["nope"])).toBe(-1);
  });
});

describe("page content checks", () => {
  it("refuses two steps with the same address", () => {
    const doc = buildTemplate("lead", "en");
    doc.steps[1].slug = doc.steps[0].slug;
    expect(funnelDocSchema.safeParse(doc).error?.issues[0].message).toMatch(/same address/);
  });

  it("refuses links that aren't web addresses", () => {
    const doc = buildTemplate("blank", "en");
    const hero = doc.steps[0].blocks[0];
    if (hero.type !== "hero") throw new Error("expected a hero");
    hero.button = { target: "url", stepId: "", url: "javascript:alert(1)" };
    expect(funnelDocSchema.safeParse(doc).success).toBe(false);
    hero.imageUrl = "data:image/png;base64,AAAA";
    hero.button = { target: "next", stepId: "", url: "" };
    expect(funnelDocSchema.safeParse(doc).success).toBe(false);
  });
});

describe("small helpers", () => {
  it("makes addresses from names, Danish letters included", () => {
    expect(slugify("Forårstilbud på Ærø 2026!")).toBe("foraarstilbud-paa-aeroe-2026");
    expect(slugify("  --  ")).toBe("");
  });

  it("picks readable text on the page's main colour", () => {
    expect(readableOn("#1d4669")).toBe("#ffffff");
    expect(readableOn("#facc15")).toBe("#0f172a");
  });
});
