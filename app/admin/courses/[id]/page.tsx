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
  PageHead,
  Person,
  Table,
  Td,
  Th,
  Tile,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerm, listIntakeBatches, listSections } from "@/lib/data/academic";
import { getOffering, listEnrolments } from "@/lib/data/courses";
import { WEEKDAYS, hhmm } from "@/lib/data/schedule";
import { DropButton, EligibleIntakes, EnrolSection } from "./enrolment";

export const metadata: Metadata = { title: "Course" };

type Slot = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  lecture_type: string;
  professors: { id: string; employee_id: string; profiles: { full_name: string } | null } | null;
};

export default async function OfferingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const offering = await getOffering(id);
  if (!offering) notFound();

  const term = await getActiveTerm();
  const supabase = await createClient();

  const [enrolments, batches, sections, students] = await Promise.all([
    listEnrolments(id),
    listIntakeBatches(true),
    term ? listSections(term.id) : Promise.resolve([]),
    supabase.from("students").select("intake_batch_id"),
  ]);

  const perBatch = new Map<string, number>();
  for (const s of students.data ?? []) {
    if (s.intake_batch_id)
      perBatch.set(s.intake_batch_id, (perBatch.get(s.intake_batch_id) ?? 0) + 1);
  }

  const course = offering.courses as unknown as {
    course_code: string;
    course_name: string;
    credits: number;
  } | null;

  const slots = (offering.timetable_slots ?? []) as unknown as Slot[];

  const currentBatches = (
    (offering.offering_batches ?? []) as unknown as {
      id: string;
      intake_batches: { id: string; name: string } | null;
    }[]
  )
    .map((b) => b.intake_batches?.id)
    .filter((b): b is string => Boolean(b));

  const active = enrolments.filter((e) => e.status === "enrolled");
  const rated = active.filter((e) => e.attendance_rate !== null);
  const averageRate = rated.length
    ? Math.round(
        rated.reduce((sum, e) => sum + Number(e.attendance_rate ?? 0), 0) / rated.length,
      )
    : null;
  const atRisk = active.filter((e) => Number(e.attendance_rate ?? 100) < 75);

  return (
    <>
      <PageHead
        crumbs={
          <>
            <Link href="/admin">Overview</Link> · <Link href="/admin/courses">Courses</Link>
          </>
        }
        title={course?.course_name ?? offering.offering_name}
        subtitle={
          course
            ? `${course.course_code} · ${course.credits} credits · ${offering.offering_name}`
            : offering.offering_name
        }
      >
        <Chip tone={offering.status === "active" ? "present" : "neutral"} dot>
          {offering.status === "active" ? "Running" : offering.status}
        </Chip>
      </PageHead>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Enrolled" value={active.length} />
        <Tile label="Class times a week" value={slots.length} />
        <Tile
          label="Average attendance"
          value={averageRate === null ? "—" : `${averageRate}%`}
          note={averageRate === null ? "No classes marked yet" : undefined}
        />
        <Tile
          label="Below 75%"
          value={atRisk.length}
          note={atRisk.length > 0 ? "At risk of being barred from the exam" : "Nobody at risk"}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <Card>
            <CardHead title="When it meets">
              <span className="flex-1" />
              <Link
                href="/admin/schedule"
                className="text-sm font-semibold text-brand-900"
              >
                Change the schedule
              </Link>
            </CardHead>

            {slots.length === 0 ? (
              <CardBody>
                <Empty title="No class times set">
                  Until this course has a time, no classes are created and there is
                  nothing to mark attendance against.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Day</Th>
                    <Th>Time</Th>
                    <Th>Room</Th>
                    <Th>Kind</Th>
                    <Th>Professor</Th>
                  </tr>
                </thead>
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
                        <Td num>
                          {hhmm(slot.start_time)} – {hhmm(slot.end_time)}
                        </Td>
                        <Td num className="text-muted">
                          {slot.room ?? "—"}
                        </Td>
                        <Td>
                          <Chip tone="neutral">{slot.lecture_type}</Chip>
                        </Td>
                        <Td>
                          {slot.professors?.profiles?.full_name ? (
                            <Person
                              name={slot.professors.profiles.full_name}
                              detail={slot.professors.employee_id}
                            />
                          ) : (
                            <Chip tone="late">Nobody assigned</Chip>
                          )}
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHead title={`${active.length} enrolled`}>
              <span className="flex-1" />
              {atRisk.length > 0 && <Chip tone="absent">{atRisk.length} below 75%</Chip>}
            </CardHead>

            {enrolments.length === 0 ? (
              <CardBody>
                <Empty title="Nobody enrolled yet">
                  Enrol a whole section beside this list, or enrol individual students
                  from their record.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Intake</Th>
                    <Th right>Attendance</Th>
                    <Th right>Absences</Th>
                    <Th right />
                  </tr>
                </thead>
                <tbody>
                  {enrolments.map((e) => {
                    const rate =
                      e.attendance_rate === null ? null : Number(e.attendance_rate);
                    const low = rate !== null && rate < 75;
                    return (
                      <tr
                        key={e.id}
                        className={
                          e.status !== "enrolled"
                            ? "bg-[#fafbfc]"
                            : low
                              ? "bg-[#fff8f8]"
                              : undefined
                        }
                      >
                        <Td>
                          <Link
                            href={`/admin/people/${e.student_id}`}
                            className="no-underline"
                          >
                            <Person name={e.full_name} detail={e.student_number} />
                          </Link>
                        </Td>
                        <Td>
                          {e.intake_batch ? (
                            <Chip tone="neutral">{e.intake_batch}</Chip>
                          ) : (
                            <Chip tone="absent">None</Chip>
                          )}
                        </Td>
                        <Td right num>
                          {rate === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <b className={low ? "text-absent-ink" : undefined}>{rate}%</b>
                          )}
                        </Td>
                        <Td right num className="text-muted">
                          {e.effective_absences}
                        </Td>
                        <Td right>
                          {e.status === "enrolled" ? (
                            <DropButton enrolmentId={e.id} />
                          ) : (
                            <Chip tone="ghost">Dropped</Chip>
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
                Attendance counts three lates as one absence, and leave that was approved
                does not count at all.
              </span>
            </CardFoot>
          </Card>
        </div>

        <div className="grid gap-5">
          <Card tone="brand">
            <CardHead title="Enrol students" tone="brand" />
            <EnrolSection
              offeringId={id}
              sections={sections.map((s) => ({
                id: s.id,
                name: s.section_name,
                students: s.student_count,
              }))}
            />
          </Card>

          <Card>
            <CardHead title="Who may take it" />
            <EligibleIntakes
              offeringId={id}
              current={currentBatches}
              batches={batches.map((b) => ({
                id: b.id,
                name: b.name,
                students: perBatch.get(b.id) ?? 0,
              }))}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
