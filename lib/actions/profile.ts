"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudent, requireViewer } from "@/lib/auth";
import { describe, fail, ok, type ActionResult } from "@/lib/actions/result";

/**
 * What a person may change about themselves.
 *
 * Nothing here decides what is allowed — the database does. "Users update own
 * profile" and "Students update own studies" grant the row, and the two guard
 * triggers refuse the columns that are not theirs to change: the email, the
 * role, the account status, the student number.
 *
 * So these actions do not re-implement those rules. They send the fields the
 * form collected and let the database answer, which is why a student cannot
 * get further by calling the action directly.
 */

/** Name and country. Email is deliberately not here — it is an identity field. */
export async function updateMyProfile(input: {
  fullName: string;
  country: string | null;
}): Promise<ActionResult> {
  const viewer = await requireViewer();

  const fullName = input.fullName.trim();
  if (fullName.length < 2) {
    return fail("Please give your full name as it appears on your student card.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      country: input.country?.trim() || null,
    })
    .eq("id", viewer.userId);

  if (error) return fail(describe(error));

  revalidatePath("/student/profile");
  revalidatePath("/student", "layout");
  return ok();
}

/**
 * Intake batch, academic level and department.
 *
 * Intake batch decides which courses this student may be enrolled in, so the
 * change is written to the audit log by a trigger — the same log that records
 * a professor correcting an attendance mark.
 */
export async function updateMyStudies(input: {
  intakeBatchId: string | null;
  academicLevelId: string | null;
  departmentId: string | null;
}): Promise<ActionResult> {
  const viewer = await requireStudent();

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      intake_batch_id: input.intakeBatchId,
      academic_level_id: input.academicLevelId,
      department_id: input.departmentId,
    })
    .eq("id", viewer.studentId);

  if (error) return fail(describe(error));

  revalidatePath("/student/profile");
  revalidatePath("/student", "layout");
  return ok();
}
