"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  activateTerm,
  createAcademicLevel,
  createIntakeBatch,
  createTerm,
  setConfigurationActive,
} from "@/lib/actions/admin";
import { Alert } from "@/components/ui";
import type { Semester } from "@/lib/database.types";

const field =
  "min-h-11 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30";
const label = "mb-1.5 block text-[13px] font-medium text-ink-2";
const primary =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60";
const small =
  "inline-flex min-h-8 items-center rounded-md border border-line-2 bg-white px-3 text-[13px] font-semibold hover:bg-page disabled:opacity-50";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        after?.();
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return { pending, error, run };
}

// ---------------------------------------------------------------- batch

export function AddBatch() {
  const { pending, error, run } = useAction();
  const [name, setName] = useState("");
  const [semester, setSemester] = useState<Semester>("Spring");
  const [year, setYear] = useState(new Date().getFullYear() + 1);

  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createIntakeBatch({ name, semester, startYear: year }),
          () => setName(""),
        );
      }}
    >
      <div className="mb-4">
        <label className={label} htmlFor="batch-name">
          Code
        </label>
        <input
          id="batch-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="2027-1"
          className={`${field} num`}
        />
        <p className="mt-1.5 text-[13px] text-muted">
          KDU&rsquo;s own notation: year, then semester.
        </p>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="batch-sem">
            Semester
          </label>
          <select
            id="batch-sem"
            className={field}
            value={semester}
            onChange={(e) => setSemester(e.target.value as Semester)}
          >
            <option>Spring</option>
            <option>Fall</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="batch-year">
            Start year
          </label>
          <input
            id="batch-year"
            type="number"
            min={2000}
            max={2100}
            className={`${field} num`}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
      </div>
      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Adding…" : "Add batch"}
      </button>
      <p className="mt-2 text-center text-[13px] text-muted">
        One batch per semester and year.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------- level

export function AddLevel({ nextSequence }: { nextSequence: number }) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createAcademicLevel({ name, sequenceNumber: nextSequence }),
          () => setName(""),
        );
      }}
    >
      <div className="min-w-48 flex-1">
        <label className={label} htmlFor="level-name">
          New level
        </label>
        <input
          id="level-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Graduate"
          className={field}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-page disabled:opacity-60"
      >
        {pending ? "Adding…" : `Add as level ${nextSequence}`}
      </button>
      {error && (
        <div className="w-full">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------- term

export function AddTerm() {
  const { pending, error, run } = useAction();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createTerm({ name, startDate: start, endDate: end }),
          () => {
            setName("");
            setStart("");
            setEnd("");
          },
        );
      }}
    >
      <div className="mb-4">
        <label className={label} htmlFor="term-name">
          Name
        </label>
        <input
          id="term-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Spring 2027"
          className={field}
        />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="term-start">
            Starts
          </label>
          <input
            id="term-start"
            type="date"
            required
            className={field}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="term-end">
            Ends
          </label>
          <input
            id="term-end"
            type="date"
            required
            className={field}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Adding…" : "Add term"}
      </button>
      <p className="mt-2 text-center text-[13px] text-muted">
        New terms start as &ldquo;being planned&rdquo;.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------- buttons

export function RetireButton({
  table,
  id,
  isActive,
}: {
  table: "intake_batches" | "academic_levels";
  id: string;
  isActive: boolean;
}) {
  const { pending, run } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      className={small}
      onClick={() => run(() => setConfigurationActive(table, id, !isActive))}
    >
      {isActive ? "Retire" : "Bring back"}
    </button>
  );
}

export function ActivateTermButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className={small} onClick={() => setConfirming(true)}>
        Make active
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[13px] text-muted">Moves the whole portal.</span>
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-8 items-center rounded-md bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
        onClick={() => run(() => activateTerm(id))}
      >
        {pending ? "Switching…" : "Confirm"}
      </button>
      <button type="button" className={small} onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
