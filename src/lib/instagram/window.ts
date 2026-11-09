/** Instagram's standard messaging window. A reply is allowed for 24 hours after their last message. */
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

export type WindowState = {
  open: boolean;
  closesAt: string | null;
  error: string | null;
};

const CLOSED =
  "This reply is outside Instagram's 24-hour window. Instagram only lets you message someone within 24 hours of their last message. You can send it after they write again.";

const NEVER_OPENED =
  "Instagram only allows a reply within 24 hours of this person's last message, and there's no incoming message on this chat yet.";

export function messagingWindow(lastInboundAt: string | null | undefined, now = Date.now()): WindowState {
  if (!lastInboundAt) return { open: false, closesAt: null, error: NEVER_OPENED };
  const inbound = new Date(lastInboundAt).getTime();
  if (!Number.isFinite(inbound)) {
    return { open: false, closesAt: null, error: "Instagram's 24-hour reply window can't be checked for this chat." };
  }
  const closesAt = new Date(inbound + MESSAGING_WINDOW_MS).toISOString();
  if (now > inbound + MESSAGING_WINDOW_MS) return { open: false, closesAt, error: CLOSED };
  return { open: true, closesAt, error: null };
}

/** Meta's own wording when a send lands outside the window. */
export function outsideWindowMessage(apiMessage: string, subcode?: number) {
  if (subcode === 2534022 || subcode === 2018278 || /outside of allowed window/i.test(apiMessage)) return CLOSED;
  return null;
}
