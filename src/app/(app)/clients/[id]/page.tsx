import { ArrowLeft, ChartColumn, Globe, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityLog } from "@/components/activity-log";
import { ClientAdAccounts } from "@/components/client-ad-accounts";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { StageSelect } from "@/components/stage-select";
import { ButtonLink, Card, CardHeader, PageHeader, PageSkeleton } from "@/components/ui";
import { updateClientAction } from "@/lib/actions/clients";
import { requireAdmin } from "@/lib/auth";
import { getClientOr404, listAdAccounts } from "@/lib/data";
import type { Activity } from "@/lib/types";

export const metadata: Metadata = { title: "Client" };

export default function ClientPage({ params }: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientDetail params={params} />
    </Suspense>
  );
}

function websiteHref(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

async function ClientDetail({ params }: { params: PageProps<"/clients/[id]">["params"] }) {
  const { id } = await params;
  const client = await getClientOr404(id);
  const { supabase } = await requireAdmin();

  const [activitiesResult, accounts] = await Promise.all([
    supabase.from("activities").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(200),
    listAdAccounts(),
  ]);
  const activities = (activitiesResult.data ?? []) as Activity[];

  const contactLinks = [
    client.email && { href: `mailto:${client.email}`, label: client.email, icon: Mail },
    client.phone && { href: `tel:${client.phone.replace(/\s/g, "")}`, label: client.phone, icon: Phone },
    client.website && { href: websiteHref(client.website), label: client.website.replace(/^https?:\/\//i, ""), icon: Globe },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Mail }[];

  return (
    <>
      <PageHeader
        back={
          <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" aria-hidden /> Clients
          </Link>
        }
        title={client.name}
        description={
          contactLinks.length > 0 || client.contact_name ? (
            <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {client.contact_name && <span className="text-slate-600">{client.contact_name}</span>}
              {contactLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-brand-700"
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </a>
              ))}
            </span>
          ) : undefined
        }
        actions={
          <>
            <StageSelect clientId={client.id} stage={client.stage} />
            <ButtonLink href={`/clients/${client.id}/dashboard`} variant="secondary">
              <ChartColumn className="size-4" aria-hidden />
              Ad dashboard
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Details" />
            <div className="p-5">
              <ClientForm action={updateClientAction.bind(null, client.id)} client={client} submitLabel="Save changes" />
            </div>
          </Card>

          <ClientAdAccounts clientId={client.id} accounts={accounts} />

          <Card className="border-rose-100">
            <CardHeader
              title="Delete client"
              description="Removes the client, their notes and activity. Their ad accounts stay connected and become unassigned."
              action={<DeleteClientButton clientId={client.id} name={client.name} />}
            />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <ActivityLog clientId={client.id} activities={activities} />
        </div>
      </div>
    </>
  );
}
