/**
 * Types for the KDU Global Attendance System schema.
 *
 * Hand-written to match supabase/migrations/0001 … 0010. Regenerate from the
 * live database at any time with `npm run types`, which overwrites this file
 * using the Supabase CLI — do that once the CLI is installed, and treat the
 * generated version as the source of truth from then on.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Row/Insert/Update triple, with sensible defaults for the write shapes. */
type T<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

// ---------------------------------------------------------------- enums

export type UserRole = "student" | "professor" | "admin";
export type AdminLevel = "admin" | "super_admin";
export type AccountStatus = "active" | "suspended" | "inactive";
export type Semester = "Spring" | "Fall";
export type TermStatus = "planning" | "active" | "completed" | "archived";
export type OfferingStatus = "planning" | "active" | "completed" | "cancelled";
export type EnrollmentStatus = "enrolled" | "dropped" | "completed" | "withdrawn";
export type AssignmentStatus = "active" | "inactive";
export type LectureType = "Lecture" | "Tutorial" | "Seminar" | "Lab";
export type SessionStatus = "scheduled" | "open" | "closed" | "cancelled";
export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type CodeType = "initial" | "late";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

/** ISO weekday, 1 = Monday to 7 = Sunday, matching EXTRACT(ISODOW). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ---------------------------------------------------------------- rows

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  country: string | null;
  role: UserRole;
  admin_level: AdminLevel | null;
  photo_path: string | null;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
};

export type Student = {
  id: string;
  profile_id: string;
  student_id: string;
  intake_batch_id: string | null;
  academic_level_id: string | null;
};

export type Professor = {
  id: string;
  profile_id: string;
  employee_id: string;
  department: string | null;
};

export type IntakeBatch = {
  id: string;
  name: string;
  semester: Semester;
  start_year: number;
  is_active: boolean;
  created_at: string;
};

export type AcademicLevel = {
  id: string;
  name: string;
  sequence_number: number;
  is_active: boolean;
  created_at: string;
};

export type AcademicTerm = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: TermStatus;
  created_at: string;
};

export type ClassSection = {
  id: string;
  academic_level_id: string;
  academic_term_id: string;
  section_name: string;
  created_at: string;
};

export type SectionBatch = {
  id: string;
  section_id: string;
  batch_id: string;
};

export type StudentSectionAssignment = {
  id: string;
  student_id: string;
  section_id: string;
  assigned_at: string;
  status: AssignmentStatus;
};

export type Course = {
  id: string;
  course_code: string;
  course_name: string;
  credits: number;
  is_active: boolean;
  created_at: string;
};

export type CourseOffering = {
  id: string;
  course_id: string;
  academic_term_id: string;
  offering_name: string;
  status: OfferingStatus;
  created_at: string;
};

export type OfferingBatch = {
  id: string;
  offering_id: string;
  batch_id: string;
};

export type Enrollment = {
  id: string;
  student_id: string;
  offering_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
};

export type TimetableSlot = {
  id: string;
  offering_id: string;
  professor_id: string;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  room: string | null;
  lecture_type: LectureType;
  created_at: string;
};

export type ClassSession = {
  id: string;
  timetable_slot_id: string;
  session_date: string;
  started_at: string | null;
  closed_at: string | null;
  status: SessionStatus;
  created_at: string;
};

export type AttendanceCode = {
  id: string;
  session_id: string;
  created_by: string;
  code_hash: string;
  code_type: CodeType;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export type AttendanceRecord = {
  id: string;
  session_id: string;
  student_id: string;
  attendance_code_id: string | null;
  status: AttendanceStatus;
  marked_at: string;
  marked_by: string | null;
  created_at: string;
  leave_request_id: string | null;
};

export type AttendanceAttempt = {
  id: string;
  session_id: string;
  student_id: string;
  succeeded: boolean;
  attempted_at: string;
};

export type Material = {
  id: string;
  offering_id: string;
  uploaded_by: string;
  title: string;
  description: string | null;
  file_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_at: string;
};

export type LeaveRequest = {
  id: string;
  student_id: string;
  session_id: string;
  reason: string;
  status: LeaveStatus;
  supporting_file_path: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  created_at: string;
};

export type LoginLookup = {
  id: string;
  identifier: string;
  found: boolean;
  attempted_at: string;
};

// ---------------------------------------------------------------- views

/**
 * Per student per offering. The three-late penalty is calculated here and
 * never written into attendance_records, so the original marks stay exactly
 * as they were recorded.
 */
export type StudentAttendanceSummary = {
  student_id: string;
  offering_id: string;
  sessions_held: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  penalty_absences: number;
  effective_absences: number;
  attendance_rate: number | null;
};

/** One row per enrolled student per session, for the attendance screen. */
export type SessionAttendanceSheet = {
  session_id: string;
  session_date: string;
  session_status: SessionStatus;
  offering_id: string;
  student_id: string;
  student_number: string;
  full_name: string;
  attendance_record_id: string | null;
  attendance_status: AttendanceStatus | "not marked";
  marked_at: string | null;
  leave_request_id: string | null;
  leave_status: LeaveStatus | null;
};

