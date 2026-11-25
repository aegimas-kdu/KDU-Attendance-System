"use client";

import { useState } from "react";
import { createCourse, createOffering } from "@/lib/actions/admin";
import { Alert } from "@/components/ui";
import { CheckList, field, label, primary, useAction } from "@/components/form-kit";

/** A course exists once. It is then offered in a term, possibly many times. */
export function AddCourse() {
  const { pending, error, run } = useAction();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [credits, setCredits] = useState(3);

  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createCourse({ courseCode: code, courseName: name, credits }),
          () => {
            setCode("");
            setName("");
          },
        );
      }}
    >
      <div className="mb-4">
        <label className={label} htmlFor="course-code">
          Course code
        </label>
        <input
          id="course-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="SC201"
          className={`${field} num uppercase`}
        />
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="course-name">
          Course name
        </label>
        <input
          id="course-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="System Analysis and Design"
          className={field}
        />
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="course-credits">
          Credits
        </label>
        <input
          id="course-credits"
          type="number"
          min={1}
          max={10}
          required
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value))}
          className={`${field} num`}
        />
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Adding…" : "Add to catalogue"}
      </button>
      <p className="mt-2 text-center text-[13px] text-muted">
        Each code is used once across the university.
      </p>
    </form>
  );
}

/**
 * Puts a course into the term and says which intakes may take it.
 *
 * The intakes are the gate: tick 2025-2 alone and only that intake can be
 * enrolled, which is how Communication in Korean III ends up with 29 of the
 * section's 53 students.
 */
export function AddOffering({
  termId,
  termName,
  courses,
  batches,
}: {
  termId: string | null;
  termName: string | null;
  courses: { id: string; code: string; name: string }[];
  batches: { id: string; name: string; students: number }[];
}) {
  const { pending, error, note, setNote, run } = useAction();
  const [courseId, setCourseId] = useState("");
  const [name, setName] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);

  if (!termId) {
    return (
      <div className="p-5">
        <Alert>
          Make a term active first. A course is offered in a term, so there is nowhere
          to put one yet.
        </Alert>
      </div>
    );
  }

  const chosen = courses.find((c) => c.id === courseId);
  const reach = batches
    .filter((b) => batchIds.includes(b.id))
    .reduce((sum, b) => sum + b.students, 0);

  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            createOffering({
              courseId,
              academicTermId: termId,
              offeringName: name || (chosen ? `${chosen.name} — ${termName}` : ""),
              batchIds,
            }),
          () => {
            setNote(`${chosen?.name ?? "The course"} is now running in ${termName}.`);
            setCourseId("");
            setName("");
            setBatchIds([]);
          },
        );
      }}
    >
      <div className="mb-4">
        <label className={label} htmlFor="offering-course">
          Course
        </label>
        <select
          id="offering-course"
          required
          className={field}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">Choose a course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="offering-name">
          Shown to students as
        </label>
        <input
          id="offering-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={chosen ? `${chosen.name} — ${termName}` : "Course — term"}
          className={field}
        />
        <p className="mt-1.5 text-[13px] text-muted">
          Leave this empty to use the course name and term.
        </p>
      </div>

      <div className="mb-4">
        <span className={label}>Who may take it</span>
        <CheckList
          options={batches.map((b) => ({
            id: b.id,
            label: b.name,
            hint: `${b.students} ${b.students === 1 ? "student" : "students"}`,
          }))}
          selected={batchIds}
          onChange={setBatchIds}
        />
        <p className="mt-1.5 text-[13px] text-muted">
          {batchIds.length === 0
            ? "Nobody can be enrolled until at least one intake is ticked."
            : `${reach} ${reach === 1 ? "student is" : "students are"} eligible.`}
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

      <button type="submit" disabled={pending || !courseId} className={primary}>
        {pending ? "Adding…" : "Run this course"}
      </button>
    </form>
  );
}
