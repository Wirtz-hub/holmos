import { z } from "zod";

// The content of a landing page or funnel: a list of steps (pages), each a
// list of blocks. Stored as JSON in funnels.draft / funnels.published.

export const LANGUAGES = [
  { id: "da", label: "Danish" },
  { id: "en", label: "English" },
] as const;
export type Language = (typeof LANGUAGES)[number]["id"];

const text = (max: number) => z.string().max(max, `Keep this under ${max} characters`).default("");
const id = z.string().regex(/^[a-z0-9_-]{4,40}$/i);

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), "Start the link with https://");

const button = z.object({
  target: z.enum(["next", "form", "step", "url"]).default("next"),
  stepId: z.string().max(40).default(""),
  url: httpUrl.default(""),
});
export type ButtonTarget = z.infer<typeof button>;

export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    id,
    type: z.literal("hero"),
    eyebrow: text(120),
    heading: text(200),
    text: text(1000),
    buttonLabel: text(60),
    button: button.default({ target: "next", stepId: "", url: "" }),
    imageUrl: httpUrl.default(""),
    layout: z.enum(["center", "split"]).default("center"),
  }),
  z.object({
    id,
    type: z.literal("text"),
    heading: text(200),
    text: text(10000),
    align: z.enum(["left", "center"]).default("left"),
  }),
  z.object({
    id,
    type: z.literal("image"),
    url: httpUrl.default(""),
    alt: text(300),
    caption: text(300),
    size: z.enum(["medium", "wide", "full"]).default("wide"),
  }),
  z.object({
    id,
    type: z.literal("form"),
    formId: z.uuid().nullable().default(null),
    heading: text(200),
    text: text(1000),
    afterSubmit: z.enum(["form", "next"]).default("form"),
  }),
  z.object({
    id,
    type: z.literal("cta"),
    heading: text(200),
    text: text(1000),
    buttonLabel: text(60),
    button: button.default({ target: "next", stepId: "", url: "" }),
  }),
  z.object({
    id,
    type: z.literal("testimonials"),
    heading: text(200),
    items: z
      .array(z.object({ quote: text(1000), name: text(120), role: text(120) }))
      .max(12)
      .default([]),
  }),
  z.object({
    id,
    type: z.literal("booking"),
    calendarId: z.uuid().nullable().default(null),
    heading: text(200),
    text: text(1000),
  }),
]);
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export const STEP_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const stepSchema = z.object({
  id,
  name: z.string().trim().min(1, "Give every step a name").max(80),
  slug: z.string().regex(STEP_SLUG, "Use lowercase letters, numbers and dashes").max(60),
  seoTitle: text(120),
  seoDescription: text(300),
  blocks: z.array(blockSchema).max(40, "A step can have up to 40 blocks"),
});
export type Step = z.infer<typeof stepSchema>;

export const ACCENTS = ["#1d4669", "#0f766e", "#b45309", "#be123c", "#6d28d9", "#111827"] as const;

