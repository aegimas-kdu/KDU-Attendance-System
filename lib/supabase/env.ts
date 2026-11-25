/**
 * The two values every Supabase client needs.
 *
 * Both are NEXT_PUBLIC_, so Next.js inlines them into the bundle at BUILD
 * time, not at run time. On a hosting platform that means they must be set
 * before the build runs — adding them afterwards changes nothing until the
 * site is deployed again.
 *
 * The @supabase/ssr message when they are missing says only "Your project's
 * URL and Key are required", which does not say where to put them. This one
 * does.
 */
function required(name: string, value: string | undefined): string {
  if (value && value.length > 0) return value;

  throw new Error(
    `${name} is not set.\n\n` +
      "Locally: copy .env.example to .env.local and fill in both values from " +
      "Supabase → Project Settings → API keys.\n" +
      "On Netlify: Site configuration → Environment variables, add " +
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, " +
      "then redeploy — these are compiled into the build, so an existing " +
      "deploy will not pick them up.",
  );
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabasePublishableKey = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
