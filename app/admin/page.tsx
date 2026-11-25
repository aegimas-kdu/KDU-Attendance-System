import type { Metadata } from "next";
import Link from "next/link";
import {
  Alert,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Chip,
  Icon,
  Meter,
  PageHead,
  Table,
  Td,
  Th,
  Tile,
  icons,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerm, countUnassignedStudents } from "@/lib/data/academic";
import { countStudentsWithoutBatch } from "@/lib/data/people";
import { countOfferingsWithoutSchedule } from "@/lib/data/courses";
import { listUnclosedSessions } from "@/lib/data/schedule";
import { listPendingLeave } from "@/lib/data/leave";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const term = await getActiveTerm();

  if (!term) {
    return (
      <>
        <PageHead title="Overview" subtitle="Kyungdong University Global" />
        <Alert tone="warn" title="No active term">
          Nothing can be scheduled until one academic term is active.{" "}
          <Link href="/admin/academic">Set one up</Link>.
        </Alert>
      </>
    );
  }

  const [
    students,
    professors,
    offerings,
    summary,
    noBatch,
    noSection,
    noSchedule,
    openClasses,
    pendingLeave,
    activity,
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("professors").select("id", { count: "exact", head: true }),
    supabase
      .from("course_offerings")
      .select("id", { count: "exact", head: true })
      .eq("academic_term_id", term.id),
    supabase
      .from("student_attendance_summary")
      .select("present_count, late_count, absent_count, excused_count"),
    countStudentsWithoutBatch(),
    countUnassignedStudents(term.id),
    countOfferingsWithoutSchedule(term.id),
    listUnclosedSessions(),
    listPendingLeave(),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, profiles:actor_id ( full_name )")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totals = (summary.data ?? []).reduce(
    (acc, r) => ({
      present: acc.present + r.present_count,
      late: acc.late + r.late_count,
      absent: acc.absent + r.absent_count,
      excused: acc.excused + r.excused_count,
    }),
    { present: 0, late: 0, absent: 0, excused: 0 },
  );
  const marked = totals.present + totals.late + totals.absent + totals.excused;
  const attended = totals.present + totals.late + totals.excused;
  const rate = marked ? Math.round((attended / marked) * 100) : null;

  const staleLeave = pendingLeave.filter((r) => r.waiting_days >= 5).length;

  const attention = [
    {
      what: "Students with no intake batch",
      count: noBatch,
      why: "They cannot be enrolled in any course.",
      href: "/admin/people",
      action: "Fix",
    },
    {
      what: "Students in no section",
      count: noSection,
      why: "They have no class group this term.",
      href: "/admin/sections",
      action: "Assign",
    },
    {
      what: "Courses with no schedule",
      count: noSchedule,
      why: "No classes exist, so no attendance can be taken.",
      href: "/admin/schedule",
      action: "Schedule",
    },
    {
      what: "Classes left open over a day",
      count: openClasses.length,
      why: "Nobody is marked absent until the class is closed.",
      href: "/admin/schedule",
      action: "Review",
    },
    {
      what: "Leave waiting over 5 days",
      count: staleLeave,
      why: "Students are waiting for a decision.",
      href: "/admin/people",
      action: "Review",
    },
  ].filter((row) => row.count > 0);

  type Activity = {
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
    profiles: { full_name: string } | null;
  };

  return (
    <>
      <PageHead
        crumbs="Kyungdong University Global"
        title="Overview"
        subtitle={`${term.name} · ${new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Active students" value={students.count ?? 0} note="Across the university" />
        <Tile label="Professors" value={professors.count ?? 0} note="Teaching this term" />
        <Tile label="Courses this term" value={offerings.count ?? 0} note={term.name} />
        <Tile
          label="Attendance, whole university"
          value={rate === null ? "—" : `${rate}%`}
          note={marked ? undefined : "No classes closed yet"}
        >
          {marked > 0 && <Meter className="mt-3" {...totals} />}
        </Tile>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Needs attention">
            {attention.length > 0 ? (
              <Chip tone="absent">{attention.length} to look at</Chip>
            ) : (
              <Chip tone="present" dot>
                All clear
              </Chip>
            )}
          </CardHead>
          {attention.length === 0 ? (
            <CardBody>
              <p className="text-sm text-muted">
                No students without a batch or a section, every course has a schedule,
                no class has been left open and no leave request is overdue.
              </p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>What</Th>
                  <Th right>How many</Th>
                  <Th>Why it matters</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {attention.map((row) => (
                  <tr key={row.what}>
                    <Td>
                      <b>{row.what}</b>
                    </Td>
                    <Td right num>
                      <b>{row.count}</b>
                    </Td>
                    <Td className="text-muted">{row.why}</Td>
                    <Td right>
                      <Link
                        href={row.href}
                        className="inline-flex min-h-8 items-center rounded-md border border-line-2 bg-white px-3 text-[13px] font-semibold no-underline hover:bg-page"
                      >
                        {row.action}
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHead title={term.name}>
              <span className="flex-1" />
              <Chip tone="open">Active</Chip>
            </CardHead>
            <Table>
              <tbody>
                <tr>
                  <Td className="text-muted">Runs</Td>
                  <Td right num>
                    {new Date(term.start_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    –{" "}
                    {new Date(term.end_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Td>
                </tr>
                <tr>
                  <Td className="text-muted">Marks recorded</Td>
                  <Td right num>
                    {marked.toLocaleString("en-GB")}
                  </Td>
                </tr>
                <tr>
                  <Td className="text-muted">Leave pending</Td>
                  <Td right num>
                    {pendingLeave.length}
                  </Td>
                </tr>
              </tbody>
            </Table>
            <CardFoot>
              <Link href="/admin/academic" className="text-sm font-semibold">
                Manage terms
              </Link>
            </CardFoot>
          </Card>

          <Card>
            <CardHead title="Recent activity" />
            {(activity.data ?? []).length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">
                  Nothing recorded yet. The log fills as attendance is corrected,
                  leave is decided and the registry makes changes.
                </p>
              </CardBody>
            ) : (
              <Table>
                <tbody>
                  {((activity.data ?? []) as unknown as Activity[]).map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <b>{row.profiles?.full_name ?? "System"}</b>{" "}
                        <span className="text-muted">
                          {row.action.toLowerCase()}d {row.entity_type.replace(/_/g, " ")}
                        </span>
                        <small className="block text-[13px] text-muted">
                          {new Date(row.created_at).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <CardFoot>
              <Link href="/admin/activity" className="text-sm font-semibold">
                Full activity log
              </Link>
            </CardFoot>
          </Card>

          <Card tone="quiet">
            <CardBody>
              <p className="mb-2 flex items-center gap-2 text-card font-semibold">
                <Icon path={icons.warning} className="text-late" />
                Before anything else
              </p>
              <p className="text-sm text-muted">
                Professors have to exist before courses can be timetabled and before
                attendance can be taken. Create their accounts, then use{" "}
                <Link href="/admin/people">Students &amp; staff</Link> to turn each one
                into a professor.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
