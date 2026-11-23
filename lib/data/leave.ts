import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LeaveStatus } from "@/lib/database.types";

export type LeaveRow = {
  id: string;
  status: LeaveStatus;
  reason: string;
  review_note: string | null;
  supporting_file_path: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewer_name: string | null;
  student_id: string;
  student_number: string;
  student_name: string;
  intake_batch: string | null;
  session_id: string;
  session_date: string;
  start_time: string;
  lecture_type: string;
  room: string | null;
  course_name: string;
  /** Whole days since it was sent — what the inbox sorts on. */
  waiting_days: number;
};

const SELECT = `
  id, status, reason, review_note, supporting_file_path, submitted_at, reviewed_at,
  reviewer:reviewed_by ( full_name ),
  students ( id, student_id, profiles ( full_name ), intake_batches ( name ) ),
  class_sessions (
    id, session_date,
    timetable_slots ( start_time, lecture_type, room,
                      course_offerings ( courses ( course_name ) ) )
  )`;

type Raw = {
  id: string;
  status: LeaveStatus;
  reason: string;
  review_note: string | null;
  supporting_file_path: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewer: { full_name: string } | null;
  students: {
    id: string;
    student_id: string;
    profiles: { full_name: string } | null;
    intake_batches: { name: string } | null;
  } | null;
  class_sessions: {
    id: string;
    session_date: string;
    timetable_slots: {
      start_time: string;
      lecture_type: string;
      room: string | null;
      course_offerings: { courses: { course_name: string } | null } | null;
    } | null;
  } | null;
};

function shape(row: Raw): LeaveRow {
  const sent = new Date(row.submitted_at).getTime();
  const days = Math.floor((Date.now() - sent) / 86_400_000);

  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    review_note: row.review_note,
    supporting_file_path: row.supporting_file_path,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    reviewer_name: row.reviewer?.full_name ?? null,
    student_id: row.students?.id ?? "",
    student_number: row.students?.student_id ?? "",
    student_name: row.students?.profiles?.full_name ?? "",
    intake_batch: row.students?.intake_batches?.name ?? null,
    session_id: row.class_sessions?.id ?? "",
    session_date: row.class_sessions?.session_date ?? "",
    start_time: row.class_sessions?.timetable_slots?.start_time ?? "",
    lecture_type: row.class_sessions?.timetable_slots?.lecture_type ?? "",
    room: row.class_sessions?.timetable_slots?.room ?? null,
    course_name:
      row.class_sessions?.timetable_slots?.course_offerings?.courses?.course_name ?? "",
    waiting_days: days,
  };
}

/**
 * Leave requests the caller may see.
 *
 * Row Level Security does the filtering: a student gets their own, a
 * professor gets the ones for classes they teach, an administrator gets all.
 */
export async function listLeaveRequests(
  status?: LeaveStatus,
): Promise<LeaveRow[]> {
  const supabase = await createClient();
  let query = supabase.from("leave_requests").select(SELECT);
  if (status) query = query.eq("status", status);

  const { data } = await query.order("submitted_at", { ascending: false });
  return ((data ?? []) as unknown as Raw[]).map(shape);
}

/** Pending first, longest wait at the top — the professor's inbox order. */
export async function listPendingLeave(): Promise<LeaveRow[]> {
  const rows = await listLeaveRequests("pending");
  return rows.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
}

export async function getLeaveRequest(id: string): Promise<LeaveRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("leave_requests").select(SELECT).eq("id", id).maybeSingle();
  return data ? shape(data as unknown as Raw) : null;
}

/** This student's history, so a reviewer can see a pattern rather than one case. */
export async function getStudentLeaveHistory(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("status")
    .eq("student_id", studentId);

  const rows = data ?? [];
  return {
    total: rows.length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    pending: rows.filter((r) => r.status === "pending").length,
  };
}

/**
 * Classes this student missed and could still request leave for — absent,
 * and no request sent yet.
 */
export async function listRequestableClasses(studentId: string) {
  const supabase = await createClient();

  const [{ data: absences }, { data: existing }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select(
        `session_id,
         class_sessions ( session_date,
           timetable_slots ( start_time, lecture_type,
                             course_offerings ( courses ( course_name ) ) ) )`,
      )
      .eq("student_id", studentId)
      .eq("status", "absent"),
    supabase.from("leave_requests").select("session_id").eq("student_id", studentId),
  ]);

  const alreadyAsked = new Set((existing ?? []).map((r) => r.session_id));

  type Raw2 = {
    session_id: string;
    class_sessions: {
      session_date: string;
      timetable_slots: {
        start_time: string;
        lecture_type: string;
        course_offerings: { courses: { course_name: string } | null } | null;
      } | null;
    } | null;
  };

  return ((absences ?? []) as unknown as Raw2[])
    .filter((row) => !alreadyAsked.has(row.session_id))
    .map((row) => ({
      session_id: row.session_id,
      session_date: row.class_sessions?.session_date ?? "",
      start_time: row.class_sessions?.timetable_slots?.start_time ?? "",
      lecture_type: row.class_sessions?.timetable_slots?.lecture_type ?? "",
      course_name:
        row.class_sessions?.timetable_slots?.course_offerings?.courses?.course_name ?? "",
    }))
    .sort((a, b) => b.session_date.localeCompare(a.session_date));
}
