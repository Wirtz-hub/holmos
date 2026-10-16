import "server-only";
import { AiError, askAi, type AiProvider } from "@/lib/ai/ask";
import { parseSiteAnswer, SITE_JSON_SCHEMA, SITE_SYSTEM_PROMPT, siteBriefMessage, type SiteBrief } from "@/lib/ai/site-answer";
import type { SiteContent } from "@/lib/funnels/website-templates";

// Writes a website's words with AI: Claude (Anthropic, paid per use) or
// Gemini (Google, free tier). Both get the same instructions and answer in
// the same JSON shape, which buildSite() then lays out as pages.

export { aiProviders, type AiProvider } from "@/lib/ai/ask";
export { AiError as SiteWriterError } from "@/lib/ai/ask";

/** Asks the chosen AI to write the website. */
export async function writeSite(provider: AiProvider, brief: SiteBrief): Promise<SiteContent> {
  const raw = await askAi(provider, {
    system: SITE_SYSTEM_PROMPT,
    message: siteBriefMessage(brief),
    schema: SITE_JSON_SCHEMA,
    maxTokens: 32000,
    task: "write this website",
    shorter: "a shorter description",
  });
  const content = parseSiteAnswer(raw, brief);
  if (!content) throw new AiError("The AI's answer was missing parts of the website. Try again.");
  return content;
}
