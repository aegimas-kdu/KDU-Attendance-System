-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0007
-- ATTENDANCE MANAGEMENT
-- =========================================================
-- How attendance works
--   1. The professor opens the session and generates a four
--      digit initial code. The code is shown once and stored
--      only as a bcrypt hash.
--   2. Students type the code into the portal. Correct code,
--      inside the expiry window, enrolled student: present.
--   3. A late code may be issued for students who missed the
--      first window. It records them as late.
--   4. Closing the session marks every enrolled student with no
--      record as absent.
--   5. The professor may correct any record afterwards. Every
--      correction is written to the audit log in 0009.
--
-- Closes gap 4. The original design stored a hash but had no
-- way to create or check a code, so verification would have had
-- to happen in the browser. Generation and verification are now
-- two SECURITY DEFINER functions that run inside the database:
-- the plain code never reaches a table, students have no read
-- access to attendance_codes at all, codes expire, and repeated
-- wrong guesses are rate limited.
-- =========================================================


-- ---------------------------------------------------------
-- 1. ATTENDANCE CODES
-- ---------------------------------------------------------
CREATE TABLE public.attendance_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID NOT NULL
        REFERENCES public.class_sessions(id) ON DELETE RESTRICT,

    created_by UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    code_hash TEXT NOT NULL,

    code_type TEXT NOT NULL CHECK (code_type IN ('initial', 'late')),

    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_codes_session
ON public.attendance_codes(session_id);


-- ---------------------------------------------------------
-- 2. ATTENDANCE RECORDS
-- ---------------------------------------------------------
CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID NOT NULL
        REFERENCES public.class_sessions(id) ON DELETE RESTRICT,

    student_id UUID NOT NULL
        REFERENCES public.students(id) ON DELETE RESTRICT,

    attendance_code_id UUID
        REFERENCES public.attendance_codes(id) ON DELETE RESTRICT,

    status TEXT NOT NULL
        CHECK (status IN ('present', 'late', 'absent', 'excused')),

    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    marked_by UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (session_id, student_id)
);

CREATE INDEX idx_attendance_session ON public.attendance_records(session_id);
CREATE INDEX idx_attendance_student ON public.attendance_records(student_id);


