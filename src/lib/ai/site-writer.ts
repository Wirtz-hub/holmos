import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { parseSiteAnswer, SITE_JSON_SCHEMA, SITE_SYSTEM_PROMPT, siteBriefMessage, type SiteBrief } from "@/lib/ai/site-answer";
import { serverEnv } from "@/lib/env";
import type { SiteContent } from "@/lib/funnels/website-templates";

// Writes a website's words with AI: Claude (Anthropic, paid per use) or
// Gemini (Google, free tier). Both get the same instructions and answer in
// the same JSON shape, which buildSite() then lays out as pages.

export type AiProvider = "claude" | "gemini";

const CLAUDE_MODEL = "claude-opus-5-5";
const geminiModel = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

/** Which AIs have a key set. */
export function aiProviders(): Record<AiProvider, boolean> {
  const env = serverEnv();
  return { claude: Boolean(env.anthropicApiKey), gemini: Boolean(env.geminiApiKey) };
}

export class SiteWriterError extends Error {}

async function askClaude(brief: SiteBrief): Promise<unknown> {
  const client = new Anthropic({ apiKey: serverEnv().anthropicApiKey, maxRetries: 1 });
  try {
    // Streamed so a long answer can't time out; only the final message is used.
    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 32000,
      system: SITE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: siteBriefMessage(brief) }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SITE_JSON_SCHEMA } },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new SiteWriterError("Claude declined to write this website. Try rewording the description.");
    if (message.stop_reason === "max_tokens") throw new SiteWriterError("Claude's answer was too long. Try a shorter description.");
    const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SiteWriterError) throw error;
    if (error instanceof SyntaxError) throw new SiteWriterError("Claude's answer couldn't be read. Try again.");
    if (error instanceof Anthropic.AuthenticationError) throw new SiteWriterError("Claude didn't accept the API key. Check ANTHROPIC_API_KEY in Vercel.");
    if (error instanceof Anthropic.PermissionDeniedError) {
      throw new SiteWriterError("The Anthropic key isn't allowed to use Claude. Check the key's workspace in the Anthropic Console.");
    }
    if (error instanceof Anthropic.RateLimitError) throw new SiteWriterError("Claude is getting too many requests right now. Try again in a minute.");
    if (error instanceof Anthropic.BadRequestError) throw new SiteWriterError(`Claude couldn't do it: ${error.message}`);
    if (error instanceof Anthropic.APIError) throw new SiteWriterError(`Claude had a problem (${error.status ?? "no answer"}). Try again in a moment.`);
    throw error;
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

async function askGemini(brief: SiteBrief): Promise<unknown> {
  const call = (withSchema: boolean) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": serverEnv().geminiApiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SITE_SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: withSchema
                  ? siteBriefMessage(brief)
                  : `${siteBriefMessage(brief)}\n\nAnswer with JSON matching this JSON Schema:\n${JSON.stringify(SITE_JSON_SCHEMA)}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          ...(withSchema ? { responseJsonSchema: SITE_JSON_SCHEMA } : {}),
          maxOutputTokens: 32768,
        },
      }),
    });

  let res: Response;
  try {
    res = await call(true);
    // A model that won't take the schema field gets the schema in the message instead.
    if (res.status === 400) res = await call(false);
  } catch {
    throw new SiteWriterError("Couldn't reach Gemini. Try again in a moment.");
  }
  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (res.status === 429) {
    throw new SiteWriterError("Gemini's free limit is used up for now. Wait a minute (or until tomorrow) and try again, or use Claude.");
  }
  if (res.status === 401 || res.status === 403) throw new SiteWriterError("Gemini didn't accept the API key. Check GEMINI_API_KEY in Vercel.");
  if (res.status === 404) throw new SiteWriterError(`Gemini doesn't know the model "${geminiModel()}". Set GEMINI_MODEL to a current model name.`);
  if (!res.ok) throw new SiteWriterError(`Gemini had a problem (${res.status}${body.error?.message ? `: ${body.error.message}` : ""}).`);
  if (body.promptFeedback?.blockReason) throw new SiteWriterError("Gemini declined to write this website. Try rewording the description.");

  const candidate = body.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") throw new SiteWriterError("Gemini's answer was too long. Try a shorter description.");
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && part.text)
    .map((part) => part.text)
    .join("");
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new SiteWriterError("Gemini's answer couldn't be read. Try again.");
  }
}

/** Asks the chosen AI to write the website. */
export async function writeSite(provider: AiProvider, brief: SiteBrief): Promise<SiteContent> {
  if (!aiProviders()[provider]) {
    throw new SiteWriterError(
      provider === "claude" ? "Claude isn't set up yet. Add ANTHROPIC_API_KEY (see SETUP.md)." : "Gemini isn't set up yet. Add GEMINI_API_KEY (see SETUP.md).",
    );
  }
  const raw = provider === "claude" ? await askClaude(brief) : await askGemini(brief);
  const content = parseSiteAnswer(raw, brief);
  if (!content) throw new SiteWriterError("The AI's answer was missing parts of the website. Try again.");
  return content;
}
