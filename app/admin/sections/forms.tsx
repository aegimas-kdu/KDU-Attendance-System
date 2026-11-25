"use client";

import { useState } from "react";
import { assignToSection, createSection } from "@/lib/actions/admin";
import { Alert, Chip } from "@/components/ui";
import {
  CheckList,
  field,
  label,
  primary,
  small,
  smallPrimary,
  useAction,
} from "@/components/form-kit";

export function AddSection({
  termId,
  levels,
  batches,
}: {
  termId: string | null;
  levels: { id: string; name: string }[];
  batches: { id: string; name: string }[];
}) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState("");
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [batchIds, setBatchIds] = useState<string[]>([]);

  if (!termId) {
    return (
      <div className="p-5">
        <Alert>
          Make a term active first. Sections belong to a term, so there is nowhere to
          put one yet.
        </Alert>
      </div>
    );
  }

  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            createSection({
              academicLevelId: levelId,
              academicTermId: termId,
              sectionName: name,
              batchIds,
            }),
          () => {
            setName("");
            setBatchIds([]);
          },
        );
      }}
    >
      <div className="mb-4">
        <label className={label} htmlFor="section-name">
          Section name
        </label>
        <input
          id="section-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sophomore Section"
          className={field}
        />
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="section-level">
          Academic level
        </label>
        <select
          id="section-level"
          className={field}
          value={levelId}
          onChange={(e) => setLevelId(e.target.value)}
        >
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <span className={label}>Intakes that sit together</span>
        <CheckList
          options={batches.map((b) => ({ id: b.id, label: b.name }))}
          selected={batchIds}
          onChange={setBatchIds}
        />
        <p className="mt-1.5 text-[13px] text-muted">
          Students from these intakes share the same timetable.
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Creating…" : "Create section"}
      </button>
    </form>
  );
}

/** Puts the students who have no section into one. */
export function AssignUnassigned({
  sections,
  students,
}: {
  sections: { id: string; name: string }[];
  students: { id: string; number: string; name: string; batch: string | null }[];
}) {
  const { pending, error, note, setNote, run } = useAction();
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [picked, setPicked] = useState<string[]>([]);

  const allPicked = picked.length === students.length && students.length > 0;

  return (
    <div className="p-5">
      <p className="mb-4 text-sm text-muted">
        {students.length}{" "}
        {students.length === 1
          ? "student has no section this term"
          : "students have no section this term"}
        . Until they do, they get no timetable and nothing to mark attendance against.
      </p>

      <div className="mb-4 max-h-72 overflow-auto rounded-lg border border-line-2">
        {students.map((s) => (
          <label
            key={s.id}
            className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-line px-3 text-sm last:border-b-0 has-[:checked]:bg-brand-50"
          >
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-brand)]"
              checked={picked.includes(s.id)}
              onChange={() =>
                setPicked(
                  picked.includes(s.id)
                    ? picked.filter((p) => p !== s.id)
                    : [...picked, s.id],
                )
              }
            />
            <span className="num text-muted">{s.number}</span>
            <b className="min-w-0 flex-1 truncate font-semibold">{s.name}</b>
            {s.batch ? (
              <Chip tone="neutral">{s.batch}</Chip>
            ) : (
              <Chip tone="absent">No intake</Chip>
            )}
          </label>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className={label} htmlFor="assign-section">
            Put them in
          </label>
          <select
            id="assign-section"
            className={field}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={small}
          onClick={() => setPicked(allPicked ? [] : students.map((s) => s.id))}
        >
          {allPicked ? "Clear" : "Select all"}
        </button>
        <button
          type="button"
          disabled={pending || !picked.length || !sectionId}
          className={smallPrimary}
          onClick={() =>
            run(
              () => assignToSection(picked, sectionId),
              (result) => {
                const count = (result as { data?: { assigned: number } }).data?.assigned ?? 0;
                setNote(
                  `${count} ${count === 1 ? "student" : "students"} now in ${
                    sections.find((s) => s.id === sectionId)?.name ?? "the section"
                  }.`,
                );
                setPicked([]);
              },
            )
          }
        >
          {pending
            ? "Assigning…"
            : `Assign ${picked.length || ""}`.trim()}
        </button>
      </div>

      {note && <Alert tone="info">{note}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
