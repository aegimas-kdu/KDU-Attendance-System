"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  closeClass,
  correctAttendance,
  issueLateCode,
  openClass,
} from "@/lib/actions/attendance";
import { cancelClass } from "@/lib/actions/attendance";
import { Alert, Chip } from "@/components/ui";
import { small, smallPrimary, useAction } from "@/components/form-kit";
import type { AttendanceStatus, SessionStatus } from "@/lib/database.types";

/** mm:ss left on the code. */
function countdown(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The code panel.
 *
 * The plain code exists only here and on the professor's screen — the
 * database keeps a bcrypt hash, so it cannot be fetched again. Losing this
 * screen means issuing a new one, which revokes the old.
 */
export function CodePanel({
  sessionId,
  status,
  unmarked,
}: {
  sessionId: string;
  status: SessionStatus;
  unmarked: number;
}) {
  const router = useRouter();
  const { pending, error, run } = useAction();

  const [code, setCode] = useState<string | null>(null);
  const [kind, setKind] = useState<"initial" | "late">("initial");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState<string | null>(null);

  // The clock, and a refresh of the sheet every ten seconds while a code is
  // live — marks arrive from students' phones, not from this page.
  useEffect(() => {
    if (!expiresAt) return;
    setLeft(countdown(expiresAt));

    const tick = setInterval(() => {
      const remaining = countdown(expiresAt);
      setLeft(remaining);
      if (remaining === 0) clearInterval(tick);
    }, 1000);

    const refresh = setInterval(() => router.refresh(), 10_000);

    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [expiresAt, router]);

  const live = code !== null && left > 0;

  if (status === "closed") {
    return (
      <div className="p-5">
        <Alert tone="info">
          This class is closed. Everyone has a mark, and students can no longer enter a
          code. Corrections are still possible in the sheet below.
        </Alert>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="p-5">
        <Alert>This class was cancelled. No attendance is expected for it.</Alert>
      </div>
    );
  }

  return (
    <div className="p-5">
      {live ? (
        <>
          <div
            className={`mb-4 rounded-card px-5 py-6 text-center ${
              kind === "late" ? "bg-late-bg" : "bg-brand-50"
            }`}
          >
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
              {kind === "late" ? "Late code" : "Attendance code"}
            </p>
            <p className="num mb-2 text-[56px] font-bold leading-none tracking-[0.12em]">
              {code}
            </p>
            <p className="num text-sm text-muted">
              {clock(left)} left
              {kind === "late" && " · whoever uses this is marked late"}
            </p>
          </div>
          <p className="mb-4 text-sm text-muted">
            Read it out or write it up. It cannot be shown again — issuing another code
            replaces this one.
          </p>
        </>
      ) : (
        <div className="mb-4">
          <p className="text-sm text-muted">
            {code
              ? "That code has expired. Issue another one, or close the class."
              : "Opening the class creates a four-digit code that lasts five minutes. Students enter it on their phones."}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      {closed && (
        <div className="mb-4">
          <Alert tone="info">{closed}</Alert>
        </div>
      )}

      <div className="grid gap-2">
        <button
          type="button"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          onClick={() =>
            run(
              () => openClass(sessionId, "initial", 300),
              (result) => {
                const data = (result as { data?: { code: string; expiresAt: string } })
                  .data;
                if (!data) return;
                setCode(data.code);
                setExpiresAt(data.expiresAt);
                setKind("initial");
              },
            )
          }
        >
          {pending ? "Working…" : live ? "New code" : "Open the class"}
        </button>

        <button
          type="button"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-page disabled:opacity-60"
          onClick={() =>
            run(
              () => issueLateCode(sessionId, 300),
              (result) => {
                const data = (result as { data?: { code: string; expiresAt: string } })
                  .data;
                if (!data) return;
                setCode(data.code);
                setExpiresAt(data.expiresAt);
                setKind("late");
              },
            )
          }
        >
          Issue a late code
        </button>

        {!closing ? (
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-page"
            onClick={() => setClosing(true)}
          >
            Close the class
          </button>
        ) : (
          <div className="rounded-card border border-line-2 bg-page px-4 py-3">
            <p className="mb-3 text-sm">
              {unmarked === 0
                ? "Everyone has a mark. Closing stops any further codes."
                : `${unmarked} ${
                    unmarked === 1 ? "student has" : "students have"
                  } no mark yet and will be marked absent. They can still ask for leave afterwards.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className={smallPrimary}
                onClick={() =>
                  run(
                    () => closeClass(sessionId),
                    (result) => {
                      const marked =
                        (result as { data?: { markedAbsent: number } }).data
                          ?.markedAbsent ?? 0;
                      setClosed(
                        marked === 0
                          ? "Class closed. Everyone already had a mark."
                          : `Class closed. ${marked} ${
                              marked === 1 ? "student was" : "students were"
                            } marked absent.`,
                      );
                      setClosing(false);
                      setCode(null);
                      setExpiresAt(null);
                    },
                  )
                }
              >
                {pending ? "Closing…" : "Close it"}
              </button>
              <button type="button" className={small} onClick={() => setClosing(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CHOICES: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
];

/**
 * One row's mark.
 *
 * A mark that came from approved leave is shown but not editable — the
 * action refuses it, so the button says why instead of failing afterwards.
 */
export function MarkPicker({
  sessionId,
  studentId,
  status,
  fromLeave,
}: {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus | "not marked";
  fromLeave: boolean;
}) {
  const { pending, error, run } = useAction();
  const [open, setOpen] = useState(false);

  if (fromLeave) {
    return (
      <span className="text-[13px] text-muted">Approved leave — change the request</span>
    );
  }

  if (error) return <span className="text-[13px] text-absent-ink">{error}</span>;

  if (!open) {
    return (
      <button type="button" className={small} onClick={() => setOpen(true)}>
        {status === "not marked" ? "Mark" : "Change"}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      {CHOICES.filter((c) => c.value !== status).map((choice) => (
        <button
          key={choice.value}
          type="button"
          disabled={pending}
          className={small}
          onClick={() =>
            run(
              () => correctAttendance(sessionId, studentId, choice.value),
              () => setOpen(false),
            )
          }
        >
          {choice.label}
        </button>
      ))}
      <button type="button" className={small} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </span>
  );
}

/** One date off, without disturbing the weekly pattern. */
export function CancelClass({ sessionId }: { sessionId: string }) {
  const { pending, error, run } = useAction();
  const [confirming, setConfirming] = useState(false);

  if (error) return <Chip tone="absent">{error}</Chip>;

  if (!confirming) {
    return (
      <button type="button" className={small} onClick={() => setConfirming(true)}>
        Cancel this class
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[13px] text-muted">No attendance will be expected.</span>
      <button
        type="button"
        disabled={pending}
        className={smallPrimary}
        onClick={() => run(() => cancelClass(sessionId))}
      >
        {pending ? "Cancelling…" : "Confirm"}
      </button>
      <button type="button" className={small} onClick={() => setConfirming(false)}>
        Keep it
      </button>
    </span>
  );
}
