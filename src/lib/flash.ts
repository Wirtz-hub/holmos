// One-time messages carried across a redirect (e.g. back from Meta/Google).
// The cookie is read and cleared by <FlashMessage /> in the browser.

export const FLASH_COOKIE = "holmos_flash";

export type Flash = { kind: "success" | "error"; message: string };

export function encodeFlash(flash: Flash) {
  return encodeURIComponent(JSON.stringify(flash));
}

export function decodeFlash(raw: string | undefined): Flash | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw));
    if ((value.kind === "success" || value.kind === "error") && typeof value.message === "string") {
      return { kind: value.kind, message: value.message.slice(0, 400) };
    }
  } catch {
    // Ignore malformed cookies.
  }
  return null;
}
