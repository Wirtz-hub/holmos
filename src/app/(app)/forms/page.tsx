import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewItemForm } from "@/components/new-item-form";
import { ButtonLink, Card, cx, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { createFormAction } from "@/lib/actions/forms";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Forms" };

export default function FormsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Forms />
    </Suspense>
  );
}

async function Forms() {
  const { supabase } = await requireAdmin();
  const [formsResult, latestResult, clientsResult] = await Promise.all([
    supabase.from("forms").select("id, name, is_active, updated_at, clients(name), form_submissions(count)").order("name"),
    supabase.from("form_submissions").select("form_id, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  if (formsResult.error) throw new Error(formsResult.error.message);
  const latest = new Map<string, string>();
  for (const row of latestResult.data ?? []) if (!latest.has(row.form_id)) latest.set(row.form_id, row.created_at);
  const forms = (formsResult.data ?? []).map(({ form_submissions, clients, ...form }) => ({
    ...form,
    owner: (clients as unknown as { name: string } | null)?.name ?? null,
    answers: (form_submissions as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Forms"
        description="Use them on your pages or on any website. Answers to your own forms become leads in your pipeline; answers to a client's form go on that client's contact list."
      />
      <div className="mb-6">
        <NewItemForm
          action={createFormAction}
          buttonLabel="New form"
          placeholder="e.g. Contact form"
          withLanguage
          clients={(clientsResult.data ?? []) as { id: string; name: string }[]}
        />
      </div>
      {forms.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardList className="size-5" />} title="No forms yet">
            Make one above. It starts with name, email, phone and message — change the questions as you like.
          </EmptyState>
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {forms.map((form) => (
            <div key={form.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <Link href={`/forms/${form.id}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700">
                  {form.name}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  {form.owner ? `For ${form.owner} · ` : ""}
                  {form.answers === 1 ? "1 answer" : `${form.answers} answers`}
                  {latest.get(form.id) && ` · latest ${formatDateTime(latest.get(form.id)!)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-medium", form.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                  {form.is_active ? "Taking answers" : "Switched off"}
                </span>
                <ButtonLink href={`/forms/${form.id}`} variant="secondary" size="sm">
                  Edit
                </ButtonLink>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
