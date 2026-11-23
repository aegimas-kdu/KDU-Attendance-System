-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0009
-- AUDIT LOGS AND ADMINISTRATOR MANAGEMENT
-- =========================================================
-- A university system must record not only what is stored, but
-- who changed it and when:
--   a professor changes an attendance record
--   a professor approves a leave request
--   an administrator edits a course offering
--   a super admin grants administrator rights
--
-- Closes gap 6. The original design had no way to create a
-- professor or an administrator, because handle_new_user()
-- makes every new account a student. register_professor() and
-- grant_admin_access() are the provisioning path.
-- =========================================================


-- ---------------------------------------------------------
-- 1. AUDIT LOGS
-- ---------------------------------------------------------
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_id UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL,

    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),

    entity_type TEXT NOT NULL,
    entity_id UUID,

    old_values JSONB,
    new_values JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor   ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_entity  ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);


-- ---------------------------------------------------------
-- 2. GENERIC AUDIT FUNCTION
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_old JSONB;
    v_new JSONB;
    v_entity_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        v_new := NULL;
        v_entity_id := (v_old ->> 'id')::UUID;
    ELSIF TG_OP = 'INSERT' THEN
        v_old := NULL;
        v_new := to_jsonb(NEW);
        v_entity_id := (v_new ->> 'id')::UUID;
    ELSE
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_entity_id := (v_new ->> 'id')::UUID;
    END IF;

    INSERT INTO public.audit_logs (
        actor_id, action, entity_type, entity_id, old_values, new_values
    )
    VALUES (
        (SELECT auth.uid()), TG_OP, TG_TABLE_NAME, v_entity_id, v_old, v_new
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$fn$;


-- ---------------------------------------------------------
-- 3. ATTACH THE TRIGGERS
-- ---------------------------------------------------------

-- Attendance corrections
CREATE TRIGGER audit_attendance_changes
AFTER UPDATE OF status, leave_request_id ON public.attendance_records
FOR EACH ROW
WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.leave_request_id IS DISTINCT FROM NEW.leave_request_id
)
EXECUTE FUNCTION public.write_audit_log();

-- Leave decisions
CREATE TRIGGER audit_leave_request_changes
AFTER UPDATE OF status ON public.leave_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.write_audit_log();

-- Role, privilege and account status changes
CREATE TRIGGER audit_profile_changes
AFTER UPDATE OF role, admin_level, account_status ON public.profiles
FOR EACH ROW
WHEN (
    OLD.role IS DISTINCT FROM NEW.role
    OR OLD.admin_level IS DISTINCT FROM NEW.admin_level
    OR OLD.account_status IS DISTINCT FROM NEW.account_status
)
EXECUTE FUNCTION public.write_audit_log();

-- Course offerings, enrolments and the timetable
CREATE TRIGGER audit_course_offering_changes
AFTER INSERT OR UPDATE OR DELETE ON public.course_offerings
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER audit_enrollment_changes
AFTER INSERT OR UPDATE OR DELETE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER audit_timetable_changes
AFTER INSERT OR UPDATE OR DELETE ON public.timetable_slots
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();


-- ---------------------------------------------------------
-- 4. AUDIT LOG SECURITY
-- ---------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit history"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin());

-- No INSERT, UPDATE or DELETE policy exists, on purpose.
-- Entries are written by triggers running as the definer, and
-- nobody can edit history through the API.


-- =========================================================
-- PROVISIONING PROFESSORS
-- =========================================================
-- The administrator invites the person through Supabase Auth,
-- which creates a student profile, then converts it here.
-- =========================================================

CREATE OR REPLACE FUNCTION public.register_professor(
    p_profile_id  UUID,
    p_employee_id TEXT,
    p_department  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only an administrator can register a professor.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id
        WHERE s.profile_id = p_profile_id
    ) THEN
        RAISE EXCEPTION
            'This account has student enrolments and cannot become a professor.';
    END IF;

    PERFORM set_config('app.kdu_privileged', 'on', TRUE);

    -- Remove the student shell created at sign-up.
    DELETE FROM public.students WHERE profile_id = p_profile_id;

    UPDATE public.profiles
    SET role = 'professor',
        admin_level = NULL,
        updated_at = NOW()
    WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found.';
    END IF;

    INSERT INTO public.professors (profile_id, employee_id, department)
    VALUES (p_profile_id, p_employee_id, p_department)
    ON CONFLICT (profile_id) DO UPDATE
    SET employee_id = EXCLUDED.employee_id,
        department  = EXCLUDED.department;
END;
$fn$;


-- =========================================================
-- GRANT ADMINISTRATOR ACCESS
-- =========================================================
CREATE OR REPLACE FUNCTION public.grant_admin_access(
    p_profile_id  UUID,
    p_admin_level TEXT DEFAULT 'admin'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Only a super admin can grant administrator access.';
    END IF;

    IF p_admin_level NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Invalid administrator level.';
    END IF;

    PERFORM set_config('app.kdu_privileged', 'on', TRUE);

    UPDATE public.profiles
    SET role = 'admin',
        admin_level = p_admin_level,
        account_status = 'active',
        updated_at = NOW()
    WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found.';
    END IF;
END;
$fn$;


-- =========================================================
-- REVOKE ADMINISTRATOR ACCESS
-- =========================================================
-- Keeps the person's student or professor role when they have
-- one. Otherwise the account is deactivated. The last active
-- super admin cannot be removed.
-- =========================================================
CREATE OR REPLACE FUNCTION public.revoke_admin_access(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_admin_level TEXT;
    v_new_role    TEXT;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Only a super admin can revoke administrator access.';
    END IF;

    SELECT admin_level
    INTO v_admin_level
    FROM public.profiles
    WHERE id = p_profile_id AND role = 'admin';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Administrator not found.';
    END IF;

    IF v_admin_level = 'super_admin' THEN
        IF (
            SELECT COUNT(*)
            FROM public.profiles
            WHERE role = 'admin'
              AND admin_level = 'super_admin'
              AND account_status = 'active'
        ) <= 1 THEN
            RAISE EXCEPTION 'The last active super admin cannot be removed.';
        END IF;
    END IF;

    PERFORM set_config('app.kdu_privileged', 'on', TRUE);

    IF EXISTS (SELECT 1 FROM public.students WHERE profile_id = p_profile_id) THEN
        v_new_role := 'student';
    ELSIF EXISTS (SELECT 1 FROM public.professors WHERE profile_id = p_profile_id) THEN
        v_new_role := 'professor';
    ELSE
        v_new_role := NULL;
    END IF;

    IF v_new_role IS NOT NULL THEN
        UPDATE public.profiles
        SET role = v_new_role,
            admin_level = NULL,
            updated_at = NOW()
        WHERE id = p_profile_id;
    ELSE
        UPDATE public.profiles
        SET account_status = 'inactive',
            updated_at = NOW()
        WHERE id = p_profile_id;
    END IF;
END;
$fn$;


GRANT EXECUTE ON FUNCTION public.register_professor(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_access(UUID, TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin_access(UUID)            TO authenticated;
