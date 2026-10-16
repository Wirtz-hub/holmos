"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

const idSchema = z.uuid();

/** Removes a person from a client's contact list, with their answers (e.g. when they ask to be forgotten). */
export async function deleteContactAction(contactId: string) {
  const { supabase } = await requireAdmin();
  if (!idSchema.safeParse(contactId).success) return { ok: false };
  // Their form answers go too, so nothing about them is left behind.
  await supabase.from("form_submissions").delete().eq("contact_id", contactId);
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  refresh();
  return { ok: !error };
}
