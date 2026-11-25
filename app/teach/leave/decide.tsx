"use client";

import { useState } from "react";
import { decideLeaveRequest, decideLeaveRequests } from "@/lib/actions/leave";
import { Alert } from "@/components/ui";
import { field, label, small, smallPrimary, useAction } from "@/components/form-kit";

/**
 * One decision, with the note the student will read.
 *
 * Approving does not touch attendance here: a database trigger writes the
 * excused record itself, even for a class that closed weeks ago.
 */
export function Decide({
  requestId,
  studentName,
}: {
  requestId: string;
  studentName: string;
}) {
  const { pending, error, run } = useAction();
  const [choice, setChoice] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");

  if (!choice) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" className={smallPrimary} onClick={() => setChoice("approved")}>
          Approve
        </button>
        <button type="button" className={small} onClick={() => setChoice("rejected")}>
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line-2 bg-page px-4 py-3">
      <p className="mb-3 text-sm">
        {choice === "approved"
          ? `${studentName} will be marked excused for that class, and it will stop counting against them.`
          : `${studentName} stays marked absent for that class.`}
      </p>

      <div className="mb-3">
        <label className={label} htmlFor={`note-${requestId}`}>
          A note for them {choice === "rejected" ? "" : "(optional)"}
        </label>
        <textarea
          id={`note-${requestId}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            choice === "approved"
              ? "Get well soon."
              : "Please send a doctor's note if you have one."
          }
          className={`${field} min-h-20`}
        />
      </div>

      {error && (
        <div className="mb-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className={smallPrimary}
          onClick={() => run(() => decideLeaveRequest(requestId, choice, note))}
        >
          {pending
            ? "Saving…"
            : choice === "approved"
              ? "Confirm approval"
              : "Confirm rejection"}
        </button>
        <button type="button" className={small} onClick={() => setChoice(null)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Several at once, for a batch of the same kind. */
export function DecideMany({
  requests,
}: {
  requests: { id: string; studentName: string; courseName: string }[];
}) {
  const { pending, error, note, setNote, run } = useAction();
  const [picked, setPicked] = useState<string[]>([]);

  const all = picked.length === requests.length && requests.length > 0;

  return (
    <div className="p-5">
      <p className="mb-4 text-sm text-muted">
        Tick the ones you have already made up your mind about. Each student can still
        see who decided, and when.
      </p>

      <div className="mb-4 max-h-64 overflow-auto rounded-lg border border-line-2">
        {requests.map((r) => (
          <label
            key={r.id}
            className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-line px-3 text-sm last:border-b-0 has-[:checked]:bg-brand-50"
          >
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-brand)]"
              checked={picked.includes(r.id)}
              onChange={() =>
                setPicked(
                  picked.includes(r.id)
                    ? picked.filter((p) => p !== r.id)
                    : [...picked, r.id],
                )
              }
            />
            <b className="min-w-0 flex-1 truncate font-semibold">{r.studentName}</b>
            <span className="truncate text-[13px] text-muted">{r.courseName}</span>
          </label>
        ))}
      </div>

      {note && (
        <div className="mb-4">
          <Alert tone="info">{note}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={small}
          onClick={() => setPicked(all ? [] : requests.map((r) => r.id))}
        >
          {all ? "Clear" : "Select all"}
        </button>
        <button
          type="button"
          disabled={pending || !picked.length}
          className={smallPrimary}
          onClick={() =>
            run(
              () => decideLeaveRequests(picked, "approved"),
              (result) => {
                const n = (result as { data?: { decided: number } }).data?.decided ?? 0;
                setNote(`${n} ${n === 1 ? "request" : "requests"} approved.`);
                setPicked([]);
              },
            )
          }
        >
          {pending ? "Saving…" : `Approve ${picked.length || ""}`.trim()}
        </button>
        <button
          type="button"
          disabled={pending || !picked.length}
          className={small}
          onClick={() =>
            run(
              () => decideLeaveRequests(picked, "rejected"),
              (result) => {
                const n = (result as { data?: { decided: number } }).data?.decided ?? 0;
                setNote(`${n} ${n === 1 ? "request" : "requests"} rejected.`);
                setPicked([]);
              },
            )
          }
        >
          Reject {picked.length || ""}
        </button>
      </div>
    </div>
  );
}
