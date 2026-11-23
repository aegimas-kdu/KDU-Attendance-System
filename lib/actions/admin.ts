"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { describe, fail, ok, type ActionResult } from "./result";
import type {
  AccountStatus,
  AdminLevel,
  LectureType,
  Semester,
  Student,
  Weekday,
} from "@/lib/database.types";

// ---------------------------------------------------------------- people

/**
 * Turns an existing account into a professor.
 *
 * The database function removes the `students` row the sign-up trigger
 * created, changes the role, and writes the professor record — all behind its
 * own `is_admin()` check, so this cannot be called by anyone else.
 */
export async function registerProfessor(input: {
  profileId: string;
  employeeId: string;
  department?: string | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("register_professor", {
    p_profile_id: input.profileId,
    p_employee_id: input.employeeId.trim(),
    p_department: input.department?.trim() || null,
  });

  if (error) return fail(describe(error));

  revalidatePath("/admin/people");
  return ok();
}

/** Super admin only — the database refuses anyone else. */
export async function grantAdminAccess(
  profileId: string,
  level: AdminLevel = "admin",
): Promise<ActionResult> {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("grant_admin_access", {
    p_profile_id: profileId,
    p_admin_level: level,
  });

  if (error) return fail(describe(error));

  revalidatePath("/admin/administrators");
  return ok();
}

/**
 * Returns the person to being a student or professor, or deactivates the
 * account if they are neither. The last active super admin cannot be removed
 * — the database will not allow the university to lock itself out.
 */
export async function revokeAdminAccess(profileId: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("revoke_admin_access", {
    p_profile_id: profileId,
  });

  if (error) return fail(describe(error));

  revalidatePath("/admin/administrators");
  return ok();
}

/** Accounts are never deleted; attendance history has to stay readable. */
export async function setAccountStatus(
  profileId: string,
  status: AccountStatus,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ account_status: status })
    .eq("id", profileId);

  if (error) return fail(describe(error));

  revalidatePath("/admin/people");
  return ok();
}

/**
 * A student's academic record.
 *
 * The intake batch is the gate on everything: without one they cannot be
 * enrolled in any course, because the enrolment trigger refuses.
 */
export async function updateStudentRecord(input: {
  studentId: string;
  fullName?: string;
  studentNumber?: string;
  intakeBatchId?: string | null;
  academicLevelId?: string | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const studentPatch: Partial<Student> = {};
  if (input.studentNumber !== undefined) studentPatch.student_id = input.studentNumber.trim();
  if (input.intakeBatchId !== undefined) studentPatch.intake_batch_id = input.intakeBatchId;
  if (input.academicLevelId !== undefined)
    studentPatch.academic_level_id = input.academicLevelId;

  if (Object.keys(studentPatch).length) {
    const { error } = await supabase
      .from("students")
      .update(studentPatch)
      .eq("id", input.studentId);
    if (error) return fail(describe(error));
  }

  if (input.fullName !== undefined) {
    const { data: student } = await supabase
      .from("students")
      .select("profile_id")
      .eq("id", input.studentId)
      .single();

    if (student) {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: input.fullName.trim() })
        .eq("id", student.profile_id);
      if (error) return fail(describe(error));
    }
  }

  revalidatePath(`/admin/people/${input.studentId}`);
  return ok();
}

// ---------------------------------------------------------------- sections

/**
 * Moves students into a section.
 *
 * A student has one active section at a time, enforced by a partial unique
 * index — so the previous assignment is retired rather than deleted, and last
 * year's attendance still makes sense.
 */
export async function assignToSection(
  studentIds: string[],
  sectionId: string,
): Promise<ActionResult<{ assigned: number }>> {
  await requireAdmin();
  if (!studentIds.length) return fail("Nothing was selected.");

  const supabase = await createClient();

  const { error: retireError } = await supabase
    .from("student_section_assignments")
    .update({ status: "inactive" })
    .in("student_id", studentIds)
    .eq("status", "active");

  if (retireError) return fail(describe(retireError));

  const { error } = await supabase.from("student_section_assignments").upsert(
    studentIds.map((student_id) => ({ student_id, section_id: sectionId, status: "active" as const })),
    { onConflict: "student_id,section_id" },
  );

  if (error) return fail(describe(error));

  revalidatePath("/admin/sections");
  return ok({ assigned: studentIds.length });
}

