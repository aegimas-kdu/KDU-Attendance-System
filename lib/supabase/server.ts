import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client for server components, route handlers and server actions.
 *
 * Still the anon key, still subject to Row Level Security — it simply reads
 * the signed-in user from the request cookies instead of from the browser.
 *
 * Must be created per request. Never hoist it into a module-level constant,
 * or one user's session leaks into another's request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a server component, where cookies cannot be set.
            // The middleware refreshes the session instead, so this is safe
            // to ignore.
          }
        },
      },
    },
  );
}
