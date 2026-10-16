import "server-only";
import { AiError, askAi, type AiProvider } from "@/lib/ai/ask";
import { readWebsite } from "@/lib/ai/read-website";
import type { Lead, LeadPitch, LeadScore, WebsiteCheck } from "@/lib/leads/types";

// Has the AI read a found business's website, name the person to contact if
// the site says who that is, and write a first message from HolmNordic.

const str = (description: string) => ({ type: "string", description });

// Both AIs take plain strings most reliably; "" means "not known".
const PITCH_SCHEMA = {
  type: "object",
  properties: {
    contactName: str("Full name of the owner, manager or marketing person, exactly as written on the website. Empty string if the website doesn't name anyone."),
    contactRole: str("That person's role as written on the website, e.g. 'Ejer' or 'Klinikchef'. Empty string if unknown."),
    contactEmail: str("That person's own email if the website shows it, otherwise the best general email from the website. Empty string if none."),
    summary: str("One sentence on what the business does and for whom."),
    angle: str("One or two sentences: the single most convincing reason this business would benefit from HolmNordic's help, based only on the facts given."),
    subject: str("Email subject line, max 60 characters, no clickbait."),
    opener: str("A short first email (60–110 words) from Frederik at HolmNordic. Personal, specific to this business, one clear observation, one soft question at the end. No made-up numbers or promises. No sign-off name block."),
  },
  required: ["contactName", "contactRole", "contactEmail", "summary", "angle", "subject", "opener"],
  additionalProperties: false,
};

const SYSTEM = `You help HolmNordic, a small marketing agency, reach out to local businesses.
HolmNordic runs Meta (Facebook/Instagram) and Google ads, builds websites and landing pages, and sets up booking and lead forms.
You get facts about one business: its map listing, an automatic check of its website, and the website's own text.
Use only these facts. Never invent names, numbers, reviews or problems. If the website doesn't name a person, contactName is an empty string.
Write the email in the language of the business's country (e.g. Danish for Denmark, Swedish for Sweden, English otherwise), in a natural, friendly and direct tone.`;

function factsMessage(lead: Lead, check: WebsiteCheck | null, score: LeadScore, siteText: string | null) {
  const lines = [
    `Business: ${lead.name}`,
    lead.category && `Category: ${lead.category}`,
    lead.address && `Address: ${lead.address}`,
    lead.phone && `Phone: ${lead.phone}`,
    lead.rating !== null && `Google rating: ${lead.rating} from ${lead.reviews ?? 0} reviews`,
    `Website: ${check?.url ?? lead.website ?? "none listed"}`,
  ];
  if (check?.status === "ok") {
    lines.push(
      `Website check: ${[
        check.mobileFriendly ? "made for phones" : "NOT made for phones",
        check.metaPixel ? "has Meta pixel" : "no Meta pixel",
        check.googleTag ? "has Google tag" : "no Google tag",
        check.googleAds ? "has Google Ads tag" : "no Google Ads tag",
        check.builder && `built with ${check.builder}`,
        check.copyrightYear && `copyright ${check.copyrightYear}`,
      ]
        .filter(Boolean)
        .join(", ")}`,
    );
    if (check.emails.length) lines.push(`Emails on website: ${check.emails.join(", ")}`);
  }
  if (score.reasons.length) lines.push(`Why it may need help: ${score.reasons.join("; ")}`);
  if (siteText) lines.push("", "Website text:", siteText);
  return lines.filter(Boolean).join("\n");
}

function parsePitch(raw: unknown): LeadPitch | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = (key: string) => (typeof r[key] === "string" && (r[key] as string).trim() ? (r[key] as string).trim() : null);
  const pitch = {
    contactName: text("contactName"),
    contactRole: text("contactRole"),
    contactEmail: text("contactEmail")?.toLowerCase() ?? null,
    summary: text("summary") ?? "",
    angle: text("angle") ?? "",
    subject: text("subject") ?? "",
    opener: text("opener") ?? "",
  };
  if (pitch.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pitch.contactEmail)) pitch.contactEmail = null;
  return pitch.opener ? pitch : null;
}

export async function writePitch(provider: AiProvider, lead: Lead, check: WebsiteCheck | null, score: LeadScore): Promise<LeadPitch> {
  let siteText: string | null = null;
  const address = check?.status === "ok" ? check.url : null;
  if (address) {
    try {
      siteText = (await readWebsite(address)).text.slice(0, 20_000);
    } catch {
      // Write from the listing and the check alone.
    }
  }
  const raw = await askAi(provider, {
    system: SYSTEM,
    message: factsMessage(lead, check, score, siteText),
    schema: PITCH_SCHEMA,
    maxTokens: 4000,
    task: "write this message",
    shorter: "again",
  });
  const pitch = parsePitch(raw);
  if (!pitch) throw new AiError("The AI's answer was missing the message. Try again.");
  return pitch;
}
