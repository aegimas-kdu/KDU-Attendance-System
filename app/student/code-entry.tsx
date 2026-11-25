"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAttendanceCode } from "@/lib/actions/attendance";
import { Alert, Chip } from "@/components/ui";
import type { AttendanceStatus } from "@/lib/database.types";

const RESULT: Record<AttendanceStatus, string> = {
  present: "You are marked present.",
  late: "You are marked late. Three lates count as one absence.",
  absent: "You are marked absent.",
  excused: "You are marked excused.",
};

/**
 * Four digits, one class.
 *
 * Nothing here decides anything: `submit_attendance_code` checks the code
 * against a bcrypt hash, refuses a student who is not enrolled, counts wrong
 * attempts, and will not downgrade a mark that is already present. This only
 * carries the four digits and shows what came back.
 */
export function CodeEntry({
  sessionId,
  courseName,
  marked,
}: {
  sessionId: string;
  courseName: string;
  marked: AttendanceStatus | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttendanceStatus | null>(null);

  const shown = result ?? marked;

  if (shown) {
    return (
      <div className="rounded-card border border-line-2 bg-white px-4 py-3">
        <p className="mb-1 text-sm font-semibold">{courseName}</p>
        <p className="text-sm text-muted">{RESULT[shown]}</p>
      </div>
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    start(async () => {
      const outcome = await submitAttendanceCode(sessionId, code);
      if (outcome.ok) {
        setResult(outcome.data);
        setCode("");
        router.refresh();
      } else {
        setError(outcome.error);
        setCode("");
        inputRef.current?.focus();
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <label
        className="mb-1.5 block text-[13px] font-medium text-ink-2"
        htmlFor={`code-${sessionId}`}
      >
        The code your professor is showing
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`code-${sessionId}`}
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          required
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 4));
            setError(null);
          }}
          placeholder="0000"
          aria-describedby={`code-help-${sessionId}`}
          className="num min-h-14 w-32 rounded-lg border border-line-2 bg-white px-3 text-center text-2xl font-bold tracking-[0.25em] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
        />
        <button
          type="submit"
          disabled={pending || code.length !== 4}
          className="inline-flex min-h-14 flex-1 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Mark me present"}
        </button>
      </div>

      <p id={`code-help-${sessionId}`} className="mt-2 text-[13px] text-muted">
        Four digits. It changes every time, and only works while your professor is
        showing it.
      </p>

      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
    </form>
  );
}

/** The banner on the Today screen when a class is open right now. */
export function OpenNow({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Chip tone="live" dot>
      {count === 1 ? "A class is open now" : `${count} classes are open now`}
    </Chip>
  );
}
