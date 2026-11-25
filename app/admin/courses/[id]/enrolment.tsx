"use client";

import { useState } from "react";
import { dropEnrolment, enrolSection, setOfferingBatches } from "@/lib/actions/admin";
import { Alert } from "@/components/ui";
import {
  CheckList,
  field,
  label,
  small,
  smallPrimary,
  useAction,
} from "@/components/form-kit";

/** Which intakes may take this course. The trigger refuses everyone else. */
export function EligibleIntakes({
  offeringId,
  batches,
  current,
}: {
  offeringId: string;
  batches: { id: string; name: string; students: number }[];
  current: string[];
}) {
  const { pending, error, note, setNote, run } = useAction();
  const [picked, setPicked] = useState<string[]>(current);

  const changed =
    picked.length !== current.length || picked.some((p) => !current.includes(p));

  return (
    <div className="p-5">
      <CheckList
        options={batches.map((b) => ({
          id: b.id,
          label: b.name,
          hint: `${b.students} ${b.students === 1 ? "student" : "students"}`,
        }))}
        selected={picked}
        onChange={setPicked}
      />

      <p className="mt-3 text-[13px] text-muted">
        Removing an intake stops new enrolments from it. Students already enrolled stay,
        along with their attendance.
      </p>

      {note && (
        <div className="mt-3">
          <Alert tone="info">{note}</Alert>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !changed}
          className={smallPrimary}
          onClick={() =>
            run(
              () => setOfferingBatches(offeringId, picked),
              () => setNote("Saved."),
            )
          }
        >
          {pending ? "Saving…" : "Save intakes"}
        </button>
        {changed && (
          <button type="button" className={small} onClick={() => setPicked(current)}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

/** Enrols a whole section at once, skipping anyone the intakes exclude. */
export function EnrolSection({
  offeringId,
  sections,
}: {
  offeringId: string;
  sections: { id: string; name: string; students: number }[];
}) {
  const { pending, error, note, setNote, run } = useAction();
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");

  if (sections.length === 0) {
    return (
      <div className="p-5">
        <Alert>
          There are no sections this term, so there is nobody to enrol as a group yet.
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="mb-4">
        <label className={label} htmlFor="enrol-section">
          Enrol a whole section
        </label>
        <select
          id="enrol-section"
          className={field}
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.students} students
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[13px] text-muted">
          Anyone whose intake is not open to this course is left out, and said so below.
        </p>
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

      <button
        type="button"
        disabled={pending || !sectionId}
        className={smallPrimary}
        onClick={() =>
          run(
            () => enrolSection(offeringId, sectionId),
            (result) => {
              const data = (result as { data?: { enrolled: number; skipped: number } })
                .data;
              const enrolled = data?.enrolled ?? 0;
              const skipped = data?.skipped ?? 0;
              setNote(
                skipped > 0
                  ? `${enrolled} enrolled. ${skipped} left out — their intake is not open to this course.`
                  : `${enrolled} ${enrolled === 1 ? "student" : "students"} enrolled.`,
              );
            },
          )
        }
      >
        {pending ? "Enrolling…" : "Enrol them"}
      </button>
    </div>
  );
}

export function DropButton({ enrolmentId }: { enrolmentId: string }) {
  const { pending, error, run } = useAction();
  const [confirming, setConfirming] = useState(false);

  if (error) return <span className="text-[13px] text-absent-ink">{error}</span>;

  if (!confirming) {
    return (
      <button type="button" className={small} onClick={() => setConfirming(true)}>
        Drop
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[13px] text-muted">Keeps their attendance.</span>
      <button
        type="button"
        disabled={pending}
        className={smallPrimary}
        onClick={() => run(() => dropEnrolment(enrolmentId))}
      >
        {pending ? "Dropping…" : "Confirm"}
      </button>
      <button type="button" className={small} onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
