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
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { AuditAction, Json } from "@/lib/database.types";

export const metadata: Metadata = { title: "Activity log" };

/** What each table's changes are called in plain words. */
const SUBJECT: Record<string, string> = {
  attendance_records: "Attendance changed",
  leave_requests: "Leave decided",
  profiles: "Account changed",
  enrollments: "Enrolment changed",
  course_offerings: "Course changed",
  timetable_slots: "Class schedule changed",
};

const ACTION_WORD: Record<AuditAction, string> = {
  INSERT: "added",
  UPDATE: "changed",
  DELETE: "removed",
};

/** Pulls a field out of the JSONB snapshot without trusting its shape. */
function field(values: Json | null, key: string): string | null {
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  const value = (values as Record<string, Json | undefined>)[key];
  if (value === null || value === undefined) return null;
  return String(value);
}

/** The one field that actually changed, for the before/after column. */
function changed(oldValues: Json | null, newValues: Json | null) {
  for (const key of ["status", "role", "admin_level", "account_status", "room"]) {
    const before = field(oldValues, key);
    const after = field(newValues, key);
    if (before !== after) return { key, before, after };
  }
  return null;
}

const STATUS_TONE: Record<string, "present" | "late" | "absent" | "excused" | "neutral"> = {
  present: "present",
  late: "late",
  absent: "absent",
  excused: "excused",
  approved: "present",
  rejected: "absent",
  pending: "late",
};

function ValueChip({ value }: { value: string | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  return <Chip tone={STATUS_TONE[value] ?? "neutral"}>{value.replace(/_/g, " ")}</Chip>;
}

type Row = {
  id: string;
  action: AuditAction;
  entity_type: string;
  created_at: string;
  old_values: Json | null;
  new_values: Json | null;
  profiles: { full_name: string; role: string } | null;
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ what?: string }>;
}) {
  const { what } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, created_at, old_values, new_values, profiles:actor_id ( full_name, role )",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (what) query = query.eq("entity_type", what);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const filters = [
    ["", "Everything"],
    ["attendance_records", "Attendance"],
    ["leave_requests", "Leave decisions"],
    ["profiles", "Roles and accounts"],
    ["enrollments", "Enrolments"],
    ["timetable_slots", "Class schedule"],
  ] as const;

  return (
    <>
      <PageHead
        crumbs={<Link href="/admin">Overview</Link>}
        title="Activity log"
        subtitle="Who changed what, and when. Written by the database itself, so an action cannot happen without being recorded — and nobody can edit or delete an entry, including you."
      />

      <div className="mb-5 flex flex-wrap gap-0.5 rounded-[10px] bg-[#edeff3] p-1">
        {filters.map(([value, label]) => {
          const active = (what ?? "") === value;
          return (
            <Link
              key={label}
              href={value ? `/admin/activity?what=${value}` : "/admin/activity"}
              className={`rounded-md px-3.5 py-2 text-sm font-semibold no-underline ${
                active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHead title={`${rows.length} ${rows.length === 1 ? "entry" : "entries"}`} />
        {rows.length === 0 ? (
          <CardBody>
            <Empty title="Nothing recorded yet">
              Entries appear as attendance is corrected, leave is decided, roles change
              and the registry edits courses, enrolments or the schedule.
            </Empty>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What happened</Th>
                <Th>Change</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diff = changed(row.old_values, row.new_values);
                const privilege =
                  row.entity_type === "profiles" &&
                  (diff?.key === "role" || diff?.key === "admin_level");

                return (
                  <tr key={row.id} className={privilege ? "bg-[#fff8f8]" : undefined}>
                    <Td num className="whitespace-nowrap text-muted">
                      {new Date(row.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                    <Td>
                      {row.profiles ? (
                        <Person name={row.profiles.full_name} detail={row.profiles.role} />
                      ) : (
                        <span className="text-muted">System</span>
                      )}
                    </Td>
                    <Td>
                      <b>
                        {SUBJECT[row.entity_type] ??
                          `${row.entity_type.replace(/_/g, " ")} ${ACTION_WORD[row.action]}`}
                      </b>
                      {privilege && (
                        <span className="ml-2">
                          <Chip tone="live">privilege</Chip>
                        </span>
                      )}
                    </Td>
                    <Td>
                      {diff ? (
                        <span className="inline-flex items-center gap-1.5">
                          <ValueChip value={diff.before} />
                          <span className="text-faint">→</span>
                          <ValueChip value={diff.after} />
                        </span>
                      ) : (
                        <span className="text-muted">
                          {ACTION_WORD[row.action]} {row.entity_type.replace(/_/g, " ")}
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <CardFoot>
          <span className="text-sm text-muted">
            Attendance corrections, leave decisions, role and account changes, and
            courses, enrolments and the schedule. Showing the most recent 100.
          </span>
        </CardFoot>
      </Card>
    </>
  );
}
