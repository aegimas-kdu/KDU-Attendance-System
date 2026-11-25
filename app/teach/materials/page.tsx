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
import { requireProfessor } from "@/lib/auth";
import { listRecentMaterials } from "@/lib/data/materials";
import { listMyOfferings } from "@/lib/data/teaching";

export const metadata: Metadata = { title: "Course files" };

export default async function MaterialsPage() {
  const viewer = await requireProfessor();

  const [offerings, recent] = await Promise.all([
    listMyOfferings(viewer.professorId),
    listRecentMaterials(8),
  ]);

  const counts = new Map<string, number>();
  for (const file of recent) {
    counts.set(file.offering_id, (counts.get(file.offering_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHead
        crumbs={<Link href="/teach">Today</Link>}
        title="Course files"
        subtitle="Slides, notes and readings, per course. Only students enrolled in a course can open its files."
      />

      {offerings.length === 0 ? (
        <Card>
          <CardBody>
            <Empty title="No courses yet">
              Files belong to a course, and you are not teaching one yet.
            </Empty>
          </CardBody>
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card>
            <CardHead title="Your courses" />
            <Table>
              <thead>
                <tr>
                  <Th>Course</Th>
                  <Th right>Students</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {offerings.map((o) => (
                  <tr key={o.offering_id}>
                    <Td>
                      <b>{o.course_name}</b>
                      <small className="num block text-[13px] text-muted">
                        {o.course_code} · {o.term_name}
                      </small>
                    </Td>
                    <Td right num>
                      {o.enrolled}
                    </Td>
                    <Td right>
                      <Link
                        href={`/teach/materials/${o.offering_id}`}
                        className="inline-flex min-h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white no-underline hover:bg-brand-800"
                      >
                        Open files
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardFoot>
              <span className="text-sm text-muted">
                Up to 25 MB a file. Every download link lasts one minute, so a copied
                link stops working almost immediately.
              </span>
            </CardFoot>
          </Card>

          <Card>
            <CardHead title="Recently uploaded">
              <span className="flex-1" />
              <Chip tone="neutral">Across your courses</Chip>
            </CardHead>
            {recent.length === 0 ? (
              <CardBody>
                <Empty title="Nothing uploaded yet">
                  Open a course and upload the first file.
                </Empty>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>File</Th>
                    <Th>Course</Th>
                    <Th right>Added</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((file) => (
                    <tr key={file.id}>
                      <Td>
                        <Link
                          href={`/teach/materials/${file.offering_id}`}
                          className="no-underline"
                        >
                          <b className="text-brand-900">{file.title}</b>
                        </Link>
                      </Td>
                      <Td className="text-muted">{file.course_name}</Td>
                      <Td right num className="whitespace-nowrap text-muted">
                        {new Date(file.uploaded_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
