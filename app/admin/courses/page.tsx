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
import { createClient } from "@/lib/supabase/server";
import { getActiveTerm, listIntakeBatches } from "@/lib/data/academic";
import { listCourseCatalogue, listOfferings } from "@/lib/data/courses";
import { AddCourse, AddOffering } from "./forms";

export const metadata: Metadata = { title: "Courses" };

const STATUS = {
  active: { tone: "present", label: "Running" },
  planning: { tone: "ghost", label: "Being planned" },
  completed: { tone: "neutral", label: "Finished" },
  cancelled: { tone: "absent", label: "Cancelled" },
} as const;

export default async function CoursesPage() {
  const term = await getActiveTerm();
  const supabase = await createClient();

  const [catalogue, offerings, batches, students] = await Promise.all([
    listCourseCatalogue(),
    term ? listOfferings(term.id) : Promise.resolve([]),
    listIntakeBatches(true),
    supabase.from("students").select("intake_batch_id"),
  ]);

  const perBatch = new Map<string, number>();
  for (const s of students.data ?? []) {
    if (s.intake_batch_id)
      perBatch.set(s.intake_batch_id, (perBatch.get(s.intake_batch_id) ?? 0) + 1);
  }

  const running = offerings.filter((o) => o.status === "active");
  const unscheduled = offerings.filter(
    (o) => o.status !== "cancelled" && o.slot_count === 0,
  );
  const offered = new Set(offerings.map((o) => o.course.id));

  return (
    <>
      <PageHead
        crumbs={<Link href="/admin">Overview</Link>}
        title="Courses"
        subtitle={
          term
            ? `What is being taught in ${term.name}, and the catalogue it is drawn from.`
            : "The course catalogue. Make a term active to start offering courses."
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="In the catalogue" value={catalogue.length} />
        <Tile label="Running this term" value={running.length} />
        <Tile
          label="Students enrolled"
          value={offerings.reduce((sum, o) => sum + o.enrolled_count, 0)}
        />
        <Tile
          label="Without a class time"
          value={unscheduled.length}
          note={
            unscheduled.length > 0
              ? "These produce no classes to mark"
              : "Every course has its times set"
          }
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <Card>
            <CardHead title={term ? `This term — ${term.name}` : "This term"}>
              <span className="flex-1" />
              <Chip tone="neutral">
                {offerings.length} {offerings.length === 1 ? "course" : "courses"}
              </Chip>
            </CardHead>

            {offerings.length === 0 ? (
              <CardBody>
                <Empty title="Nothing running yet">
                  Pick a course from the catalogue beside this list and say which intakes
                  may take it.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Course</Th>
                    <Th>Taught by</Th>
                    <Th>Open to</Th>
                    <Th right>Enrolled</Th>
                    <Th right>Class times</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {offerings.map((o) => (
                    <tr key={o.id}>
                      <Td>
                        <Link href={`/admin/courses/${o.id}`} className="no-underline">
                          <b className="text-brand-900">{o.course.course_name}</b>
                        </Link>
                        <small className="num block text-[13px] text-muted">
                          {o.course.course_code} · {o.course.credits} credits
                        </small>
                      </Td>
                      <Td className="text-muted">
                        {o.professors.length ? (
                          o.professors.join(", ")
                        ) : (
                          <Chip tone="late">Nobody yet</Chip>
                        )}
                      </Td>
                      <Td>
                        <span className="inline-flex flex-wrap gap-1.5">
                          {o.eligible_batches.length === 0 ? (
                            <Chip tone="absent">No intakes</Chip>
                          ) : (
                            o.eligible_batches.map((b) => (
                              <Chip key={b.id} tone="neutral">
                                {b.name}
                              </Chip>
                            ))
                          )}
                        </span>
                      </Td>
                      <Td right num>
                        <b>{o.enrolled_count}</b>
                      </Td>
                      <Td right num>
                        {o.slot_count === 0 ? <Chip tone="late">None</Chip> : o.slot_count}
                      </Td>
                      <Td>
                        <Chip tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Chip>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <CardFoot>
              <span className="text-sm text-muted">
                A course with no class time produces no classes, so there is nothing to
                mark attendance against. Set its times under Class schedule.
              </span>
            </CardFoot>
          </Card>

          <Card>
            <CardHead title="Course catalogue">
              <span className="flex-1" />
              <Chip tone="neutral">Across the whole university</Chip>
            </CardHead>

            {catalogue.length === 0 ? (
              <CardBody>
                <Empty title="The catalogue is empty">
                  Add the first course beside this list.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th right>Credits</Th>
                    <Th>This term</Th>
                  </tr>
                </thead>
                <tbody>
                  {catalogue.map((c) => (
                    <tr key={c.id}>
                      <Td num>
                        <b>{c.course_code}</b>
                      </Td>
                      <Td>{c.course_name}</Td>
                      <Td right num>
                        {c.credits}
                      </Td>
                      <Td>
                        {offered.has(c.id) ? (
                          <Chip tone="present" dot>
                            Running
                          </Chip>
                        ) : (
                          <Chip tone="ghost">Not offered</Chip>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="grid gap-5">
          <Card tone="brand">
            <CardHead title="Run a course this term" tone="brand" />
            <AddOffering
              termId={term?.id ?? null}
              termName={term?.name ?? null}
              courses={catalogue.map((c) => ({
                id: c.id,
                code: c.course_code,
                name: c.course_name,
              }))}
              batches={batches.map((b) => ({
                id: b.id,
                name: b.name,
                students: perBatch.get(b.id) ?? 0,
              }))}
            />
          </Card>

          <Card>
            <CardHead title="Add a course to the catalogue" />
            <AddCourse />
          </Card>
        </div>
      </div>
    </>
  );
}
