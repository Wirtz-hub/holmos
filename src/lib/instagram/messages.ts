export type Attachment = { type: string; url: string | null };

export type Direction = "inbound" | "outbound";

const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

export function normaliseUsername(value: string | null | undefined) {
  const raw = value?.trim().replace(/^@/, "") ?? "";
  return USERNAME.test(raw) ? raw : null;
}

export function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const asNumber = Number(trimmed);
      const ms = asNumber < 1e12 ? asNumber * 1000 : asNumber;
      return new Date(ms).toISOString();
    }
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

export function directionFromIds(
  senderId: string | undefined,
  igUserId: string,
  pageId: string,
  isEcho = false,
): Direction {
  if (isEcho) return "outbound";
  if (senderId && (senderId === igUserId || senderId === pageId)) return "outbound";
  return "inbound";
}

export function snippetFor(text: string | null, attachments: Attachment[]) {
  const trimmed = text?.replace(/\s+/g, " ").trim();
  if (trimmed) return trimmed.slice(0, 140);
  if (attachments[0]) return `[${attachments[0].type}]`;
  return null;
}

/** Instagram text messages are limited to 1,000 bytes. Returns an error, or null when the text is fine. */
export function draftTextError(text: string) {
  const body = text.trim();
  if (!body) return "Write a message first.";
  if (Buffer.byteLength(body, "utf8") > 1000) {
    return "Instagram only accepts a reply of up to 1,000 bytes. Shorten it and try again.";
  }
  return null;
}

type LooseAttachment = {
  type?: string;
  mime_type?: string;
  file_url?: string;
  name?: string;
  payload?: { url?: string };
  image_data?: { url?: string };
};

function asAttachments(raw: unknown): LooseAttachment[] {
  if (Array.isArray(raw)) return raw.filter((item): item is LooseAttachment => Boolean(item) && typeof item === "object");
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: LooseAttachment[] }).data;
  }
  return [];
}

export function normaliseAttachments(raw: unknown): Attachment[] {
  return asAttachments(raw).map((item) => {
    const url = item.payload?.url ?? item.image_data?.url ?? item.file_url ?? null;
    const type = item.type ?? (item.mime_type ? item.mime_type.split("/")[0] : "file");
    return { type: type || "file", url: typeof url === "string" && url ? url : null };
  });
}

export type Participant = { id: string; username?: string | null; name?: string | null };

/** The other person in a thread. The professional account and its Page are not them. */
export function otherParticipant(participants: Participant[], igUserId: string, pageId: string) {
  const others = participants.filter((person) => person.id && person.id !== igUserId && person.id !== pageId);
  if (others.length) return others[0];
  if (participants.length === 1 && participants[0].id && participants[0].id !== igUserId) return participants[0];
  return null;
}

export function later(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}
