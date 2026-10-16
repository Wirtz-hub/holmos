import { ArrowLeft, Download, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContactList, type ContactRow } from "@/components/contacts/contact-list";
import { buttonClass, Card, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getClientOr404 } from "@/lib/data";

export const metadata: Metadata = { title: "Contacts" };

export default function ClientContactsPage({ params }: PageProps<"/clients/[id]/contacts">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/clients/[id]/contacts">["params"] }) {
  const { id } = await params;
  const client = await getClientOr404(id);
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, email, phone, company, created_at, contact_events(id, kind, body, meta, created_at)")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "contact_events", ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  const contacts: ContactRow[] = (data ?? []).map(({ contact_events, ...contact }) => ({
    ...contact,
    events: (contact_events ?? []) as ContactRow["events"],
  }));

  return (
    <>
      <PageHeader
        back={
          <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" aria-hidden /> {client.name}
          </Link>
        }
        title={`${client.name}: contacts`}
        description={`People who filled in a form on ${client.name}'s pages. They're not in your own pipeline.`}
        actions={
          contacts.length > 0 && (
            <a href={`/api/clients/${client.id}/contacts`} className={buttonClass("secondary")}>
              <Download className="size-4" aria-hidden /> Download for Excel
            </a>
          )
        }
      />
      <Card>
        {contacts.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title="No contacts yet">
            When someone fills in one of {client.name}&apos;s forms, they show up here. Make a page or form for {client.name} and choose them under
            &quot;Belongs to&quot;.
          </EmptyState>
        ) : (
          <ContactList contacts={contacts} />
        )}
      </Card>
    </>
  );
}
