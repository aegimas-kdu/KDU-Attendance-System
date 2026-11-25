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
} from "@/components/ui";
import { getActiveTerm } from "@/lib/data/academic";
import { listOfferings } from "@/lib/data/courses";
import { listProfessors } from "@/lib/data/people";
import { PERIODS, WEEKDAYS, hhmm, listTimetableSlots } from "@/lib/data/schedule";
import { AddSlot, RemoveSlot } from "./forms";

export const metadata: Metadata = { title: "Class schedule" };

const DAYS = WEEKDAYS.slice(0, 5);

type SlotRow = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  lecture_type: string;
  offering_id: string;
  professors: {
    id: string;
    employee_id: string;
    profiles: { full_name: string } | null;
  } | null;
  course_offerings: {
    id: string;
    offering_name: string;
    courses: { course_code: string; course_name: string } | null;
    offering_batches: { intake_batches: { name: string } | null }[];
    enrollments: { status: string }[];
  } | null;
};

/** The surname a timetable cell has room for. */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}

export default async function SchedulePage() {
  const term = await getActiveTerm();

  const [slots, offerings, professors] = await Promise.all([
    listTimetableSlots(),
    term ? listOfferings(term.id) : Promise.resolve([]),
    listProfessors(),
  ]);

  const rows = slots as unknown as SlotRow[];

  // The grid is keyed by day and period, so a cell can be found in one step.
  const cells = new Map<string, SlotRow[]>();
  for (const slot of rows) {
    const key = `${slot.weekday}-${hhmm(slot.start_time)}`;
    cells.set(key, [...(cells.get(key) ?? []), slot]);
  }

  const rooms = Array.from(
    new Set(rows.map((s) => s.room).filter((r): r is string => Boolean(r))),
  ).sort();

  const staff = professors as unknown as {
    id: string;
    employee_id: string;
    profiles: { full_name: string } | null;
  }[];

  const clashes = [...cells.entries()].filter(([, group]) => {
    if (group.length < 2) return false;
    const takenRooms = group.map((s) => s.room).filter(Boolean);
    const takenStaff = group.map((s) => s.professors?.id).filter(Boolean);
    return (
      new Set(takenRooms).size !== takenRooms.length ||
      new Set(takenStaff).size !== takenStaff.length
    );
  });

  return (
    <>
      <PageHead
        crumbs={<Link href="/admin">Overview</Link>}
        title="Class schedule"
        subtitle={
          term
            ? `The week as it repeats through ${term.name}. Classes are created from these times for every week of the term.`
            : "Make a term active to build its schedule."
        }
      >
        <Chip tone="neutral">
          {rows.length} {rows.length === 1 ? "class time" : "class times"}
        </Chip>
      </PageHead>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          {clashes.length > 0 && (
            <Card tone="warn">
              <CardHead title="Two classes at the same time" />
              <CardBody>
                <p className="text-sm">
                  {clashes.length === 1 ? "One period has" : `${clashes.length} periods have`}{" "}
                  a professor or a room booked twice. The grid below marks them.
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHead title="The week" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <Th className="w-28">Period</Th>
                    {DAYS.map((d) => (
                      <Th key={d.value}>{d.name}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((period, index) => (
                    <tr key={period.start}>
                      <Td num className="align-top whitespace-nowrap text-muted">
                        <b className="block text-ink">Period {index + 1}</b>
                        {period.label}
                      </Td>
                      {DAYS.map((day) => {
                        const group = cells.get(`${day.value}-${period.start}`) ?? [];
                        return (
                          <Td key={day.value} className="align-top">
                            {group.length === 0 ? (
                              <span className="text-faint">—</span>
                            ) : (
                              <div className="grid gap-2">
                                {group.map((slot) => {
                                  const course = slot.course_offerings?.courses;
                                  const doubled = group.length > 1;
                                  return (
                                    <div
                                      key={slot.id}
                                      className={`rounded-lg border px-3 py-2 ${
                                        doubled
                                          ? "border-absent bg-[#fff8f8]"
                                          : "border-line-2 bg-brand-50"
                                      }`}
                                    >
                                      <b className="block leading-snug">
                                        {course?.course_name ?? "—"}
                                      </b>
                                      <small className="num block text-[13px] text-muted">
                                        {course?.course_code}
                                        {slot.room ? ` · ${slot.room}` : ""}
                                      </small>
                                      <small className="block text-[13px] text-muted">
                                        {slot.professors?.profiles?.full_name
                                          ? shortName(slot.professors.profiles.full_name)
                                          : "Nobody assigned"}
                                      </small>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardFoot>
              <span className="text-sm text-muted">
                Four periods a day, 09:00 to 12:50, each 50 minutes with a 10 minute
                break after it.
              </span>
            </CardFoot>
          </Card>

          <Card>
            <CardHead title="Every class time" />
            {rows.length === 0 ? (
              <CardBody>
                <Empty title="No class times yet">
                  Add the first one beside this list. Until a course has a time, no
                  classes exist for it.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Day</Th>
                    <Th>Time</Th>
                    <Th>Course</Th>
                    <Th>Professor</Th>
                    <Th>Room</Th>
                    <Th right>Students</Th>
                    <Th right />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((slot) => {
                    const course = slot.course_offerings?.courses;
                    const enrolled =
                      slot.course_offerings?.enrollments.filter(
                        (e) => e.status === "enrolled",
                      ).length ?? 0;
                    return (
                      <tr key={slot.id}>
                        <Td>
                          <b>
                            {WEEKDAYS.find((d) => d.value === slot.weekday)?.name ?? "—"}
                          </b>
                        </Td>
                        <Td num className="whitespace-nowrap">
                          {hhmm(slot.start_time)} – {hhmm(slot.end_time)}
                        </Td>
                        <Td>
                          <Link
                            href={`/admin/courses/${slot.offering_id}`}
                            className="no-underline"
                          >
                            <b className="text-brand-900">{course?.course_name ?? "—"}</b>
                          </Link>
                          <small className="num block text-[13px] text-muted">
                            {course?.course_code} · {slot.lecture_type}
                          </small>
                        </Td>
                        <Td className="text-muted">
                          {slot.professors?.profiles?.full_name ?? (
                            <Chip tone="late">Nobody assigned</Chip>
                          )}
                        </Td>
                        <Td num className="text-muted">
                          {slot.room ?? "—"}
                        </Td>
                        <Td right num>
                          {enrolled}
                        </Td>
                        <Td right>
                          <RemoveSlot slotId={slot.id} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
            <CardFoot>
              <span className="text-sm text-muted">
                A time cannot be removed once classes have been created from it. Cancel
                those classes instead, so the attendance already marked stays readable.
              </span>
            </CardFoot>
          </Card>
        </div>

        <Card tone="brand">
          <CardHead title="Add a class time" tone="brand" />
          <AddSlot
            offerings={offerings.map((o) => ({
              id: o.id,
              name: o.course.course_name,
              code: o.course.course_code,
            }))}
            professors={staff.map((p) => ({
              id: p.id,
              name: p.profiles?.full_name ?? p.employee_id,
              employeeId: p.employee_id,
            }))}
            rooms={rooms}
          />
        </Card>
      </div>
    </>
  );
}
