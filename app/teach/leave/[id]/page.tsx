import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Chip,
  PageHead,
  Person,
  Table,
  Td,
  Th,
  Tile,
} from "@/components/ui";
import { getLeaveRequest, getStudentLeaveHistory } from "@/lib/data/leave";
import { hhmm } from "@/lib/data/schedule";
import { leaveDocumentUrl } from "@/lib/storage";
import { Decide } from "../decide";

export const metadata: Metadata = { title: "Leave request" };

export default async function LeaveRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const request = await getLeaveRequest(id);
  if (!request) notFound();

  const [history, documentUrl] = await Promise.all([
    getStudentLeaveHistory(request.student_id),
    request.supporting_file_path
      ? leaveDocumentUrl(request.supporting_file_path, 60)
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHead
        crumbs={
          <>
            <Link href="/teach">Today</Link> ·{" "}
            <Link href="/teach/leave">Leave requests</Link>
          </>
        }
        title={request.student_name}
        subtitle={`${request.student_number} · asked to be excused for ${request.course_name}`}
      >
        {request.status === "pending" ? (
          <Chip tone="pending" dot>
            Waiting on you
          </Chip>
        ) : request.status === "approved" ? (
          <Chip tone="present" dot>
            Approved
          </Chip>
        ) : (
          <Chip tone="absent">Rejected</Chip>
        )}
      </PageHead>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <Card>
            <CardHead title="The class they missed" />
            <Table>
              <tbody>
                <tr>
                  <Th>Course</Th>
                  <Td>
                    <b>{request.course_name}</b>
                  </Td>
                </tr>
                <tr>
                  <Th>Date</Th>
                  <Td num>
                    {request.session_date &&
                      new Date(request.session_date).toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                  </Td>
                </tr>
                <tr>
                  <Th>Time</Th>
                  <Td num>
                    {request.start_time ? hhmm(request.start_time) : "—"}
                    {request.room ? ` · Room ${request.room}` : ""}
                    {request.lecture_type ? ` · ${request.lecture_type}` : ""}
                  </Td>
                </tr>
                <tr>
                  <Th>Sent</Th>
                  <Td num>
                    {new Date(request.submitted_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {request.status === "pending" && request.waiting_days > 0 && (
                      <span className="text-muted">
                        {" "}
                        · waiting {request.waiting_days}{" "}
                        {request.waiting_days === 1 ? "day" : "days"}
                      </span>
                    )}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHead title="What they wrote" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {request.reason}
              </p>

              {request.supporting_file_path && (
                <div className="mt-4">
                  {documentUrl ? (
                    <a
                      href={documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center rounded-lg border border-line-2 bg-white px-4 text-sm font-semibold no-underline hover:bg-page"
                    >
                      Open the document they attached
                    </a>
                  ) : (
                    <Chip tone="absent">The attached document could not be opened</Chip>
                  )}
                  <p className="mt-2 text-[13px] text-muted">
                    The link works for one minute and only for you.
                  </p>
                </div>
              )}
            </CardBody>

            {request.status !== "pending" && (
              <CardFoot>
                <span className="text-sm text-muted">
                  {request.status === "approved" ? "Approved" : "Rejected"}
                  {request.reviewer_name ? ` by ${request.reviewer_name}` : ""}
                  {request.reviewed_at
                    ? ` on ${new Date(request.reviewed_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                      })}`
                    : ""}
                  {request.review_note ? ` · "${request.review_note}"` : ""}
                </span>
              </CardFoot>
            )}
          </Card>
        </div>

        <div className="grid gap-5">
          <Card tone={request.status === "pending" ? "brand" : "plain"}>
            <CardHead
              title={request.status === "pending" ? "Your decision" : "Change your mind"}
              tone={request.status === "pending" ? "brand" : "plain"}
            />
            <CardBody>
              {request.status !== "pending" && (
                <p className="mb-3 text-sm text-muted">
                  Deciding again replaces the first decision. Approving writes the
                  excused mark; rejecting puts the absence back.
                </p>
              )}
              <Decide requestId={request.id} studentName={request.student_name} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="This student's requests" />
            <div className="grid grid-cols-2 gap-4 p-5">
              <Tile label="Sent in total" value={history.total} />
              <Tile label="Approved" value={history.approved} />
              <Tile label="Rejected" value={history.rejected} />
              <Tile label="Still waiting" value={history.pending} />
            </div>
            <CardFoot>
              <span className="text-sm text-muted">
                Across every course they take, not only yours — so a pattern is visible
                rather than one case at a time.
              </span>
            </CardFoot>
          </Card>

          <Card>
            <CardHead title="Their record" />
            <CardBody>
              <Person name={request.student_name} detail={request.student_number} />
              <div className="mt-3 flex flex-wrap gap-2">
                {request.intake_batch && (
                  <Chip tone="neutral">{request.intake_batch}</Chip>
                )}
                <Link
                  href={`/teach/courses`}
                  className="text-sm font-semibold text-brand-900"
                >
                  My courses
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
