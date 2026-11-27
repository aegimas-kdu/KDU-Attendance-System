import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";

export const metadata: Metadata = { title: "That link did not work" };

/**
 * Where a dead email link lands.
 *
 * Recovery links are single use and expire, so the ordinary reasons for being
 * here are harmless: the link was opened twice, or it sat in an inbox too
 * long. The page says so plainly and offers the way forward, rather than
 * leaving someone to guess whether their account is broken.
 */
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  const expired =
    !reason || /expired|invalid|already|not found/i.test(reason);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex min-h-16 flex-wrap items-center gap-6 bg-navy px-6 shadow-[inset_0_-3px_0_var(--color-brand)]">
        <Brand />
        <span className="flex-1" />
        <span className="text-sm text-brand-200">Kyungdong University Global</span>
      </header>

      <main className="grid flex-1 place-items-center px-7 py-14">
        <div className="w-full max-w-[440px]">
          <h1 className="mb-1.5 text-center text-page-title font-bold tracking-tight">
            That link did not work
          </h1>
          <p className="mb-6 text-center text-sm text-muted">
            {expired
              ? "Links in our emails can only be used once, and they expire after a short while."
              : reason}
          </p>

          <div className="rounded-card border border-line bg-white p-6 shadow-sm">
            <p className="mb-5 text-sm text-muted">
              Nothing is wrong with your account. Ask for a new link and use it
              straight away — open it in the same browser you asked from.
            </p>

            <Link
              href="/forgot-password"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white no-underline hover:bg-brand-800"
            >
              Send a new link
            </Link>
          </div>

          <div className="mt-4 rounded-card border border-line bg-[#fafbfc] p-5 text-center">
            <p className="text-sm text-muted">
              Remembered it? <Link href="/sign-in">Back to sign in</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
