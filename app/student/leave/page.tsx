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
import { requireStudent } from "@/lib/auth";
import { listLeaveRequests, listRequestableClasses } from "@/lib/data/leave";
import { hhmm } from "@/lib/data/schedule";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Leave requests" };

export default async function StudentLeavePage() {
  const viewer = await requireStudent();

  const [requests, missed] = await Promise.all([
    listLeaveRequests(),
    listRequestableClasses(viewer.studentId),
  ]);

  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");

  return (
    <>
      <PageHead
        crumbs={<Link href="/student">Today</Link>}
        title="Leave requests"
        subtitle="Ask to be excused for a class you missed. If your professor approves it, that absence stops counting against your 75%."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Tile
          label="Waiting on a decision"
          value={pending.length}
          note={pending.length > 0 ? "Your professor has not decided yet" : undefined}
        />
        <Tile label="Approved" value={approved.length} note="No longer counting against me" />
        <Tile
          label="Absences I can still ask about"
          value={missed.length}
          note={missed.length === 0 ? "Nothing waiting" : "Each one needs its own request"}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="My requests" />

          {requests.length === 0 ? (
            <CardBody>
              <Empty title="You have not sent any">
                If you miss a class for a real reason, ask to be excused beside this
                list. Your professor sees what you write.
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Class</Th>
                  <Th>What I wrote</Th>
                  <Th>Answer</Th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    className={r.status === "approved" ? "bg-[#f4fbf7]" : undefined}
                  >
                    <Td>
                      <b>{r.course_name}</b>
                      <small className="num block text-[13px] text-muted">
                        {r.session_date &&
                          new Date(r.session_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        {r.start_time ? ` · ${hhmm(r.start_time)}` : ""}
                      </small>
                    </Td>
                    <Td className="max-w-80">
                      <span className="block text-sm">{r.reason}</span>
                      {r.supporting_file_path && (
                        <Chip tone="neutral">Document attached</Chip>
                      )}
                      <small className="num block text-[13px] text-muted">
                        Sent{" "}
                        {new Date(r.submitted_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </small>
                    </Td>
                    <Td>
                      {r.status === "pending" ? (
                        <>
                          <Chip tone="pending" dot>
                            Waiting
                          </Chip>
                          <small className="block text-[13px] text-muted">
                            {r.waiting_days === 0
                              ? "Sent today"
                              : `${r.waiting_days} ${
                                  r.waiting_days === 1 ? "day" : "days"
                                } so far`}
                          </small>
                        </>
                      ) : r.status === "approved" ? (
                        <>
                          <Chip tone="present" dot>
                            Approved
                          </Chip>
                          <small className="block text-[13px] text-muted">
                            Marked excused
                          </small>
                        </>
                      ) : (
                        <>
                          <Chip tone="absent">Not approved</Chip>
                          <small className="block text-[13px] text-muted">
                            The absence still counts
                          </small>
                        </>
                      )}
                      {r.review_note && (
                        <small className="mt-1 block text-[13px]">
                          {r.reviewer_name ? `${r.reviewer_name}: ` : ""}
                          {r.review_note}
                        </small>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <CardFoot>
            <span className="text-sm text-muted">
              You cannot send a second request for the same class. An approved request
              changes your mark for that class to excused, even weeks later.
            </span>
          </CardFoot>
        </Card>

        <Card tone="brand">
          <CardHead title="Ask to be excused" tone="brand" />
          <RequestForm
            classes={missed.map((m) => ({
              session_id: m.session_id,
              session_date: m.session_date,
              start_time: m.start_time,
              course_name: m.course_name,
            }))}
          />
        </Card>
      </div>
    </>
  );
}
