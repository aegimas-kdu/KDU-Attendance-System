import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AttendanceStatus,
  SessionAttendanceSheet,
  StudentAttendanceSummary,
} from "@/lib/database.types";

/** How a status reads on screen. Colour is never the only signal. */
export const STATUS_LABEL: Record<AttendanceStatus | "not marked", string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
  "not marked": "Not marked",
};

/**
 * The class list for one session: every enrolled student, with their mark if
 * they have one. Comes from the `session_attendance_sheet` view, which uses
 * security_invoker — so a student calling it sees only their own line.
 */
export async function getAttendanceSheet(
  sessionId: string,
): Promise<SessionAttendanceSheet[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_attendance_sheet")
    .select("*")
    .eq("session_id", sessionId)
    .order("student_number");
  return data ?? [];
}

/** Counts for the live session screen. */
export function tallySheet(rows: SessionAttendanceSheet[]) {
  const tally = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
  for (const row of rows) {
    if (row.attendance_status === "not marked") tally.unmarked += 1;
    else tally[row.attendance_status] += 1;
  }
  return { ...tally, total: rows.length, marked: rows.length - tally.unmarked };
}

export type CourseAttendance = StudentAttendanceSummary & {
  course_code: string;
  course_name: string;
  professor_name: string | null;
};

/**
 * A student's record across their courses.
 *
 * `penalty_absences` and `effective_absences` are calculated in the view: the
 * three-late rule is applied on read, so the marks recorded on the day are
 * never rewritten.
 */
export async function getStudentAttendance(
  studentId: string,
): Promise<CourseAttendance[]> {
  const supabase = await createClient();

  const { data: summary } = await supabase
    .from("student_attendance_summary")
    .select("*")
    .eq("student_id", studentId);

  if (!summary?.length) return [];

  const { data: offerings } = await supabase
    .from("course_offerings")
    .select(
      `id, courses ( course_code, course_name ),
       timetable_slots ( professors ( profiles ( full_name ) ) )`,
    )
    .in(
      "id",
      summary.map((s) => s.offering_id),
    );

  type RawOffering = {
    id: string;
    courses: { course_code: string; course_name: string } | null;
    timetable_slots: { professors: { profiles: { full_name: string } | null } | null }[];
  };

  const byId = new Map(
    ((offerings ?? []) as unknown as RawOffering[]).map((o) => [o.id, o]),
  );

  return summary.map((row) => {
    const offering = byId.get(row.offering_id);
    return {
      ...row,
      course_code: offering?.courses?.course_code ?? "",
      course_name: offering?.courses?.course_name ?? "",
      professor_name:
        offering?.timetable_slots[0]?.professors?.profiles?.full_name ?? null,
    };
  });
}

/** Every class of one course for one student, newest first. */
export async function getStudentCourseHistory(
  studentId: string,
  offeringId: string,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select(
      `id, status, marked_at, marked_by, leave_request_id,
       class_sessions!inner (
         id, session_date, status,
         timetable_slots!inner ( offering_id, start_time, end_time, room, lecture_type )
       ),
       profiles:marked_by ( full_name )`,
    )
    .eq("student_id", studentId)
    .eq("class_sessions.timetable_slots.offering_id", offeringId)
    .order("marked_at", { ascending: false });
  return data ?? [];
}

/** The class report: every student in an offering, worst attendance first. */
export async function getOfferingAttendance(offeringId: string) {
  const supabase = await createClient();

  const [{ data: summary }, { data: enrolled }] = await Promise.all([
    supabase
      .from("student_attendance_summary")
      .select("*")
      .eq("offering_id", offeringId),
    supabase
      .from("enrollments")
      .select(
        `student_id, status,
         students ( student_id, profiles ( full_name ), intake_batches ( name ) )`,
      )
      .eq("offering_id", offeringId)
      .eq("status", "enrolled"),
  ]);

  type RawEnrolled = {
    student_id: string;
    students: {
      student_id: string;
      profiles: { full_name: string } | null;
      intake_batches: { name: string } | null;
    } | null;
  };

  const people = new Map(
    ((enrolled ?? []) as unknown as RawEnrolled[]).map((e) => [e.student_id, e.students]),
  );

  return (summary ?? [])
    .map((row) => ({
      ...row,
      student_number: people.get(row.student_id)?.student_id ?? "",
      full_name: people.get(row.student_id)?.profiles?.full_name ?? "",
      intake_batch: people.get(row.student_id)?.intake_batches?.name ?? null,
    }))
    .sort((a, b) => (a.attendance_rate ?? 0) - (b.attendance_rate ?? 0));
}

/** Attendance split per class date, for the report chart. */
export async function getSessionBreakdown(offeringId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select(
      `status, class_sessions!inner ( id, session_date, status,
        timetable_slots!inner ( offering_id ) )`,
    )
    .eq("class_sessions.timetable_slots.offering_id", offeringId);

  type Raw = {
    status: AttendanceStatus;
    class_sessions: { id: string; session_date: string; status: string } | null;
  };

  const byDate = new Map<
    string,
    { date: string; present: number; late: number; absent: number; excused: number }
  >();

  for (const row of (data ?? []) as unknown as Raw[]) {
    const date = row.class_sessions?.session_date;
    if (!date) continue;
    const bucket =
      byDate.get(date) ??
      { date, present: 0, late: 0, absent: 0, excused: 0 };
    bucket[row.status] += 1;
    byDate.set(date, bucket);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Students who entered a wrong code — shown as a count on the live screen. */
export async function countFailedAttempts(sessionId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_attempts")
    .select("student_id")
    .eq("session_id", sessionId)
    .eq("succeeded", false);
  return new Set((data ?? []).map((a) => a.student_id)).size;
}

/**
 * This student's own marks for a set of classes.
 *
 * One query for a whole day or week, rather than one per class. The policy on
 * `attendance_records` already narrows it to the caller, so no student id is
 * passed in.
 */
export async function myMarks(
  sessionIds: string[],
): Promise<Map<string, { status: AttendanceStatus; marked_at: string | null }>> {
  const marks = new Map<string, { status: AttendanceStatus; marked_at: string | null }>();
  if (!sessionIds.length) return marks;

  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("session_id, status, marked_at")
    .in("session_id", sessionIds);

  for (const row of data ?? []) {
    marks.set(row.session_id, { status: row.status, marked_at: row.marked_at });
  }
  return marks;
}

/**
 * This student's own marks across a date range.
 *
 * myMarks() needs the session ids, so it cannot start until the schedule
 * query has come back — a round trip of its own, in sequence, on two of the
 * busiest pages. Filtering on the session's date instead makes it independent,
 * so it joins the parallel batch and costs nothing extra.
 *
 * Row Level Security still scopes the rows to this student; the date range
 * only decides how many of their own marks come back.
 */
export async function myMarksBetween(
  from: string,
  to: string,
): Promise<Map<string, { status: AttendanceStatus; marked_at: string | null }>> {
  const marks = new Map<string, { status: AttendanceStatus; marked_at: string | null }>();

  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("session_id, status, marked_at, class_sessions!inner(session_date)")
    .gte("class_sessions.session_date", from)
    .lte("class_sessions.session_date", to);

  for (const row of data ?? []) {
    marks.set(row.session_id, { status: row.status, marked_at: row.marked_at });
  }
  return marks;
}
