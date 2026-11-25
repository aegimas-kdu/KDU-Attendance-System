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
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getOffering } from "@/lib/data/courses";
import { listMaterials } from "@/lib/data/materials";
import { fileKind, fileSize } from "@/lib/storage";
import { FileActions, Upload } from "./upload";

export const metadata: Metadata = { title: "Course files" };

export default async function CourseFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const offering = await getOffering(id);
  if (!offering) notFound();

  const files = await listMaterials(id);

  const course = offering.courses as unknown as {
    course_code: string;
    course_name: string;
  } | null;

  const enrolled = (
    (offering.offering_batches ?? []) as unknown as {
      intake_batches: { name: string } | null;
    }[]
  )
    .map((b) => b.intake_batches?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <>
      <PageHead
        crumbs={
          <>
            <Link href="/teach">Today</Link> ·{" "}
            <Link href="/teach/courses">My courses</Link> ·{" "}
            <Link href={`/teach/courses/${id}`}>{course?.course_name}</Link>
          </>
        }
        title="Course files"
        subtitle={
          course
            ? `${course.course_name} · ${course.course_code}`
            : offering.offering_name
        }
      >
        <Chip tone="neutral">
          {files.length} {files.length === 1 ? "file" : "files"}
        </Chip>
      </PageHead>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="What your students can open" />

          {files.length === 0 ? (
            <CardBody>
              <Empty title="No files yet">
                Upload slides, notes or a reading list beside this list. Students see
                them in their own course page straight away.
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th>Kind</Th>
                  <Th right>Size</Th>
                  <Th>Uploaded</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <Td>
                      <b>{file.title}</b>
                      {file.description && (
                        <small className="block text-[13px] text-muted">
                          {file.description}
                        </small>
                      )}
                    </Td>
                    <Td>
                      <Chip tone="neutral">
                        {fileKind(file.mime_type, file.file_path)}
                      </Chip>
                    </Td>
                    <Td right num className="whitespace-nowrap text-muted">
                      {fileSize(file.file_size_bytes)}
                    </Td>
                    <Td num className="whitespace-nowrap text-muted">
                      {new Date(file.uploaded_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                      {file.uploader_name && (
                        <small className="block text-[13px]">{file.uploader_name}</small>
                      )}
                    </Td>
                    <Td right className="align-top">
                      <FileActions
                        materialId={file.id}
                        title={file.title}
                        description={file.description}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <CardFoot>
            <span className="text-sm text-muted">
              Files are private. Only students actively enrolled in this course can open
              them{enrolled.length ? ` — the ${enrolled.join(" and ")} intakes` : ""}.
              Every download link lasts one minute.
            </span>
          </CardFoot>
        </Card>

        <Card tone="brand">
          <CardHead title="Upload a file" tone="brand" />
          <Upload offeringId={id} />
        </Card>
      </div>
    </>
  );
}
