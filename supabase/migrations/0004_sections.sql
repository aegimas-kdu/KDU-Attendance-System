-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0004
-- CLASS SECTIONS AND STUDENT GROUPING
-- =========================================================
-- One class section can contain students from several intake
-- batches. The Sophomore Section for Fall 2026 holds the
-- Fall 2025 intake (29 students) and the Spring 2025 intake
-- (24 students): 53 students in one section.
--
-- section_batches says which batches the section is built from.
-- student_section_assignments records the individual students
-- actually placed in it, because belonging to an eligible batch
-- is not the same as being assigned.
-- =========================================================


-- ---------------------------------------------------------
-- 1. CLASS SECTIONS
-- ---------------------------------------------------------
CREATE TABLE public.class_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_level_id UUID NOT NULL
        REFERENCES public.academic_levels(id) ON DELETE RESTRICT,
    academic_term_id UUID NOT NULL
        REFERENCES public.academic_terms(id) ON DELETE RESTRICT,
    section_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (academic_level_id, academic_term_id, section_name)
);


-- ---------------------------------------------------------
-- 2. SECTION BATCHES
-- ---------------------------------------------------------
CREATE TABLE public.section_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL
        REFERENCES public.class_sections(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL
        REFERENCES public.intake_batches(id) ON DELETE RESTRICT,
    UNIQUE (section_id, batch_id)
);


-- ---------------------------------------------------------
-- 3. STUDENT SECTION ASSIGNMENTS
-- ---------------------------------------------------------
CREATE TABLE public.student_section_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL
        REFERENCES public.students(id) ON DELETE RESTRICT,
    section_id UUID NOT NULL
        REFERENCES public.class_sections(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    UNIQUE (student_id, section_id)
);

-- A student has at most one active section at any moment.
-- Previous assignments stay as history with status 'inactive'.
CREATE UNIQUE INDEX one_active_section_per_student
ON public.student_section_assignments(student_id)
WHERE status = 'active';

CREATE INDEX idx_section_assignments_section
ON public.student_section_assignments(section_id);


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
ALTER TABLE public.class_sections              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_batches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_section_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sections"
ON public.class_sections
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view section batches"
ON public.section_batches
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "View section assignments"
ON public.student_section_assignments
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR student_id = public.current_student_id()
);

CREATE POLICY "Admins insert sections"
ON public.class_sections
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update sections"
ON public.class_sections
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins insert section batches"
ON public.section_batches
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update section batches"
ON public.section_batches
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins insert student assignments"
ON public.student_section_assignments
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update student assignments"
ON public.student_section_assignments
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
