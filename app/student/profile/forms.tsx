"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui";
import { field, label, primary } from "@/components/form-kit";
import { createClient } from "@/lib/supabase/client";
import { updateMyProfile, updateMyStudies } from "@/lib/actions/profile";
import type { AcademicLevel, Department, IntakeBatch } from "@/lib/database.types";

type Note = { tone: "info" | "danger"; text: string } | null;

function Saved({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <div className="mt-4">
      <Alert tone={note.tone === "info" ? "info" : "danger"}>{note.text}</Alert>
    </div>
  );
}

/** Name and country. */
export function AboutYouForm({
  initial,
}: {
  initial: { fullName: string; country: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const dirty =
    form.fullName !== initial.fullName || form.country !== initial.country;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    const result = await updateMyProfile({
      fullName: form.fullName,
      country: form.country,
    });
    setBusy(false);
    setNote(
      result.ok
        ? { tone: "info", text: "Saved." }
        : { tone: "danger", text: result.error },
    );
    if (result.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="full-name">
            Full name
          </label>
          <input
            id="full-name"
            required
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className={field}
          />
          <p className="mt-1.5 text-[13px] text-muted">
            As it appears on your student card. This is the name on every
            attendance sheet.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="country">
            Country
          </label>
          <input
            id="country"
            autoComplete="country-name"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            placeholder="Burundi"
            className={field}
          />
        </div>
      </div>

      <div className="mt-5 sm:w-48">
        <button type="submit" disabled={busy || !dirty} className={primary}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>

      <Saved note={note} />
    </form>
  );
}

/** Intake batch, academic level and department. */
export function StudiesForm({
  initial,
  batches,
  levels,
  departments,
}: {
  initial: {
    intakeBatchId: string | null;
    academicLevelId: string | null;
    departmentId: string | null;
  };
  batches: IntakeBatch[];
  levels: AcademicLevel[];
  departments: Department[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const dirty =
    form.intakeBatchId !== initial.intakeBatchId ||
    form.academicLevelId !== initial.academicLevelId ||
    form.departmentId !== initial.departmentId;

  const batchChanged = form.intakeBatchId !== initial.intakeBatchId;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    const result = await updateMyStudies(form);
    setBusy(false);
    setNote(
      result.ok
        ? { tone: "info", text: "Saved." }
        : { tone: "danger", text: result.error },
    );
    if (result.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="p-5 sm:p-6">
      <p className="mb-4 text-sm text-muted">
        You chose these when you registered. Correct them here if any of them is
        wrong.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="department">
            Department
          </label>
          <select
            id="department"
            value={form.departmentId ?? ""}
            onChange={(e) =>
              setForm({ ...form, departmentId: e.target.value || null })
            }
            className={field}
          >
            <option value="">Not set</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
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
            value={form.academicLevelId ?? ""}
            onChange={(e) =>
              setForm({ ...form, academicLevelId: e.target.value || null })
            }
            className={field}
          >
            <option value="">Not set</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[13px] text-muted">
            Your level this academic year.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="batch">
            Intake batch
          </label>
          <select
            id="batch"
            value={form.intakeBatchId ?? ""}
            onChange={(e) =>
              setForm({ ...form, intakeBatchId: e.target.value || null })
            }
            className={field}
          >
            <option value="">Not set</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.semester} {b.start_year}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[13px] text-muted">
            The semester you joined KDU. It stays the same throughout your
            studies.
          </p>
        </div>
      </div>

      {batchChanged && (
        <div className="mt-4">
          <Alert tone="warn" title="This decides which courses you can take">
            Your intake batch controls which courses you can be enrolled in.
            Change it only if it is genuinely wrong — if you are already
            enrolled in courses, speak to the registry office first. The change
            is recorded with your name against it.
          </Alert>
        </div>
      )}

      <div className="mt-5 sm:w-48">
        <button type="submit" disabled={busy || !dirty} className={primary}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>

      <Saved note={note} />
    </form>
  );
}

/**
 * Changing the password.
 *
 * Done in the browser, against Supabase directly, so the password never
 * travels through this application's server at all — the same reason
 * registration signs up from the browser rather than through a server action.
 */
export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const longEnough = password.length >= 8;
  const match = password.length > 0 && password === confirm;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNote(null);

    if (!longEnough) {
      setNote({ tone: "danger", text: "Your password needs at least 8 characters." });
      return;
    }
    if (!match) {
      setNote({ tone: "danger", text: "The two passwords are not the same." });
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setNote({
        tone: "danger",
        text: /should be different|same as the old/i.test(error.message)
          ? "That is the password you are already using. Choose a different one."
          : error.message,
      });
      return;
    }

    setPassword("");
    setConfirm("");
    setNote({
      tone: "info",
      text: "Your password has been changed. It applies the next time you sign in.",
    });
  }

  return (
    <form onSubmit={save} className="p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          <p className="mt-1.5 text-[13px] text-muted">At least 8 characters.</p>
        </div>

        <div>
          <label className={label} htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={confirm.length > 0 && !match ? true : undefined}
            className={`${field} ${
              confirm.length > 0 && !match
                ? "border-absent ring-2 ring-absent/20"
                : ""
            }`}
          />
          {confirm.length > 0 && !match && (
            <p className="mt-1.5 text-[13px] font-semibold text-absent-ink">
              The two passwords are not the same.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 sm:w-48">
        <button
          type="submit"
          disabled={busy || !longEnough || !match}
          className={primary}
        >
          {busy ? "Changing…" : "Change password"}
        </button>
      </div>

      <Saved note={note} />
    </form>
  );
}
