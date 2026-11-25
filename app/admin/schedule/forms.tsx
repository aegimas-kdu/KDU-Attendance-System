"use client";

import { useState } from "react";
import {
  addTimetableSlot,
  findTimetableClashes,
  removeTimetableSlot,
} from "@/lib/actions/admin";
import { Alert } from "@/components/ui";
import { field, label, primary, small, smallPrimary, useAction } from "@/components/form-kit";
import type { LectureType, Weekday } from "@/lib/database.types";

const PERIODS = [
  { start: "09:00", end: "09:50" },
  { start: "10:00", end: "10:50" },
  { start: "11:00", end: "11:50" },
  { start: "12:00", end: "12:50" },
];

const DAYS: { value: Weekday; name: string }[] = [
  { value: 1, name: "Monday" },
  { value: 2, name: "Tuesday" },
  { value: 3, name: "Wednesday" },
  { value: 4, name: "Thursday" },
  { value: 5, name: "Friday" },
];

const KINDS: LectureType[] = ["Lecture", "Tutorial", "Seminar", "Lab"];

/**
 * Adds one recurring class time.
 *
 * Two classes in one room is a timetabling mistake, not a broken record, so
 * the database allows it and this form warns instead — before saving, and
 * naming what it would collide with.
 */
export function AddSlot({
  offerings,
  professors,
  rooms,
}: {
  offerings: { id: string; name: string; code: string }[];
  professors: { id: string; name: string; employeeId: string }[];
  rooms: string[];
}) {
  const { pending, error, note, setNote, run } = useAction();

  const [offeringId, setOfferingId] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [weekday, setWeekday] = useState<Weekday>(1);
  const [period, setPeriod] = useState(0);
  const [room, setRoom] = useState("");
  const [kind, setKind] = useState<LectureType>("Lecture");
  const [warning, setWarning] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const slot = PERIODS[period];

  if (offerings.length === 0) {
    return (
      <div className="p-5">
        <Alert>
          No courses are running this term yet. Add one under Courses first, then give it
          a time here.
        </Alert>
      </div>
    );
  }

  if (professors.length === 0) {
    return (
      <div className="p-5">
        <Alert>
          No professors have been added yet. A class time belongs to a professor, so add
          them under Students &amp; staff first.
        </Alert>
      </div>
    );
  }

  async function check() {
    setChecking(true);
    setWarning(null);
    const result = await findTimetableClashes({
      professorId,
      weekday,
      startTime: slot.start,
      endTime: slot.end,
      room: room || null,
    });
    setChecking(false);

    if (!result.ok) {
      setWarning(result.error);
      return;
    }

    const { professor, room: roomClash } = result.data;
    const parts: string[] = [];
    const who = professors.find((p) => p.id === professorId)?.name ?? "That professor";
    if (professor > 0) parts.push(`${who} already teaches at that time`);
    if (roomClash > 0) parts.push(`room ${room} is already taken then`);

    setWarning(
      parts.length
        ? `${parts.join(", and ")}. Save it anyway only if that is what you mean.`
        : null,
    );
    if (!parts.length) setNote("Nothing clashes with that time.");
  }

  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            addTimetableSlot({
              offeringId,
              professorId,
              weekday,
              startTime: slot.start,
              endTime: slot.end,
              room: room || null,
              lectureType: kind,
            }),
          () => {
            setNote("Class time added. Classes are created from it for the whole term.");
            setWarning(null);
            setRoom("");
          },
        );
      }}
    >
      <div className="mb-4">
        <label className={label} htmlFor="slot-offering">
          Course
        </label>
        <select
          id="slot-offering"
          required
          className={field}
          value={offeringId}
          onChange={(e) => {
            setOfferingId(e.target.value);
            setWarning(null);
          }}
        >
          <option value="">Choose a course</option>
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} — {o.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="slot-professor">
          Professor
        </label>
        <select
          id="slot-professor"
          required
          className={field}
          value={professorId}
          onChange={(e) => {
            setProfessorId(e.target.value);
            setWarning(null);
          }}
        >
          <option value="">Choose a professor</option>
          {professors.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[13px] text-muted">
          They see only their own classes, and only they can open this one for marking.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="slot-day">
            Day
          </label>
          <select
            id="slot-day"
            className={field}
            value={weekday}
            onChange={(e) => {
              setWeekday(Number(e.target.value) as Weekday);
              setWarning(null);
            }}
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="slot-period">
            Period
          </label>
          <select
            id="slot-period"
            className={`${field} num`}
            value={period}
            onChange={(e) => {
              setPeriod(Number(e.target.value));
              setWarning(null);
            }}
          >
            {PERIODS.map((p, i) => (
              <option key={p.start} value={i}>
                {i + 1} · {p.start} – {p.end}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="slot-room">
            Room
          </label>
          <input
            id="slot-room"
            list="known-rooms"
            value={room}
            onChange={(e) => {
              setRoom(e.target.value);
              setWarning(null);
            }}
            placeholder="5302"
            className={`${field} num`}
          />
          <datalist id="known-rooms">
            {rooms.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={label} htmlFor="slot-kind">
            Kind
          </label>
          <select
            id="slot-kind"
            className={field}
            value={kind}
            onChange={(e) => setKind(e.target.value as LectureType)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      </div>

      {warning && (
        <div className="mb-4">
          <Alert>{warning}</Alert>
        </div>
      )}
      {note && !warning && (
        <div className="mb-4">
          <Alert tone="info">{note}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div className="grid gap-2">
        <button
          type="button"
          disabled={checking || !professorId}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-page disabled:opacity-60"
          onClick={check}
        >
          {checking ? "Checking…" : "Check for clashes"}
        </button>
        <button
          type="submit"
          disabled={pending || !offeringId || !professorId}
          className={primary}
        >
          {pending ? "Adding…" : "Add class time"}
        </button>
      </div>

      <p className="mt-2 text-center text-[13px] text-muted">
        Classes run 50 minutes, with a 10 minute break between them.
      </p>
    </form>
  );
}

export function RemoveSlot({ slotId }: { slotId: string }) {
  const { pending, error, run } = useAction();
  const [confirming, setConfirming] = useState(false);

  if (error) return <span className="text-[13px] text-absent-ink">{error}</span>;

  if (!confirming) {
    return (
      <button
        type="button"
        className={small}
        onClick={() => setConfirming(true)}
        aria-label="Remove this class time"
      >
        Remove
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className={smallPrimary}
        onClick={() => run(() => removeTimetableSlot(slotId))}
      >
        {pending ? "Removing…" : "Confirm"}
      </button>
      <button type="button" className={small} onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