-- ---------------------------------------------------------
-- 3. CODE ATTEMPTS
-- Used for rate limiting and as evidence in a dispute.
-- ---------------------------------------------------------
CREATE TABLE public.attendance_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL
        REFERENCES public.class_sessions(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL
        REFERENCES public.students(id) ON DELETE RESTRICT,
    succeeded BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attempts_lookup
ON public.attendance_attempts(session_id, student_id, attempted_at DESC);


-- =========================================================
-- GENERATE AN ATTENDANCE CODE
-- =========================================================
-- Returns the four digit code exactly once, to the professor
-- who asked for it. Only the hash is stored. Generating a new
-- code of the same type revokes the previous one.
-- =========================================================

CREATE OR REPLACE FUNCTION public.generate_attendance_code(
    p_session_id    UUID,
    p_code_type     TEXT    DEFAULT 'initial',
    p_valid_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_random  BYTEA;
    v_code    TEXT;
    v_expires TIMESTAMPTZ;
    v_seconds INTEGER;
BEGIN
    IF NOT (public.is_admin() OR public.teaches_session(p_session_id)) THEN
        RAISE EXCEPTION
            'You are not authorised to open attendance for this session.';
    END IF;

    IF p_code_type NOT IN ('initial', 'late') THEN
        RAISE EXCEPTION 'A code is either initial or late.';
    END IF;

    -- Between 30 seconds and 30 minutes.
    v_seconds := GREATEST(30, LEAST(COALESCE(p_valid_seconds, 300), 1800));

    -- Opening the session is part of generating the first code.
    UPDATE public.class_sessions
    SET status = 'open',
        started_at = COALESCE(started_at, NOW())
    WHERE id = p_session_id
      AND status IN ('scheduled', 'open');

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'This session is closed or cancelled and cannot take attendance.';
    END IF;

    UPDATE public.attendance_codes
    SET revoked_at = NOW()
    WHERE session_id = p_session_id
      AND code_type = p_code_type
      AND revoked_at IS NULL;

    v_random := extensions.gen_random_bytes(2);
    v_code := LPAD(
        (((get_byte(v_random, 0) * 256) + get_byte(v_random, 1)) % 10000)::TEXT,
        4, '0'
    );
    v_expires := NOW() + MAKE_INTERVAL(secs => v_seconds);

    INSERT INTO public.attendance_codes (
        session_id, created_by, code_hash, code_type, expires_at
    )
    VALUES (
        p_session_id,
        (SELECT auth.uid()),
        extensions.crypt(v_code, extensions.gen_salt('bf')),
        p_code_type,
        v_expires
    );

    RETURN QUERY SELECT v_code, v_expires;
END;
$fn$;

GRANT EXECUTE ON FUNCTION
    public.generate_attendance_code(UUID, TEXT, INTEGER) TO authenticated;


-- =========================================================
-- SUBMIT AN ATTENDANCE CODE
-- =========================================================
-- Returns the resulting status: present, late, or the status
-- the student already had. A student can only ever mark
-- themselves, and only in a class they are enrolled in.
-- =========================================================

CREATE OR REPLACE FUNCTION public.submit_attendance_code(
    p_session_id UUID,
    p_code       TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_student  UUID;
    v_code     public.attendance_codes%ROWTYPE;
    v_failures INTEGER;
    v_status   TEXT;
    v_existing TEXT;
BEGIN
    v_student := public.current_student_id();

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'Only an active student can submit an attendance code.';
    END IF;

    IF NOT public.attends_session(p_session_id) THEN
        RAISE EXCEPTION 'You are not enrolled in this class.';
    END IF;

    -- Five wrong guesses in ten minutes stops the attempt.
    SELECT COUNT(*)
    INTO v_failures
    FROM public.attendance_attempts a
    WHERE a.session_id = p_session_id
      AND a.student_id = v_student
      AND a.succeeded = FALSE
      AND a.attempted_at > NOW() - INTERVAL '10 minutes';

    IF v_failures >= 5 THEN
        RAISE EXCEPTION
            'Too many incorrect attempts. Please ask your professor to mark you.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.class_sessions
        WHERE id = p_session_id AND status = 'open'
    ) THEN
        RAISE EXCEPTION 'This session is not open for attendance.';
    END IF;

    -- Already marked? Say so without spending an attempt.
    SELECT ar.status INTO v_existing
    FROM public.attendance_records ar
    WHERE ar.session_id = p_session_id
      AND ar.student_id = v_student;

    IF v_existing IN ('present', 'late', 'excused') THEN
        RETURN v_existing;
    END IF;

    SELECT * INTO v_code
    FROM public.attendance_codes ac
    WHERE ac.session_id = p_session_id
      AND ac.revoked_at IS NULL
      AND ac.expires_at > NOW()
      AND ac.code_hash = extensions.crypt(p_code, ac.code_hash)
    ORDER BY ac.created_at DESC
    LIMIT 1;

    IF v_code.id IS NULL THEN
        INSERT INTO public.attendance_attempts (session_id, student_id, succeeded)
        VALUES (p_session_id, v_student, FALSE);
        RAISE EXCEPTION 'Invalid or expired attendance code.';
    END IF;

    v_status := CASE WHEN v_code.code_type = 'late' THEN 'late' ELSE 'present' END;

    INSERT INTO public.attendance_records (
        session_id, student_id, attendance_code_id,
        status, marked_at, marked_by
    )
    VALUES (
        p_session_id, v_student, v_code.id,
        v_status, NOW(), (SELECT auth.uid())
    )
    ON CONFLICT (session_id, student_id) DO UPDATE
    SET status = EXCLUDED.status,
        attendance_code_id = EXCLUDED.attendance_code_id,
        marked_at = NOW(),
        marked_by = EXCLUDED.marked_by
    WHERE attendance_records.status = 'absent';

    INSERT INTO public.attendance_attempts (session_id, student_id, succeeded)
    VALUES (p_session_id, v_student, TRUE);

    RETURN v_status;
END;
$fn$;

GRANT EXECUTE ON FUNCTION
    public.submit_attendance_code(UUID, TEXT) TO authenticated;


-- =========================================================
-- CLOSE A SESSION
-- =========================================================
-- Everyone enrolled who has no record yet becomes absent.
-- An excused record created by an approved leave request is
-- never overwritten.
-- =========================================================

CREATE OR REPLACE FUNCTION public.close_class_session(p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_offering_id UUID;
    v_marked      INTEGER;
BEGIN
    IF NOT (public.is_admin() OR public.teaches_session(p_session_id)) THEN
        RAISE EXCEPTION 'You are not authorised to close this session.';
    END IF;

    SELECT ts.offering_id
    INTO v_offering_id
    FROM public.class_sessions cs
    JOIN public.timetable_slots ts ON ts.id = cs.timetable_slot_id
    WHERE cs.id = p_session_id;

    UPDATE public.class_sessions
    SET status = 'closed',
        started_at = COALESCE(started_at, NOW()),
        closed_at = NOW()
    WHERE id = p_session_id
      AND status <> 'cancelled';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found or cancelled.';
    END IF;

    -- Any code still live becomes useless.
    UPDATE public.attendance_codes
    SET revoked_at = NOW()
    WHERE session_id = p_session_id
      AND revoked_at IS NULL;

    WITH marked AS (
        INSERT INTO public.attendance_records (
            session_id, student_id, status, marked_at, marked_by
        )
        SELECT p_session_id, e.student_id, 'absent', NOW(), (SELECT auth.uid())
        FROM public.enrollments e
        WHERE e.offering_id = v_offering_id
          AND e.status = 'enrolled'
        ON CONFLICT (session_id, student_id) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_marked FROM marked;

    RETURN v_marked;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.close_class_session(UUID) TO authenticated;


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
ALTER TABLE public.attendance_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_attempts ENABLE ROW LEVEL SECURITY;

-- Students read their own records. The professor of the session
-- and administrators read the whole class.
CREATE POLICY "View attendance records"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR student_id = public.current_student_id()
    OR public.teaches_session(session_id)
);

-- Students never write this table directly. Marking happens
-- through submit_attendance_code(); corrections are made by the
-- professor of the session or an administrator.
CREATE POLICY "Authorized users insert attendance records"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
    OR public.teaches_session(session_id)
);

CREATE POLICY "Authorized users correct attendance records"
ON public.attendance_records
FOR UPDATE
TO authenticated
USING (
    public.is_admin()
    OR public.teaches_session(session_id)
)
WITH CHECK (
    public.is_admin()
    OR public.teaches_session(session_id)
);

-- Codes are invisible to students, in any form.
CREATE POLICY "View attendance codes"
ON public.attendance_codes
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR public.teaches_session(session_id)
);

CREATE POLICY "Revoke attendance codes"
ON public.attendance_codes
FOR UPDATE
TO authenticated
USING (
    public.is_admin()
    OR public.teaches_session(session_id)
)
WITH CHECK (
    public.is_admin()
    OR public.teaches_session(session_id)
);

-- Attempts are written by submit_attendance_code() only.
CREATE POLICY "View attendance attempts"
ON public.attendance_attempts
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR public.teaches_session(session_id)
);


