import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardHead,
  Chip,
  Empty,
  Meter,
  PageHead,
} from "@/components/ui";
import { requireProfessor } from "@/lib/auth";
import { WEEKDAYS, hhmm } from "@/lib/data/schedule";
import { listMyOfferings, myCourseAttendance } from "@/lib/data/teaching";

export const metadata: Metadata = { title: "My courses" };

export default async function MyCoursesPage() {
  const viewer = await requireProfessor();
  const offerings = await listMyOfferings(viewer.professorId);
  const rates = await myCourseAttendance(offerings.map((o) => o.offering_id));

  return (
    <>
      <PageHead
        crumbs={<Link href="/teach">Today</Link>}
        title="My courses"
        subtitle="The courses you teach this term. A course appears here when one of its class times is yours."
      />

      {offerings.length === 0 ? (
        <Card>
          <CardBody>
            <Empty title="No courses yet">
              Courses appear here once the registry gives one of their class times to
              you. Nothing on your side is missing.
            </Empty>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {offerings.map((o) => {
            const stat = rates.get(o.offering_id);
            const rate = stat?.rate ?? null;
            const low = rate !== null && rate < 75;

            return (
              <Card key={o.offering_id}>
                <CardHead title={o.course_name}>
                  <span className="flex-1" />
                  <Chip tone={o.status === "active" ? "present" : "neutral"} dot>
                    {o.status === "active" ? "Running" : o.status}
                  </Chip>
                </CardHead>

                <CardBody>
                  <p className="num mb-4 text-[13px] text-muted">
                    {o.course_code} · {o.credits} credits · {o.term_name}
                  </p>

                  <div className="mb-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="mb-1 text-[13px] text-muted">Students</p>
                      <p className="num text-2xl font-bold leading-none">{o.enrolled}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[13px] text-muted">Attendance</p>
                      <p
                        className={`num text-2xl font-bold leading-none ${
                          low ? "text-absent-ink" : ""
                        }`}
                      >
                        {rate === null ? "—" : `${rate}%`}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[13px] text-muted">Below 75%</p>
                      <p
                        className={`num text-2xl font-bold leading-none ${
                          (stat?.atRisk ?? 0) > 0 ? "text-absent-ink" : ""
                        }`}
                      >
                        {stat?.atRisk ?? 0}
                      </p>
                    </div>
                  </div>

                  {rate !== null && (
                    <Meter
                      present={rate}
                      absent={100 - rate}
                      className="mb-4"
                    />
                  )}

                  <p className="mb-1.5 text-[13px] font-medium text-ink-2">
                    When it meets
                  </p>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {o.slots.length === 0 ? (
                      <Chip tone="late">No class times</Chip>
                    ) : (
                      o.slots.map((slot, i) => (
                        <Chip key={i} tone="neutral">
                          {WEEKDAYS.find((d) => d.value === slot.weekday)?.short}{" "}
                          {hhmm(slot.start_time)}
                          {slot.room ? ` · ${slot.room}` : ""}
                        </Chip>
                      ))
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/teach/courses/${o.offering_id}`}
                      className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white no-underline hover:bg-brand-800"
                    >
                      Class list and report
                    </Link>
                    <Link
                      href={`/teach/materials/${o.offering_id}`}
                      className="inline-flex min-h-11 items-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold no-underline hover:bg-page"
                    >
                      Course files
                    </Link>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