export const themeSchema = z.object({
  accent: z.string().regex(/^#[0-9a-f]{6}$/i).default("#1d4669"),
  background: z.enum(["white", "soft", "dark"]).default("white"),
  font: z.enum(["sans", "serif"]).default("sans"),
});
export type Theme = z.infer<typeof themeSchema>;

export const funnelDocSchema = z
  .object({
    version: z.literal(1).default(1),
    language: z.enum(["da", "en"]).default("da"),
    indexable: z.boolean().default(true),
    theme: themeSchema.default({ accent: "#1d4669", background: "white", font: "sans" }),
    steps: z.array(stepSchema).min(1, "A page needs at least one step").max(10, "A funnel can have up to 10 steps"),
  })
  .refine((doc) => new Set(doc.steps.map((s) => s.slug)).size === doc.steps.length, {
    message: "Two steps have the same address. Give each step its own.",
    path: ["steps"],
  });
export type FunnelDoc = z.infer<typeof funnelDocSchema>;

export const BLOCK_LABELS: Record<BlockType, { label: string; hint: string }> = {
  hero: { label: "Hero", hint: "Big headline, short pitch and a button" },
  text: { label: "Text", hint: "Heading and paragraphs or a bullet list" },
  image: { label: "Image", hint: "A picture, with an optional caption" },
  form: { label: "Form", hint: "One of your forms — answers become leads" },
  cta: { label: "Call to action", hint: "A short nudge with a button" },
  testimonials: { label: "Testimonials", hint: "Quotes from happy clients" },
  booking: { label: "Booking", hint: "Let visitors book a time with you" },
};

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** A fresh block with sensible starter content. */
export function newBlock(type: BlockType, language: Language = "da"): Block {
  const da = language === "da";
  const base = { id: newId() };
  switch (type) {
    case "hero":
      return {
        ...base,
        type,
        eyebrow: "",
        heading: da ? "Din overskrift her" : "Your headline here",
        text: da ? "Fortæl kort, hvad du tilbyder, og hvorfor det er værd at handle nu." : "Say in one or two lines what you offer and why it's worth acting now.",
        buttonLabel: da ? "Kom i gang" : "Get started",
        button: { target: "form", stepId: "", url: "" },
        imageUrl: "",
        layout: "center",
      };
    case "text":
      return { ...base, type, heading: da ? "Overskrift" : "Heading", text: da ? "Skriv din tekst her." : "Write your text here.", align: "left" };
    case "image":
      return { ...base, type, url: "", alt: "", caption: "", size: "wide" };
    case "form":
      return { ...base, type, formId: null, heading: da ? "Skriv til os" : "Get in touch", text: "", afterSubmit: "form" };
    case "cta":
      return {
        ...base,
        type,
        heading: da ? "Klar til at tage næste skridt?" : "Ready for the next step?",
        text: "",
        buttonLabel: da ? "Ja tak" : "Yes, please",
        button: { target: "next", stepId: "", url: "" },
      };
    case "testimonials":
      return {
        ...base,
        type,
        heading: da ? "Det siger vores kunder" : "What our clients say",
        items: [
          { quote: da ? "Skriv en kundeudtalelse her." : "Put a client quote here.", name: da ? "Navn Efternavn" : "Full Name", role: da ? "Firma" : "Company" },
        ],
      };
    case "booking":
      return { ...base, type, calendarId: null, heading: da ? "Book en tid" : "Book a time", text: "" };
  }
}

export function newStep(name: string, slug: string, blocks: Block[] = []): Step {
  return { id: newId(), name, slug, seoTitle: "", seoDescription: "", blocks };
}

/** Turns "Spring offer 2026!" into "spring-offer-2026". */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "oe")
    .replace(/[å]/g, "aa")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Where a button goes. `basePath` is "/f/<slug>" on the app's own address, "" on a custom domain. */
export function buttonHref(doc: Pick<FunnelDoc, "steps">, stepIndex: number, target: ButtonTarget, basePath: string): string {
  const stepPath = (index: number) => {
    if (index <= 0) return basePath || "/";
    return `${basePath}/${doc.steps[index].slug}`;
  };
  switch (target.target) {
    case "url":
      return target.url || "#";
    case "form":
      return "#signup";
    case "step": {
      const index = doc.steps.findIndex((s) => s.id === target.stepId);
      return index >= 0 ? stepPath(index) : "#";
    }
    case "next":
      return stepIndex + 1 < doc.steps.length ? stepPath(stepIndex + 1) : "#signup";
  }
}

/** Which step a URL shows: none → the first step, one segment → that step's address, anything else → none. */
export function stepIndexFor(doc: Pick<FunnelDoc, "steps">, path: string[] | undefined) {
  if (!path || path.length === 0) return 0;
  if (path.length > 1) return -1;
  return doc.steps.findIndex((step, i) => i > 0 && step.slug === path[0]);
}

/** The path of the step after `stepIndex`, or null on the last step. */
export function nextStepHref(doc: Pick<FunnelDoc, "steps">, stepIndex: number, basePath: string) {
  if (stepIndex + 1 >= doc.steps.length) return null;
  return `${basePath}/${doc.steps[stepIndex + 1].slug}`;
}

/** Form and calendar ids a funnel uses, so the public page can load them. */
export function referencedIds(doc: FunnelDoc) {
  const forms = new Set<string>();
  const calendars = new Set<string>();
  for (const step of doc.steps) {
    for (const block of step.blocks) {
      if (block.type === "form" && block.formId) forms.add(block.formId);
      if (block.type === "booking" && block.calendarId) calendars.add(block.calendarId);
    }
  }
  return { formIds: [...forms], calendarIds: [...calendars] };
}

/** White or near-black text, whichever reads better on `hex`. */
export function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.4 ? "#0f172a" : "#ffffff";
}
