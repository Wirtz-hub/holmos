import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { AdAccount, Client } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getClientOr404(id: string): Promise<Client> {
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return { ...data, deal_value: data.deal_value === null ? null : Number(data.deal_value) } as Client;
}

export type AccountWithClient = AdAccount & { client_name: string | null };

export async function listAdAccounts(): Promise<AccountWithClient[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("ad_accounts")
    .select("*, clients(name)")
    .order("platform")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(({ clients, ...account }) => ({
    ...(account as AdAccount),
    client_name: (clients as { name: string } | null)?.name ?? null,
  }));
}
