import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Alert,
  Avatar,
  Card,
  CardBody,
  CardHead,
  Chip,
  PageHead,
  Table,
  Td,
} from "@/components/ui";
import {
  listAcademicLevels,
  listDepartments,
  listIntakeBatches,
} from "@/lib/data/academic";
import { getMyStudentRecord } from "@/lib/data/people";
import { signOut } from "@/lib/actions/auth";
import { AboutYouForm, PasswordForm, StudiesForm } from "./forms";

export const metadata: Metadata = { title: "My profile" };

type Named = { id: string; name: string } | null;

type Record = {
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
    account_status: string;
    created_at: string;
  } | null;
  intake_batches: Named;
  academic_levels: Named;
  departments: ({ id: string; code: string; name: string }) | null;
  student_section_assignments: {
    id: string;
    status: string;
    class_sections: {
      section_name: string;
      academic_terms: { name: string } | null;
    } | null;
  }[];
};

export default async function StudentProfilePage() {
  // Only active rows are offered. A student whose batch was retired keeps it
  // on their record, but is not invited to pick it again.
  const [raw, batches, levels, departments] = await Promise.all([
    getMyStudentRecord(),
    listIntakeBatches(true),
    listAcademicLevels(true),
    listDepartments(true),
  ]);

  if (!raw) notFound();
  const record = raw as unknown as Record;
  const profile = record.profiles;
  if (!profile) notFound();

  const section = (record.student_section_assignments ?? []).find(
    (a) => a.status === "active",
  );

  const incomplete =
    !record.intake_batch_id || !record.academic_level_id || !record.department_id;

  return (
    <>
      <PageHead
        title="My profile"
        subtitle="Your details, and the record the university holds for you."
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

      {incomplete && (
        <div className="mb-5">
          <Alert tone="warn" title="Your studies details are incomplete">
            Until your intake batch is set you cannot be enrolled in any course.
            Fill in what is missing below, or ask the registry office if you are
            not sure.
          </Alert>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <Card>
            <CardHead title="About you" />
            <AboutYouForm
              initial={{
                fullName: profile.full_name,
                country: profile.country ?? "",
              }}
            />
          </Card>

          <Card>
            <CardHead title="My studies" />
            <StudiesForm
              initial={{
                intakeBatchId: record.intake_batch_id,
                academicLevelId: record.academic_level_id,
                departmentId: record.department_id,
              }}
              batches={batches}
              levels={levels}
              departments={departments}
            />
          </Card>

          <Card>
            <CardHead title="Password" />
            <PasswordForm />
          </Card>
        </div>

        <div className="grid gap-5">
          <Card>
            <CardHead title="Issued by the university" />
            <Table>
              <tbody>
                <tr>
                  <Td className="text-muted">Student number</Td>
                  <Td right num>
                    <b>{record.student_id}</b>
                  </Td>
                </tr>
                <tr>
                  <Td className="text-muted">Email address</Td>
                  <Td right>{profile.email}</Td>
                </tr>
                <tr>
                  <Td className="text-muted">Section</Td>
                  <Td right>
                    {section?.class_sections?.section_name ?? "Not assigned"}
                  </Td>
                </tr>
                <tr>
                  <Td className="text-muted">Term</Td>
                  <Td right>
                    {section?.class_sections?.academic_terms?.name ?? "—"}
                  </Td>
                </tr>
                <tr>
                  <Td className="text-muted">Joined</Td>
                  <Td right num>
                    {new Date(profile.created_at).toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </Td>
                </tr>
              </tbody>
            </Table>
            <CardBody>
              <p className="text-[13px] text-muted">
                These are set by the registry office and cannot be changed here.
                If your student number or email is wrong, contact them — your
                number identifies you on every attendance sheet.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="This account" />
            <CardBody>
              <p className="mb-4 text-sm text-muted">
                Signing out ends this session on this device only.
              </p>
              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold hover:bg-page"
                >
                  Sign out
                </button>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
