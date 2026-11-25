"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Shared input styling, so every admin form looks like the same form. */
export const field =
  "min-h-11 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30";
export const label = "mb-1.5 block text-[13px] font-medium text-ink-2";
export const primary =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60";
export const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-page disabled:opacity-60";
export const small =
  "inline-flex min-h-8 items-center rounded-md border border-line-2 bg-white px-3 text-[13px] font-semibold hover:bg-page disabled:opacity-50";
export const smallPrimary =
  "inline-flex min-h-8 items-center rounded-md bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-800 disabled:opacity-50";

type AnyResult = { ok: boolean; error?: string };

/**
 * Runs a server action and keeps the page honest afterwards.
 *
 * `router.refresh()` re-runs the server components, so the table above the
 * form shows the row that was just added without a full page load.
 */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function run<T extends AnyResult>(
    fn: () => Promise<T>,
    after?: (result: T & { ok: true }) => void,
  ) {
    setError(null);
    setNote(null);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        after?.(result as T & { ok: true });
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return { pending, error, note, setNote, setError, run };
}

/** A tick-box list — eligible intake batches, mostly. */
export function CheckList({
  options,
  selected,
  onChange,
}: {
  options: { id: string; label: string; hint?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  }

  return (
    <div className="grid gap-1.5">
      {options.map((option) => (
        <label
          key={option.id}
          className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-line-2 bg-white px-3 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
        >
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-brand)]"
            checked={selected.includes(option.id)}
            onChange={() => toggle(option.id)}
          />
          <span className="num font-semibold">{option.label}</span>
          {option.hint && <span className="text-[13px] text-muted">{option.hint}</span>}
        </label>
      ))}
    </div>
  );
}
