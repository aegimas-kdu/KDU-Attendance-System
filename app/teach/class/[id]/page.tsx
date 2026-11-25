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
  StatusChip,
  Table,
  Td,
  Th,
  Tile,
} from "@/components/ui";
import {
  countFailedAttempts,
  getAttendanceSheet,
  tallySheet,
} from "@/lib/data/attendance";
import { getSession, hhmm } from "@/lib/data/schedule";
import { CancelClass, CodePanel, MarkPicker } from "./runner";

export const metadata: Metadata = { title: "Take attendance" };

export default async function ClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession(id);
  if (!session) notFound();

  const [sheet, failed] = await Promise.all([
    getAttendanceSheet(id),
    countFailedAttempts(id),
  ]);

  const tally = tallySheet(sheet);
  const status = session.status ?? "scheduled";

  return (
    <>
      <PageHead
        crumbs={
          <>
            <Link href="/teach">Today</Link> ·{" "}
            <Link href={`/teach/courses/${session.offering_id}`}>
              {session.course_name}
            </Link>
          </>
        }
        title={session.course_name}
        subtitle={
          <>
            {session.session_date &&
              new Date(session.session_date).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
            · {hhmm(session.start_time)} – {hhmm(session.end_time)}
            {session.room ? ` · Room ${session.room}` : ""} · {session.lecture_type}
          </>
        }
      >
        {status === "open" ? (
          <Chip tone="open" dot>
            Open for marking
          </Chip>
        ) : status === "closed" ? (
          <Chip tone="neutral">Closed</Chip>
        ) : status === "cancelled" ? (
          <Chip tone="absent">Cancelled</Chip>
        ) : (
          <Chip tone="ghost">Not started</Chip>
        )}
      </PageHead>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Marked" value={`${tally.marked} of ${tally.total}`} />
        <Tile label="Present" value={tally.present} />
        <Tile label="Late" value={tally.late} />
        <Tile
          label="Wrong code entered"
          value={failed}
          note={
            failed > 0
              ? `${failed} ${failed === 1 ? "student" : "students"} tried a code that did not match`
              : "Nobody has mistyped the code"
          }
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title={`Class list — ${tally.total} enrolled`}>
            <span className="flex-1" />
            {tally.unmarked > 0 && status !== "closed" && (
              <Chip tone="late">{tally.unmarked} not marked</Chip>
            )}
          </CardHead>

          <CardBody className="pb-0">
            <Meter
              present={tally.present}
              late={tally.late}
              absent={tally.absent}
              excused={tally.excused}
            />
            <div className="mt-3">
              <Legend />
            </div>
          </CardBody>

          {sheet.length === 0 ? (
            <CardBody>
              <Empty title="Nobody is enrolled">
                Attendance needs students. The registry enrols them under the course.
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Mark</Th>
                  <Th>Marked at</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {sheet.map((row) => (
                  <tr
                    key={row.student_id}
                    className={
                      row.attendance_status === "not marked" ? "bg-[#fafbfc]" : undefined
                    }
                  >
                    <Td>
                      <Person name={row.full_name} detail={row.student_number} />
                    </Td>
                    <Td>
                      <StatusChip status={row.attendance_status} />
                      {row.leave_status === "approved" && (
                        <span className="ml-2">
                          <Chip tone="excused">From leave</Chip>
                        </span>
                      )}
                    </Td>
                    <Td num className="whitespace-nowrap text-muted">
                      {row.marked_at
                        ? new Date(row.marked_at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </Td>
                    <Td right>
                      <MarkPicker
                        sessionId={id}
                        studentId={row.student_id}
                        status={row.attendance_status}
                        fromLeave={row.leave_request_id !== null}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <CardFoot>
            <span className="text-sm text-muted">
              Every change you make here is recorded with your name, and the student can
              see that it changed. Three lates count as one absence.
            </span>
          </CardFoot>
        </Card>

        <div className="grid gap-5">
          <Card tone="brand">
            <CardHead
              title={status === "open" ? "The code" : "Start the class"}
              tone="brand"
            />
            <CodePanel sessionId={id} status={status} unmarked={tally.unmarked} />
          </Card>

          {status !== "closed" && status !== "cancelled" && (
            <Card>
              <CardHead title="If the class is not happening" />
              <CardBody>
                <p className="mb-3 text-sm text-muted">
                  Cancelling this one date leaves the rest of the term as it is, and
                  nobody is marked absent for it.
                </p>
                <CancelClass sessionId={id} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
