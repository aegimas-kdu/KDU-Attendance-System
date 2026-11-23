-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0002
-- USER IDENTITY, ROLES AND AUTHORISATION HELPERS
-- =========================================================
-- Replaces Phase 1 of the original design and closes
-- gaps 1, 2 and 6 recorded in the revision notes:
--   * administrators had no way to create or read user records
--   * professors could not read the names of their own students
--   * nothing prevented a user from editing their own role
-- =========================================================


-- ---------------------------------------------------------
-- 1. PROFILES
-- One profile for each Supabase Auth account.
-- ---------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    country TEXT,

    role TEXT NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'professor', 'admin')),

    -- NULL for students and professors.
    admin_level TEXT
        CHECK (admin_level IS NULL
               OR admin_level IN ('admin', 'super_admin')),

    photo_path TEXT,

    account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'suspended', 'inactive')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- An admin always has an admin level; nobody else ever does.
    CONSTRAINT profiles_admin_level_consistency CHECK (
        (role = 'admin' AND admin_level IS NOT NULL)
        OR
        (role <> 'admin' AND admin_level IS NULL)
    )
);

CREATE INDEX idx_profiles_role ON public.profiles(role);


-- ---------------------------------------------------------
-- 2. STUDENTS
-- Academic configuration columns are added in 0003, once
-- intake_batches and academic_levels exist.
-- ---------------------------------------------------------
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL UNIQUE
);


-- ---------------------------------------------------------
-- 3. PROFESSORS
-- ---------------------------------------------------------
CREATE TABLE public.professors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL UNIQUE,
    department TEXT
);


-- =========================================================
-- AUTHORISATION HELPER FUNCTIONS
-- =========================================================
-- Every one of these is SECURITY DEFINER so that a policy on
-- profiles may consult profiles without recursing into its own
-- policy. They are STABLE so PostgreSQL can evaluate them once
-- per statement instead of once per row.
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = (SELECT auth.uid())
          AND role = 'admin'
          AND account_status = 'active'
    );
$fn$;


CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = (SELECT auth.uid())
          AND role = 'admin'
          AND admin_level = 'super_admin'
          AND account_status = 'active'
    );
$fn$;


-- The students.id of the signed-in user, or NULL.
CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT s.id
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.profile_id = (SELECT auth.uid())
      AND p.account_status = 'active';
$fn$;


-- The professors.id of the signed-in user, or NULL.
CREATE OR REPLACE FUNCTION public.current_professor_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT pr.id
    FROM public.professors pr
    JOIN public.profiles p ON p.id = pr.profile_id
    WHERE pr.profile_id = (SELECT auth.uid())
      AND p.account_status = 'active';
$fn$;


GRANT EXECUTE ON FUNCTION public.is_admin()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_student_id()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_professor_id() TO authenticated;


-- =========================================================
-- AUTOMATIC PROFILE CREATION ON SIGN-UP
-- =========================================================
-- Self-registration always produces a student. Professor and
-- administrator accounts are provisioned afterwards by an
-- administrator (see 0009), never by the person signing up.
-- =========================================================

-- ---------------------------------------------------------
-- next_student_number()
-- One numbering scheme for the whole university: seven digits,
-- the last two of the year the student joined followed by a
-- running number. 2025 gave 2500001 upwards, 2026 gives
-- 2600001 upwards, and the prefix moves on by itself each year.
-- The registry normally issues the number and the registration
-- form carries it; this is the fallback when it does not.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_student_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_prefix TEXT := TO_CHAR(NOW(), 'YY');
    v_next   INTEGER;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(s.student_id FROM 3 FOR 5)::INTEGER), 0) + 1
    INTO v_next
    FROM public.students s
    WHERE s.student_id ~ ('^' || v_prefix || '[0-9]{5}$');

    RETURN v_prefix || LPAD(v_next::TEXT, 5, '0');
END;
$fn$;


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
BEGIN
    INSERT INTO public.profiles (id, full_name, email, country, role)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(v_meta ->> 'full_name', ''), 'New User'),
        NEW.email,
        NULLIF(v_meta ->> 'country', ''),
        'student'
    );

    -- Use the student number from the registration form, or
    -- allocate the next one when the form did not carry it.
    -- Two people registering in the same instant can pick the
    -- same number; the unique constraint catches that, so try
    -- again a few times before giving up.
    v_student_id := NULLIF(TRIM(v_meta ->> 'student_id'), '');

    IF v_student_id IS NOT NULL THEN
        INSERT INTO public.students (profile_id, student_id)
        VALUES (NEW.id, v_student_id);
    ELSE
        FOR v_attempt IN 1..5 LOOP
            BEGIN
                INSERT INTO public.students (profile_id, student_id)
                VALUES (NEW.id, public.next_student_number());
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- =========================================================
-- PRIVILEGE GUARD
-- =========================================================
-- A user may edit their own name, country or photo. Nobody may
-- promote themselves. Role and admin_level may only change
-- through a super admin; account_status only through an admin.
-- Direct database access (SQL editor, service role) is exempt
-- so that the first super admin can be provisioned.
-- =========================================================

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
    -- No authenticated user: this is a trusted server-side call,
    -- such as seeding the first super admin from the SQL editor.
    IF (SELECT auth.uid()) IS NULL THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    -- The provisioning functions in 0009 raise this flag after
    -- doing their own authorisation check. The flag lives for
    -- one transaction and no client can set it, because
    -- set_config() is not exposed through the API.
    IF COALESCE(current_setting('app.kdu_privileged', TRUE), '') = 'on' THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.email IS DISTINCT FROM OLD.email THEN
        RAISE EXCEPTION
            'Identity fields cannot be changed here. Use Supabase Auth.';
    END IF;

    IF (NEW.role IS DISTINCT FROM OLD.role
        OR NEW.admin_level IS DISTINCT FROM OLD.admin_level)
       AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION
            'Only a super admin can change a role or administrator level.';
    END IF;

    IF NEW.account_status IS DISTINCT FROM OLD.account_status
       AND NOT public.is_admin() THEN
        RAISE EXCEPTION
            'Only an administrator can change an account status.';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER guard_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_privileges();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;

-- Everyone reads their own profile. The wider rules that let a
-- professor see their students, and a student see their
-- professors, are added in 0010 once enrolments exist.
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY "Admins view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- A user may edit their own profile. The guard trigger above
-- decides which columns they are actually allowed to touch.
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Admins update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- Students
CREATE POLICY "Students view own record"
ON public.students
FOR SELECT
TO authenticated
USING (profile_id = (SELECT auth.uid()));

CREATE POLICY "Admins view all students"
ON public.students
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins insert students"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update students"
ON public.students
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- Professors
CREATE POLICY "Professors view own record"
ON public.professors
FOR SELECT
TO authenticated
USING (profile_id = (SELECT auth.uid()));

CREATE POLICY "Admins view all professors"
ON public.professors
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins insert professors"
ON public.professors
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update professors"
ON public.professors
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
