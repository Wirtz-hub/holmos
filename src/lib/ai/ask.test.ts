import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { askAi } = await import("@/lib/ai/ask");

const request = { system: "s", message: "m", schema: { type: "object" }, maxTokens: 100, task: "do it", shorter: "less" };
const answer = (json: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] }, finishReason: "STOP" }] }), { status: 200 });
const status = (code: number) => new Response(JSON.stringify({ error: { message: "busy" } }), { status: code });

describe("askAi with Gemini", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const modelsAsked = () => fetchMock.mock.calls.map(([url]) => String(url).match(/models\/([^:]+):/)?.[1]);

  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("moves on to the next free model when one is overloaded", async () => {
    fetchMock.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(answer({ ok: true }));
    await expect(askAi("gemini", request)).resolves.toEqual({ ok: true });
    expect(modelsAsked()).toEqual(["gemini-3.8-flash", "gemini-3.6-flash"]);
  });

  it("says plainly when every free model is busy", async () => {
    fetchMock.mockImplementation(async () => status(503));
    await expect(askAi("gemini", request)).rejects.toThrow("All of Gemini's free models are overloaded");
    expect(modelsAsked()).toEqual(["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]);
  });

  it("stops at a bad key instead of trying other models", async () => {
    fetchMock.mockResolvedValueOnce(status(403));
    await expect(askAi("gemini", request)).rejects.toThrow("didn't accept the API key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tries GEMINI_MODEL first when it is set", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-custom");
    fetchMock.mockResolvedValueOnce(answer({ ok: 1 }));
    await askAi("gemini", request);
    expect(modelsAsked()).toEqual(["gemini-custom"]);
  });
});
