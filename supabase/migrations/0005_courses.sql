-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0005
-- COURSE MANAGEMENT AND STUDENT ENROLMENT
-- =========================================================
--   course           the subject itself, e.g. Python for AI
--   course offering  that subject delivered in one term
--   offering batch   which intake batches may take it
--   enrolment        the individual students registered for it
--
-- Batch eligibility alone never grants access. Materials,
-- timetables and attendance all require an active enrolment.
--
-- Closes gap 3: check_enrollment_batch() now runs as
-- SECURITY DEFINER. Without it the trigger reads public.students
-- as the calling user, whose row level security hides every
-- student but their own, so the eligibility test silently
-- failed for administrators enrolling other people.
-- =========================================================


-- ---------------------------------------------------------
-- 1. COURSES
-- ---------------------------------------------------------
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code TEXT NOT NULL UNIQUE,
    course_name TEXT NOT NULL,
    credits NUMERIC(3,1) NOT NULL CHECK (credits > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------
-- 2. COURSE OFFERINGS
-- ---------------------------------------------------------
CREATE TABLE public.course_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL
        REFERENCES public.courses(id) ON DELETE RESTRICT,
    academic_term_id UUID NOT NULL
        REFERENCES public.academic_terms(id) ON DELETE RESTRICT,
    offering_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, academic_term_id, offering_name)
);

CREATE INDEX idx_offerings_term ON public.course_offerings(academic_term_id);


-- ---------------------------------------------------------
-- 3. OFFERING BATCHES
-- ---------------------------------------------------------
CREATE TABLE public.offering_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL
        REFERENCES public.course_offerings(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL
        REFERENCES public.intake_batches(id) ON DELETE RESTRICT,
    UNIQUE (offering_id, batch_id)
);


-- ---------------------------------------------------------
-- 4. ENROLMENTS
-- ---------------------------------------------------------
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL
        REFERENCES public.students(id) ON DELETE RESTRICT,
    offering_id UUID NOT NULL
        REFERENCES public.course_offerings(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'enrolled'
        CHECK (status IN ('enrolled', 'dropped', 'completed', 'withdrawn')),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, offering_id)
);

CREATE INDEX idx_enrollments_offering ON public.enrollments(offering_id);
CREATE INDEX idx_enrollments_student  ON public.enrollments(student_id);


-- =========================================================
-- ENROLMENT HELPERS
-- =========================================================
-- Used by the policies in 0006 to 0010. SECURITY DEFINER, so a
-- policy can ask "is this person in that class?" without the
-- person needing read access to every table in the join.
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_enrolled_in_offering(p_offering_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id
        WHERE e.offering_id = p_offering_id
          AND s.profile_id = (SELECT auth.uid())
          AND e.status = 'enrolled'
    );
$fn$;

GRANT EXECUTE ON FUNCTION public.is_enrolled_in_offering(UUID) TO authenticated;


-- =========================================================
-- ENFORCE BATCH ELIGIBILITY
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_enrollment_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER            -- gap 3 fix
SET search_path = ''
AS $fn$
DECLARE
    v_student_batch_id UUID;
    v_offering_status  TEXT;
BEGIN
    SELECT s.intake_batch_id
    INTO v_student_batch_id
    FROM public.students s
    WHERE s.id = NEW.student_id;

    IF v_student_batch_id IS NULL THEN
        RAISE EXCEPTION
            'The student must have an intake batch assigned before enrolment.';
    END IF;

    SELECT co.status
    INTO v_offering_status
    FROM public.course_offerings co
    WHERE co.id = NEW.offering_id;

    IF v_offering_status = 'cancelled' THEN
        RAISE EXCEPTION 'This course offering has been cancelled.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.offering_batches ob
        WHERE ob.offering_id = NEW.offering_id
          AND ob.batch_id = v_student_batch_id
    ) THEN
        RAISE EXCEPTION
            'This student belongs to an intake batch that is not eligible for this course offering.';
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE TRIGGER validate_enrollment_batch
BEFORE INSERT OR UPDATE OF student_id, offering_id
ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.check_enrollment_batch();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
ALTER TABLE public.courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offering_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view courses"
ON public.courses
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users view offerings"
ON public.course_offerings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users view offering batches"
ON public.offering_batches
FOR SELECT
TO authenticated
USING (true);

-- A student sees their own enrolments. The rule that lets a
-- professor see the class list is added in 0010, once the
-- timetable tells us who teaches what.
CREATE POLICY "View own enrollments or admin access"
ON public.enrollments
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR student_id = public.current_student_id()
);

CREATE POLICY "Admins insert courses"
ON public.courses
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update courses"
ON public.courses
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins insert offerings"
ON public.course_offerings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update offerings"
ON public.course_offerings
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins insert offering batches"
ON public.offering_batches
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update offering batches"
ON public.offering_batches
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins insert enrollments"
ON public.enrollments
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update enrollments"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
