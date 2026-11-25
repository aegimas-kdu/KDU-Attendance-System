"use server";

import { findProfileByEmail as lookup } from "@/lib/data/people";
import { requireAdmin } from "@/lib/auth";
import { fail, ok, type ActionResult } from "./result";

/**
 * Finds someone by email so an admin screen can act on them.
 *
 * Administrators work from addresses, not profile UUIDs, so every "do
 * something to this person" form starts here. It is a server action rather
 * than a data function because the forms that need it are client components.
 */
export async function findProfileByEmail(
  email: string,
): Promise<ActionResult<{ id: string; full_name: string; role: string }>> {
  await requireAdmin();

  const profile = await lookup(email);
  if (!profile) {
    return fail(
      "No account with that email. Create it first under Authentication \u2192 Users in Supabase.",
    );
  }

  return ok({ id: profile.id, full_name: profile.full_name, role: profile.role });
}
