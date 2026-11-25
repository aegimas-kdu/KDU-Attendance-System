import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AccountStatus, Profile } from "@/lib/database.types";

export type StudentRow = {
  id: string;
  student_id: string;
  profile: Pick<Profile, "id" | "full_name" | "email" | "account_status">;
  intake_batch: string | null;
  academic_level: string | null;
  section: string | null;
  course_count: number;
};

export type StudentFilters = {
  search?: string;
  intakeBatchId?: string;
  academicLevelId?: string;
  status?: AccountStatus;
  limit?: number;
};

/**
 * The administrator's student list.
 *
 * Row Level Security decides what comes back: an administrator sees everyone,
 * a professor only the students they teach, a student only themselves. The
 * same function is therefore safe to call from any role.
 */
export async function listStudents(
  filters: StudentFilters = {},
): Promise<StudentRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("students")
    .select(
      `id, student_id,
       profiles!inner ( id, full_name, email, account_status ),
       intake_batches ( name ),
       academic_levels ( name ),
       student_section_assignments ( status, class_sections ( section_name ) ),
       enrollments ( status )`,
    )
    .limit(filters.limit ?? 200);

  if (filters.intakeBatchId) query = query.eq("intake_batch_id", filters.intakeBatchId);
  if (filters.academicLevelId)
    query = query.eq("academic_level_id", filters.academicLevelId);
  if (filters.status) query = query.eq("profiles.account_status", filters.status);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      `student_id.ilike.${term},profiles.full_name.ilike.${term},profiles.email.ilike.${term}`,
    );
  }

  const { data } = await query.order("student_id");

  type Raw = {
    id: string;
    student_id: string;
    profiles: Pick<Profile, "id" | "full_name" | "email" | "account_status">;
    intake_batches: { name: string } | null;
    academic_levels: { name: string } | null;
    student_section_assignments: {
      status: string;
      class_sections: { section_name: string } | null;
    }[];
    enrollments: { status: string }[];
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    profile: row.profiles,
    intake_batch: row.intake_batches?.name ?? null,
    academic_level: row.academic_levels?.name ?? null,
    section:
      row.student_section_assignments.find((a) => a.status === "active")?.class_sections
        ?.section_name ?? null,
    course_count: row.enrollments.filter((e) => e.status === "enrolled").length,
  }));
}

/** One student, with everything the record screen shows. */
export async function getStudent(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select(
      `id, student_id, intake_batch_id, academic_level_id, department_id,
       profiles ( id, full_name, email, country, role, admin_level, account_status, created_at ),
       intake_batches ( id, name ),
       academic_levels ( id, name ),
       departments ( id, code, name ),
       student_section_assignments ( id, assigned_at, status, class_sections ( id, section_name, academic_terms ( name ) ) )`,
    )
    .eq("id", studentId)
    .maybeSingle();
  return data;
}

export async function listProfessors() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professors")
    .select(
      `id, employee_id, department,
       profiles ( id, full_name, email, role, account_status )`,
    )
    .order("employee_id");
  return data ?? [];
}

/** Everyone holding the admin role. Only a super admin can read this usefully. */
export async function listAdministrators() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, admin_level, account_status, updated_at")
    .eq("role", "admin")
    .order("admin_level")
    .order("full_name");
  return data ?? [];
}

/** Find a profile by email — how the admin screens pick someone to promote. */
export async function findProfileByEmail(email: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, admin_level, account_status")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return data;
}

/** Students with no intake batch cannot be enrolled in anything. */
export async function countStudentsWithoutBatch(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .is("intake_batch_id", null);
  return count ?? 0;
}
