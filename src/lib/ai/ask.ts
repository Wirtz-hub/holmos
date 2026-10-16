import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

// Asks Claude (Anthropic, paid per use) or Gemini (Google, free tier) for an
// answer in a fixed JSON shape. Used by the website writer and the lead
// finder; each gives its own instructions, schema and wording for errors.

export type AiProvider = "claude" | "gemini";

const CLAUDE_MODEL = "claude-opus-5-5";
const geminiModel = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

/** Which AIs have a key set. */
export function aiProviders(): Record<AiProvider, boolean> {
  const env = serverEnv();
  return { claude: Boolean(env.anthropicApiKey), gemini: Boolean(env.geminiApiKey) };
}

export class AiError extends Error {}

export type AiRequest = {
  system: string;
  message: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  /** What the AI is doing, for error messages, e.g. "write this website". */
  task: string;
  /** What to shorten when the answer runs too long, e.g. "a shorter description". */
  shorter: string;
};

async function askClaude(req: AiRequest): Promise<unknown> {
  const client = new Anthropic({ apiKey: serverEnv().anthropicApiKey, maxRetries: 1 });
  try {
    // Streamed so a long answer can't time out; only the final message is used.
    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.message }],
      output_config: { effort: "low", format: { type: "json_schema", schema: req.schema } },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new AiError(`Claude declined to ${req.task}. Try rewording it.`);
    if (message.stop_reason === "max_tokens") throw new AiError(`Claude's answer was too long. Try ${req.shorter}.`);
    const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof SyntaxError) throw new AiError("Claude's answer couldn't be read. Try again.");
    if (error instanceof Anthropic.AuthenticationError) throw new AiError("Claude didn't accept the API key. Check ANTHROPIC_API_KEY in Vercel.");
    if (error instanceof Anthropic.PermissionDeniedError) {
      throw new AiError("The Anthropic key isn't allowed to use Claude. Check the key's workspace in the Anthropic Console.");
    }
    if (error instanceof Anthropic.RateLimitError) throw new AiError("Claude is getting too many requests right now. Try again in a minute.");
    if (error instanceof Anthropic.BadRequestError) throw new AiError(`Claude couldn't do it: ${error.message}`);
    if (error instanceof Anthropic.APIError) throw new AiError(`Claude had a problem (${error.status ?? "no answer"}). Try again in a moment.`);
    throw error;
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

async function askGemini(req: AiRequest): Promise<unknown> {
  const call = (withSchema: boolean) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": serverEnv().geminiApiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [
          {
            role: "user",
            parts: [{ text: withSchema ? req.message : `${req.message}\n\nAnswer with JSON matching this JSON Schema:\n${JSON.stringify(req.schema)}` }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          ...(withSchema ? { responseJsonSchema: req.schema } : {}),
          maxOutputTokens: req.maxTokens,
        },
      }),
    });

  let res: Response;
  try {
    res = await call(true);
    // A model that won't take the schema field gets the schema in the message instead.
    if (res.status === 400) res = await call(false);
  } catch {
    throw new AiError("Couldn't reach Gemini. Try again in a moment.");
  }
  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (res.status === 429) {
    throw new AiError("Gemini's free limit is used up for now. Wait a minute (or until tomorrow) and try again, or use Claude.");
  }
  if (res.status === 401 || res.status === 403) throw new AiError("Gemini didn't accept the API key. Check GEMINI_API_KEY in Vercel.");
  if (res.status === 404) throw new AiError(`Gemini doesn't know the model "${geminiModel()}". Set GEMINI_MODEL to a current model name.`);
  if (!res.ok) throw new AiError(`Gemini had a problem (${res.status}${body.error?.message ? `: ${body.error.message}` : ""}).`);
  if (body.promptFeedback?.blockReason) throw new AiError(`Gemini declined to ${req.task}. Try rewording it.`);

  const candidate = body.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") throw new AiError(`Gemini's answer was too long. Try ${req.shorter}.`);
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && part.text)
    .map((part) => part.text)
    .join("");
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AiError("Gemini's answer couldn't be read. Try again.");
  }
}

/** Asks the chosen AI and returns its parsed JSON answer (not yet checked against the schema). */
export async function askAi(provider: AiProvider, req: AiRequest): Promise<unknown> {
  if (!aiProviders()[provider]) {
    throw new AiError(
      provider === "claude" ? "Claude isn't set up yet. Add ANTHROPIC_API_KEY (see SETUP.md)." : "Gemini isn't set up yet. Add GEMINI_API_KEY (see SETUP.md).",
    );
  }
  return provider === "claude" ? askClaude(req) : askGemini(req);
}
