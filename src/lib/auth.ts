import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Every page, server action and API route calls this first. Only the admin
 * gets past it today; when client logins arrive they get their own guard.
 */
export const requireAdmin = cache(async () => {
  // Not set up yet: the login page explains what's missing.
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: appUser } = await supabase.from("app_users").select("role").eq("user_id", userId).maybeSingle();
  if (appUser?.role !== "admin") redirect("/login?error=no-access");

  return { supabase, userId, email: (data.claims.email as string | undefined) ?? "" };
});
