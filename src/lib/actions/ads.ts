"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { refreshConnectionAccounts } from "@/lib/ads/connections";
import { AdPlatformError } from "@/lib/ads/types";

const idSchema = z.uuid();

/** Assign (or unassign, with null) an ad account to a client. No reconnecting needed. */
export async function assignAdAccountAction(accountId: string, clientId: string | null) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(accountId).success) return { ok: false, message: "Unknown ad account." };
  if (clientId !== null && !idSchema.safeParse(clientId).success) return { ok: false, message: "Unknown client." };

  const { error } = await supabase.from("ad_accounts").update({ client_id: clientId }).eq("id", accountId);
  if (error) return { ok: false, message: `Couldn't save: ${error.message}` };
  refresh();
  return { ok: true };
}

export async function refreshConnectionAction(connectionId: string) {
  await requireAdmin();
  if (!idSchema.safeParse(connectionId).success) return { ok: false, message: "Unknown login." };
  try {
    const { found, added } = await refreshConnectionAccounts(connectionId);
    refresh();
    return {
      ok: true,
      message: added
        ? `Found ${added} new ad account${added === 1 ? "" : "s"}.`
        : `Up to date — ${found} ad account${found === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    refresh();
    return {
      ok: false,
      message: error instanceof AdPlatformError ? error.message : "Couldn't check for new accounts. Try again.",
    };
  }
}

/** Remove a login. Its ad accounts keep their client assignments for when you reconnect. */
export async function disconnectAction(connectionId: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(connectionId).success) return { ok: false };
  await supabase.from("ad_accounts").update({ is_active: false }).eq("connection_id", connectionId);
  const { error } = await supabase.from("ad_connections").delete().eq("id", connectionId);
  refresh();
  return { ok: !error };
}
