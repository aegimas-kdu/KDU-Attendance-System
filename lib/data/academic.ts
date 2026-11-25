import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  AcademicLevel,
  AcademicTerm,
  ClassSection,
  Department,
  IntakeBatch,
} from "@/lib/database.types";

/** The term everything defaults to. Only one can be active at a time. */
export const getActiveTerm = cache(async (): Promise<AcademicTerm | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_terms")
    .select("*")
    .eq("status", "active")
    .maybeSingle();
  return data;
});

export const listTerms = cache(async (): Promise<AcademicTerm[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_terms")
    .select("*")
    .order("start_date", { ascending: false });
  return data ?? [];
});

/**
 * Intake batches. `activeOnly` matches what a visitor sees on the
 * registration form; administrators see retired ones too.
 */
export const listIntakeBatches = cache(
  async (activeOnly = false): Promise<IntakeBatch[]> => {
    const supabase = await createClient();
    let query = supabase.from("intake_batches").select("*");
    if (activeOnly) query = query.eq("is_active", true);
    const { data } = await query
      .order("start_year", { ascending: false })
      .order("semester", { ascending: false });
    return data ?? [];
  },
);

export const listAcademicLevels = cache(
  async (activeOnly = false): Promise<AcademicLevel[]> => {
    const supabase = await createClient();
    let query = supabase.from("academic_levels").select("*");
    if (activeOnly) query = query.eq("is_active", true);
    const { data } = await query.order("sequence_number");
    return data ?? [];
  },
);

export type SectionWithDetail = ClassSection & {
  academic_levels: Pick<AcademicLevel, "name"> | null;
  academic_terms: Pick<AcademicTerm, "name"> | null;
  section_batches: { batch_id: string; intake_batches: Pick<IntakeBatch, "name"> | null }[];
  student_count: number;
};

/** Sections for a term, with their batches and how many students are in them. */
export async function listSections(termId: string): Promise<SectionWithDetail[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("class_sections")
    .select(
      `*,
       academic_levels ( name ),
       academic_terms ( name ),
       section_batches ( batch_id, intake_batches ( name ) ),
       student_section_assignments ( id, status )`,
    )
    .eq("academic_term_id", termId)
    .order("section_name");

  type Raw = Omit<SectionWithDetail, "student_count"> & {
    student_section_assignments: { id: string; status: string }[];
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => {
    const { student_section_assignments, ...rest } = row;
    return {
      ...rest,
      student_count: student_section_assignments.filter((a) => a.status === "active")
        .length,
    };
  });
}

/** Students in a section, newest assignment first. */
export async function listSectionMembers(sectionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_section_assignments")
    .select(
      `id, assigned_at, status,
       students ( id, student_id, profiles ( full_name ), intake_batches ( name ) )`,
    )
    .eq("section_id", sectionId)
    .eq("status", "active")
    .order("assigned_at");
  return data ?? [];
}

/**
 * Students who belong to a section's intake batches and academic level but
 * have no active section this term — the quiet failure the admin overview
 * exists to catch.
 */
export async function countUnassignedStudents(termId: string): Promise<number> {
  const supabase = await createClient();

  const { data: assigned } = await supabase
    .from("student_section_assignments")
    .select("student_id, class_sections!inner ( academic_term_id )")
    .eq("status", "active")
    .eq("class_sections.academic_term_id", termId);

  const assignedIds = new Set((assigned ?? []).map((a) => a.student_id));

  const { data: students } = await supabase
    .from("students")
    .select("id, intake_batch_id, academic_level_id");

  return (students ?? []).filter(
    (s) => s.intake_batch_id && s.academic_level_id && !assignedIds.has(s.id),
  ).length;
}

/**
 * The university's departments.
 *
 * Readable by a signed-out visitor, because the registration
 * form needs them before anyone has an account.
 */
export const listDepartments = cache(
  async (activeOnly = false): Promise<Department[]> => {
    const supabase = await createClient();
    let query = supabase.from("departments").select("*");
    if (activeOnly) query = query.eq("is_active", true);
    const { data } = await query.order("name");
    return data ?? [];
  },
);
