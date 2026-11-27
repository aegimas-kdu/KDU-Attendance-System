"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Setting the new password.
 *
 * Done in the browser against Supabase directly, so the password never
 * travels through this application's server — the same reason registration
 * and the profile page work this way.
 */
export function ResetPasswordForm({ email }: { email: string | null }) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const longEnough = password.length >= 8;
  const match = password.length > 0 && password === confirm;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!longEnough) {
      setError("Your password needs at least 8 characters.");
      return;
    }
    if (!match) {
      setError("The two passwords are not the same.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(
        /should be different|same as the old/i.test(updateError.message)
          ? "That is the password you were already using. Choose a different one."
          : updateError.message,
      );
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="w-full max-w-[440px]">
        <h1 className="mb-1.5 text-center text-page-title font-bold tracking-tight">
          Password changed
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          You are signed in already — there is nothing else to do.
        </p>

        <div className="rounded-card border border-line bg-white p-6 shadow-sm">
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white no-underline hover:bg-brand-800"
          >
            Go to the portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[440px]">
      <h1 className="mb-1.5 text-center text-page-title font-bold tracking-tight">
        Set a new password
      </h1>
      <p className="mb-6 text-center text-sm text-muted">
        {email ? (
          <>
            For <b>{email}</b>
          </>
        ) : (
          "Choose something you have not used here before."
        )}
      </p>

      <div className="rounded-card border border-line bg-white p-6 shadow-sm">
        <form onSubmit={onSubmit}>
          <div className="mb-4">
            <label
              htmlFor="password"
              className="mb-1.5 block text-[13px] font-medium text-ink-2"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
            />
            <p className="mt-1.5 text-[13px] text-muted">At least 8 characters.</p>
          </div>

          <div className="mb-4">
            <label
              htmlFor="confirm"
              className="mb-1.5 block text-[13px] font-medium text-ink-2"
            >
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={confirm.length > 0 && !match ? true : undefined}
              className={`min-h-11 w-full rounded-lg border bg-white px-3 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 ${
                confirm.length > 0 && !match
                  ? "border-absent ring-2 ring-absent/20"
                  : "border-line-2"
              }`}
            />
            {confirm.length > 0 && !match && (
              <p className="mt-1.5 text-[13px] font-semibold text-absent-ink">
                The two passwords are not the same.
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-[#ebc2c6] bg-absent-bg px-3 py-2.5 text-sm text-absent-ink"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !longEnough || !match}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
