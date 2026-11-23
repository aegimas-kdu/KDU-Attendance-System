import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LectureType, SessionStatus, Weekday } from "@/lib/database.types";

/** The four teaching periods. Classes run 50 minutes with a 10 minute break. */
export const PERIODS = [
  { start: "09:00", end: "09:50", label: "09:00 – 09:50" },
  { start: "10:00", end: "10:50", label: "10:00 – 10:50" },
  { start: "11:00", end: "11:50", label: "11:00 – 11:50" },
  { start: "12:00", end: "12:50", label: "12:00 – 12:50" },
] as const;

export const WEEKDAYS: { value: Weekday; name: string; short: string }[] = [
  { value: 1, name: "Monday", short: "Mon" },
  { value: 2, name: "Tuesday", short: "Tue" },
  { value: 3, name: "Wednesday", short: "Wed" },
  { value: 4, name: "Thursday", short: "Thu" },
  { value: 5, name: "Friday", short: "Fri" },
  { value: 6, name: "Saturday", short: "Sat" },
  { value: 7, name: "Sunday", short: "Sun" },
];

/** "09:00:00" → "09:00" */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export type ScheduledClass = {
  session_id: string | null;
  slot_id: string;
  session_date: string | null;
  status: SessionStatus | null;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  room: string | null;
  lecture_type: LectureType;
  course_name: string;
  course_code: string;
  offering_id: string;
  professor_name: string | null;
  professor_id: string;
};

type RawSession = {
  id: string;
  session_date: string;
  status: SessionStatus;
  timetable_slots: {
    id: string;
    weekday: Weekday;
    start_time: string;
    end_time: string;
    room: string | null;
    lecture_type: LectureType;
    offering_id: string;
    professors: { id: string; profiles: { full_name: string } | null } | null;
    course_offerings: {
      courses: { course_code: string; course_name: string } | null;
    } | null;
  } | null;
};

function toScheduledClass(row: RawSession): ScheduledClass | null {
  const slot = row.timetable_slots;
  if (!slot) return null;
  return {
    session_id: row.id,
    slot_id: slot.id,
    session_date: row.session_date,
    status: row.status,
    weekday: slot.weekday,
    start_time: slot.start_time,
    end_time: slot.end_time,
    room: slot.room,
    lecture_type: slot.lecture_type,
    offering_id: slot.offering_id,
    course_code: slot.course_offerings?.courses?.course_code ?? "",
    course_name: slot.course_offerings?.courses?.course_name ?? "",
    professor_id: slot.professors?.id ?? "",
    professor_name: slot.professors?.profiles?.full_name ?? null,
  };
}

const SESSION_SELECT = `
  id, session_date, status,
  timetable_slots (
    id, weekday, start_time, end_time, room, lecture_type, offering_id,
    professors ( id, profiles ( full_name ) ),
    course_offerings ( courses ( course_code, course_name ) )
  )`;

/**
 * Class meetings between two dates.
 *
 * Row Level Security narrows this by itself: a student sees the classes they
 * are enrolled in, a professor the ones they teach, an administrator all of
 * them. No role argument is needed here.
 */
export async function listClassesBetween(
  from: string,
  to: string,
): Promise<ScheduledClass[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_sessions")
    .select(SESSION_SELECT)
    .gte("session_date", from)
    .lte("session_date", to)
    .order("session_date");

  return ((data ?? []) as unknown as RawSession[])
    .map(toScheduledClass)
    .filter((c): c is ScheduledClass => c !== null)
    .sort(
      (a, b) =>
        (a.session_date ?? "").localeCompare(b.session_date ?? "") ||
        a.start_time.localeCompare(b.start_time),
    );
}

/** Everything happening on one day. */
export async function listClassesOn(date: string): Promise<ScheduledClass[]> {
  return listClassesBetween(date, date);
}

/** Every meeting of one course offering. */
export async function listOfferingSessions(
  offeringId: string,
): Promise<ScheduledClass[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_sessions")
    .select(SESSION_SELECT)
    .eq("timetable_slots.offering_id", offeringId)
    .order("session_date", { ascending: false });

  return ((data ?? []) as unknown as RawSession[])
    .map(toScheduledClass)
    .filter((c): c is ScheduledClass => c !== null);
}

export async function getSession(sessionId: string): Promise<ScheduledClass | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle();
  return data ? toScheduledClass(data as unknown as RawSession) : null;
}

/** The weekly grid: slots, not dated meetings. */
export async function listTimetableSlots(offeringId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("timetable_slots")
    .select(
      `id, weekday, start_time, end_time, room, lecture_type, offering_id,
       professors ( id, employee_id, profiles ( full_name ) ),
       course_offerings ( id, offering_name, courses ( course_code, course_name ),
                          offering_batches ( intake_batches ( name ) ),
                          enrollments ( status ) )`,
    );

  if (offeringId) query = query.eq("offering_id", offeringId);

  const { data } = await query.order("weekday").order("start_time");
  return data ?? [];
}

/** Classes a professor left open — nobody is marked absent until they close. */
export async function listUnclosedSessions(): Promise<ScheduledClass[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("class_sessions")
    .select(SESSION_SELECT)
    .eq("status", "open")
    .lt("session_date", today)
    .order("session_date");

  return ((data ?? []) as unknown as RawSession[])
    .map(toScheduledClass)
    .filter((c): c is ScheduledClass => c !== null);
}

/** Today, as the database stores dates. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Monday of the week containing `date`, and the Friday after it. */
export function weekBounds(date = new Date()): { from: string; to: string } {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    from: monday.toISOString().slice(0, 10),
    to: friday.toISOString().slice(0, 10),
  };
}
