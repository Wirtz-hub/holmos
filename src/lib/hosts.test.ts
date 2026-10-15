import { describe, expect, it } from "vitest";
import { customDomainFor, DOMAIN_PATTERN, isPassThroughPath, normaliseDomain } from "@/lib/hosts";

const APP = "https://holmos-goz5.vercel.app";

describe("custom domains", () => {
  it("treats HolmOS's own addresses as the app", () => {
    expect(customDomainFor("holmos-goz5.vercel.app", APP)).toBeNull();
    expect(customDomainFor("holmos-git-preview-holm2.vercel.app", APP)).toBeNull();
    expect(customDomainFor("localhost:3000", APP)).toBeNull();
    expect(customDomainFor("127.0.0.1:3000", APP)).toBeNull();
    expect(customDomainFor("os.holmnordic.dk", "https://os.holmnordic.dk")).toBeNull();
    expect(customDomainFor(null, APP)).toBeNull();
  });

  it("recognises a client's domain", () => {
    expect(customDomainFor("Tilbud.Example.dk", APP)).toBe("tilbud.example.dk");
    expect(customDomainFor("tilbud.example.dk:443", APP)).toBe("tilbud.example.dk");
    expect(customDomainFor("tilbud.example.dk", undefined)).toBe("tilbud.example.dk");
  });

  it("lets form and booking requests through to HolmOS on a custom domain", () => {
    expect(isPassThroughPath("/api/public/forms/abc")).toBe(true);
    expect(isPassThroughPath("/_next/static/chunk.js")).toBe(true);
    expect(isPassThroughPath("/clients")).toBe(false);
    expect(isPassThroughPath("/tak")).toBe(false);
  });

  it("cleans up what people type as a domain", () => {
    expect(normaliseDomain(" https://Tilbud.Example.dk/side?x=1 ")).toBe("tilbud.example.dk");
    expect(DOMAIN_PATTERN.test("tilbud.example.dk")).toBe(true);
    expect(DOMAIN_PATTERN.test("example")).toBe(false);
    expect(DOMAIN_PATTERN.test("-bad.example.dk")).toBe(false);
  });
});
