/** What every server action returns. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Turns a Postgres error into something worth showing someone.
 *
 * The functions in supabase/migrations raise messages written for the person
 * reading them — "You are not enrolled in this class", "Too many incorrect
 * attempts" — so those pass straight through. Anything that looks like a
 * constraint or a policy refusal gets a plain sentence instead of jargon.
 */
export function describe(error: { message?: string; code?: string } | null): string {
  const message = error?.message ?? "";
  const code = error?.code ?? "";

  if (code === "42501" || /row-level security/i.test(message)) {
    return "You are not allowed to do that.";
  }
  if (code === "23505") {
    return "That already exists.";
  }
  if (code === "23503") {
    return "Something this depends on is missing.";
  }
  if (code === "23514") {
    return "That value is not allowed here.";
  }
  if (!message) {
    return "Something went wrong. Please try again.";
  }

  // Our own RAISE EXCEPTION text, already written for a reader.
  return message.replace(/^.*?:\s*/, "").trim() || message;
}
