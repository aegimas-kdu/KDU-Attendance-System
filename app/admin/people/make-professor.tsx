"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerProfessorByEmail } from "@/lib/actions/admin";
import { Alert, Card, CardBody, CardHead } from "@/components/ui";

const DEPARTMENTS = [
  "Smart Computing",
  "International Business Administration",
  "Artificial Intelligence",
  "Hospitality and AI Innovation",
  "AI Integration and Digital Technology",
];

/**
 * Turning an account into a professor.
 *
 * This has to come before everything else: a timetable slot needs a
 * professor, and attendance needs a timetable.
 */
export function MakeProfessor() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [message, setMessage] = useState<
    { tone: "info" | "danger"; text: string } | null
  >(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    start(async () => {
      const result = await registerProfessorByEmail({
        email,
        employeeId,
        department,
      });

      if (result.ok) {
        setMessage({
          tone: "info",
          text: `${result.data.name} is now a professor, employee ${employeeId}.`,
        });
        setEmail("");
        setEmployeeId("");
        router.refresh();
      } else {
        setMessage({ tone: "danger", text: result.error });
      }
    });
  }

  const field =
    "min-h-11 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30";
  const label = "mb-1.5 block text-[13px] font-medium text-ink-2";

  return (
    <Card tone="brand">
      <CardHead title="Make someone a professor" tone="brand" />
      <CardBody>
        <p className="mb-4 text-sm text-muted">
          The person needs a Supabase Auth account first. Creating one makes them a
          student, because self-registration always does; this converts it.
        </p>

        <form onSubmit={submit}>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="prof-email">
                Email address
              </label>
              <input
                id="prof-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarwar@kdu.edu"
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="prof-emp">
                Employee ID
              </label>
              <input
                id="prof-emp"
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="EMP-SARWAR"
                className={field}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="prof-dept">
                Department
              </label>
              <select
                id="prof-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={field}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {message && (
            <div className="mb-4">
              <Alert tone={message.tone}>{message.text}</Alert>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {pending ? "Converting…" : "Make professor"}
          </button>
        </form>
      </CardBody>
    </Card>
  );
}
