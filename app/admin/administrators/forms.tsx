"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantAdminAccess, revokeAdminAccess } from "@/lib/actions/admin";
import { findProfileByEmail } from "@/lib/actions/lookup";
import { Alert } from "@/components/ui";
import type { AdminLevel } from "@/lib/database.types";

const field =
  "min-h-11 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30";
const label = "mb-1.5 block text-[13px] font-medium text-ink-2";
const small =
  "inline-flex min-h-8 items-center rounded-md border border-line-2 bg-white px-3 text-[13px] font-semibold hover:bg-page disabled:opacity-50";

export function GrantAccess() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<AdminLevel>("admin");
  const [message, setMessage] = useState<
    { tone: "info" | "danger"; text: string } | null
  >(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    start(async () => {
      const found = await findProfileByEmail(email);
      if (!found.ok) {
        setMessage({ tone: "danger", text: found.error });
        return;
      }

      const result = await grantAdminAccess(found.data.id, level);
      if (result.ok) {
        setMessage({
          tone: "info",
          text: `${found.data.full_name} is now ${
            level === "super_admin" ? "a super admin" : "an administrator"
          }.`,
        });
        setEmail("");
        router.refresh();
      } else {
        setMessage({ tone: "danger", text: result.error });
      }
    });
  }

  return (
    <form className="p-5" onSubmit={submit}>
      <div className="mb-4">
        <label className={label} htmlFor="grant-email">
          Who
        </label>
        <input
          id="grant-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Search by email"
          className={field}
        />
        <p className="mt-1.5 text-[13px] text-muted">
          They must already have an account.
        </p>
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="grant-level">
          Level
        </label>
        <select
          id="grant-level"
          className={field}
          value={level}
          onChange={(e) => setLevel(e.target.value as AdminLevel)}
        >
          <option value="admin">Admin — students, courses, schedule and reports</option>
          <option value="super_admin">
            Super admin — all of that, and managing administrators
          </option>
        </select>
      </div>

      <div className="mb-4">
        <Alert tone="danger">
          A super admin can give and remove administrator access, including yours. This
          is recorded in the activity log with your name.
        </Alert>
      </div>

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {pending ? "Granting…" : "Give access"}
      </button>
    </form>
  );
}

export function AdminRowActions({
  profileId,
  level,
  isSelf,
}: {
  profileId: string;
  level: AdminLevel | null;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(result.error ?? "Something went wrong.");
    });
  }

  if (isSelf) return <span className="text-[13px] text-muted">You</span>;

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {error && <span className="text-[13px] text-absent-ink">{error}</span>}
      <button
        type="button"
        disabled={pending}
        className={small}
        onClick={() =>
          run(() =>
            grantAdminAccess(profileId, level === "super_admin" ? "admin" : "super_admin"),
          )
        }
      >
        {level === "super_admin" ? "Make admin" : "Make super admin"}
      </button>
      <button
        type="button"
        disabled={pending}
        className={small}
        onClick={() => run(() => revokeAdminAccess(profileId))}
      >
        Remove access
      </button>
    </span>
  );
}
