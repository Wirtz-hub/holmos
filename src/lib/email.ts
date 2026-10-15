import "server-only";
import { missingEmailSettings, serverEnv } from "@/lib/env";

// Sends email through Resend (resend.com). Without RESEND_API_KEY and
// EMAIL_FROM set, nothing is sent and callers carry on as normal.

export type EmailAttachment = { filename: string; content: string; contentType?: string };

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
  /** Resend ignores a repeat send with the same key for 24 hours. */
  idempotencyKey?: string;
};

export type SendResult = { sent: true } | { sent: false; reason: string };

export function isEmailConfigured() {
  return missingEmailSettings().length === 0;
}

export async function sendEmail(email: Email): Promise<SendResult> {
  const { resendApiKey, emailFrom } = serverEnv();
  if (!resendApiKey || !emailFrom) return { sent: false, reason: "Email isn't set up yet." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        ...(email.attachments?.length
          ? {
              attachments: email.attachments.map((a) => ({
                filename: a.filename,
                content: Buffer.from(a.content, "utf8").toString("base64"),
                ...(a.contentType ? { content_type: a.contentType } : {}),
              })),
            }
          : {}),
      }),
      cache: "no-store",
    });
    if (res.ok) return { sent: true };
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    console.error("Resend refused an email", res.status, body.message);
    return { sent: false, reason: body.message ?? `Resend answered ${res.status}` };
  } catch (error) {
    console.error("Couldn't reach Resend", error);
    return { sent: false, reason: "Couldn't reach Resend." };
  }
}
