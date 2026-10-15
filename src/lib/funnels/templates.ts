import { newBlock, newStep, type Block, type FunnelDoc, type Language } from "@/lib/funnels/schema";

// Starter templates. Their text is placeholder copy, meant to be replaced.

export const TEMPLATES = [
  { id: "lead", name: "Collect leads", description: "Headline, benefits, a sign-up form and a thank-you page.", steps: 2 },
  { id: "booking", name: "Book a call", description: "Pitch, what they get, and your booking calendar on the page.", steps: 1 },
  { id: "offer", name: "Campaign offer", description: "Two steps: the offer, then a form to claim it.", steps: 2 },
  { id: "blank", name: "Blank page", description: "Just a headline. Build the rest yourself.", steps: 1 },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

function make<T extends Block["type"]>(type: T, language: Language, overrides: Partial<Extract<Block, { type: T }>>) {
  return { ...newBlock(type, language), ...overrides } as Extract<Block, { type: T }>;
}

/** Builds a template's content. Form and booking blocks are filled in by the caller. */
export function buildTemplate(template: TemplateId, language: Language): FunnelDoc {
  const da = language === "da";
  const t = (danish: string, english: string) => (da ? danish : english);
  const doc = (steps: FunnelDoc["steps"]): FunnelDoc => ({
    version: 1,
    language,
    indexable: true,
    theme: { accent: "#1d4669", background: "white", font: "sans" },
    steps,
  });

  const testimonials = () =>
    make("testimonials", language, {
      heading: t("Det siger vores kunder", "What our clients say"),
      items: [
        {
          quote: t("Vi fik flere henvendelser på en måned end hele sidste kvartal.", "We got more enquiries in one month than the whole of last quarter."),
          name: t("Mette Jensen", "Sarah Miller"),
          role: t("Ejer, Klinik Nord", "Owner, North Clinic"),
        },
        {
          quote: t("Nemt samarbejde og tydelige resultater hver måned.", "Easy to work with, and clear results every month."),
          name: t("Anders Holm", "James Carter"),
          role: t("Direktør, Holm & Co.", "Director, Carter & Co."),
        },
      ],
    });

  switch (template) {
    case "blank":
      return doc([newStep(t("Forside", "Landing page"), "start", [newBlock("hero", language)])]);

    case "lead":
      return doc([
        newStep(t("Forside", "Landing page"), "start", [
          make("hero", language, {
            eyebrow: t("Gratis guide", "Free guide"),
            heading: t("Få flere kunder fra dine annoncer", "Get more customers from your ads"),
            text: t(
              "Hent vores guide med de 7 ting, vi altid tjekker, før vi bruger én krone på annoncer.",
              "Download our guide to the 7 things we always check before spending a penny on ads.",
            ),
            buttonLabel: t("Send mig guiden", "Send me the guide"),
            button: { target: "form", stepId: "", url: "" },
          }),
          make("text", language, {
            heading: t("Det lærer du", "What you'll learn"),
            text: t(
              "- Hvordan du finder de annoncer, der faktisk giver kunder\n- Hvad en kunde må koste dig\n- De 3 fejl, vi ser oftest",
              "- How to find the ads that actually bring customers\n- What a customer can afford to cost you\n- The 3 mistakes we see most often",
            ),
          }),
          make("form", language, { heading: t("Hvor skal vi sende den hen?", "Where should we send it?"), afterSubmit: "next" }),
          testimonials(),
        ]),
        newStep(t("Tak", "Thank you"), t("tak", "thank-you"), [
          make("text", language, {
            heading: t("Tak! Guiden er på vej", "Thanks! The guide is on its way"),
            text: t("Tjek din indbakke om et par minutter.", "Check your inbox in a few minutes."),
            align: "center",
          }),
          make("booking", language, {
            heading: t("Vil du hellere tale med os?", "Rather talk it through?"),
            text: t("Book et gratis opkald på 20 minutter.", "Book a free 20-minute call."),
          }),
        ]),
      ]);

    case "booking":
      return doc([
        newStep(t("Book et møde", "Book a call"), "start", [
          make("hero", language, {
            heading: t("Book et gratis strategimøde", "Book a free strategy call"),
            text: t(
              "På 30 minutter gennemgår vi dine annoncer og giver dig tre konkrete forbedringer.",
              "In 30 minutes we review your ads and give you three concrete improvements.",
            ),
            buttonLabel: t("Find en tid", "Pick a time"),
            button: { target: "form", stepId: "", url: "" },
          }),
          make("text", language, {
            heading: t("Det får du ud af mødet", "What you get from the call"),
            text: t(
              "- En gennemgang af dine nuværende kampagner\n- Et bud på, hvad en kunde bør koste dig\n- En plan, du kan bruge med eller uden os",
              "- A review of your current campaigns\n- An estimate of what a customer should cost you\n- A plan you can use with or without us",
            ),
          }),
          make("booking", language, {}),
          testimonials(),
        ]),
      ]);

    case "offer": {
      const claim = newStep(t("Få tilbuddet", "Claim the offer"), t("tilbud", "claim"), [
        make("text", language, {
          heading: t("Næsten færdig", "Almost there"),
          text: t("Udfyld formularen, så kontakter vi dig inden for én arbejdsdag.", "Fill in the form and we'll contact you within one working day."),
          align: "center",
        }),
        make("form", language, { heading: "", afterSubmit: "form" }),
      ]);
      return doc([
        newStep(t("Tilbud", "Offer"), "start", [
          make("hero", language, {
            eyebrow: t("Kun i denne måned", "This month only"),
            heading: t("Første måned til halv pris", "Your first month at half price"),
            text: t("Vi sætter dine annoncer op og styrer dem for dig. Ingen binding.", "We set up and run your ads for you. No lock-in."),
            buttonLabel: t("Jeg vil have tilbuddet", "I want the offer"),
            button: { target: "step", stepId: claim.id, url: "" },
            layout: "split",
          }),
          make("text", language, {
            heading: t("Sådan virker det", "How it works"),
            text: t(
              "- Vi tager en snak om dine mål\n- Vi bygger kampagnerne\n- Du får en rapport hver måned",
              "- We talk about your goals\n- We build the campaigns\n- You get a report every month",
            ),
          }),
          testimonials(),
          make("cta", language, {
            heading: t("Klar til at komme i gang?", "Ready to get started?"),
            buttonLabel: t("Ja, giv mig tilbuddet", "Yes, give me the offer"),
            button: { target: "step", stepId: claim.id, url: "" },
          }),
        ]),
        claim,
      ]);
    }
  }
}

/** Fills empty form and booking blocks with the given ids. */
export function fillTemplateIds(doc: FunnelDoc, ids: { formId?: string | null; calendarId?: string | null }): FunnelDoc {
  return {
    ...doc,
    steps: doc.steps.map((step) => ({
      ...step,
      blocks: step.blocks.map((block) => {
        if (block.type === "form" && !block.formId && ids.formId) return { ...block, formId: ids.formId };
        if (block.type === "booking" && !block.calendarId && ids.calendarId) return { ...block, calendarId: ids.calendarId };
        return block;
      }),
    })),
  };
}

export const templateUsesForm = (doc: FunnelDoc) => doc.steps.some((s) => s.blocks.some((b) => b.type === "form"));
