"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudent, requireViewer } from "@/lib/auth";
import { describe, fail, ok, type ActionResult } from "./result";

/**
 * A student asking to be excused for one class.
 *
 * One request per class meeting, not per course — three missed Computer
 * Graphics classes are three requests. A database trigger refuses anything
 * from a student who is not actively enrolled, and the unique constraint
 * refuses a second request for the same class.
 */
export async function submitLeaveRequest(input: {
  sessionId: string;
  reason: string;
  supportingFilePath?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireStudent();

  const reason = input.reason.trim();
  if (reason.length < 10) {
    return fail("Please say a little more about why you were absent.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      student_id: viewer.studentId,
      session_id: input.sessionId,
      reason,
      supporting_file_path: input.supportingFilePath ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return fail("You have already sent a request for that class.");
    }
    return fail(describe(error));
  }

  revalidatePath("/student/leave");
  return ok({ id: data.id });
}

/**
 * A professor deciding.
 *
 * Approving is the linked-process part of the redesign: a trigger writes the
 * excused attendance record itself, even for a class that closed weeks ago,
 * and another records who decided and when. Nothing here touches attendance
 * directly.
 */
export async function decideLeaveRequest(
  requestId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<ActionResult> {
  await requireViewer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: decision,
      review_note: note?.trim() || null,
    })
    .eq("id", requestId);

  if (error) return fail(describe(error));

  revalidatePath("/teach/leave");
  revalidatePath(`/teach/leave/${requestId}`);
  return ok();
}

/** Several at once, from the inbox's checkboxes. */
export async function decideLeaveRequests(
  requestIds: string[],
  decision: "approved" | "rejected",
): Promise<ActionResult<{ decided: number }>> {
  await requireViewer();

  if (!requestIds.length) return fail("Nothing was selected.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: decision })
    .in("id", requestIds);

  if (error) return fail(describe(error));

  revalidatePath("/teach/leave");
  return ok({ decided: requestIds.length });
}
