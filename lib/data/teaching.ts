import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OfferingStatus } from "@/lib/database.types";

export type TeachingOffering = {
  offering_id: string;
  offering_name: string;
  status: OfferingStatus;
  course_code: string;
  course_name: string;
  credits: number;
  term_name: string;
  enrolled: number;
  slots: { weekday: number; start_time: string; end_time: string; room: string | null }[];
};

/**
 * The courses one professor teaches.
 *
 * Derived from the timetable, not the course: a slot carries the professor,
 * so two professors can share a course and each sees only their own classes.
 */
export async function listMyOfferings(
  professorId: string,
): Promise<TeachingOffering[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("timetable_slots")
    .select(
      `weekday, start_time, end_time, room, offering_id,
       course_offerings (
         id, offering_name, status,
         courses ( course_code, course_name, credits ),
         academic_terms ( name ),
         enrollments ( status )
       )`,
    )
    .eq("professor_id", professorId)
    .order("weekday")
    .order("start_time");

  type Raw = {
    weekday: number;
    start_time: string;
    end_time: string;
    room: string | null;
    offering_id: string;
    course_offerings: {
      id: string;
      offering_name: string;
      status: OfferingStatus;
      courses: { course_code: string; course_name: string; credits: number } | null;
      academic_terms: { name: string } | null;
      enrollments: { status: string }[];
    } | null;
  };

  const byOffering = new Map<string, TeachingOffering>();

  for (const row of (data ?? []) as unknown as Raw[]) {
    const offering = row.course_offerings;
    if (!offering) continue;

    const existing = byOffering.get(row.offering_id);
    const slot = {
      weekday: row.weekday,
      start_time: row.start_time,
      end_time: row.end_time,
      room: row.room,
    };

    if (existing) {
      existing.slots.push(slot);
      continue;
    }

    byOffering.set(row.offering_id, {
      offering_id: row.offering_id,
      offering_name: offering.offering_name,
      status: offering.status,
      course_code: offering.courses?.course_code ?? "",
      course_name: offering.courses?.course_name ?? "",
      credits: offering.courses?.credits ?? 0,
      term_name: offering.academic_terms?.name ?? "",
      enrolled: offering.enrollments.filter((e) => e.status === "enrolled").length,
      slots: [slot],
    });
  }

  return [...byOffering.values()].sort((a, b) =>
    a.course_name.localeCompare(b.course_name),
  );
}

/**
 * How a professor's own teaching is going: one rate per course.
 *
 * Averages the per-student rates the summary view calculates, so the
 * three-late rule and approved leave are already accounted for.
 */
export async function myCourseAttendance(
  offeringIds: string[],
): Promise<Map<string, { rate: number | null; atRisk: number; students: number }>> {
  const result = new Map<
    string,
    { rate: number | null; atRisk: number; students: number }
  >();
  if (!offeringIds.length) return result;

  const supabase = await createClient();
  const { data } = await supabase
    .from("student_attendance_summary")
    .select("offering_id, attendance_rate")
    .in("offering_id", offeringIds);

  for (const id of offeringIds) {
    const rows = (data ?? []).filter((r) => r.offering_id === id);
    const rated = rows.filter((r) => r.attendance_rate !== null);
    result.set(id, {
      students: rows.length,
      rate: rated.length
        ? Math.round(
            rated.reduce((sum, r) => sum + Number(r.attendance_rate ?? 0), 0) /
              rated.length,
          )
        : null,
      atRisk: rows.filter((r) => Number(r.attendance_rate ?? 100) < 75).length,
    });
  }

  return result;
}

/** How many students are waiting on this professor's leave decisions. */
export async function countPendingLeave(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
