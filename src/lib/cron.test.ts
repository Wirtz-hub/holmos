import { afterEach, describe, expect, it, vi } from "vitest";
import { authorisedCron } from "@/lib/cron";

afterEach(() => vi.unstubAllEnvs());

function call(authorization?: string) {
  return authorisedCron(new Request("https://holmos.example/api/cron/ad-insights", { headers: authorization ? { authorization } : {} }));
}

describe("authorisedCron", () => {
  it("accepts only the configured bearer secret", () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    expect(call("Bearer correct-secret")).toBe(true);
    expect(call("Bearer wrong-secret")).toBe(false);
    expect(call("Bearer correct-secret-and-more")).toBe(false);
    expect(call("correct-secret")).toBe(false);
    expect(call()).toBe(false);
  });

  it("refuses every caller when the secret is not set", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(call("Bearer ")).toBe(false);
  });
});
