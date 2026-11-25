-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0011
-- TABLE PRIVILEGES FOR THE API ROLES
-- =========================================================
-- Row Level Security decides WHICH ROWS a request may touch.
-- It does not grant the right to touch the table at all — that
-- is an ordinary SQL privilege, and without it PostgREST
-- refuses before any policy is consulted:
--
--   42501: permission denied for table intake_batches
--
-- So the two layers work together, and both are needed:
--
--   GRANT   decides whether the role may use the table
--   POLICY  decides which rows it sees inside it
--
-- Granting broadly here is safe precisely because every table
-- has RLS enabled: a role with SELECT on a table it has no
-- policy for gets an empty result, not an error and not data.
--
-- This file also adds three DELETE policies the application
-- turned out to need.
-- =========================================================


-- ---------------------------------------------------------
-- 1. THE SCHEMA ITSELF
-- ---------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;


-- ---------------------------------------------------------
-- 2. ANONYMOUS VISITORS
-- Only what someone needs before they have an account: the
-- batch and level dropdowns on the registration form.
-- Everything else stays unreachable at the privilege level,
-- not merely at the policy level.
-- ---------------------------------------------------------
GRANT SELECT ON public.intake_batches  TO anon;
GRANT SELECT ON public.academic_levels TO anon;


-- ---------------------------------------------------------
-- 3. SIGNED-IN USERS — READING
-- Every table and both views. The policies written in 0002 to
-- 0010 are what actually narrow this down per role.
-- ---------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;


-- ---------------------------------------------------------
-- 4. SIGNED-IN USERS — WRITING
-- Listed one by one rather than granted wholesale, so the set
-- of writable tables is visible in one place.
--
-- Deliberately absent: audit_logs, login_lookups and
-- attendance_attempts. Those are written by SECURITY DEFINER
-- triggers and functions, never by a user, and they have no
-- write policy either. Read-only is the whole point of an
-- audit trail.
-- ---------------------------------------------------------
GRANT INSERT, UPDATE ON
    public.profiles,
    public.students,
    public.professors,
    public.intake_batches,
    public.academic_levels,
    public.academic_terms,
    public.class_sections,
    public.section_batches,
    public.student_section_assignments,
    public.courses,
    public.course_offerings,
    public.offering_batches,
    public.enrollments,
    public.timetable_slots,
    public.class_sessions,
    public.attendance_codes,
    public.attendance_records,
    public.materials,
    public.leave_requests
TO authenticated;

-- The only three things anyone may actually remove. Academic
-- configuration and attendance history are never deleted.
GRANT DELETE ON
    public.materials,
    public.offering_batches,
    public.timetable_slots
TO authenticated;


-- ---------------------------------------------------------
-- 5. THE DELETE POLICIES THOSE GRANTS NEED
-- A grant without a policy still returns nothing, so both
-- halves have to exist.
-- ---------------------------------------------------------

-- Changing which intakes may take a course means removing rows.
CREATE POLICY "Admins remove offering batches"
ON public.offering_batches
FOR DELETE
TO authenticated
USING (public.is_admin());

-- A timetable slot can be removed until classes exist for it;
-- the foreign key from class_sessions stops it after that.
CREATE POLICY "Admins remove timetable slots"
ON public.timetable_slots
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Correcting a section's intake batches.
CREATE POLICY "Admins remove section batches"
ON public.section_batches
FOR DELETE
TO authenticated
USING (public.is_admin());


-- ---------------------------------------------------------
-- 6. ANYTHING ADDED LATER
-- So a new table is readable by signed-in users without this
-- being rediscovered the hard way.
-- ---------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO authenticated;


-- ---------------------------------------------------------
-- 7. CHECK
-- Expect intake_batches and academic_levels for anon, and
-- every table for authenticated.
-- ---------------------------------------------------------
SELECT grantee, table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY grantee, table_name
ORDER BY grantee, table_name;
