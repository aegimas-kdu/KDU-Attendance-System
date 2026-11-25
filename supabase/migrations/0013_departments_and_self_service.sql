-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0013
-- DEPARTMENTS, AND STUDENTS MAINTAINING THEIR OWN STUDIES
-- =========================================================
-- Two changes, for one reason: the registry cannot type in a
-- thousand students.
--
--   1. Departments become a table. Until now only professors
--      had one, as free text. Students need one too, and five
--      departments spelled five ways is not a department list.
--
--   2. A student fills in their own intake batch, academic
--      level and department when they register, and can
--      correct them afterwards. An administrator can still
--      change them for anyone — that power is not removed,
--      it simply stops being the only way.
--
-- What a student still cannot touch: their student number,
-- their role, their account status, or anyone else's record.
-- A guard trigger enforces that, and every change is written
-- to the audit log with the name of whoever made it.
-- =========================================================


-- ---------------------------------------------------------
-- 1. DEPARTMENTS
-- ---------------------------------------------------------
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE
        CHECK (code = UPPER(code) AND LENGTH(code) BETWEEN 2 AND 8),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.departments IS
    'The university''s departments. Retired with is_active, never deleted: '
    'student records point at them.';

INSERT INTO public.departments (code, name) VALUES
    ('IBA',  'International Business Administration'),
    ('AI',   'Artificial Intelligence'),
    ('HAI',  'Hospitality and AI Innovation'),
    ('AIDT', 'AI Integration and Digital Technology'),
    ('SC',   'Smart Computing')
ON CONFLICT (code) DO NOTHING;


