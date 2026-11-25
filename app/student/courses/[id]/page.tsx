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
  StatusChip,
  Table,
  Td,
  Th,
  Tile,
} from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { getStudentAttendance, getStudentCourseHistory } from "@/lib/data/attendance";
import { getOffering } from "@/lib/data/courses";
import { listLeaveRequests } from "@/lib/data/leave";
import { listMaterials } from "@/lib/data/materials";
import { WEEKDAYS, hhmm } from "@/lib/data/schedule";
import { fileKind, fileSize } from "@/lib/storage";
import { Download } from "./download";
import type { AttendanceStatus } from "@/lib/database.types";

export const metadata: Metadata = { title: "Course" };

type HistoryRow = {
  id: string;
  status: AttendanceStatus;
  marked_at: string;
  leave_request_id: string | null;
  class_sessions: {
    id: string;
    session_date: string;
    status: string;
    timetable_slots: {
      offering_id: string;
      start_time: string;
      end_time: string;
      room: string | null;
      lecture_type: string;
    } | null;
  } | null;
  profiles: { full_name: string } | null;
};

export default async function StudentCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireStudent();

  const [offering, courses, history, files, leave] = await Promise.all([
    getOffering(id),
    getStudentAttendance(viewer.studentId),
    getStudentCourseHistory(viewer.studentId, id),
    listMaterials(id),
    listLeaveRequests(),
  ]);

  if (!offering) notFound();

  const summary = courses.find((c) => c.offering_id === id);
  const course = offering.courses as unknown as {
    course_code: string;
    course_name: string;
    credits: number;
  } | null;

  const slots = (offering.timetable_slots ?? []) as unknown as {
    id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    room: string | null;
    professors: { profiles: { full_name: string } | null } | null;
  }[];

  const rows = history as unknown as HistoryRow[];
  const askedAbout = new Set(leave.map((r) => r.session_id));

  const rate = summary?.attendance_rate === null ? null : Number(summary?.attendance_rate);
  const low = rate !== null && rate !== undefined && rate < 75;

  const professors = Array.from(
    new Set(
      slots
        .map((s) => s.professors?.profiles?.full_name)
        .filter((n): n is string => Boolean(n)),
    ),
  );

  return (
    <>
      <PageHead
        crumbs={
          <>
            <Link href="/student">Today</Link> ·{" "}
            <Link href="/student/courses">My courses</Link>
          </>
        }
        title={course?.course_name ?? offering.offering_name}
        subtitle={
          [
            course?.course_code,
            course ? `${course.credits} credits` : null,
            professors.join(", ") || null,
          ]
            .filter(Boolean)
            .join(" · ")
        }
      >
        {rate !== null && rate !== undefined && (
          <Chip tone={low ? "absent" : "present"} dot>
            {rate}% attendance
          </Chip>
        )}
      </PageHead>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Present" value={summary?.present_count ?? 0} />
        <Tile label="Late" value={summary?.late_count ?? 0} note="Three count as one absence" />
        <Tile label="Absent" value={summary?.absent_count ?? 0} />
        <Tile
          label="Counts against me"
          value={summary?.effective_absences ?? 0}
          note={
            (summary?.penalty_absences ?? 0) > 0
              ? `${summary?.penalty_absences} of these come from lates`
              : "Excused absences are not counted"
          }
        />
      </div>

      {low && (
        <div className="mb-5">
          <Card tone="warn">
            <CardHead title="You are below 75%" />
            <CardBody>
              <p className="text-sm">
                Below 75% you can be barred from the final exam. If you had a reason for
                one of the absences below, send a leave request — if your professor
                approves it, that absence stops counting.
              </p>
              <Link
                href="/student/leave"
                className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white no-underline hover:bg-brand-800"
              >
                Request leave
              </Link>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Every class">
            <span className="flex-1" />
            <Chip tone="neutral">
              {rows.length} {rows.length === 1 ? "class" : "classes"} marked
            </Chip>
          </CardHead>

          {summary && (
            <CardBody className="pb-3">
              <Meter
                present={summary.present_count}
                late={summary.late_count}
                absent={summary.absent_count}
                excused={summary.excused_count}
              />
              <div className="mt-3">
                <Legend />
              </div>
            </CardBody>
          )}

          {rows.length === 0 ? (
            <CardBody>
              <Empty title="Nothing marked yet">
                Each class appears here once your professor closes it.
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th>My mark</Th>
                  <Th>Marked by</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const slot = row.class_sessions?.timetable_slots;
                  const date = row.class_sessions?.session_date;
                  const canAsk =
                    row.status === "absent" &&
                    row.class_sessions?.id &&
                    !askedAbout.has(row.class_sessions.id);

                  return (
                    <tr
                      key={row.id}
                      className={row.status === "absent" ? "bg-[#fff8f8]" : undefined}
                    >
                      <Td num className="whitespace-nowrap">
                        <b>
                          {date &&
                            new Date(date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                        </b>
                        <small className="block text-[13px] text-muted">
                          {date &&
                            new Date(date).toLocaleDateString("en-GB", {
                              weekday: "short",
                            })}
                        </small>
                      </Td>
                      <Td num className="whitespace-nowrap text-muted">
                        {slot ? `${hhmm(slot.start_time)} – ${hhmm(slot.end_time)}` : "—"}
                        {slot?.room && (
                          <small className="block text-[13px]">{slot.room}</small>
                        )}
                      </Td>
                      <Td>
                        <StatusChip status={row.status} />
                        {row.leave_request_id && (
                          <small className="block text-[13px] text-muted">
                            From approved leave
                          </small>
                        )}
                      </Td>
                      <Td className="text-muted">
                        {row.profiles?.full_name ?? "The system"}
                        <small className="num block text-[13px]">
                          {new Date(row.marked_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </small>
                      </Td>
                      <Td right>
                        {canAsk ? (
                          <Link
                            href="/student/leave"
                            className="text-sm font-semibold text-brand-900"
                          >
                            Ask to be excused
                          </Link>
                        ) : row.status === "absent" ? (
                          <span className="text-[13px] text-muted">Request sent</span>
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          <CardFoot>
            <span className="text-sm text-muted">
              Marks are never rewritten. If one changes, the change is recorded with the
              name of whoever made it.
            </span>
          </CardFoot>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHead title="Course files">
              <span className="flex-1" />
              <Chip tone="neutral">{files.length}</Chip>
            </CardHead>
            {files.length === 0 ? (
              <CardBody>
                <Empty title="No files yet">
                  Slides and notes appear here when your professor uploads them.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <Td>
                        <b>{file.title}</b>
                        {file.description && (
                          <small className="block text-[13px] text-muted">
                            {file.description}
                          </small>
                        )}
                        <small className="num block text-[13px] text-muted">
                          {fileKind(file.mime_type, file.file_path)} ·{" "}
                          {fileSize(file.file_size_bytes)} ·{" "}
                          {new Date(file.uploaded_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </small>
                      </Td>
                      <Td right className="align-top">
                        <Download materialId={file.id} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHead title="When it meets" />
            {slots.length === 0 ? (
              <CardBody>
                <Empty title="No times set">
                  The registry has not set this course&rsquo;s times yet.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <tbody>
                  {slots
                    .slice()
                    .sort(
                      (a, b) =>
                        a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
                    )
                    .map((slot) => (
                      <tr key={slot.id}>
                        <Td>
                          <b>
                            {WEEKDAYS.find((d) => d.value === slot.weekday)?.name ?? "—"}
                          </b>
                        </Td>
                        <Td num className="whitespace-nowrap text-muted">
                          {hhmm(slot.start_time)} – {hhmm(slot.end_time)}
                        </Td>
                        <Td num right className="text-muted">
                          {slot.room ?? "—"}
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
