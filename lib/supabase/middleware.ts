import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Pages anyone may see without signing in.
 *
 * /reset-password is here even though it only does anything for someone
 * holding a recovery session. Bouncing an expired link to the sign-in page
 * would leave the person with no idea what went wrong; the page itself says
 * the link has expired and offers a new one. It is not a way in: changing a
 * password still needs the session that /auth/confirm establishes.
 */
const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/register",
  "/auth",
  "/forgot-password",
  "/reset-password",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the Supabase session on every request and keeps signed-out
 * visitors out of the application.
 *
 * This is a convenience, not the security boundary. Even if it were removed,
 * Row Level Security would still refuse the data — a signed-out visitor who
 * reached /dashboard would see an empty page, not someone else's record.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl(),
    supabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() verifies the token's signature rather than believing the
  // cookie, so it is as trustworthy as getUser() here — but with asymmetric
  // JWT signing keys it verifies locally against a cached JWKS instead of
  // making an HTTP call to the Auth server on every request.
  //
  // Do NOT replace this with getSession(), which performs no verification at
  // all and would accept a forged cookie.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims?.sub ? claims.claims : null;

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
