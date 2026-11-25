"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type Option = { id: string; label: string; hint?: string };

const field =
  "min-h-11 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30";
const label = "mb-1.5 block text-[13px] font-medium text-ink-2";
const help = "mt-1.5 text-[13px] text-muted";
const legend =
  "mb-4 text-[12px] font-semibold uppercase tracking-[0.09em] text-faint";

/**
 * Creating a student account.
 *
 * Everything this form collects travels as sign-up metadata and is read by
 * handle_new_user() in migration 0013, which validates each answer against
 * the real tables before storing it. Nothing here is trusted: a batch id
 * invented by hand lands as NULL, not as a batch.
 */
export function RegisterForm({
  batches,
  levels,
  departments,
}: {
  batches: Option[];
  levels: Option[];
  departments: Option[];
}) {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [batch, setBatch] = useState("");
  const [level, setLevel] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);

  const [numberTaken, setNumberTaken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  const numberLooksRight = /^\d{7}$/.test(studentNumber);
  const passwordsMatch = password.length > 0 && password === confirm;
  const passwordLongEnough = password.length >= 8;

  /** Asks the database, which answers yes or no and nothing else. */
  async function checkNumber() {
    if (!numberLooksRight) return;
    const supabase = createClient();
    const { data } = await supabase.rpc("student_number_taken", {
      p_student_id: studentNumber,
    });
    setNumberTaken(data === true);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!passwordLongEnough) {
      setError("Your password needs at least 8 characters.");
      return;
    }
    if (!passwordsMatch) {
      setError("The two passwords are not the same.");
      return;
    }

    setBusy(true);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          student_id: studentNumber.trim(),
          country: country.trim(),
          intake_batch_id: batch,
          academic_level_id: level,
          department_id: department,
        },
      },
    });

    if (signUpError) {
      setBusy(false);
      setError(
        /already registered|already exists/i.test(signUpError.message)
          ? "There is already an account with that email address. Sign in instead."
          : signUpError.message,
      );
      return;
    }

    // With email confirmation switched on there is no session yet, so there
    // is nowhere to send them until they open the link.
    if (!data.session) {
      setBusy(false);
      setCheckEmail(true);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="rounded-card border border-line bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-section font-semibold">Check your email</h2>
        <p className="mb-4 text-sm text-muted">
          We sent a message to <b>{email}</b>. Open the link in it to confirm your
          address, then sign in. Your account exists already — the link only proves the
          address is yours.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white no-underline hover:bg-brand-800"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-5 rounded-card border border-line bg-white p-6 shadow-sm">
        <p className={legend}>About you</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="full-name">
              Full name
            </label>
            <input
              id="full-name"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Rosine Marie Ininahazwe"
              className={field}
            />
          </div>

          <div>
            <label className={label} htmlFor="student-number">
              Student number
            </label>
            <input
              id="student-number"
              required
              inputMode="numeric"
              maxLength={7}
              value={studentNumber}
              onChange={(e) => {
                setStudentNumber(e.target.value.replace(/\D/g, "").slice(0, 7));
                setNumberTaken(false);
              }}
              onBlur={checkNumber}
              placeholder="2617304"
              aria-invalid={numberTaken || undefined}
              className={`${field} num ${
                numberTaken ? "border-absent ring-2 ring-absent/20" : ""
              }`}
            />
            <p className={help}>
              {numberTaken ? (
                <span className="font-semibold text-absent-ink">
                  That number is already in use. Check your student card, or sign in if
                  you already have an account.
                </span>
              ) : (
                "Seven digits, as issued by the university. It begins with the year you joined — 26 for 2026."
              )}
            </p>
          </div>

          <div>
            <label className={label} htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@kdu.edu"
              className={field}
            />
          </div>

          <div>
            <label className={label} htmlFor="country">
              Country
            </label>
            <input
              id="country"
              autoComplete="country-name"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Burundi"
              className={field}
            />
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-card border border-line bg-white p-6 shadow-sm">
        <p className={legend}>Your studies</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="department">
              Department
            </label>
            <select
              id="department"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={field}
            >
              <option value="">Choose your department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="level">
              Academic level
            </label>
            <select
              id="level"
              required
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={field}
            >
              <option value="">Choose your level</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className={help}>Your level this academic year.</p>
          </div>

          <div className="sm:col-span-2">
            <label className={label} htmlFor="batch">
              Intake batch
            </label>
            <select
              id="batch"
              required
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className={field}
            >
              <option value="">Choose the semester you joined</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                  {b.hint ? ` — ${b.hint}` : ""}
                </option>
              ))}
            </select>
            <p className={help}>
              The semester you joined KDU. This stays the same throughout your studies,
              and it decides which courses you can be enrolled in. You can correct it
              later in your profile.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-card border border-line bg-white p-6 shadow-sm">
        <p className={legend}>Password</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
            <p className={help}>At least 8 characters.</p>
          </div>

          <div>
            <label className={label} htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={confirm.length > 0 && !passwordsMatch ? true : undefined}
              className={`${field} ${
                confirm.length > 0 && !passwordsMatch
                  ? "border-absent ring-2 ring-absent/20"
                  : ""
              }`}
            />
            {confirm.length > 0 && !passwordsMatch && (
              <p className="mt-1.5 text-[13px] font-semibold text-absent-ink">
                The two passwords are not the same.
              </p>
            )}
          </div>
        </div>
      </div>

      <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-card border border-line bg-white p-4 text-sm shadow-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
        <input
          type="checkbox"
          required
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--color-brand)]"
        />
        <span>
          I confirm this information is correct and I accept the portal terms of use.
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-[#ebc2c6] bg-absent-bg px-3 py-2.5 text-sm text-absent-ink"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy || numberTaken || !accepted}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {busy ? "Creating your account…" : "Create account"}
        </button>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line-2 bg-white px-5 font-semibold no-underline hover:bg-page"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
