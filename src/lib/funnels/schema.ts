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

/** Icons people can put on a service. The names match lucide-react icons. */
export const SERVICE_ICONS = [
  "check", "star", "heart", "shield", "clock", "phone", "mail", "map-pin", "wrench", "hammer", "scissors", "sparkles",
  "leaf", "home", "car", "dumbbell", "utensils", "coffee", "briefcase", "users", "calendar", "camera", "paintbrush",
  "zap", "award", "smile", "stethoscope", "graduation-cap", "truck", "shopping-bag",
] as const;
export type ServiceIcon = (typeof SERVICE_ICONS)[number];

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
    layout: z.enum(["center", "split", "background"]).default("center"),
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
  z.object({
    id,
    type: z.literal("features"),
    heading: text(200),
    text: text(1000),
    columns: z.union([z.literal(2), z.literal(3)]).default(3),
    items: z
      .array(z.object({ icon: z.enum(SERVICE_ICONS).default("check"), title: text(120), text: text(600) }))
      .max(12)
      .default([]),
  }),
  z.object({
    id,
    type: z.literal("split"),
    heading: text(200),
    text: text(3000),
    imageUrl: httpUrl.default(""),
    imageSide: z.enum(["left", "right"]).default("right"),
    buttonLabel: text(60),
    button: button.default({ target: "form", stepId: "", url: "" }),
  }),
  z.object({
    id,
    type: z.literal("faq"),
    heading: text(200),
    items: z
      .array(z.object({ question: text(300), answer: text(2000) }))
      .max(20)
      .default([]),
  }),
  z.object({
    id,
    type: z.literal("pricing"),
    heading: text(200),
    text: text(1000),
    plans: z
      .array(
        z.object({
          name: text(80),
          price: text(40),
          period: text(40),
          description: text(300),
          features: text(2000),
          buttonLabel: text(60),
          button: button.default({ target: "form", stepId: "", url: "" }),
          highlighted: z.boolean().default(false),
        }),
      )
      .max(4)
      .default([]),
  }),
  z.object({
    id,
    type: z.literal("team"),
    heading: text(200),
    text: text(1000),
    people: z
      .array(z.object({ name: text(120), role: text(120), photoUrl: httpUrl.default(""), bio: text(600) }))
      .max(16)
      .default([]),
  }),
  z.object({
    id,
    type: z.literal("contact"),
    heading: text(200),
    text: text(1000),
    address: text(300),
    phone: text(40),
    email: text(200),
    openingHours: text(600),
    showMap: z.boolean().default(true),
    formId: z.uuid().nullable().default(null),
  }),
  z.object({
    id,
    type: z.literal("gallery"),
    heading: text(200),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    images: z
      .array(z.object({ url: httpUrl.default(""), alt: text(300) }))
      .max(24)
      .default([]),
  }),
  z.object({
    id,
    type: z.literal("stats"),
    heading: text(200),
    items: z
      .array(z.object({ value: text(20), label: text(120) }))
      .max(6)
      .default([]),
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
  /** Shown in the website menu (when the page has one). */
  inMenu: z.boolean().default(true),
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

/** A menu along the top and a footer along the bottom: what turns a landing page into a website. */
export const siteSchema = z.object({
  header: z
    .object({
      enabled: z.boolean().default(false),
      businessName: text(120),
      logoUrl: httpUrl.default(""),
      buttonLabel: text(60),
      button: button.default({ target: "form", stepId: "", url: "" }),
    })
    .default({ enabled: false, businessName: "", logoUrl: "", buttonLabel: "", button: { target: "form", stepId: "", url: "" } }),
  footer: z
    .object({
      enabled: z.boolean().default(false),
      text: text(1000),
      phone: text(40),
      email: text(200),
    })
    .default({ enabled: false, text: "", phone: "", email: "" }),
});
export type Site = z.infer<typeof siteSchema>;

/** Unsplash asks for the photographer to be credited wherever their photo is used. */
export const photoCreditSchema = z.object({
  url: z.string().max(2000),
  name: text(120),
  link: httpUrl.default(""),
});
export type PhotoCredit = z.infer<typeof photoCreditSchema>;

export const funnelDocSchema = z
  .object({
    version: z.literal(1).default(1),
    language: z.enum(["da", "en"]).default("da"),
    indexable: z.boolean().default(true),
    theme: themeSchema.default({ accent: "#1d4669", background: "white", font: "sans" }),
    site: siteSchema.default(siteSchema.parse({})),
    photoCredits: z.array(photoCreditSchema).max(200).default([]),
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
  features: { label: "Services", hint: "What you offer, in a grid with icons" },
  split: { label: "Text and image", hint: "A picture beside some text" },
  faq: { label: "Questions", hint: "Frequently asked questions that fold out" },
  pricing: { label: "Prices", hint: "Packages side by side" },
  team: { label: "Team", hint: "The people, with photos" },
  contact: { label: "Contact", hint: "Address, phone, opening hours, map and a form" },
  gallery: { label: "Gallery", hint: "A grid of pictures" },
  stats: { label: "Key figures", hint: "A few numbers that impress" },
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
    case "features":
      return {
        ...base,
        type,
        heading: da ? "Det tilbyder vi" : "What we offer",
        text: "",
        columns: 3,
        items: [1, 2, 3].map((n) => ({
          icon: "check" as const,
          title: da ? `Ydelse ${n}` : `Service ${n}`,
          text: da ? "En kort beskrivelse af ydelsen." : "A short description of the service.",
        })),
      };
    case "split":
      return {
        ...base,
        type,
        heading: da ? "Om os" : "About us",
        text: da ? "Fortæl kort, hvem I er, og hvad der gør jer gode til det, I laver." : "Say who you are and what makes you good at what you do.",
        imageUrl: "",
        imageSide: "right",
        buttonLabel: "",
        button: { target: "form", stepId: "", url: "" },
      };
    case "faq":
      return {
        ...base,
        type,
        heading: da ? "Ofte stillede spørgsmål" : "Frequently asked questions",
        items: [
          { question: da ? "Hvad koster det?" : "What does it cost?", answer: da ? "Skriv svaret her." : "Write the answer here." },
          { question: da ? "Hvor hurtigt kan I starte?" : "How soon can you start?", answer: da ? "Skriv svaret her." : "Write the answer here." },
        ],
      };
    case "pricing":
      return {
        ...base,
        type,
        heading: da ? "Priser" : "Prices",
        text: "",
        plans: [
          { name: "Basis", highlighted: false, price: da ? "499 kr." : "€69" },
          { name: "Plus", highlighted: true, price: da ? "999 kr." : "€139" },
        ].map((plan) => ({
          ...plan,
          period: da ? "pr. måned" : "per month",
          description: "",
          features: da ? "- Det første, der er med\n- Det andet, der er med" : "- The first thing included\n- The second thing included",
          buttonLabel: da ? "Vælg" : "Choose",
          button: { target: "form" as const, stepId: "", url: "" },
        })),
      };
    case "team":
      return {
        ...base,
        type,
        heading: da ? "Mød holdet" : "Meet the team",
        text: "",
        people: [1, 2].map(() => ({ name: da ? "Navn Efternavn" : "Full Name", role: da ? "Titel" : "Role", photoUrl: "", bio: "" })),
      };
    case "contact":
      return {
        ...base,
        type,
        heading: da ? "Kontakt os" : "Get in touch",
        text: "",
        address: "",
        phone: "",
        email: "",
        openingHours: da ? "Mandag–fredag: 9–16\nLørdag–søndag: Lukket" : "Monday–Friday: 9–16\nSaturday–Sunday: Closed",
        showMap: true,
        formId: null,
      };
    case "gallery":
      return { ...base, type, heading: "", columns: 3, images: [] };
    case "stats":
      return {
        ...base,
        type,
        heading: "",
        items: [
          { value: "10+", label: da ? "års erfaring" : "years of experience" },
          { value: "500", label: da ? "tilfredse kunder" : "happy clients" },
          { value: "4,9", label: da ? "i gennemsnit på Google" : "average on Google" },
        ],
      };
  }
}

export function newStep(name: string, slug: string, blocks: Block[] = []): Step {
  return { id: newId(), name, slug, seoTitle: "", seoDescription: "", inMenu: true, blocks };
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

/** The address of a step: the first one is the page's main address. */
export function stepHref(doc: Pick<FunnelDoc, "steps">, index: number, basePath: string) {
  if (index <= 0) return basePath || "/";
  return `${basePath}/${doc.steps[index].slug}`;
}

/** Every picture address used anywhere in the page (for photo credits). */
export function usedImageUrls(doc: Pick<FunnelDoc, "steps" | "site">) {
  const urls = new Set<string>();
  const add = (url: string) => url && urls.add(url);
  add(doc.site.header.logoUrl);
  for (const step of doc.steps) {
    for (const block of step.blocks) {
      if (block.type === "hero" || block.type === "split") add(block.imageUrl);
      if (block.type === "image") add(block.url);
      if (block.type === "team") block.people.forEach((p) => add(p.photoUrl));
      if (block.type === "gallery") block.images.forEach((i) => add(i.url));
    }
  }
  return urls;
}

/** Where a button goes. `basePath` is "/f/<slug>" on the app's own address, "" on a custom domain. */
export function buttonHref(doc: Pick<FunnelDoc, "steps">, stepIndex: number, target: ButtonTarget, basePath: string): string {
  const stepPath = (index: number) => stepHref(doc, index, basePath);
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
      if ((block.type === "form" || block.type === "contact") && block.formId) forms.add(block.formId);
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
