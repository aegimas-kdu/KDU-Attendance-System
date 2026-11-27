import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { getUser } from "@/lib/auth";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password" };

/**
 * The end of the recovery flow.
 *
 * /auth/confirm has already exchanged the emailed token for a session by the
 * time anyone arrives here, so a visitor with no session followed a link that
 * had expired, had been used, or was opened in a different browser from the
 * one that asked. That is worth saying plainly instead of bouncing them to
 * the sign-in page, where they would have no idea what went wrong.
 */
export default async function ResetPasswordPage() {
  const user = await getUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex min-h-16 flex-wrap items-center gap-6 bg-navy px-6 shadow-[inset_0_-3px_0_var(--color-brand)]">
        <Brand />
        <span className="flex-1" />
        <span className="text-sm text-brand-200">Kyungdong University Global</span>
      </header>

      <main className="grid flex-1 place-items-center px-7 py-14">
        {user ? (
          <ResetPasswordForm email={user.email} />
        ) : (
          <div className="w-full max-w-[440px]">
            <h1 className="mb-1.5 text-center text-page-title font-bold tracking-tight">
              This link has expired
            </h1>
            <p className="mb-6 text-center text-sm text-muted">
              Password links work once, and only for a short while.
            </p>

            <div className="rounded-card border border-line bg-white p-6 shadow-sm">
              <p className="mb-5 text-sm text-muted">
                Ask for a new one and open it straight away, in the same
                browser you asked from.
              </p>
              <Link
                href="/forgot-password"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white no-underline hover:bg-brand-800"
              >
                Send a new link
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
