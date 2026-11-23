import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client for client components.
 *
 * Uses the anon key, so every query it makes is subject to the Row Level
 * Security policies in supabase/migrations. That is the point: the policies
 * are the security boundary, not the user interface.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
