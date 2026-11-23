"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "number" | "email";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("number");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    let email = identifier.trim();

    // Students know their student number, not the address the portal has on
    // file. email_for_student_id() resolves it server-side; it is rate
    // limited and returns nothing for an inactive account.
    if (mode === "number") {
      const { data, error: lookupError } = await supabase.rpc(
        "email_for_student_id",
        { p_student_id: email },
      );

      if (lookupError || !data) {
        // One message for an unknown number and a wrong password, so an
        // outsider cannot discover which student numbers exist.
        setError("That student number and password do not match.");
        setBusy(false);
        return;
      }
      email = data as string;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(
        mode === "number"
          ? "That student number and password do not match."
          : "That email address and password do not match.",
      );
      setBusy(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-[440px]">
      <h1 className="mb-1.5 text-center text-page-title font-bold tracking-tight">
        Sign in
      </h1>
      <p className="mb-6 text-center text-sm text-muted">
        Use your student number, or your email address if you are staff.
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
                The seven-digit number on your student card.
              </p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="password"
              className="mb-1.5 block text-[13px] font-medium text-ink-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="min-h-11 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
            />
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
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <div className="mt-4 rounded-card border border-line bg-[#fafbfc] p-5 text-center">
        <p className="text-sm text-muted">
          New at KDU? <Link href="/register">Create your student account</Link>
        </p>
      </div>
    </div>
  );
}
