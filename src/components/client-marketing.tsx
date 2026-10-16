import { ClipboardList, LayoutTemplate, Plus, Users } from "lucide-react";
import Link from "next/link";
import { ButtonLink, Card, CardHeader, cx } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

/** On a client's page: the pages and forms you've made for them, and their contact list. */
export async function ClientMarketing({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { supabase } = await requireAdmin();
  const [contacts, funnels, forms] = await Promise.all([
    supabase.from("contacts").select("id, name, email", { count: "exact" }).eq("client_id", clientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("funnels").select("id, name, published").eq("client_id", clientId).order("name"),
    supabase.from("forms").select("id, name, is_active").eq("client_id", clientId).order("name"),
  ]);
  const contactCount = contacts.count ?? 0;
  const pages = funnels.data ?? [];
  const clientForms = forms.data ?? [];

  return (
    <Card>
      <CardHeader
        title="Their website and leads"
        description={`Pages and forms you've made for ${clientName}. People who fill them in go on ${clientName}'s own contact list.`}
        action={
          <ButtonLink href={`/funnels/new?client=${clientId}`} variant="secondary" size="sm">
            <Plus className="size-4" aria-hidden /> New page
          </ButtonLink>
        }
      />
      <div className="grid gap-5 p-5 sm:grid-cols-3">
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <Users className="size-3.5" aria-hidden /> Contacts
          </h3>
          <p className="text-2xl font-semibold text-slate-900 tabular">{contactCount}</p>
          {(contacts.data ?? []).map((c) => (
            <p key={c.id} className="truncate text-sm text-slate-600">
              {c.name ?? c.email}
            </p>
          ))}
          <Link href={`/clients/${clientId}/contacts`} className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
            Open contact list
          </Link>
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <LayoutTemplate className="size-3.5" aria-hidden /> Pages
          </h3>
          {pages.length === 0 ? (
            <p className="text-sm text-slate-500">None yet.</p>
          ) : (
            <ul className="space-y-1">
              {pages.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className={cx("size-2 shrink-0 rounded-full", p.published ? "bg-emerald-500" : "bg-slate-300")} title={p.published ? "Live" : "Draft"} />
                  <Link href={`/funnels/${p.id}`} className="truncate text-slate-700 hover:text-brand-700">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <ClipboardList className="size-3.5" aria-hidden /> Forms
          </h3>
          {clientForms.length === 0 ? (
            <p className="text-sm text-slate-500">None yet.</p>
          ) : (
            <ul className="space-y-1">
              {clientForms.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-sm">
                  <span className={cx("size-2 shrink-0 rounded-full", f.is_active ? "bg-emerald-500" : "bg-slate-300")} title={f.is_active ? "Taking answers" : "Switched off"} />
                  <Link href={`/forms/${f.id}`} className="truncate text-slate-700 hover:text-brand-700">
                    {f.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
