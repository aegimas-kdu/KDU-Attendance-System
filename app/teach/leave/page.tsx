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
  Person,
  Table,
  Td,
  Th,
  Tile,
} from "@/components/ui";
import { listLeaveRequests } from "@/lib/data/leave";
import { hhmm } from "@/lib/data/schedule";
import { Decide, DecideMany } from "./decide";
import type { LeaveStatus } from "@/lib/database.types";

export const metadata: Metadata = { title: "Leave requests" };

const TABS = [
  ["pending", "Waiting"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["", "Everything"],
] as const;

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = (status ?? "pending") as LeaveStatus | "";

  const [rows, pending] = await Promise.all([
    listLeaveRequests(filter || undefined),
    listLeaveRequests("pending"),
  ]);

  const sorted =
    filter === "pending"
      ? [...rows].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))
      : rows;

  const waitingLong = pending.filter((r) => r.waiting_days >= 3);

  return (
    <>
      <PageHead
        crumbs={<Link href="/teach">Today</Link>}
        title="Leave requests"
        subtitle="A student asks to be excused for one class. Approving marks them excused for it, even if the class closed weeks ago — you do not have to reopen anything."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Tile label="Waiting on you" value={pending.length} />
        <Tile
          label="Waiting three days or more"
          value={waitingLong.length}
          note={
            waitingLong.length > 0
              ? "These students are still marked absent"
              : "Nothing has been waiting long"
          }
        />
        <Tile
          label="Decided"
          value={rows.filter((r) => r.status !== "pending").length}
          note={filter === "" ? undefined : "In this view"}
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-0.5 rounded-[10px] bg-[#edeff3] p-1">
        {TABS.map(([value, label]) => {
          const active = filter === value;
          return (
            <Link
              key={label}
              href={value ? `/teach/leave?status=${value}` : "/teach/leave?status="}
              className={`rounded-md px-3.5 py-2 text-sm font-semibold no-underline ${
                active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {label}
              {value === "pending" && pending.length > 0 && (
                <span className="num ml-1.5 text-[13px] text-accent">
                  {pending.length}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title={`${sorted.length} ${sorted.length === 1 ? "request" : "requests"}`} />

          {sorted.length === 0 ? (
            <CardBody>
              <Empty
                title={
                  filter === "pending" ? "Nothing waiting" : "Nothing in this view"
                }
              >
                {filter === "pending"
                  ? "Every request has been decided. Students see your decision and note as soon as you save it."
                  : "Requests appear here once students send them."}
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Class missed</Th>
                  <Th>Why</Th>
                  <Th>Status</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      r.status === "pending" && r.waiting_days >= 3
                        ? "bg-[#fffaf0]"
                        : undefined
                    }
                  >
                    <Td>
                      <Person name={r.student_name} detail={r.student_number} />
                      {r.status === "pending" && (
                        <small className="mt-1 block text-[13px] text-muted">
                          {r.waiting_days === 0
                            ? "Sent today"
                            : `Waiting ${r.waiting_days} ${
                                r.waiting_days === 1 ? "day" : "days"
                              }`}
                        </small>
                      )}
                    </Td>
                    <Td>
                      <b>{r.course_name}</b>
                      <small className="num block text-[13px] text-muted">
                        {r.session_date &&
                          new Date(r.session_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        {r.start_time ? ` · ${hhmm(r.start_time)}` : ""}
                        {r.room ? ` · ${r.room}` : ""}
                      </small>
                    </Td>
                    <Td className="max-w-80">
                      <span className="block text-sm">{r.reason}</span>
                      {r.supporting_file_path && (
                        <Chip tone="neutral">Document attached</Chip>
                      )}
                      {r.review_note && (
                        <small className="mt-1 block text-[13px] text-muted">
                          Your note: {r.review_note}
                        </small>
                      )}
                    </Td>
                    <Td>
                      {r.status === "pending" ? (
                        <Chip tone="pending" dot>
                          Waiting
                        </Chip>
                      ) : r.status === "approved" ? (
                        <Chip tone="present" dot>
                          Approved
                        </Chip>
                      ) : (
                        <Chip tone="absent">Rejected</Chip>
                      )}
                      {r.reviewed_at && (
                        <small className="num mt-1 block text-[13px] text-muted">
                          {new Date(r.reviewed_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                          {r.reviewer_name ? ` · ${r.reviewer_name}` : ""}
                        </small>
                      )}
                    </Td>
                    <Td right className="align-top">
                      {r.status === "pending" ? (
                        <Decide requestId={r.id} studentName={r.student_name} />
                      ) : (
                        <Link
                          href={`/teach/leave/${r.id}`}
                          className="text-sm font-semibold text-brand-900"
                        >
                          Open
                        </Link>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <CardFoot>
            <span className="text-sm text-muted">
              An approved request stops that absence counting against the student&rsquo;s
              75%. Rejecting leaves the absence as it is.
            </span>
          </CardFoot>
        </Card>

        {pending.length > 1 && (
          <Card tone="brand">
            <CardHead title="Decide several at once" tone="brand" />
            <DecideMany
              requests={pending.map((r) => ({
                id: r.id,
                studentName: r.student_name,
                courseName: r.course_name,
              }))}
            />
          </Card>
        )}
      </div>
    </>
  );
}