// ---------------------------------------------------------------- database

export type Database = {
  public: {
    Tables: {
      profiles: T<
        Profile,
        Pick<Profile, "id" | "full_name" | "email"> & Partial<Profile>
      >;
      students: T<Student, Pick<Student, "profile_id" | "student_id"> & Partial<Student>>;
      professors: T<
        Professor,
        Pick<Professor, "profile_id" | "employee_id"> & Partial<Professor>
      >;
      intake_batches: T<
        IntakeBatch,
        Pick<IntakeBatch, "name" | "semester" | "start_year"> & Partial<IntakeBatch>
      >;
      academic_levels: T<
        AcademicLevel,
        Pick<AcademicLevel, "name" | "sequence_number"> & Partial<AcademicLevel>
      >;
      academic_terms: T<
        AcademicTerm,
        Pick<AcademicTerm, "name" | "start_date" | "end_date"> & Partial<AcademicTerm>
      >;
      class_sections: T<
        ClassSection,
        Pick<ClassSection, "academic_level_id" | "academic_term_id" | "section_name"> &
          Partial<ClassSection>
      >;
      section_batches: T<
        SectionBatch,
        Pick<SectionBatch, "section_id" | "batch_id"> & Partial<SectionBatch>
      >;
      student_section_assignments: T<
        StudentSectionAssignment,
        Pick<StudentSectionAssignment, "student_id" | "section_id"> &
          Partial<StudentSectionAssignment>
      >;
      courses: T<
        Course,
        Pick<Course, "course_code" | "course_name" | "credits"> & Partial<Course>
      >;
      course_offerings: T<
        CourseOffering,
        Pick<CourseOffering, "course_id" | "academic_term_id" | "offering_name"> &
          Partial<CourseOffering>
      >;
      offering_batches: T<
        OfferingBatch,
        Pick<OfferingBatch, "offering_id" | "batch_id"> & Partial<OfferingBatch>
      >;
      enrollments: T<
        Enrollment,
        Pick<Enrollment, "student_id" | "offering_id"> & Partial<Enrollment>
      >;
      timetable_slots: T<
        TimetableSlot,
        Pick<
          TimetableSlot,
          "offering_id" | "professor_id" | "weekday" | "start_time" | "end_time" | "lecture_type"
        > &
          Partial<TimetableSlot>
      >;
      class_sessions: T<
        ClassSession,
        Pick<ClassSession, "timetable_slot_id" | "session_date"> & Partial<ClassSession>
      >;
      attendance_codes: T<AttendanceCode>;
      attendance_records: T<
        AttendanceRecord,
        Pick<AttendanceRecord, "session_id" | "student_id" | "status"> &
          Partial<AttendanceRecord>
      >;
      attendance_attempts: T<AttendanceAttempt>;
      materials: T<
        Material,
        Pick<Material, "offering_id" | "uploaded_by" | "title" | "file_path"> &
          Partial<Material>
      >;
      leave_requests: T<
        LeaveRequest,
        Pick<LeaveRequest, "student_id" | "session_id" | "reason"> & Partial<LeaveRequest>
      >;
      audit_logs: T<AuditLog, never, never>;
      login_lookups: T<LoginLookup, never, never>;
    };
    Views: {
      student_attendance_summary: {
        Row: StudentAttendanceSummary;
        Relationships: [];
      };
      session_attendance_sheet: {
        Row: SessionAttendanceSheet;
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      current_student_id: { Args: Record<string, never>; Returns: string | null };
      current_professor_id: { Args: Record<string, never>; Returns: string | null };
      next_student_number: { Args: Record<string, never>; Returns: string };

      is_enrolled_in_offering: { Args: { p_offering_id: string }; Returns: boolean };
      teaches_offering: { Args: { p_offering_id: string }; Returns: boolean };
      teaches_session: { Args: { p_session_id: string }; Returns: boolean };
      attends_session: { Args: { p_session_id: string }; Returns: boolean };
      can_view_profile: { Args: { p_profile_id: string }; Returns: boolean };

      generate_class_sessions: { Args: { p_offering_id: string }; Returns: number };
      generate_attendance_code: {
        Args: { p_session_id: string; p_code_type?: CodeType; p_valid_seconds?: number };
        Returns: { code: string; expires_at: string }[];
      };
      submit_attendance_code: {
        Args: { p_session_id: string; p_code: string };
        Returns: AttendanceStatus;
      };
      close_class_session: { Args: { p_session_id: string }; Returns: number };

      register_professor: {
        Args: { p_profile_id: string; p_employee_id: string; p_department?: string | null };
        Returns: undefined;
      };
      grant_admin_access: {
        Args: { p_profile_id: string; p_admin_level?: AdminLevel };
        Returns: undefined;
      };
      revoke_admin_access: { Args: { p_profile_id: string }; Returns: undefined };
      email_for_student_id: { Args: { p_student_id: string }; Returns: string | null };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
