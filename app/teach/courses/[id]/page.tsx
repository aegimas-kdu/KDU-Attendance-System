import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  Person,
  Table,
  Td,
  Th,
  Tile,
} from "@/components/ui";
import { getOfferingAttendance, getSessionBreakdown } from "@/lib/data/attendance";
import { getOffering } from "@/lib/data/courses";
import { hhmm, listOfferingSessions } from "@/lib/data/schedule";

export const metadata: Metadata = { title: "Class list" };

export default async function TeachCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const offering = await getOffering(id);
  if (!offering) notFound();

  const [students, breakdown, sessions] = await Promise.all([
    getOfferingAttendance(id),
    getSessionBreakdown(id),
    listOfferingSessions(id),
  ]);

  const course = offering.courses as unknown as {
    course_code: string;
    course_name: string;
    credits: number;
  } | null;

  const rated = students.filter((s) => s.attendance_rate !== null);
  const average = rated.length
    ? Math.round(
        rated.reduce((sum, s) => sum + Number(s.attendance_rate ?? 0), 0) / rated.length,
      )
    : null;
  const atRisk = students.filter((s) => Number(s.attendance_rate ?? 100) < 75);

  const held = sessions.filter((s) => s.status === "closed").length;
  const remaining = sessions.filter((s) => s.status === "scheduled").length;

  return (
    <>
      <PageHead
        crumbs={
          <>
            <Link href="/teach">Today</Link> ·{" "}
            <Link href="/teach/courses">My courses</Link>
          </>
        }
        title={course?.course_name ?? offering.offering_name}
        subtitle={
          course
            ? `${course.course_code} · ${course.credits} credits · ${students.length} students`
            : offering.offering_name
        }
      >
        <Link
          href={`/teach/materials/${id}`}
          className="inline-flex min-h-9 items-center rounded-lg border border-line-2 bg-white px-3 text-sm font-semibold no-underline hover:bg-page"
        >
          Course files
        </Link>
      </PageHead>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Classes held" value={held} note={`${remaining} still to come`} />
        <Tile
          label="Average attendance"
          value={average === null ? "—" : `${average}%`}
          note={average === null ? "No classes marked yet" : undefined}
        />
        <Tile label="Students" value={students.length} />
        <Tile
          label="Below 75%"
          value={atRisk.length}
          note={
            atRisk.length > 0
              ? "At risk of being barred from the exam"
              : "Nobody at risk"
          }
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Class list">
            <span className="flex-1" />
            {atRisk.length > 0 && <Chip tone="absent">{atRisk.length} below 75%</Chip>}
          </CardHead>

          {students.length === 0 ? (
            <CardBody>
              <Empty title="Nobody enrolled yet">
                The registry enrols students under the course. Until then there is no
                class list.
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Intake</Th>
                  <Th>Record</Th>
                  <Th right>Attendance</Th>
                  <Th right>Counts as absent</Th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const rate = s.attendance_rate === null ? null : Number(s.attendance_rate);
                  const low = rate !== null && rate < 75;
                  return (
                    <tr key={s.student_id} className={low ? "bg-[#fff8f8]" : undefined}>
                      <Td>
                        <Person name={s.full_name} detail={s.student_number} />
                      </Td>
                      <Td>
                        {s.intake_batch ? (
                          <Chip tone="neutral">{s.intake_batch}</Chip>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                      <Td>
                        <Meter
                          present={s.present_count}
                          late={s.late_count}
                          absent={s.absent_count}
                          excused={s.excused_count}
                          className="min-w-28"
                        />
                        <small className="num mt-1 block text-[13px] text-muted">
                          {s.present_count} present · {s.late_count} late ·{" "}
                          {s.absent_count} absent
                        </small>
                      </Td>
                      <Td right num>
                        {rate === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <b className={low ? "text-absent-ink" : undefined}>{rate}%</b>
                        )}
                      </Td>
                      <Td right num>
                        <b>{s.effective_absences}</b>
                        {s.penalty_absences > 0 && (
                          <small className="block text-[13px] text-muted">
                            {s.penalty_absences} from lates
                          </small>
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
              Three lates count as one absence, and approved leave does not count at all.
              The marks recorded on the day are never rewritten — the rule is applied
              when this is read.
            </span>
          </CardFoot>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHead title="Attendance by class" />
            {breakdown.length === 0 ? (
              <CardBody>
                <Empty title="No classes marked yet">
                  Each class you close appears here, newest at the bottom.
                </Empty>
              </CardBody>
            ) : (
              <>
                <CardBody className="pb-3">
                  <Legend />
                </CardBody>
                <div className="px-5 pb-5">
                  {breakdown.map((day) => {
                    const total =
                      day.present + day.late + day.absent + day.excused;
                    const here = total ? Math.round(((day.present + day.late) / total) * 100) : 0;
                    return (
                      <div key={day.date} className="mb-3 last:mb-0">
                        <div className="mb-1.5 flex items-baseline gap-2">
                          <span className="num text-[13px] font-semibold">
                            {new Date(day.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="flex-1" />
                          <span
                            className={`num text-[13px] font-semibold ${
                              here < 75 ? "text-absent-ink" : "text-muted"
                            }`}
                          >
                            {here}%
                          </span>
                        </div>
                        <Meter
                          present={day.present}
                          late={day.late}
                          absent={day.absent}
                          excused={day.excused}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHead title="Classes" />
            {sessions.length === 0 ? (
              <CardBody>
                <Empty title="No classes created">
                  Classes come from the weekly schedule. The registry sets it under Class
                  schedule.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Time</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 15).map((s) => (
                    <tr key={s.session_id}>
                      <Td num className="whitespace-nowrap">
                        <Link
                          href={`/teach/class/${s.session_id}`}
                          className="font-semibold text-brand-900 no-underline"
                        >
                          {s.session_date &&
                            new Date(s.session_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                        </Link>
                      </Td>
                      <Td num className="whitespace-nowrap text-muted">
                        {hhmm(s.start_time)}
                      </Td>
                      <Td>
                        {s.status === "closed" ? (
                          <Chip tone="neutral">Taken</Chip>
                        ) : s.status === "open" ? (
                          <Chip tone="open" dot>
                            Open now
                          </Chip>
                        ) : s.status === "cancelled" ? (
                          <Chip tone="absent">Cancelled</Chip>
                        ) : (
                          <Chip tone="ghost">To come</Chip>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {sessions.length > 15 && (
              <CardFoot>
                <span className="text-sm text-muted">
                  Showing the 15 most recent of {sessions.length}.
                </span>
              </CardFoot>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
