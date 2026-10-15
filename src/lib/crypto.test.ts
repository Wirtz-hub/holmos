import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const key = "a-test-key-that-is-at-least-32-characters-long";

describe("token encryption", () => {
  it("round-trips and never stores the plaintext", () => {
    const sealed = encryptSecret("EAAB-secret-token", key);
    expect(sealed).not.toContain("EAAB");
    expect(decryptSecret(sealed, key)).toBe("EAAB-secret-token");
  });
  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });
  it("rejects tampering and the wrong key", () => {
    const sealed = encryptSecret("token", key);
    const [v, iv, tag, data] = sealed.split(".");
    const flipped = data[0] === "A" ? `B${data.slice(1)}` : `A${data.slice(1)}`;
    expect(() => decryptSecret([v, iv, tag, flipped].join("."), key)).toThrow();
    expect(() => decryptSecret(sealed, `${key}-other`)).toThrow();
  });
  it("refuses a weak key", () => {
    expect(() => encryptSecret("token", "short")).toThrow(/32 characters/);
  });
});
