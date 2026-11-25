import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Alert,
  Avatar,
  Card,
  CardBody,
  CardHead,
  Chip,
  Meter,
  PageHead,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  listAcademicLevels,
  listDepartments,
  listIntakeBatches,
} from "@/lib/data/academic";
import { getStudent } from "@/lib/data/people";
import { getStudentAttendance } from "@/lib/data/attendance";
import type { AccountStatus } from "@/lib/database.types";
import { RecordForm } from "./record-form";

export const metadata: Metadata = { title: "Student record" };

type Raw = {
  id: string;
  student_id: string;
  intake_batch_id: string | null;
  academic_level_id: string | null;
  department_id: string | null;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    country: string | null;
    role: string;
    admin_level: string | null;
    account_status: AccountStatus;
    created_at: string;
  } | null;
  student_section_assignments: {
    id: string;
    assigned_at: string;
    status: string;
    class_sections: {
      id: string;
      section_name: string;
      academic_terms: { name: string } | null;
    } | null;
  }[];
};

export default async function StudentRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [raw, batches, levels, departments, attendance] = await Promise.all([
    getStudent(id),
    listIntakeBatches(),
    listAcademicLevels(),
    listDepartments(),
    getStudentAttendance(id),
  ]);

  if (!raw) notFound();
  const student = raw as unknown as Raw;
  const profile = student.profiles;
  if (!profile) notFound();

  const totals = attendance.reduce(
    (acc, r) => ({
      present: acc.present + r.present_count,
      late: acc.late + r.late_count,
      absent: acc.absent + r.absent_count,
      excused: acc.excused + r.excused_count,
      penalty: acc.penalty + r.penalty_absences,
    }),
    { present: 0, late: 0, absent: 0, excused: 0, penalty: 0 },
  );
  const marked = totals.present + totals.late + totals.absent + totals.excused;
  const rate = marked
    ? Math.round(((totals.present + totals.late + totals.excused) / marked) * 100)
    : null;

  const sections = student.student_section_assignments ?? [];

  return (
    <>
      <PageHead
        crumbs={
          <>
            <Link href="/admin/people">Students &amp; staff</Link> · {profile.full_name}
          </>
        }
        title={profile.full_name}
        subtitle={
          <>
            <span className="num">{student.student_id}</span> · {profile.email} · joined{" "}
            {new Date(profile.created_at).toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </>
        }
      >
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} size={48} />
          {profile.account_status === "active" ? (
            <Chip tone="present" dot>
              Active
            </Chip>
          ) : (
            <Chip tone="late" dot>
              {profile.account_status}
            </Chip>
          )}
        </div>
      </PageHead>

      {!student.intake_batch_id && (
        <div className="mb-5">
          <Alert tone="danger" title="No intake batch">
            This student cannot be enrolled in any course until one is set — the
            database refuses the enrolment, not the interface.
          </Alert>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <Card>
            <CardHead title="Academic record" />
            <RecordForm
              studentId={student.id}
              profileId={profile.id}
              accountStatus={profile.account_status}
              batches={batches}
              levels={levels}
              departments={departments}
              initial={{
                fullName: profile.full_name,
                studentNumber: student.student_id,
                intakeBatchId: student.intake_batch_id,
                academicLevelId: student.academic_level_id,
                departmentId: student.department_id,
              }}
            />
          </Card>

          <Card>
            <CardHead title="Section" />
            {sections.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">
                  Not in a section. Assign one from{" "}
                  <Link href="/admin/sections">Sections</Link>.
                </p>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Section</Th>
                    <Th>Term</Th>
                    <Th>Assigned</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((a) => (
                    <tr key={a.id}>
                      <Td>
                        <b>{a.class_sections?.section_name ?? "—"}</b>
                      </Td>
                      <Td className="text-muted">
                        {a.class_sections?.academic_terms?.name ?? "—"}
                      </Td>
                      <Td num className="text-muted">
                        {new Date(a.assigned_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Td>
                      <Td>
                        {a.status === "active" ? (
                          <Chip tone="present" dot>
                            Active
                          </Chip>
                        ) : (
                          <Chip tone="ghost">Past</Chip>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHead title={`Courses (${attendance.length})`} />
            {attendance.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">
                  Not enrolled in anything yet. Enrol from a course, or add the whole
                  section at once.
                </p>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Course</Th>
                    <Th>Professor</Th>
                    <Th className="w-32">Split</Th>
                    <Th right>Penalty</Th>
                    <Th right>Rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((c) => (
                    <tr key={c.offering_id}>
                      <Td>
                        <b>{c.course_name}</b>
                      </Td>
                      <Td className="text-muted">{c.professor_name ?? "—"}</Td>
                      <Td>
                        <Meter
                          present={c.present_count}
                          late={c.late_count}
                          absent={c.absent_count}
                          excused={c.excused_count}
                        />
                      </Td>
                      <Td right num>
                        {c.penalty_absences > 0 ? <b>{c.penalty_absences}</b> : 0}
                      </Td>
                      <Td right num>
                        {c.attendance_rate === null ? "—" : `${c.attendance_rate}%`}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="grid gap-5">
          <Card>
            <CardHead title="Account" />
            <Table>
              <tbody>
                <tr>
                  <Td className="text-muted">Role</Td>
                  <Td right>Student</Td>
                </tr>
                <tr>
                  <Td className="text-muted">Email</Td>
                  <Td right>{profile.email}</Td>
                </tr>
                <tr>
                  <Td className="text-muted">Country</Td>
                  <Td right>{profile.country ?? "—"}</Td>
                </tr>
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHead title="Attendance this term" />
            <CardBody>
              {marked === 0 ? (
                <p className="text-sm text-muted">
                  Nothing recorded yet. Marks appear once classes are held and closed.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1 text-[13px] text-muted">Overall</p>
                      <p className="num text-[30px] font-bold leading-none tracking-tight">
                        {rate}%
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[13px] text-muted">Penalty absences</p>
                      <p className="num text-[30px] font-bold leading-none tracking-tight">
                        {totals.penalty}
                      </p>
                    </div>
                  </div>
                  <Meter className="mt-4" {...totals} />
                  <p className="mt-3 text-[13px] text-muted">
                    Three unexcused late marks count as one absence. The penalty is
                    calculated, never written into the record.
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
