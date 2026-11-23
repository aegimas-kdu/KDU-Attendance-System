import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Course, OfferingStatus } from "@/lib/database.types";

export type OfferingRow = {
  id: string;
  offering_name: string;
  status: OfferingStatus;
  course: Pick<Course, "id" | "course_code" | "course_name" | "credits">;
  professors: string[];
  eligible_batches: { id: string; name: string }[];
  enrolled_count: number;
  slot_count: number;
};

/**
 * Course offerings for a term — the course catalogue crossed with who is
 * actually teaching it, who may take it, and how many did.
 */
export async function listOfferings(termId: string): Promise<OfferingRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("course_offerings")
    .select(
      `id, offering_name, status,
       courses ( id, course_code, course_name, credits ),
       offering_batches ( intake_batches ( id, name ) ),
       enrollments ( status ),
       timetable_slots ( id, professors ( profiles ( full_name ) ) )`,
    )
    .eq("academic_term_id", termId)
    .order("offering_name");

  type Raw = {
    id: string;
    offering_name: string;
    status: OfferingStatus;
    courses: Pick<Course, "id" | "course_code" | "course_name" | "credits">;
    offering_batches: { intake_batches: { id: string; name: string } | null }[];
    enrollments: { status: string }[];
    timetable_slots: { id: string; professors: { profiles: { full_name: string } | null } | null }[];
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    id: row.id,
    offering_name: row.offering_name,
    status: row.status,
    course: row.courses,
    professors: Array.from(
      new Set(
        row.timetable_slots
          .map((s) => s.professors?.profiles?.full_name)
          .filter((n): n is string => Boolean(n)),
      ),
    ),
    eligible_batches: row.offering_batches
      .map((b) => b.intake_batches)
      .filter((b): b is { id: string; name: string } => Boolean(b)),
    enrolled_count: row.enrollments.filter((e) => e.status === "enrolled").length,
    slot_count: row.timetable_slots.length,
  }));
}

/** One offering, for the admin detail screen. */
export async function getOffering(offeringId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_offerings")
    .select(
      `id, offering_name, status, academic_term_id,
       courses ( id, course_code, course_name, credits ),
       academic_terms ( id, name, start_date, end_date ),
       offering_batches ( id, intake_batches ( id, name ) ),
       timetable_slots ( id, weekday, start_time, end_time, room, lecture_type,
                         professors ( id, employee_id, profiles ( full_name ) ) )`,
    )
    .eq("id", offeringId)
    .maybeSingle();
  return data;
}

/** Who is enrolled, with the attendance rate the summary view calculates. */
export async function listEnrolments(offeringId: string) {
  const supabase = await createClient();

  const [{ data: rows }, { data: summary }] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        `id, status, enrolled_at,
         students ( id, student_id, profiles ( full_name ), intake_batches ( name ) )`,
      )
      .eq("offering_id", offeringId)
      .order("enrolled_at"),
    supabase
      .from("student_attendance_summary")
      .select("student_id, attendance_rate, effective_absences")
      .eq("offering_id", offeringId),
  ]);

  const rates = new Map(
    (summary ?? []).map((s) => [
      s.student_id,
      { rate: s.attendance_rate, absences: s.effective_absences },
    ]),
  );

  type Raw = {
    id: string;
    status: string;
    enrolled_at: string;
    students: {
      id: string;
      student_id: string;
      profiles: { full_name: string } | null;
      intake_batches: { name: string } | null;
    } | null;
  };

  return ((rows ?? []) as unknown as Raw[]).map((row) => ({
    id: row.id,
    status: row.status,
    enrolled_at: row.enrolled_at,
    student_id: row.students?.id ?? "",
    student_number: row.students?.student_id ?? "",
    full_name: row.students?.profiles?.full_name ?? "",
    intake_batch: row.students?.intake_batches?.name ?? null,
    attendance_rate: rates.get(row.students?.id ?? "")?.rate ?? null,
    effective_absences: rates.get(row.students?.id ?? "")?.absences ?? 0,
  }));
}

/**
 * Students a section can contribute to an offering, split by whether their
 * intake batch makes them eligible.
 *
 * This is what lets the admin screen say "adding the section will enrol 29 and
 * leave out 24" before anyone clicks, rather than failing one row at a time
 * against the database trigger.
 */
export async function previewSectionEnrolment(
  sectionId: string,
  offeringId: string,
): Promise<{ eligible: string[]; ineligible: string[] }> {
  const supabase = await createClient();

  const [{ data: members }, { data: allowed }, { data: existing }] = await Promise.all([
    supabase
      .from("student_section_assignments")
      .select("student_id, students ( intake_batch_id )")
      .eq("section_id", sectionId)
      .eq("status", "active"),
    supabase.from("offering_batches").select("batch_id").eq("offering_id", offeringId),
    supabase.from("enrollments").select("student_id").eq("offering_id", offeringId),
  ]);

  const allowedBatches = new Set((allowed ?? []).map((b) => b.batch_id));
  const alreadyIn = new Set((existing ?? []).map((e) => e.student_id));

  type Raw = { student_id: string; students: { intake_batch_id: string | null } | null };

  const eligible: string[] = [];
  const ineligible: string[] = [];

  for (const row of (members ?? []) as unknown as Raw[]) {
    if (alreadyIn.has(row.student_id)) continue;
    const batch = row.students?.intake_batch_id;
    if (batch && allowedBatches.has(batch)) eligible.push(row.student_id);
    else ineligible.push(row.student_id);
  }

  return { eligible, ineligible };
}

export async function listCourseCatalogue(): Promise<Course[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("*").order("course_code");
  return data ?? [];
}

/** Offerings with no timetable produce no classes and no attendance. */
export async function countOfferingsWithoutSchedule(termId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_offerings")
    .select("id, timetable_slots ( id )")
    .eq("academic_term_id", termId)
    .neq("status", "cancelled");

  type Raw = { id: string; timetable_slots: { id: string }[] };
  return ((data ?? []) as unknown as Raw[]).filter((o) => o.timetable_slots.length === 0)
    .length;
}