export async function createSection(input: {
  academicLevelId: string;
  academicTermId: string;
  sectionName: string;
  batchIds: string[];
}): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_sections")
    .insert({
      academic_level_id: input.academicLevelId,
      academic_term_id: input.academicTermId,
      section_name: input.sectionName.trim(),
    })
    .select("id")
    .single();

  if (error) return fail(describe(error));

  if (input.batchIds.length) {
    const { error: batchError } = await supabase
      .from("section_batches")
      .insert(input.batchIds.map((batch_id) => ({ section_id: data.id, batch_id })));
    if (batchError) return fail(describe(batchError));
  }

  revalidatePath("/admin/sections");
  return ok({ id: data.id });
}

// ---------------------------------------------------------------- enrolment

/**
 * Enrols specific students.
 *
 * The batch-eligibility trigger refuses anyone whose intake is not open to
 * the offering, so this reports which ones were turned away rather than
 * failing the whole operation.
 */
export async function enrolStudents(
  offeringId: string,
  studentIds: string[],
): Promise<ActionResult<{ enrolled: number; refused: number }>> {
  await requireAdmin();
  if (!studentIds.length) return fail("Nothing was selected.");

  const supabase = await createClient();
  let enrolled = 0;
  let refused = 0;

  for (const student_id of studentIds) {
    const { error } = await supabase
      .from("enrollments")
      .insert({ student_id, offering_id: offeringId, status: "enrolled" });

    if (!error) enrolled += 1;
    else if (error.code === "23505") continue; // already enrolled
    else refused += 1;
  }

  revalidatePath(`/admin/courses/${offeringId}`);
  return ok({ enrolled, refused });
}

/** Everyone in a section whose intake batch is eligible. */
export async function enrolSection(
  offeringId: string,
  sectionId: string,
): Promise<ActionResult<{ enrolled: number; skipped: number }>> {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: members }, { data: allowed }] = await Promise.all([
    supabase
      .from("student_section_assignments")
      .select("student_id, students ( intake_batch_id )")
      .eq("section_id", sectionId)
      .eq("status", "active"),
    supabase.from("offering_batches").select("batch_id").eq("offering_id", offeringId),
  ]);

  const allowedBatches = new Set((allowed ?? []).map((b) => b.batch_id));

  type Raw = { student_id: string; students: { intake_batch_id: string | null } | null };
  const rows = (members ?? []) as unknown as Raw[];

  const eligible = rows
    .filter((r) => r.students?.intake_batch_id && allowedBatches.has(r.students.intake_batch_id))
    .map((r) => r.student_id);

  const result = await enrolStudents(offeringId, eligible);
  if (!result.ok) return result;

  return ok({ enrolled: result.data.enrolled, skipped: rows.length - eligible.length });
}

export async function dropEnrolment(enrolmentId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("enrollments")
    .update({ status: "dropped" })
    .eq("id", enrolmentId);

  if (error) return fail(describe(error));

  revalidatePath("/admin/courses");
  return ok();
}

// ---------------------------------------------------------------- academic

