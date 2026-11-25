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
import {
  getActiveTerm,
  listAcademicLevels,
  listIntakeBatches,
  listSections,
} from "@/lib/data/academic";
import { listStudents } from "@/lib/data/people";
import { AddSection, AssignUnassigned } from "./forms";

export const metadata: Metadata = { title: "Sections" };

export default async function SectionsPage() {
  const term = await getActiveTerm();

  const [levels, batches, sections, students] = await Promise.all([
    listAcademicLevels(true),
    listIntakeBatches(true),
    term ? listSections(term.id) : Promise.resolve([]),
    listStudents({ limit: 500 }),
  ]);

  const unassigned = students
    .filter((s) => !s.section)
    .map((s) => ({
      id: s.id,
      number: s.student_id,
      name: s.profile.full_name,
      batch: s.intake_batch,
    }));

  return (
    <>
      <PageHead
        crumbs={<Link href="/admin">Overview</Link>}
        title="Sections"
        subtitle={
          term
            ? `A section is a group of students who sit the same classes together. ${term.name}.`
            : "A section is a group of students who sit the same classes together."
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <Card>
            <CardHead title={`${sections.length} ${sections.length === 1 ? "section" : "sections"}`}>
              <span className="flex-1" />
              {unassigned.length > 0 && (
                <Chip tone="late">{unassigned.length} without a section</Chip>
              )}
            </CardHead>

            {sections.length === 0 ? (
              <CardBody>
                <Empty title="No sections this term">
                  Create one beside this list, then put students in it.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Section</Th>
                    <Th>Level</Th>
                    <Th>Intakes</Th>
                    <Th right>Students</Th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <b>{s.section_name}</b>
                      </Td>
                      <Td className="text-muted">{s.academic_levels?.name ?? "—"}</Td>
                      <Td>
                        <span className="inline-flex flex-wrap gap-1.5">
                          {s.section_batches.length === 0 ? (
                            <Chip tone="absent">None set</Chip>
                          ) : (
                            s.section_batches.map((b) => (
                              <Chip key={b.batch_id} tone="neutral">
                                {b.intake_batches?.name ?? "—"}
                              </Chip>
                            ))
                          )}
                        </span>
                      </Td>
                      <Td right num>
                        <b>{s.student_count}</b>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <CardFoot>
              <span className="text-sm text-muted">
                A student belongs to one section at a time. Moving them keeps last
                term&rsquo;s record as it was.
              </span>
            </CardFoot>
          </Card>

          {unassigned.length > 0 && sections.length > 0 && (
            <Card tone="warn">
              <CardHead title="Students waiting for a section" />
              <AssignUnassigned
                sections={sections.map((s) => ({ id: s.id, name: s.section_name }))}
                students={unassigned}
              />
            </Card>
          )}
        </div>

        <Card tone="brand">
          <CardHead title="Create a section" tone="brand" />
          <AddSection
            termId={term?.id ?? null}
            levels={levels.map((l) => ({ id: l.id, name: l.name }))}
            batches={batches.map((b) => ({ id: b.id, name: b.name }))}
          />
        </Card>
      </div>
    </>
  );
}
