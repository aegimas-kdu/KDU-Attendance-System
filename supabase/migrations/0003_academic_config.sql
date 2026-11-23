-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0003
-- ACADEMIC CONFIGURATION
-- =========================================================
-- Intake batch, academic level and academic term are three
-- different ideas and are managed independently:
--   intake batch   Spring 2025   when the student joined KDU
--   academic level Sophomore     where the student is now
--   academic term  Fall 2026     when classes take place
--
-- No DELETE policy is created anywhere in this file. Historical
-- student records reference these rows, so configuration is
-- retired with is_active = FALSE, never removed.
-- =========================================================


-- ---------------------------------------------------------
-- 1. INTAKE BATCHES
-- ---------------------------------------------------------
CREATE TABLE public.intake_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    semester TEXT NOT NULL
        CHECK (semester IN ('Spring', 'Fall')),
    start_year INTEGER NOT NULL
        CHECK (start_year BETWEEN 2000 AND 2100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (semester, start_year)
);


-- ---------------------------------------------------------
-- 2. ACADEMIC LEVELS
-- ---------------------------------------------------------
CREATE TABLE public.academic_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sequence_number INTEGER NOT NULL UNIQUE
        CHECK (sequence_number > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------
-- 3. ACADEMIC TERMS
-- ---------------------------------------------------------
CREATE TABLE public.academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'completed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

-- Only one term may be active at a time.
CREATE UNIQUE INDEX one_active_academic_term
ON public.academic_terms ((status))
WHERE status = 'active';


-- ---------------------------------------------------------
-- 4. CONNECT STUDENTS TO ACADEMIC CONFIGURATION
-- ---------------------------------------------------------
ALTER TABLE public.students
ADD COLUMN intake_batch_id UUID
    REFERENCES public.intake_batches(id) ON DELETE RESTRICT,
ADD COLUMN academic_level_id UUID
    REFERENCES public.academic_levels(id) ON DELETE RESTRICT;

CREATE INDEX idx_students_batch ON public.students(intake_batch_id);
CREATE INDEX idx_students_level ON public.students(academic_level_id);


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
ALTER TABLE public.intake_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms  ENABLE ROW LEVEL SECURITY;

-- Visitors need active batches and levels to fill in the
-- registration form before they have an account.
CREATE POLICY "Read active intake batches"
ON public.intake_batches
FOR SELECT
TO anon, authenticated
USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Read active academic levels"
ON public.academic_levels
FOR SELECT
TO anon, authenticated
USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Read academic terms"
ON public.academic_terms
FOR SELECT
TO authenticated
USING (status <> 'archived' OR public.is_admin());


-- Administrators maintain configuration. No DELETE policies.
CREATE POLICY "Admins insert intake batches"
ON public.intake_batches
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update intake batches"
ON public.intake_batches
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins insert academic levels"
ON public.academic_levels
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update academic levels"
ON public.academic_levels
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins insert academic terms"
ON public.academic_terms
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins update academic terms"
ON public.academic_terms
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
