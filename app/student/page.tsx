import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Chip,
  Empty,
  PageHead,
  StatusChip,
  Table,
  Td,
  Th,
  Tile,
} from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { getStudentAttendance, myMarksBetween } from "@/lib/data/attendance";
import { listLeaveRequests } from "@/lib/data/leave";
import { listRecentMaterials } from "@/lib/data/materials";
import {
  hhmm,
  listClassesBetween,
  listClassesOn,
  today,
  weekBounds,
} from "@/lib/data/schedule";
import { CodeEntry, OpenNow } from "./code-entry";

export const metadata: Metadata = { title: "Today" };

export default async function StudentTodayPage() {
  const viewer = await requireStudent();
  const date = today();
  const week = weekBounds();

  const [classes, thisWeek, courses, leave, files, marks] = await Promise.all([
    listClassesOn(date),
    listClassesBetween(week.from, week.to),
    getStudentAttendance(viewer.studentId),
    listLeaveRequests(),
    listRecentMaterials(4),
    myMarksBetween(date, date),
  ]);

  const open = classes.filter((c) => c.status === "open");
  const needsCode = open.filter(
    (c) => c.session_id && !marks.get(c.session_id),
  );

  const rated = courses.filter((c) => c.attendance_rate !== null);
  const overall = rated.length
    ? Math.round(
        rated.reduce((sum, c) => sum + Number(c.attendance_rate ?? 0), 0) / rated.length,
      )
    : null;
  const atRisk = courses.filter((c) => Number(c.attendance_rate ?? 100) < 75);
  const pendingLeave = leave.filter((r) => r.status === "pending");

  const firstName = (viewer.profile.full_name ?? "").trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHead
        title={`${greeting}, ${firstName}`}
        subtitle={new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      >
        <OpenNow count={needsCode.length} />
      </PageHead>

      {needsCode.length > 0 && (
        <div className="mb-5">
          <Card tone="brand">
            <CardHead
              title={
                needsCode.length === 1
                  ? "Mark yourself present"
                  : "Mark yourself present in these classes"
              }
              tone="brand"
            />
            <CardBody>
              <div className="grid gap-5">
                {needsCode.map((c) => (
                  <div key={c.session_id}>
                    <p className="mb-2">
                      <b>{c.course_name}</b>
                      <span className="num block text-[13px] text-muted">
                        {hhmm(c.start_time)} – {hhmm(c.end_time)}
                        {c.room ? ` · Room ${c.room}` : ""}
                        {c.professor_name ? ` · ${c.professor_name}` : ""}
                      </span>
                    </p>
                    <CodeEntry
                      sessionId={c.session_id ?? ""}
                      courseName={c.course_name}
                      marked={null}
                    />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="My attendance"
          value={overall === null ? "—" : `${overall}%`}
          note={overall === null ? "No classes marked yet" : "Across all my courses"}
        />
        <Tile label="Classes today" value={classes.length} />
        <Tile label="Classes this week" value={thisWeek.length} />
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

      {atRisk.length > 0 && (
        <div className="mb-5">
          <Card tone="warn">
            <CardHead title="Attendance that needs your attention" />
            <Table>
              <thead>
                <tr>
                  <Th>Course</Th>
                  <Th right>Attendance</Th>
                  <Th right>Absences</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {atRisk.map((c) => (
                  <tr key={c.offering_id}>
                    <Td>
                      <b>{c.course_name}</b>
                      <small className="num block text-[13px] text-muted">
                        {c.course_code}
                      </small>
                    </Td>
                    <Td right num>
                      <b className="text-absent-ink">
                        {c.attendance_rate === null ? "—" : `${c.attendance_rate}%`}
                      </b>
                    </Td>
                    <Td right num>
                      {c.effective_absences}
                    </Td>
                    <Td right>
                      <Link
                        href={`/student/courses/${c.offering_id}`}
                        className="text-sm font-semibold text-brand-900"
                      >
                        See every class
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardFoot>
              <span className="text-sm text-muted">
                Below 75% you can be barred from the final exam. If you had a reason for
                an absence, send a leave request — an approved one stops it counting.
              </span>
            </CardFoot>
          </Card>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Today's classes" />
          {classes.length === 0 ? (
            <CardBody>
              <Empty title="No classes today">
                Your whole week is under My week.
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Class</Th>
                  <Th>Where</Th>
                  <Th>My mark</Th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const mark = c.session_id ? marks.get(c.session_id) : undefined;
                  return (
                    <tr
                      key={c.session_id}
                      className={c.status === "open" ? "bg-brand-50" : undefined}
                    >
                      <Td num className="whitespace-nowrap">
                        <b>{hhmm(c.start_time)}</b>
                        <small className="block text-[13px] text-muted">
                          {hhmm(c.end_time)}
                        </small>
                      </Td>
                      <Td>
                        <Link
                          href={`/student/courses/${c.offering_id}`}
                          className="no-underline"
                        >
                          <b className="text-brand-900">{c.course_name}</b>
                        </Link>
                        <small className="num block text-[13px] text-muted">
                          {c.course_code} · {c.lecture_type}
                        </small>
                      </Td>
                      <Td num className="text-muted">
                        {c.room ?? "—"}
                        {c.professor_name && (
                          <small className="block text-[13px]">{c.professor_name}</small>
                        )}
                      </Td>
                      <Td>
                        {c.status === "cancelled" ? (
                          <Chip tone="ghost">Cancelled</Chip>
                        ) : mark ? (
                          <StatusChip status={mark.status} />
                        ) : c.status === "open" ? (
                          <Chip tone="live" dot>
                            Enter the code
                          </Chip>
                        ) : c.status === "closed" ? (
                          <Chip tone="ghost">Not marked</Chip>
                        ) : (
                          <Chip tone="ghost">Not started</Chip>
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
              Your professor shows a four-digit code in class. Enter it here while it is
              on screen — nobody is marked absent until the class is closed.
            </span>
          </CardFoot>
        </Card>

        <div className="grid gap-5">
          {pendingLeave.length > 0 && (
            <Card>
              <CardHead title="Leave requests you are waiting on" />
              <Table>
                <tbody>
                  {pendingLeave.map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <b>{r.course_name}</b>
                        <small className="num block text-[13px] text-muted">
                          {r.session_date &&
                            new Date(r.session_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                        </small>
                      </Td>
                      <Td right>
                        <Chip tone="pending" dot>
                          Waiting
                        </Chip>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <CardFoot>
                <span className="text-sm text-muted">
                  Your professor decides. You will see the answer and their note here.
                </span>
              </CardFoot>
            </Card>
          )}

          <Card>
            <CardHead title="New course files">
              <span className="flex-1" />
              <Link
                href="/student/courses"
                className="text-sm font-semibold text-brand-900"
              >
                My courses
              </Link>
            </CardHead>
            {files.length === 0 ? (
              <CardBody>
                <Empty title="Nothing new">
                  Slides and notes your professors upload appear here.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <Td>
                        <Link
                          href={`/student/courses/${file.offering_id}`}
                          className="no-underline"
                        >
                          <b className="text-brand-900">{file.title}</b>
                        </Link>
                        <small className="block text-[13px] text-muted">
                          {file.course_name}
                        </small>
                      </Td>
                      <Td right num className="whitespace-nowrap text-muted">
                        {new Date(file.uploaded_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
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
