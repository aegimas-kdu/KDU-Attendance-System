import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for client components.
 *
 * Uses the anon key, so every query it makes is subject to the Row Level
 * Security policies in supabase/migrations. That is the point: the policies
 * are the security boundary, not the user interface.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
