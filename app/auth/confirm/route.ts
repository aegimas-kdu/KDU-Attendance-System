import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Where every link in an email from Supabase lands.
 *
 * Password recovery, email confirmation and invitations all arrive here. The
 * link carries a one-time token; this exchanges it for a session cookie and
 * then sends the person on to the page that finishes the job.
 *
 * Two shapes are accepted, because which one arrives depends on how the email
 * template in the Supabase dashboard is written:
 *
 *   ?token_hash=…&type=recovery   the template uses {{ .TokenHash }}
 *   ?code=…                       the template uses {{ .ConfirmationURL }},
 *                                 which is the default
 *
 * Handling both means the flow works whether or not the templates have been
 * customised, and keeps working if someone changes them later.
 *
 * The token is single use and short lived. Nothing here decides whether it is
 * valid — Supabase does, and an invalid one ends up on the error page with a
 * message rather than a stack trace.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Only ever redirect inside this site. An open redirect here would be
  // handing out a link that looks like ours and lands somewhere else.
  const requested = searchParams.get("next") ?? "/dashboard";
  const next = requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/dashboard";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return NextResponse.redirect(
      new URL(`/auth/error?reason=${encodeURIComponent(error.message)}`, origin),
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return NextResponse.redirect(
      new URL(`/auth/error?reason=${encodeURIComponent(error.message)}`, origin),
    );
  }

  return NextResponse.redirect(new URL("/auth/error", origin));
}
