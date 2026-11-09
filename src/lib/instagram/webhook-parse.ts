import {
  directionFromIds,
  normaliseAttachments,
  toIsoTimestamp,
  type Attachment,
  type Direction,
} from "@/lib/instagram/messages";

export type ParsedMessage = {
  igUserId: string;
  participantId: string;
  direction: Direction;
  externalId: string;
  text: string | null;
  attachments: Attachment[];
  sentAt: string;
  deleted: boolean;
};

export type ParsedRead = {
  igUserId: string;
  participantId: string;
  messageId: string;
  at: string;
};

export type ParsedWebhook = {
  messages: ParsedMessage[];
  reads: ParsedRead[];
};

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: unknown;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    attachments?: unknown;
  };
  read?: { mid?: string };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Pull messages and read receipts out of an Instagram webhook body.
 * Anything that isn't a message or a read (reactions, referrals, handoffs) is ignored.
 */
export function parseInstagramWebhook(body: unknown): ParsedWebhook {
  const root = asRecord(body);
  const messages: ParsedMessage[] = [];
  const reads: ParsedRead[] = [];
  if (!root || root.object !== "instagram" || !Array.isArray(root.entry)) return { messages, reads };

  for (const entryValue of root.entry) {
    const entry = asRecord(entryValue);
    const igUserId = typeof entry?.id === "string" ? entry.id : "";
    if (!igUserId || !Array.isArray(entry?.messaging)) continue;

    for (const eventValue of entry.messaging) {
      const event = eventValue as MessagingEvent;
      const senderId = event.sender?.id;
      const recipientId = event.recipient?.id;
      const sentAt = toIsoTimestamp(event.timestamp) ?? new Date().toISOString();
      if (!senderId || !recipientId) continue;

      if (event.read?.mid) {
        const participantId = senderId === igUserId ? recipientId : senderId;
        if (participantId !== igUserId) {
          reads.push({ igUserId, participantId, messageId: event.read.mid, at: sentAt });
        }
        continue;
      }

      const mid = event.message?.mid;
      if (!mid) continue;
      const direction = directionFromIds(senderId, igUserId, "", Boolean(event.message?.is_echo));
      const participantId = direction === "outbound" ? recipientId : senderId;
      if (!participantId || participantId === igUserId) continue;

      let attachments = normaliseAttachments(event.message?.attachments);
      if (event.message?.is_unsupported) attachments = [{ type: "unsupported", url: null }, ...attachments];
      if (event.message?.is_deleted) attachments = [{ type: "deleted", url: null }];

      messages.push({
        igUserId,
        participantId,
        direction,
        externalId: mid,
        text: event.message?.is_deleted ? null : (event.message?.text ?? null),
        attachments,
        sentAt,
        deleted: Boolean(event.message?.is_deleted),
      });
    }
  }

  return { messages, reads };
}
