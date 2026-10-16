import { after, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { checkAnswers, fieldsSchema } from "@/lib/forms/schema";
import { escapeHtml } from "@/lib/html";
import { publicText } from "@/lib/public-text";
import { json, looksLikeBot, readJson, visitorIpHash } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { appAddress } from "@/lib/urls";

// PUBLIC: a visitor sends a form. No login — the deliberate exception to
// requireAdmin(). Only active forms take answers; each answer creates or
// updates a client and lands in their activity log (see record_form_submission).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false }, 404);
  const body = await readJson(request);
  if (!body) return json({ ok: false, message: publicText("da").formError }, 400);

  const admin = createAdminClient();
  const { data: form } = await admin
    .from("forms")
    .select("id, name, fields, success_message, redirect_url, language, notify_email, is_active")
    .eq("id", id)
    .maybeSingle();
  const text = publicText(form?.language);
  if (!form || !form.is_active) return json({ ok: false, message: text.formClosed }, 410);

  const success = { ok: true, message: form.success_message, redirectUrl: form.redirect_url };
  // Pretend all is well, so bots learn nothing.
  if (looksLikeBot(body)) return json(success);

  const fields = fieldsSchema.safeParse(form.fields);
  if (!fields.success) return json({ ok: false, message: text.formError }, 500);
  const answers = body.answers && typeof body.answers === "object" ? (body.answers as Record<string, unknown>) : {};
  const checked = checkAnswers(fields.data, answers, form.language);
  if (!checked.ok) return json({ ok: false, errors: checked.errors }, 400);

  const sourceUrl = typeof body.sourceUrl === "string" && /^https?:\/\//.test(body.sourceUrl) ? body.sourceUrl.slice(0, 1000) : null;
  const { data, error } = await admin.rpc("record_form_submission", {
    p_form_id: form.id,
    p_contact: checked.contact,
    p_answers: checked.answers,
    p_source_url: sourceUrl,
    p_ip_hash: visitorIpHash(request),
  });
  if (error) {
    if (/rate_limited/.test(error.message)) return json({ ok: false, message: text.tooMany }, 429);
    if (/form_closed/.test(error.message)) return json({ ok: false, message: text.formClosed }, 410);
    console.error("Couldn't save a form submission", error.message);
    return json({ ok: false, message: text.formError }, 500);
  }

  if (form.notify_email) {
    // Your own forms link to the client record; a client's forms to the person on their contact list.
    const saved = data as { client_id: string | null; contact_id: string | null; owner_client_id: string | null };
    const record =
      saved.contact_id && saved.owner_client_id
        ? `Contact: ${appAddress(`/clients/${saved.owner_client_id}/contacts#contact-${saved.contact_id}`)}`
        : `Client record: ${appAddress(`/clients/${saved.client_id}`)}`;
    const lines = [...checked.answers.map((a) => `${a.label}: ${a.value}`), "", sourceUrl ? `Sent from: ${sourceUrl}` : "", record].filter(
      (line, i) => line !== "" || i === checked.answers.length,
    );
    const who = checked.contact.name ?? checked.contact.email ?? checked.contact.phone ?? "Someone";
    after(() =>
      sendEmail({
        to: form.notify_email,
        subject: `New answer to “${form.name}” from ${who}`,
        text: lines.join("\n"),
        html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(lines.join("\n"))}</div>`,
        replyTo: checked.contact.email,
      }),
    );
  }

  return json(success);
}
