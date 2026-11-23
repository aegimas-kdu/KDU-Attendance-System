-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0010
-- CROSS ROLE VISIBILITY AND SIGN-IN BY STUDENT NUMBER
-- =========================================================
-- These rules need tables from several earlier files, so they
-- are collected here rather than scattered through them.
--
-- Closes gap 2. In the original design the only rule on
-- profiles was "view own profile", which meant an attendance
-- sheet could show student ids but never names, and a student
-- could not see who teaches their course.
--
-- Closes gap 7. Supabase Auth signs a person in by email, but
-- KDU students know their student number. The lookup below is
-- rate limited and returns nothing for inactive accounts.
-- =========================================================


-- ---------------------------------------------------------
-- 1. WHO MAY SEE WHOSE PROFILE
-- ---------------------------------------------------------
-- Yourself, always.
-- Administrators, everyone.
-- A professor may see a student enrolled in a class they teach.
-- A student may see a professor who teaches a class they are
-- enrolled in.
-- Two students in the same class cannot see each other.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT
        p_profile_id = (SELECT auth.uid())
        OR public.is_admin()
        -- I teach them.
        OR EXISTS (
            SELECT 1
            FROM public.students s
            JOIN public.enrollments e    ON e.student_id = s.id
            JOIN public.timetable_slots ts ON ts.offering_id = e.offering_id
            JOIN public.professors pr    ON pr.id = ts.professor_id
            WHERE s.profile_id = p_profile_id
              AND e.status = 'enrolled'
              AND pr.profile_id = (SELECT auth.uid())
        )
        -- They teach me.
        OR EXISTS (
            SELECT 1
            FROM public.professors pr
            JOIN public.timetable_slots ts ON ts.professor_id = pr.id
            JOIN public.enrollments e    ON e.offering_id = ts.offering_id
            JOIN public.students s       ON s.id = e.student_id
            WHERE pr.profile_id = p_profile_id
              AND e.status = 'enrolled'
              AND s.profile_id = (SELECT auth.uid())
        );
$fn$;

GRANT EXECUTE ON FUNCTION public.can_view_profile(UUID) TO authenticated;


CREATE POLICY "View profiles of people you share a class with"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_view_profile(id));

CREATE POLICY "Professors view their students"
ON public.students
FOR SELECT
TO authenticated
USING (public.can_view_profile(profile_id));

CREATE POLICY "Students view their professors"
ON public.professors
FOR SELECT
TO authenticated
USING (public.can_view_profile(profile_id));


-- ---------------------------------------------------------
-- 2. THE CLASS LIST
-- ---------------------------------------------------------
-- A professor needs the enrolment rows of their own classes in
-- order to take attendance. 0005 only granted this to the
-- student concerned and to administrators.
-- ---------------------------------------------------------
CREATE POLICY "Teaching staff view their class lists"
ON public.enrollments
FOR SELECT
TO authenticated
USING (public.teaches_offering(offering_id));


-- ---------------------------------------------------------
-- 3. SIGN IN WITH A STUDENT NUMBER
-- ---------------------------------------------------------
CREATE TABLE public.login_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    found BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_lookups_time ON public.login_lookups(attempted_at DESC);

ALTER TABLE public.login_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read login lookups"
ON public.login_lookups
FOR SELECT
TO authenticated
USING (public.is_admin());


-- Returns the sign-in email for a student number, or NULL.
-- The caller is anonymous at this point, so the limit is global
-- rather than per user: sixty lookups a minute is far more than
-- a campus needs and far less than an enumeration run.
CREATE OR REPLACE FUNCTION public.email_for_student_id(p_student_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_recent INTEGER;
    v_email  TEXT;
BEGIN
    SELECT COUNT(*)
    INTO v_recent
    FROM public.login_lookups
    WHERE attempted_at > NOW() - INTERVAL '1 minute';

    IF v_recent >= 60 THEN
        RAISE EXCEPTION 'Too many sign-in lookups. Please try again shortly.';
    END IF;

    SELECT p.email
    INTO v_email
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.student_id = TRIM(p_student_id)
      AND p.account_status = 'active';

    INSERT INTO public.login_lookups (identifier, found)
    VALUES (TRIM(p_student_id), v_email IS NOT NULL);

    RETURN v_email;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.email_for_student_id(TEXT) TO anon, authenticated;

-- Note for the backend stage: this function does hand an email
-- address to an anonymous caller who already knows a valid
-- student number. If that is judged too generous during
-- testing, move the same logic into a Supabase Edge Function
-- that performs the sign-in itself with the service role key
-- and returns only a session, then revoke the grant above.


-- ---------------------------------------------------------
-- 4. CONVENIENCE VIEW FOR THE ATTENDANCE SCREEN
-- ---------------------------------------------------------
-- One row per enrolled student per session, with the mark when
-- there is one. Obeys the reader's own row level security.
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW public.session_attendance_sheet
WITH (security_invoker = true)
AS
SELECT
    cs.id            AS session_id,
    cs.session_date,
    cs.status        AS session_status,
    ts.offering_id,
    s.id             AS student_id,
    s.student_id     AS student_number,
    p.full_name,
    ar.id            AS attendance_record_id,
    COALESCE(ar.status, 'not marked') AS attendance_status,
    ar.marked_at,
    lr.id            AS leave_request_id,
    lr.status        AS leave_status
FROM public.class_sessions cs
JOIN public.timetable_slots ts ON ts.id = cs.timetable_slot_id
JOIN public.enrollments e      ON e.offering_id = ts.offering_id
                              AND e.status = 'enrolled'
JOIN public.students s         ON s.id = e.student_id
JOIN public.profiles p         ON p.id = s.profile_id
LEFT JOIN public.attendance_records ar
       ON ar.session_id = cs.id AND ar.student_id = s.id
LEFT JOIN public.leave_requests lr
       ON lr.session_id = cs.id AND lr.student_id = s.id;