export async function createIntakeBatch(input: {
  name: string;
  semester: Semester;
  startYear: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("intake_batches").insert({
    name: input.name.trim(),
    semester: input.semester,
    start_year: input.startYear,
  });

  if (error) return fail(describe(error));

  revalidatePath("/admin/academic");
  return ok();
}

/**
 * Retires configuration rather than deleting it — historical records still
 * point at it, and the database has no delete policy for these tables.
 */
export async function setConfigurationActive(
  table: "intake_batches" | "academic_levels",
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from(table).update({ is_active: isActive }).eq("id", id);
  if (error) return fail(describe(error));

  revalidatePath("/admin/academic");
  return ok();
}

export async function createTerm(input: {
  name: string;
  startDate: string;
  endDate: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("academic_terms").insert({
    name: input.name.trim(),
    start_date: input.startDate,
    end_date: input.endDate,
    status: "planning",
  });

  if (error) return fail(describe(error));

  revalidatePath("/admin/academic");
  return ok();
}

/** Only one term is active at a time; the old one is marked completed. */
export async function activateTerm(termId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error: closeError } = await supabase
    .from("academic_terms")
    .update({ status: "completed" })
    .eq("status", "active");

  if (closeError) return fail(describe(closeError));

  const { error } = await supabase
    .from("academic_terms")
    .update({ status: "active" })
    .eq("id", termId);

  if (error) return fail(describe(error));

  revalidatePath("/admin");
  return ok();
}

// ---------------------------------------------------------------- courses

export async function createCourse(input: {
  courseCode: string;
  courseName: string;
  credits: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("courses").insert({
    course_code: input.courseCode.trim().toUpperCase(),
    course_name: input.courseName.trim(),
    credits: input.credits,
  });

  if (error) return fail(describe(error));

  revalidatePath("/admin/courses");
  return ok();
}

/**
 * Schedules a course for a term and says which intakes may take it.
 *
 * The eligible batches are the gate: choose 2025-2 alone and only that intake
 * can be enrolled, which is how Communication in Korean III ends up with 29
 * of the section's 53 students.
 */
export async function createOffering(input: {
  courseId: string;
  academicTermId: string;
  offeringName: string;
  batchIds: string[];
}): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("course_offerings")
    .insert({
      course_id: input.courseId,
      academic_term_id: input.academicTermId,
      offering_name: input.offeringName.trim(),
      status: "active",
    })
    .select("id")
    .single();

  if (error) return fail(describe(error));

  if (input.batchIds.length) {
    const { error: batchError } = await supabase
      .from("offering_batches")
      .insert(input.batchIds.map((batch_id) => ({ offering_id: data.id, batch_id })));
    if (batchError) return fail(describe(batchError));
  }

  revalidatePath("/admin/courses");
  return ok({ id: data.id });
}

/** Removing a batch does not remove students already enrolled. */
export async function setOfferingBatches(
  offeringId: string,
  batchIds: string[],
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("offering_batches")
    .select("id, batch_id")
    .eq("offering_id", offeringId);

  const existing = new Set((current ?? []).map((b) => b.batch_id));
  const wanted = new Set(batchIds);

  const toAdd = batchIds.filter((id) => !existing.has(id));
  const toRemove = (current ?? []).filter((b) => !wanted.has(b.batch_id)).map((b) => b.id);

  if (toAdd.length) {
    const { error } = await supabase
      .from("offering_batches")
      .insert(toAdd.map((batch_id) => ({ offering_id: offeringId, batch_id })));
    if (error) return fail(describe(error));
  }

  if (toRemove.length) {
    const { error } = await supabase.from("offering_batches").delete().in("id", toRemove);
    if (error) return fail(describe(error));
  }

  revalidatePath(`/admin/courses/${offeringId}`);
  return ok();
}

// ---------------------------------------------------------------- timetable

/**
 * One recurring class time.
 *
 * The professor belongs to the slot, not the course, so two professors can
 * share a course and each sees only their own classes.
 */
export async function addTimetableSlot(input: {
  offeringId: string;
  professorId: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room?: string | null;
  lectureType: LectureType;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("timetable_slots").insert({
    offering_id: input.offeringId,
    professor_id: input.professorId,
    weekday: input.weekday,
    start_time: input.startTime,
    end_time: input.endTime,
    room: input.room?.trim() || null,
    lecture_type: input.lectureType,
  });

  if (error) return fail(describe(error));

  revalidatePath("/admin/schedule");
  return ok();
}

/**
 * Would this slot collide with something?
 *
 * The database does not enforce this — two classes in one room is a
 * timetabling mistake, not a data integrity one — so the interface checks
 * and warns.
 */
export async function findTimetableClashes(input: {
  professorId: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room?: string | null;
}): Promise<ActionResult<{ professor: number; room: number }>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("timetable_slots")
    .select("id, professor_id, room, start_time, end_time")
    .eq("weekday", input.weekday);

  const overlaps = (aStart: string, aEnd: string) =>
    aStart < input.endTime && input.startTime < aEnd;

  const clashing = (data ?? []).filter((s) => overlaps(s.start_time, s.end_time));

  return ok({
    professor: clashing.filter((s) => s.professor_id === input.professorId).length,
    room: input.room
      ? clashing.filter((s) => s.room === input.room).length
      : 0,
  });
}

export async function removeTimetableSlot(slotId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("timetable_slots").delete().eq("id", slotId);
  if (error) {
    if (error.code === "23503") {
      return fail(
        "Classes have already been created from this slot. Cancel those classes instead.",
      );
    }
    return fail(describe(error));
  }

  revalidatePath("/admin/schedule");
  return ok();
}