-- =========================================================
-- ATTENDANCE SUMMARY AND THE THREE LATE RULE
-- =========================================================
-- Three unexcused late records count as one absence. The rule
-- is applied in this view, so the original records are never
-- rewritten and a dispute can always be traced.
--
-- security_invoker means the view obeys the reader's own row
-- level security: a student sees only their own line.
-- =========================================================

CREATE OR REPLACE VIEW public.student_attendance_summary
WITH (security_invoker = true)
AS
WITH held AS (
    SELECT ts.offering_id, cs.id AS session_id
    FROM public.timetable_slots ts
    JOIN public.class_sessions cs ON cs.timetable_slot_id = ts.id
    WHERE cs.status = 'closed'
)
SELECT
    e.student_id,
    e.offering_id,

    COUNT(h.session_id) AS sessions_held,

    COUNT(ar.id) FILTER (WHERE ar.status = 'present') AS present_count,
    COUNT(ar.id) FILTER (WHERE ar.status = 'late')    AS late_count,
    COUNT(ar.id) FILTER (WHERE ar.status = 'absent')  AS absent_count,
    COUNT(ar.id) FILTER (WHERE ar.status = 'excused') AS excused_count,

    FLOOR(COUNT(ar.id) FILTER (WHERE ar.status = 'late') / 3.0)::INTEGER
        AS penalty_absences,

    (COUNT(ar.id) FILTER (WHERE ar.status = 'absent')
     + FLOOR(COUNT(ar.id) FILTER (WHERE ar.status = 'late') / 3.0))::INTEGER
        AS effective_absences,

    ROUND(
        100.0 * (
            COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))
        ) / NULLIF(COUNT(h.session_id), 0)
    , 1) AS attendance_rate

FROM public.enrollments e
JOIN held h ON h.offering_id = e.offering_id
LEFT JOIN public.attendance_records ar
       ON ar.session_id = h.session_id
      AND ar.student_id = e.student_id
WHERE e.status IN ('enrolled', 'completed')
GROUP BY e.student_id, e.offering_id;