-- ---------------------------------------------------------
-- 2. CONNECT STUDENTS TO A DEPARTMENT
-- ---------------------------------------------------------
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS department_id UUID
    REFERENCES public.departments(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_students_department
ON public.students(department_id);

-- Professors keep their free-text department for now, but a
-- matching column lets the two be reconciled later without a
-- second migration.
ALTER TABLE public.professors
ADD COLUMN IF NOT EXISTS department_id UUID
    REFERENCES public.departments(id) ON DELETE RESTRICT;

-- Existing professor rows whose text matches a department name
-- or code are linked up; anything else is left for the registry.
UPDATE public.professors p
SET department_id = d.id
FROM public.departments d
WHERE p.department_id IS NULL
  AND p.department IS NOT NULL
  AND (UPPER(TRIM(p.department)) = d.code
       OR LOWER(TRIM(p.department)) = LOWER(d.name));


-- ---------------------------------------------------------
-- 3. ROW LEVEL SECURITY ON DEPARTMENTS
-- ---------------------------------------------------------
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Visitors need the list to fill in the registration form
-- before they have an account, exactly like batches and levels.
CREATE POLICY "Read active departments"
ON public.departments
FOR SELECT
TO anon, authenticated
USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Admins insert departments"
ON public.departments
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update departments"
ON public.departments
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- No DELETE policy: a department is retired, never removed.


-- ---------------------------------------------------------
-- 4. TABLE PRIVILEGES
-- GRANT ... ON ALL TABLES in 0011 applied to the tables that
-- existed then. A new table needs its own grant, or PostgREST
-- refuses with 42501 before any policy is consulted.
-- ---------------------------------------------------------
GRANT SELECT         ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE ON public.departments TO authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER
ON public.departments FROM anon, authenticated;


-- ---------------------------------------------------------
-- 5. A STUDENT MAY MAINTAIN THEIR OWN STUDIES
-- ---------------------------------------------------------
CREATE POLICY "Students update own studies"
ON public.students
FOR UPDATE
TO authenticated
USING (profile_id = (SELECT auth.uid()))
WITH CHECK (profile_id = (SELECT auth.uid()));

-- The policy decides WHICH ROW. This decides WHICH COLUMNS:
-- without it, that policy would let a student rewrite their own
-- student number, which is their identity in every report and
-- on every attendance sheet.
CREATE OR REPLACE FUNCTION public.guard_student_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
    -- No authenticated user: a trusted server-side call, such as
    -- the sign-up trigger or the SQL editor.
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN NEW;
    END IF;

    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.id         IS DISTINCT FROM OLD.id
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
        RAISE EXCEPTION 'This record cannot be moved to another account.';
    END IF;

    IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
        RAISE EXCEPTION
            'Your student number is issued by the university and cannot be '
            'changed here. Contact the registry office.';
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE TRIGGER guard_student_record_changes
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.guard_student_record();


-- ---------------------------------------------------------
-- 6. THE CHANGE IS RECORDED
-- Intake batch decides which courses a student may be enrolled
-- in, so a student editing their own is worth a line in the
-- audit log — the same log that records a professor correcting
-- an attendance mark.
-- ---------------------------------------------------------
CREATE TRIGGER audit_student_studies_changes
AFTER UPDATE OF intake_batch_id, academic_level_id, department_id
ON public.students
FOR EACH ROW
WHEN (
    OLD.intake_batch_id   IS DISTINCT FROM NEW.intake_batch_id
    OR OLD.academic_level_id IS DISTINCT FROM NEW.academic_level_id
    OR OLD.department_id  IS DISTINCT FROM NEW.department_id
)
EXECUTE FUNCTION public.write_audit_log();


-- ---------------------------------------------------------
-- 7. SIGN-UP CARRIES THE ANSWERS THROUGH
-- The registration form asks for intake batch, academic level
-- and department. Until now handle_new_user() read only the
-- name, country and student number, so those three answers
-- were collected and thrown away.
--
-- Anything missing or not recognised is left NULL rather than
-- failing the sign-up: an account with no batch is a job for
-- the registry, an account that could not be created is a
-- student who cannot get in at all. The admin overview counts
-- exactly these.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_meta       JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
    v_student_id TEXT;
    v_attempt    INTEGER;
    v_batch      UUID;
    v_level      UUID;
    v_department UUID;
BEGIN
    INSERT INTO public.profiles (id, full_name, email, country, role)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(v_meta ->> 'full_name', ''), 'New User'),
        NEW.email,
        NULLIF(v_meta ->> 'country', ''),
        'student'
    );

    -- Only accept a batch, level or department that really
    -- exists and is still offered. A value invented by hand in
    -- the sign-up request is dropped here, not stored.
    SELECT b.id INTO v_batch
    FROM public.intake_batches b
    WHERE b.id = public.safe_uuid(v_meta ->> 'intake_batch_id')
      AND b.is_active;

    SELECT l.id INTO v_level
    FROM public.academic_levels l
    WHERE l.id = public.safe_uuid(v_meta ->> 'academic_level_id')
      AND l.is_active;

    SELECT d.id INTO v_department
    FROM public.departments d
    WHERE d.id = public.safe_uuid(v_meta ->> 'department_id')
      AND d.is_active;

    -- Use the student number from the registration form, or
    -- allocate the next one when the form did not carry it.
    -- Two people registering in the same instant can pick the
    -- same number; the unique constraint catches that, so try
    -- again a few times before giving up.
    v_student_id := NULLIF(TRIM(v_meta ->> 'student_id'), '');

    IF v_student_id IS NOT NULL THEN
        INSERT INTO public.students (
            profile_id, student_id,
            intake_batch_id, academic_level_id, department_id
        )
        VALUES (NEW.id, v_student_id, v_batch, v_level, v_department);
    ELSE
        FOR v_attempt IN 1..5 LOOP
            BEGIN
                INSERT INTO public.students (
                    profile_id, student_id,
                    intake_batch_id, academic_level_id, department_id
                )
                VALUES (
                    NEW.id, public.next_student_number(),
                    v_batch, v_level, v_department
                );
                EXIT;
            EXCEPTION
                WHEN unique_violation THEN
                    IF v_attempt = 5 THEN
                        RAISE EXCEPTION
                            'Could not allocate a student number. Please try again.';
                    END IF;
            END;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$fn$;


-- ---------------------------------------------------------
-- 8. IS THIS STUDENT NUMBER ALREADY TAKEN?
-- The registration form asks for the number on the student
-- card, so it has to be able to say "that one is already in
-- use" before the account is created. It answers yes or no and
-- nothing else: a visitor cannot read the students table, and
-- must not be able to walk it one number at a time either.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_number_taken(p_student_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $fn$
DECLARE
    v_clean TEXT := TRIM(COALESCE(p_student_id, ''));
BEGIN
    IF v_clean !~ '^[0-9]{7}$' THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.students s WHERE s.student_id = v_clean
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.student_number_taken(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_number_taken(TEXT) TO anon, authenticated;


-- =========================================================
-- AFTER RUNNING THIS
-- =========================================================
-- Check the departments are there and that a student can see
-- their own record with one:
--
--   SELECT code, name FROM public.departments ORDER BY code;
--
--   SELECT s.student_id, p.full_name, b.name AS intake,
--          l.name AS level, d.name AS department
--   FROM public.students s
--   JOIN public.profiles p ON p.id = s.profile_id
--   LEFT JOIN public.intake_batches b  ON b.id = s.intake_batch_id
--   LEFT JOIN public.academic_levels l ON l.id = s.academic_level_id
--   LEFT JOIN public.departments d     ON d.id = s.department_id
--   ORDER BY s.student_id;
-- =========================================================
