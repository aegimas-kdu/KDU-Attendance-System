import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardFoot,
  CardHead,
  Chip,
  Empty,
  PageHead,
  Person,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { listIntakeBatches, listAcademicLevels } from "@/lib/data/academic";
import { listProfessors, listStudents } from "@/lib/data/people";
import { MakeProfessor } from "./make-professor";

export const metadata: Metadata = { title: "Students & staff" };

type Search = {
  tab?: string;
  q?: string;
  batch?: string;
  level?: string;
  status?: string;
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const tab = params.tab === "professors" ? "professors" : "students";

  const [batches, levels, students, professors] = await Promise.all([
    listIntakeBatches(),
    listAcademicLevels(),
    tab === "students"
      ? listStudents({
          search: params.q,
          intakeBatchId: params.batch,
          academicLevelId: params.level,
          status: params.status as "active" | "suspended" | "inactive" | undefined,
        })
      : Promise.resolve([]),
    listProfessors(),
  ]);

  type ProfessorRow = {
    id: string;
    employee_id: string;
    department: string | null;
    profiles: {
      id: string;
      full_name: string;
      email: string;
      account_status: string;
    } | null;
  };

  const profRows = professors as unknown as ProfessorRow[];

  const field =
    "min-h-10 rounded-lg border border-line-2 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600";

  return (
    <>
      <PageHead
        crumbs={<Link href="/admin">Overview</Link>}
        title="Students &amp; staff"
        subtitle="Everyone with an account. Nothing here is ever deleted — suspend instead, so attendance history stays readable."
      />

      <div className="mb-5 flex flex-wrap gap-0.5 rounded-[10px] bg-[#edeff3] p-1">
        <Link
          href="/admin/people"
          className={`rounded-md px-3.5 py-2 text-sm font-semibold no-underline ${
            tab === "students" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Students ({students.length})
        </Link>
        <Link
          href="/admin/people?tab=professors"
          className={`rounded-md px-3.5 py-2 text-sm font-semibold no-underline ${
            tab === "professors" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Professors ({profRows.length})
        </Link>
      </div>

      {tab === "students" ? (
        <>
          <form className="mb-5 flex flex-wrap items-center gap-2.5">
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Name, student number or email"
              aria-label="Search students"
              className={`${field} min-w-60 flex-1`}
            />
            <select name="batch" defaultValue={params.batch ?? ""} aria-label="Intake batch" className={field}>
              <option value="">Any intake</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select name="level" defaultValue={params.level ?? ""} aria-label="Academic level" className={field}>
              <option value="">Any level</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={params.status ?? ""} aria-label="Account status" className={field}>
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-page"
            >
              Filter
            </button>
          </form>

          <Card className="mb-5">
            {students.length === 0 ? (
              <div className="p-5">
                <Empty title="No students yet">
                  Students appear here once they register, or once you import them.
                </Empty>
              </div>
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Number</Th>
                      <Th>Intake</Th>
                      <Th>Level</Th>
                      <Th>Section</Th>
                      <Th right>Courses</Th>
                      <Th>Status</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} className={!s.intake_batch ? "bg-[#fff8f8]" : undefined}>
                        <Td>
                          <Person name={s.profile.full_name} detail={s.profile.email} />
                        </Td>
                        <Td num>{s.student_id}</Td>
                        <Td>
                          {s.intake_batch ? (
                            <Chip tone="ghost">{s.intake_batch}</Chip>
                          ) : (
                            <Chip tone="absent" dot>
                              Not set
                            </Chip>
                          )}
                        </Td>
                        <Td>{s.academic_level ?? <span className="text-muted">—</span>}</Td>
                        <Td className="text-muted">{s.section ?? "—"}</Td>
                        <Td right num>
                          {s.course_count}
                        </Td>
                        <Td>
                          {s.profile.account_status === "active" ? (
                            <Chip tone="present" dot>
                              Active
                            </Chip>
                          ) : (
                            <Chip tone="late" dot>
                              {s.profile.account_status}
                            </Chip>
                          )}
                        </Td>
                        <Td right>
                          <Link
                            href={`/admin/people/${s.id}`}
                            className="inline-flex min-h-8 items-center rounded-md border border-line-2 bg-white px-3 text-[13px] font-semibold no-underline hover:bg-page"
                          >
                            Open
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <CardFoot>
                  <span className="text-sm text-muted">
                    {students.length} shown. A student with no intake batch is highlighted —
                    they cannot be enrolled in anything until it is set.
                  </span>
                </CardFoot>
              </>
            )}
          </Card>
        </>
      ) : (
        <Card className="mb-5">
          <CardHead title={`${profRows.length} professors`} />
          {profRows.length === 0 ? (
            <div className="p-5">
              <Empty title="No professors yet">
                Create their Auth accounts in Supabase, then convert them below.
                Nothing can be timetabled until at least one exists.
              </Empty>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Employee ID</Th>
                  <Th>Department</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {profRows.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Person
                        name={p.profiles?.full_name ?? "—"}
                        detail={p.profiles?.email}
                      />
                    </Td>
                    <Td num>{p.employee_id}</Td>
                    <Td className="text-muted">{p.department ?? "—"}</Td>
                    <Td>
                      {p.profiles?.account_status === "active" ? (
                        <Chip tone="present" dot>
                          Active
                        </Chip>
                      ) : (
                        <Chip tone="late" dot>
                          {p.profiles?.account_status ?? "unknown"}
                        </Chip>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      <MakeProfessor />
    </>
  );
}
