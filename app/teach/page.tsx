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
  Table,
  Td,
  Th,
  Tile,
} from "@/components/ui";
import { requireProfessor } from "@/lib/auth";
import {
  hhmm,
  listClassesOn,
  listUnclosedSessions,
  today,
  weekBounds,
  listClassesBetween,
} from "@/lib/data/schedule";
import {
  countPendingLeave,
  listMyOfferings,
  myCourseAttendance,
} from "@/lib/data/teaching";

export const metadata: Metadata = { title: "Today" };

const SESSION_TONE = {
  scheduled: "ghost",
  open: "open",
  closed: "neutral",
  cancelled: "absent",
} as const;

const SESSION_LABEL = {
  scheduled: "Not started",
  open: "Open for marking",
  closed: "Closed",
  cancelled: "Cancelled",
} as const;

export default async function TeachTodayPage() {
  const viewer = await requireProfessor();
  const date = today();
  const week = weekBounds();

  const [classes, unclosed, pending, offerings, thisWeek] = await Promise.all([
    listClassesOn(date),
    listUnclosedSessions(),
    countPendingLeave(),
    listMyOfferings(viewer.professorId),
    listClassesBetween(week.from, week.to),
  ]);

  const rates = await myCourseAttendance(offerings.map((o) => o.offering_id));

  const students = offerings.reduce((sum, o) => sum + o.enrolled, 0);
  const atRisk = offerings.reduce(
    (sum, o) => sum + (rates.get(o.offering_id)?.atRisk ?? 0),
    0,
  );

  const firstName = (viewer.profile.full_name ?? "").trim().split(/\s+/)[0];
  const nowHour = new Date().getHours();
  const greeting =
    nowHour < 12 ? "Good morning" : nowHour < 18 ? "Good afternoon" : "Good evening";

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
        {pending > 0 && (
          <Link href="/teach/leave" className="no-underline">
            <Chip tone="late" dot>
              {pending} leave {pending === 1 ? "request" : "requests"} waiting
            </Chip>
          </Link>
        )}
      </PageHead>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Classes today" value={classes.length} />
        <Tile label="Classes this week" value={thisWeek.length} />
        <Tile label="Students taught" value={students} />
        <Tile
          label="Below 75%"
          value={atRisk}
          note={atRisk > 0 ? "At risk of being barred from the exam" : "Nobody at risk"}
        />
      </div>

      {unclosed.length > 0 && (
        <div className="mb-5">
          <Card tone="warn">
            <CardHead title="Classes you left open" />
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Class</Th>
                  <Th>Time</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {unclosed.map((c) => (
                  <tr key={c.session_id}>
                    <Td num className="whitespace-nowrap">
                      {c.session_date &&
                        new Date(c.session_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                    </Td>
                    <Td>
                      <b>{c.course_name}</b>
                      <small className="num block text-[13px] text-muted">
                        {c.course_code}
                        {c.room ? ` · ${c.room}` : ""}
                      </small>
                    </Td>
                    <Td num className="whitespace-nowrap">
                      {hhmm(c.start_time)} – {hhmm(c.end_time)}
                    </Td>
                    <Td right>
                      <Link
                        href={`/teach/class/${c.session_id}`}
                        className="inline-flex min-h-8 items-center rounded-md bg-brand px-3 text-[13px] font-semibold text-white no-underline hover:bg-brand-800"
                      >
                        Close it
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardFoot>
              <span className="text-sm text-muted">
                Nobody is marked absent until a class is closed, so these students still
                have no record for the day.
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
                Your week is under My week, and the courses you teach under My courses.
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Class</Th>
                  <Th>Room</Th>
                  <Th>Status</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
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
                      <b>{c.course_name}</b>
                      <small className="num block text-[13px] text-muted">
                        {c.course_code} · {c.lecture_type}
                      </small>
                    </Td>
                    <Td num className="text-muted">
                      {c.room ?? "—"}
                    </Td>
                    <Td>
                      <Chip tone={SESSION_TONE[c.status ?? "scheduled"]} dot={c.status === "open"}>
                        {SESSION_LABEL[c.status ?? "scheduled"]}
                      </Chip>
                    </Td>
                    <Td right>
                      {c.status === "cancelled" ? (
                        <span className="text-[13px] text-muted">Nothing to do</span>
                      ) : (
                        <Link
                          href={`/teach/class/${c.session_id}`}
                          className="inline-flex min-h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white no-underline hover:bg-brand-800"
                        >
                          {c.status === "open"
                            ? "Open class"
                            : c.status === "closed"
                              ? "See the sheet"
                              : "Take attendance"}
                        </Link>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <CardFoot>
            <span className="text-sm text-muted">
              Opening a class shows a four-digit code. Students enter it on their phones,
              and the sheet fills in as they do.
            </span>
          </CardFoot>
        </Card>

        <Card>
          <CardHead title="My courses">
            <span className="flex-1" />
            <Link href="/teach/courses" className="text-sm font-semibold text-brand-900">
              All courses
            </Link>
          </CardHead>
          {offerings.length === 0 ? (
            <CardBody>
              <Empty title="No courses yet">
                Courses appear here once the registry gives one of your class times to
                you.
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Course</Th>
                  <Th right>Students</Th>
                  <Th right>Attendance</Th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((o) => {
                  const stat = rates.get(o.offering_id);
                  const low = stat?.rate !== null && (stat?.rate ?? 100) < 75;
                  return (
                    <tr key={o.offering_id}>
                      <Td>
                        <Link
                          href={`/teach/courses/${o.offering_id}`}
                          className="no-underline"
                        >
                          <b className="text-brand-900">{o.course_name}</b>
                        </Link>
                        <small className="num block text-[13px] text-muted">
                          {o.course_code}
                        </small>
                      </Td>
                      <Td right num>
                        {o.enrolled}
                      </Td>
                      <Td right num>
                        {stat?.rate === null || stat === undefined ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <b className={low ? "text-absent-ink" : undefined}>
                            {stat.rate}%
                          </b>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
