"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "number" | "email";

export function ForgotPasswordForm() {
  const [mode, setMode] = useState<Mode>("number");
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    let email = identifier.trim();

    if (mode === "number") {
      const { data } = await supabase.rpc("email_for_student_id", {
        p_student_id: email,
      });
      // An unknown number is NOT reported. Saying "no such student" here
      // would turn this form into a way of discovering which student numbers
      // exist, so the confirmation below is shown either way.
      if (!data) {
        setSent(true);
        setBusy(false);
        return;
      }
      email = data as string;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });

    setBusy(false);

    // Rate limiting is the one failure worth reporting, because waiting is
    // something the person can actually act on.
    if (resetError && /rate|too many|seconds/i.test(resetError.message)) {
      setError(
        "A link was sent very recently. Please wait a minute before asking for another.",
      );
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-[440px]">
        <h1 className="mb-1.5 text-center text-page-title font-bold tracking-tight">
          Check your email
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          If we hold an account for that {mode === "number" ? "student number" : "address"}, a link to set a new password is on its way.
        </p>

        <div className="rounded-card border border-line bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-muted">
            The link works once, and only for a short while. Open it in this
            same browser — if you open it somewhere else you will be asked to
            start again.
          </p>
          <p className="mb-5 text-sm text-muted">
            Nothing arrived after a few minutes? Check the spam folder. If it is
            not there either, the university may hold a different address for
            you — the registry office can tell you which.
          </p>

          <Link
            href="/sign-in"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white no-underline hover:bg-brand-800"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[440px]">
      <h1 className="mb-1.5 text-center text-page-title font-bold tracking-tight">
        Forgotten your password?
      </h1>
      <p className="mb-6 text-center text-sm text-muted">
        Tell us who you are and we will email you a link to set a new one.
      </p>

      <div className="rounded-card border border-line bg-white p-6 shadow-sm">
        <div className="mb-5 flex gap-0.5 rounded-[10px] bg-[#edeff3] p-1">
          {(["number", "email"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
                mode === m
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {m === "number" ? "Student number" : "Email address"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit}>
          <div className="mb-4">
            <label
              htmlFor="identifier"
              className="mb-1.5 block text-[13px] font-medium text-ink-2"
            >
              {mode === "number" ? "Student number" : "Email address"}
            </label>
            <input
              id="identifier"
              type={mode === "number" ? "text" : "email"}
              inputMode={mode === "number" ? "numeric" : "email"}
              autoComplete={mode === "number" ? "username" : "email"}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={mode === "number" ? "2517304" : "you@kdu.edu"}
              className="min-h-11 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
            />
            {mode === "number" && (
              <p className="mt-1.5 text-[13px] text-muted">
                The email goes to the address the university holds for you, not
                to one you choose here.
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
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Email me a link"}
          </button>
        </form>
      </div>

      <div className="mt-4 rounded-card border border-line bg-[#fafbfc] p-5 text-center">
        <p className="text-sm text-muted">
          Remembered it? <Link href="/sign-in">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
