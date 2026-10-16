import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmbedCode } from "@/components/embed-code";
import { FormBuilder } from "@/components/forms/form-builder";
import { Card, PageSkeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { FormField } from "@/lib/forms/schema";
import type { Stage } from "@/lib/types";
import { appAddress } from "@/lib/urls";

export const metadata: Metadata = { title: "Form" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function FormPage({ params }: PageProps<"/forms/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

type Submission = {
  id: string;
  client_id: string | null;
  contact_id: string | null;
  answers: { label: string; value: string }[];
  source_url: string | null;
  created_at: string;
  clients: { name: string } | null;
  contacts: { name: string | null; email: string | null; client_id: string } | null;
};

async function Content({ params }: { params: PageProps<"/forms/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [formResult, submissionsResult, clientsResult] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("form_submissions")
      .select("id, client_id, contact_id, answers, source_url, created_at, clients(name), contacts(name, email, client_id)", { count: "exact" })
      .eq("form_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  if (formResult.error) throw new Error(formResult.error.message);
  const form = formResult.data;
  if (!form) notFound();
  const submissions = (submissionsResult.data ?? []) as unknown as Submission[];

  const app = appAddress("");
  const share = (
    <EmbedCode
      intro="Paste one of these into the website's HTML. In WordPress, Wix, Squarespace or Webflow, use an “HTML” or “Embed code” block."
      snippets={[
        {
          title: "Script (recommended)",
          description: "Fits the form into the page and adjusts its height automatically. If you set a thank-you page, visitors go there.",
          code: `<script src="${app}/embed/form.js" data-form="${form.id}" async></script>`,
        },
        {
          title: "Iframe",
          description: "For website builders that don't allow scripts. Set the height to fit your questions.",
          code: `<iframe src="${app}/embed/form/${form.id}" style="width:100%;height:560px;border:0" title="${form.name.replace(/"/g, "&quot;")}"></iframe>`,
        },
        {
          title: "Link",
          description: "The form on its own page, e.g. for an email or a social media post.",
          code: `${app}/embed/form/${form.id}`,
        },
      ]}
    />
  );

  const answers = (
    <Card className="max-w-4xl">
      {submissions.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">No answers yet. They show up here, and in each client&apos;s activity log.</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {submissions.map((submission) => (
            <li key={submission.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {submission.contacts ? (
                  <Link
                    href={`/clients/${submission.contacts.client_id}/contacts#contact-${submission.contact_id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-brand-700"
                  >
                    {submission.contacts.name ?? submission.contacts.email ?? "Contact"}
                  </Link>
                ) : submission.client_id ? (
                  <Link href={`/clients/${submission.client_id}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700">
                    {submission.clients?.name ?? "Client"}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-slate-500">Deleted</span>
                )}
                <time dateTime={submission.created_at} className="text-xs text-slate-400 tabular">
                  {formatDateTime(submission.created_at)}
                </time>
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
                {submission.answers.map((answer, i) => (
                  <div key={i} className="contents">
                    <dt className="text-slate-500">{answer.label}</dt>
                    <dd className="break-words whitespace-pre-wrap text-slate-800">{answer.value}</dd>
                  </div>
                ))}
              </dl>
              {submission.source_url && <p className="mt-2 truncate text-xs text-slate-400">From {submission.source_url}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );

  return (
    <FormBuilder
      initial={{
        id: form.id,
        name: form.name,
        fields: form.fields as FormField[],
        submit_label: form.submit_label,
        success_message: form.success_message,
        redirect_url: form.redirect_url ?? "",
        language: form.language,
        lead_stage: form.lead_stage as Stage,
        notify_email: form.notify_email ?? "",
        is_active: form.is_active,
        client_id: form.client_id ?? "",
      }}
      clients={(clientsResult.data ?? []) as { id: string; name: string }[]}
      answerCount={submissionsResult.count ?? submissions.length}
      share={share}
      answers={answers}
    />
  );
}
