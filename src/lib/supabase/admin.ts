import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv, supabaseUrl } from "@/lib/env";

/**
 * Supabase client with the secret key. Bypasses row-level security, so only
 * use it on the server, after `requireAdmin()`, for things a logged-in session
 * is deliberately not allowed to touch (ad platform tokens).
 */
export function createAdminClient() {
  const { supabaseSecretKey } = serverEnv();
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set.");
  }
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
