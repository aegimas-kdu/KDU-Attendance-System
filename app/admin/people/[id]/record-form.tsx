"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAccountStatus, updateStudentRecord } from "@/lib/actions/admin";
import { Alert } from "@/components/ui";
import type {
  AcademicLevel,
  AccountStatus,
  Department,
  IntakeBatch,
} from "@/lib/database.types";

export function RecordForm({
  studentId,
  profileId,
  initial,
  batches,
  levels,
  departments,
  accountStatus,
}: {
  studentId: string;
  profileId: string;
  initial: {
    fullName: string;
    studentNumber: string;
    intakeBatchId: string | null;
    academicLevelId: string | null;
    departmentId: string | null;
  };
  batches: IntakeBatch[];
  levels: AcademicLevel[];
  departments: Department[];
  accountStatus: AccountStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<
    { tone: "info" | "danger"; text: string } | null
  >(null);

  const dirty =
    form.fullName !== initial.fullName ||
    form.studentNumber !== initial.studentNumber ||
    form.intakeBatchId !== initial.intakeBatchId ||
    form.academicLevelId !== initial.academicLevelId ||
    form.departmentId !== initial.departmentId;

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await updateStudentRecord({
        studentId,
        fullName: form.fullName,
        studentNumber: form.studentNumber,
        intakeBatchId: form.intakeBatchId,
        academicLevelId: form.academicLevelId,
        departmentId: form.departmentId,
      });
      setMessage(
        result.ok
          ? { tone: "info", text: "Saved." }
          : { tone: "danger", text: result.error },
      );
      if (result.ok) router.refresh();
    });
  }

  function toggleStatus() {
    start(async () => {
      const next: AccountStatus = accountStatus === "active" ? "suspended" : "active";
      const result = await setAccountStatus(profileId, next);
      setMessage(
        result.ok
          ? { tone: "info", text: next === "active" ? "Account reactivated." : "Account suspended." }
          : { tone: "danger", text: result.error },
      );
      if (result.ok) router.refresh();
    });
  }

  const field =
    "min-h-11 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30";
  const label = "mb-1.5 block text-[13px] font-medium text-ink-2";

  return (
    <form onSubmit={save}>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="full-name">
            Full name
          </label>
          <input
            id="full-name"
            className={field}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="student-number">
            Student number
          </label>
          <input
            id="student-number"
            className={`${field} num`}
            value={form.studentNumber}
            onChange={(e) => setForm({ ...form, studentNumber: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="intake">
            Intake batch
          </label>
          <select
            id="intake"
            className={field}
            value={form.intakeBatchId ?? ""}
            onChange={(e) =>
              setForm({ ...form, intakeBatchId: e.target.value || null })
            }
          >
            <option value="">Not set</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[13px] text-muted">
            Decides which courses this student may be enrolled in. Without one,
            every enrolment is refused.
          </p>
        </div>
        <div>
          <label className={label} htmlFor="level">
            Academic level
          </label>
          <select
            id="level"
            className={field}
            value={form.academicLevelId ?? ""}
            onChange={(e) =>
              setForm({ ...form, academicLevelId: e.target.value || null })
            }
          >
            <option value="">Not set</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="department">
            Department
          </label>
          <select
            id="department"
            className={field}
            value={form.departmentId ?? ""}
            onChange={(e) =>
              setForm({ ...form, departmentId: e.target.value || null })
            }
          >
            <option value="">Not set</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[13px] text-muted">
            Students choose this when they register, and can correct it in their own
            profile. You can change it for anyone.
          </p>
        </div>

        {message && (
          <div className="sm:col-span-2">
            <Alert tone={message.tone}>{message.text}</Alert>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-b-card border-t border-line bg-[#fafbfc] px-5 py-3">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => setForm(initial)}
          disabled={pending || !dirty}
          className="inline-flex min-h-11 items-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-page disabled:opacity-50"
        >
          Cancel
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={toggleStatus}
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-page disabled:opacity-50"
        >
          {accountStatus === "active" ? "Suspend account" : "Reactivate account"}
        </button>
      </div>
    </form>
  );
}
