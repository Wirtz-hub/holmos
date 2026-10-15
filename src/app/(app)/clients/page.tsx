import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientTable, type ClientRow } from "@/components/client-table";
import { ButtonLink, PageHeader, PageSkeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Clients />
    </Suspense>
  );
}

async function Clients() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, contact_name, email, phone, stage, deal_value, currency, ad_accounts(count)")
    .order("name");
  if (error) throw new Error(error.message);

  const rows: ClientRow[] = (data ?? []).map(({ ad_accounts, ...client }) => ({
    ...client,
    adAccountCount: (ad_accounts as { count: number }[] | null)?.[0]?.count ?? 0,
  })) as ClientRow[];

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone in your pipeline, with their contact details and ad accounts."
        actions={
          <ButtonLink href="/clients/new">
            <Plus className="size-4" aria-hidden />
            Add client
          </ButtonLink>
        }
      />
      <ClientTable rows={rows} />
    </>
  );
}
