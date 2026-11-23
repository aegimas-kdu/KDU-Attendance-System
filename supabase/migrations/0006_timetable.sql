-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0006
-- TIMETABLE AND CLASS SESSIONS
-- =========================================================
-- A timetable slot is a recurring arrangement: Monday 09:00.
-- A class session is one real meeting: Monday 23 November 2026.
-- Attendance belongs to the session, never to the slot.
--
-- weekday follows ISO numbering, 1 = Monday to 7 = Sunday,
-- which matches EXTRACT(ISODOW FROM date).
--
-- The professor is stored on the slot rather than the offering
-- so that two professors can share one course.
-- =========================================================


-- ---------------------------------------------------------
-- 1. TIMETABLE SLOTS
-- ---------------------------------------------------------
CREATE TABLE public.timetable_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    offering_id UUID NOT NULL
        REFERENCES public.course_offerings(id) ON DELETE RESTRICT,

    professor_id UUID NOT NULL
        REFERENCES public.professors(id) ON DELETE RESTRICT,

    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),

    start_time TIME NOT NULL,
    end_time   TIME NOT NULL,

    room TEXT,

    lecture_type TEXT NOT NULL
        CHECK (lecture_type IN ('Lecture', 'Tutorial', 'Seminar', 'Lab')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (end_time > start_time)
);

CREATE INDEX idx_timetable_offering  ON public.timetable_slots(offering_id);
CREATE INDEX idx_timetable_professor ON public.timetable_slots(professor_id);


-- ---------------------------------------------------------
-- 2. CLASS SESSIONS
-- ---------------------------------------------------------
CREATE TABLE public.class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    timetable_slot_id UUID NOT NULL
        REFERENCES public.timetable_slots(id) ON DELETE RESTRICT,

    session_date DATE NOT NULL,

    started_at TIMESTAMPTZ,
    closed_at  TIMESTAMPTZ,

    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'open', 'closed', 'cancelled')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (timetable_slot_id, session_date),
    CHECK (closed_at IS NULL OR started_at IS NOT NULL)
);

CREATE INDEX idx_sessions_date ON public.class_sessions(session_date);
CREATE INDEX idx_sessions_slot ON public.class_sessions(timetable_slot_id);


-- =========================================================
-- TEACHING HELPERS
-- =========================================================

-- Does the signed-in user teach this course offering?
CREATE OR REPLACE FUNCTION public.teaches_offering(p_offering_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.timetable_slots ts
        JOIN public.professors p ON p.id = ts.professor_id
        WHERE ts.offering_id = p_offering_id
          AND p.profile_id = (SELECT auth.uid())
    );
$fn$;


-- Does the signed-in user teach this particular class session?
CREATE OR REPLACE FUNCTION public.teaches_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.class_sessions cs
        JOIN public.timetable_slots ts ON ts.id = cs.timetable_slot_id
        JOIN public.professors p       ON p.id  = ts.professor_id
        WHERE cs.id = p_session_id
          AND p.profile_id = (SELECT auth.uid())
    );
$fn$;


-- Is the signed-in student enrolled in the class this session
-- belongs to?
CREATE OR REPLACE FUNCTION public.attends_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.class_sessions cs
        JOIN public.timetable_slots ts ON ts.id = cs.timetable_slot_id
        JOIN public.enrollments e      ON e.offering_id = ts.offering_id
        JOIN public.students s         ON s.id = e.student_id
        WHERE cs.id = p_session_id
          AND s.profile_id = (SELECT auth.uid())
          AND e.status = 'enrolled'
    );
$fn$;

GRANT EXECUTE ON FUNCTION public.teaches_offering(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teaches_session(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.attends_session(UUID)  TO authenticated;


-- =========================================================
-- GENERATE THE TERM CALENDAR
-- =========================================================
-- Creates one class session for every date in the term that
-- matches a slot's weekday. Safe to run again: existing
-- sessions are left alone. Returns how many were created.
-- =========================================================

CREATE OR REPLACE FUNCTION public.generate_class_sessions(p_offering_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_start DATE;
    v_end   DATE;
    v_count INTEGER;
BEGIN
    IF NOT (public.is_admin() OR public.teaches_offering(p_offering_id)) THEN
        RAISE EXCEPTION
            'You are not authorised to generate sessions for this offering.';
    END IF;

    SELECT at.start_date, at.end_date
    INTO v_start, v_end
    FROM public.course_offerings co
    JOIN public.academic_terms at ON at.id = co.academic_term_id
    WHERE co.id = p_offering_id;

    IF v_start IS NULL THEN
        RAISE EXCEPTION 'Course offering not found.';
    END IF;

    WITH inserted AS (
        INSERT INTO public.class_sessions (timetable_slot_id, session_date)
        SELECT ts.id, d::DATE
        FROM public.timetable_slots ts
        CROSS JOIN generate_series(v_start, v_end, INTERVAL '1 day') AS d
        WHERE ts.offering_id = p_offering_id
          AND EXTRACT(ISODOW FROM d) = ts.weekday
        ON CONFLICT (timetable_slot_id, session_date) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM inserted;

    RETURN v_count;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.generate_class_sessions(UUID) TO authenticated;


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View authorized timetable slots"
ON public.timetable_slots
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR professor_id = public.current_professor_id()
    OR public.is_enrolled_in_offering(offering_id)
);

CREATE POLICY "View authorized class sessions"
ON public.class_sessions
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR public.teaches_session(id)
    OR public.attends_session(id)
);

CREATE POLICY "Authorized users insert timetable slots"
ON public.timetable_slots
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
    OR professor_id = public.current_professor_id()
);

CREATE POLICY "Authorized users update timetable slots"
ON public.timetable_slots
FOR UPDATE
TO authenticated
USING (
    public.is_admin()
    OR professor_id = public.current_professor_id()
)
WITH CHECK (
    public.is_admin()
    OR professor_id = public.current_professor_id()
);

CREATE POLICY "Authorized users insert class sessions"
ON public.class_sessions
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
    OR EXISTS (
        SELECT 1
        FROM public.timetable_slots ts
        WHERE ts.id = class_sessions.timetable_slot_id
          AND ts.professor_id = public.current_professor_id()
    )
);

CREATE POLICY "Authorized users update class sessions"
ON public.class_sessions
FOR UPDATE
TO authenticated
USING (public.is_admin() OR public.teaches_session(id))
WITH CHECK (public.is_admin() OR public.teaches_session(id));
