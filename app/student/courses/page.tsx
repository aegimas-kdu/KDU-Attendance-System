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
import { requireStudent } from "@/lib/auth";
import { getStudent } from "@/lib/data/people";
import { getStudentAttendance } from "@/lib/data/attendance";

export const metadata: Metadata = { title: "My courses" };

export default async function MyCoursesPage() {
  const viewer = await requireStudent();

  const [courses, record] = await Promise.all([
    getStudentAttendance(viewer.studentId),
    getStudent(viewer.studentId),
  ]);

  const batch = (record?.intake_batches as unknown as { name: string } | null)?.name;
  const level = (record?.academic_levels as unknown as { name: string } | null)?.name;
  const section = (
    record?.student_section_assignments as unknown as {
      status: string;
      class_sections: { section_name: string } | null;
    }[]
  )?.find((a) => a.status === "active")?.class_sections?.section_name;

  return (
    <>
      <PageHead
        crumbs={<Link href="/student">Today</Link>}
        title="My courses"
        subtitle={
          [
            viewer.profile.full_name,
            record?.student_id,
            batch,
            level,
            section,
          ]
            .filter(Boolean)
            .join(" · ") || "The courses you are enrolled in this term."
        }
      />

      {courses.length === 0 ? (
        <Card>
          <CardBody>
            <Empty title="No courses yet">
              You appear here once the registry enrols you. If the term has started and
              this is still empty, speak to the office.
            </Empty>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {courses.map((c) => {
            const rate = c.attendance_rate === null ? null : Number(c.attendance_rate);
            const low = rate !== null && rate < 75;

            return (
              <Card key={c.offering_id} tone={low ? "warn" : "plain"}>
                <CardHead title={c.course_name}>
                  <span className="flex-1" />
                  {rate !== null && (
                    <Chip tone={low ? "absent" : "present"} dot>
                      {rate}%
                    </Chip>
                  )}
                </CardHead>

                <CardBody>
                  <p className="num mb-4 text-[13px] text-muted">
                    {c.course_code}
                    {c.professor_name ? ` · ${c.professor_name}` : ""}
                  </p>

                  <Meter
                    present={c.present_count}
                    late={c.late_count}
                    absent={c.absent_count}
                    excused={c.excused_count}
                    className="mb-3"
                  />

                  <div className="mb-4 grid grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="num text-xl font-bold leading-none">
                        {c.present_count}
                      </p>
                      <p className="mt-1 text-[13px] text-muted">Present</p>
                    </div>
                    <div>
                      <p className="num text-xl font-bold leading-none">{c.late_count}</p>
                      <p className="mt-1 text-[13px] text-muted">Late</p>
                    </div>
                    <div>
                      <p
                        className={`num text-xl font-bold leading-none ${
                          c.absent_count > 0 ? "text-absent-ink" : ""
                        }`}
                      >
                        {c.absent_count}
                      </p>
                      <p className="mt-1 text-[13px] text-muted">Absent</p>
                    </div>
                    <div>
                      <p className="num text-xl font-bold leading-none">
                        {c.excused_count}
                      </p>
                      <p className="mt-1 text-[13px] text-muted">Excused</p>
                    </div>
                  </div>

                  {low && (
                    <p className="mb-4 text-sm">
                      Below 75% you can be barred from the final exam. You are at{" "}
                      <b>{rate}%</b> with <b>{c.effective_absences}</b> counting against
                      you.
                    </p>
                  )}

                  <Link
                    href={`/student/courses/${c.offering_id}`}
                    className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white no-underline hover:bg-brand-800"
                  >
                    Every class and the files
                  </Link>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
