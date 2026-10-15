import "server-only";
import { createServerClient } from "@supabase/ssr";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/** Supabase client acting as the logged-in user (row-level security applies). */
export async function createClient() {
  const cookieStore = await cookies();
  // Creating the client checks the session's expiry against the clock. With Cache
  // Components that must happen at request time, not while prerendering.
  await io();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
