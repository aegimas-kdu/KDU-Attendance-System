import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Chip,
  Empty,
  Legend,
  Meter,
  PageHead,
  Table,
  Td,
  Th,
  Tile,
} from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { getStudentAttendance } from "@/lib/data/attendance";
import { listLeaveRequests } from "@/lib/data/leave";

export const metadata: Metadata = { title: "My attendance" };

export default async function MyAttendancePage() {
  const viewer = await requireStudent();

  const [courses, leave] = await Promise.all([
    getStudentAttendance(viewer.studentId),
    listLeaveRequests(),
  ]);

  const rated = courses.filter((c) => c.attendance_rate !== null);
  const overall = rated.length
    ? Math.round(
        rated.reduce((sum, c) => sum + Number(c.attendance_rate ?? 0), 0) / rated.length,
      )
    : null;

  const totals = courses.reduce(
    (sum, c) => ({
      present: sum.present + c.present_count,
      late: sum.late + c.late_count,
      absent: sum.absent + c.absent_count,
      excused: sum.excused + c.excused_count,
      held: sum.held + c.sessions_held,
    }),
    { present: 0, late: 0, absent: 0, excused: 0, held: 0 },
  );

  const atRisk = courses.filter((c) => Number(c.attendance_rate ?? 100) < 75);
  const approved = leave.filter((r) => r.status === "approved").length;

  return (
    <>
      <PageHead
        crumbs={<Link href="/student">Today</Link>}
        title="My attendance"
        subtitle="Every course you take, and where you stand in each. Three lates count as one absence, and an approved leave request does not count at all."
      >
        {overall !== null && (
          <Chip tone={overall < 75 ? "absent" : "present"} dot>
            {overall}% overall
          </Chip>
        )}
      </PageHead>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Overall"
          value={overall === null ? "—" : `${overall}%`}
          note={`${totals.held} classes held`}
        />
        <Tile label="Present" value={totals.present} note={`${totals.late} late`} />
        <Tile
          label="Absent"
          value={totals.absent}
          note={`${totals.excused} excused by leave`}
        />
        <Tile
          label="Courses below 75%"
          value={atRisk.length}
          note={
            atRisk.length > 0
              ? "You may be barred from the exam"
              : "You are on track everywhere"
          }
        />
      </div>

      <Card>
        <CardHead title="Course by course">
          <span className="flex-1" />
          {approved > 0 && (
            <Chip tone="excused">
              {approved} {approved === 1 ? "absence" : "absences"} excused
            </Chip>
          )}
        </CardHead>

        <CardBody className="pb-3">
          <Legend />
        </CardBody>

        {courses.length === 0 ? (
          <CardBody>
            <Empty title="No attendance yet">
              Your record starts the first time a professor takes attendance in one of
              your classes.
            </Empty>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Course</Th>
                <Th>Record</Th>
                <Th right>Classes held</Th>
                <Th right>Counts as absent</Th>
                <Th right>Attendance</Th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const rate = c.attendance_rate === null ? null : Number(c.attendance_rate);
                const low = rate !== null && rate < 75;
                return (
                  <tr key={c.offering_id} className={low ? "bg-[#fff8f8]" : undefined}>
                    <Td>
                      <Link
                        href={`/student/courses/${c.offering_id}`}
                        className="no-underline"
                      >
                        <b className="text-brand-900">{c.course_name}</b>
                      </Link>
                      <small className="num block text-[13px] text-muted">
                        {c.course_code}
                        {c.professor_name ? ` · ${c.professor_name}` : ""}
                      </small>
                    </Td>
                    <Td>
                      <Meter
                        present={c.present_count}
                        late={c.late_count}
                        absent={c.absent_count}
                        excused={c.excused_count}
                        className="min-w-32"
                      />
                      <small className="num mt-1 block text-[13px] text-muted">
                        {c.present_count} present · {c.late_count} late ·{" "}
                        {c.absent_count} absent
                        {c.excused_count > 0 ? ` · ${c.excused_count} excused` : ""}
                      </small>
                    </Td>
                    <Td right num className="text-muted">
                      {c.sessions_held}
                    </Td>
                    <Td right num>
                      <b>{c.effective_absences}</b>
                      {c.penalty_absences > 0 && (
                        <small className="block text-[13px] text-muted">
                          {c.penalty_absences} from lates
                        </small>
                      )}
                    </Td>
                    <Td right num>
                      {rate === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <b className={low ? "text-absent-ink" : undefined}>{rate}%</b>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <CardFoot>
          <span className="text-sm text-muted">
            A mark can only be changed by the professor of that class or the registry,
            and every change is recorded with their name. If something looks wrong,
            speak to your professor.
          </span>
        </CardFoot>
      </Card>
    </>
  );
}
