"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfessor, requireStudent, requireViewer } from "@/lib/auth";
import { describe, fail, ok, type ActionResult } from "./result";
import type { AttendanceStatus, CodeType } from "@/lib/database.types";

/**
 * Attendance is driven entirely by database functions.
 *
 * Nothing here decides who may do what — `generate_attendance_code`,
 * `submit_attendance_code` and `close_class_session` each check the caller
 * themselves and raise if they should not be running. These actions only
 * carry the call and translate the answer.
 */

export type OpenClassResult = { code: string; expiresAt: string };

/**
 * Opens the class and returns the four-digit code.
 *
 * The plain code exists only in this response and on the professor's screen —
 * the database stores a bcrypt hash and nothing else. It cannot be fetched
 * again; generating another one revokes this.
 */
export async function openClass(
  sessionId: string,
  codeType: CodeType = "initial",
  validSeconds = 300,
): Promise<ActionResult<OpenClassResult>> {
  await requireViewer();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("generate_attendance_code", {
    p_session_id: sessionId,
    p_code_type: codeType,
    p_valid_seconds: validSeconds,
  });

  if (error) return fail(describe(error));

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return fail("The code could not be created. Please try again.");

  revalidatePath(`/teach/class/${sessionId}`);
  return ok({ code: row.code, expiresAt: row.expires_at });
}

/** A late code marks whoever uses it late, and retires the current one. */
export async function issueLateCode(
  sessionId: string,
  validSeconds = 300,
): Promise<ActionResult<OpenClassResult>> {
  return openClass(sessionId, "late", validSeconds);
}

/**
 * A student marking themselves.
 *
 * Returns the resulting status, which may be the one they already had — the
 * function refuses to downgrade a present mark, and says so rather than
 * silently doing nothing.
 */
export async function submitAttendanceCode(
  sessionId: string,
  code: string,
): Promise<ActionResult<AttendanceStatus>> {
  await requireStudent();

  const cleaned = code.replace(/\D/g, "");
  if (cleaned.length !== 4) return fail("The code is four digits.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_attendance_code", {
    p_session_id: sessionId,
    p_code: cleaned,
  });

  if (error) return fail(describe(error));

  revalidatePath("/student");
  revalidatePath("/student/attendance");
  return ok(data as AttendanceStatus);
}

/**
 * Closing marks every unmarked student absent and kills any live code.
 *
 * Returns how many were marked, so the screen can say what happened instead
 * of just going quiet.
 */
export async function closeClass(
  sessionId: string,
): Promise<ActionResult<{ markedAbsent: number }>> {
  await requireViewer();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("close_class_session", {
    p_session_id: sessionId,
  });

  if (error) return fail(describe(error));

  revalidatePath(`/teach/class/${sessionId}`);
  revalidatePath("/teach");
  return ok({ markedAbsent: (data as number) ?? 0 });
}

/**
 * A professor correcting one mark.
 *
 * Writes directly to `attendance_records`, which the policy allows only for
 * the professor of that class or an administrator. The audit trigger records
 * the before and after, so the student can always see that it changed and
 * who changed it.
 */
export async function correctAttendance(
  sessionId: string,
  studentId: string,
  status: AttendanceStatus,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id, leave_request_id")
    .eq("session_id", sessionId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing?.leave_request_id) {
    return fail(
      "This mark comes from an approved leave request. Reopen the request to change it.",
    );
  }

  const { error } = existing
    ? await supabase
        .from("attendance_records")
        .update({ status, marked_at: new Date().toISOString(), marked_by: viewer.userId })
        .eq("id", existing.id)
    : await supabase.from("attendance_records").insert({
        session_id: sessionId,
        student_id: studentId,
        status,
        marked_by: viewer.userId,
      });

  if (error) return fail(describe(error));

  revalidatePath(`/teach/class/${sessionId}`);
  return ok();
}

/** Several corrections at once, for the attendance sheet's save button. */
export async function correctAttendanceBatch(
  sessionId: string,
  changes: { studentId: string; status: AttendanceStatus }[],
): Promise<ActionResult<{ saved: number }>> {
  await requireViewer();

  let saved = 0;
  for (const change of changes) {
    const result = await correctAttendance(sessionId, change.studentId, change.status);
    if (!result.ok) return fail(result.error);
    saved += 1;
  }

  revalidatePath(`/teach/class/${sessionId}`);
  return ok({ saved });
}

/** Creates the term's class meetings from an offering's timetable. */
export async function generateSessions(
  offeringId: string,
): Promise<ActionResult<{ created: number }>> {
  await requireViewer();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("generate_class_sessions", {
    p_offering_id: offeringId,
  });

  if (error) return fail(describe(error));

  revalidatePath("/admin/schedule");
  return ok({ created: (data as number) ?? 0 });
}

/** One date off, without disturbing the weekly pattern. */
export async function cancelClass(sessionId: string): Promise<ActionResult> {
  await requireProfessor().catch(() => requireViewer());
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId);

  if (error) return fail(describe(error));

  revalidatePath("/teach");
  revalidatePath("/admin/schedule");
  return ok();
}
