-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0008
-- LEARNING MATERIALS, LEAVE REQUESTS AND FILE STORAGE
-- =========================================================
-- Files live in Supabase Storage. These tables hold the
-- metadata and the path, never the bytes.
--
-- A leave request is always about one class session, not about
-- a whole course. Three missed System Analysis and Design
-- classes are three separate requests.
--
-- Closes gap 5. The original design created the metadata
-- tables but never the buckets, so any file would have been
-- downloadable by anyone who guessed its path. This file
-- creates two private buckets and the policies that guard
-- them, with a path convention that the policies rely on:
--
--   kdu-course-materials   <offering_id>/<uuid>-<filename>
--   kdu-leave-documents    <profile_id>/<uuid>-<filename>
-- =========================================================


-- ---------------------------------------------------------
-- 1. MATERIALS
-- ---------------------------------------------------------
CREATE TABLE public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    offering_id UUID NOT NULL
        REFERENCES public.course_offerings(id) ON DELETE RESTRICT,

    uploaded_by UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    title TEXT NOT NULL,
    description TEXT,

    file_path TEXT NOT NULL UNIQUE,
    file_size_bytes BIGINT,
    mime_type TEXT,

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_materials_offering ON public.materials(offering_id);


-- ---------------------------------------------------------
-- 2. LEAVE REQUESTS
-- ---------------------------------------------------------
CREATE TABLE public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL
        REFERENCES public.students(id) ON DELETE RESTRICT,

    session_id UUID NOT NULL
        REFERENCES public.class_sessions(id) ON DELETE RESTRICT,

    reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) >= 10),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),

    supporting_file_path TEXT,
    review_note TEXT,

    reviewed_by UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL,

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,

    UNIQUE (student_id, session_id)
);

CREATE INDEX idx_leave_requests_student ON public.leave_requests(student_id);
CREATE INDEX idx_leave_requests_session ON public.leave_requests(session_id);
CREATE INDEX idx_leave_requests_status  ON public.leave_requests(status);


-- An excused attendance record points back at the request
-- that produced it.
ALTER TABLE public.attendance_records
ADD COLUMN leave_request_id UUID
    REFERENCES public.leave_requests(id) ON DELETE RESTRICT;


-- =========================================================
-- A LEAVE REQUEST NEEDS AN ACTIVE ENROLMENT
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_leave_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.class_sessions cs
        JOIN public.timetable_slots ts ON ts.id = cs.timetable_slot_id
        JOIN public.enrollments e      ON e.offering_id = ts.offering_id
        WHERE cs.id = NEW.session_id
          AND e.student_id = NEW.student_id
          AND e.status = 'enrolled'
    ) THEN
        RAISE EXCEPTION
            'You must be actively enrolled in this class to request leave.';
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE TRIGGER validate_student_leave_request
BEFORE INSERT ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.validate_leave_request();


-- =========================================================
-- RECORD WHO DECIDED, AND WHEN
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_leave_review_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('approved', 'rejected') THEN
        NEW.reviewed_by := (SELECT auth.uid());
        NEW.reviewed_at := NOW();
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE TRIGGER set_leave_review_details
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_leave_review_details();


-- =========================================================
-- AN APPROVED REQUEST EXCUSES THE ATTENDANCE RECORD
-- =========================================================
-- Deliberately allowed to overwrite an existing record, so an
-- approval still works after the session has been closed and
-- the student has already been marked absent.
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_approved_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        INSERT INTO public.attendance_records (
            session_id, student_id, leave_request_id,
            status, marked_at, marked_by
        )
        VALUES (
            NEW.session_id, NEW.student_id, NEW.id,
            'excused', NOW(), NEW.reviewed_by
        )
        ON CONFLICT (session_id, student_id) DO UPDATE
        SET leave_request_id = EXCLUDED.leave_request_id,
            status = 'excused',
            marked_at = NOW(),
            marked_by = EXCLUDED.marked_by;
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE TRIGGER apply_approved_leave
AFTER UPDATE OF status ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.apply_approved_leave();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
ALTER TABLE public.materials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Materials: enrolled students, the teaching professor, admins.
CREATE POLICY "View course materials"
ON public.materials
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR public.teaches_offering(offering_id)
    OR public.is_enrolled_in_offering(offering_id)
);

CREATE POLICY "Teaching staff upload materials"
ON public.materials
FOR INSERT
TO authenticated
WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND (public.is_admin() OR public.teaches_offering(offering_id))
);

CREATE POLICY "Teaching staff update own materials"
ON public.materials
FOR UPDATE
TO authenticated
USING (
    public.is_admin()
    OR (uploaded_by = (SELECT auth.uid())
        AND public.teaches_offering(offering_id))
)
WITH CHECK (
    public.is_admin()
    OR (uploaded_by = (SELECT auth.uid())
        AND public.teaches_offering(offering_id))
);

CREATE POLICY "Teaching staff delete own materials"
ON public.materials
FOR DELETE
TO authenticated
USING (
    public.is_admin()
    OR (uploaded_by = (SELECT auth.uid())
        AND public.teaches_offering(offering_id))
);


-- Leave requests
CREATE POLICY "View leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR student_id = public.current_student_id()
    OR public.teaches_session(session_id)
);

CREATE POLICY "Students submit own leave requests"
ON public.leave_requests
FOR INSERT
TO authenticated
WITH CHECK (
    student_id = public.current_student_id()
    AND status = 'pending'
);

CREATE POLICY "Teaching staff review leave requests"
ON public.leave_requests
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


-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
-- Both buckets are private. Files are reached through signed
-- URLs created on the server, never by public link.
-- =========================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kdu-course-materials', 'kdu-course-materials', FALSE, 52428800)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kdu-leave-documents', 'kdu-leave-documents', FALSE, 10485760)
ON CONFLICT (id) DO NOTHING;


-- Course materials: the first folder in the path is the
-- offering id, so the same rule that guards the metadata row
-- guards the file.
CREATE POLICY "Read course material files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'kdu-course-materials'
    AND (
        public.is_admin()
        OR public.teaches_offering(
               public.safe_uuid((storage.foldername(name))[1]))
        OR public.is_enrolled_in_offering(
               public.safe_uuid((storage.foldername(name))[1]))
    )
);

CREATE POLICY "Upload course material files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'kdu-course-materials'
    AND (
        public.is_admin()
        OR public.teaches_offering(
               public.safe_uuid((storage.foldername(name))[1]))
    )
);

CREATE POLICY "Remove course material files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'kdu-course-materials'
    AND (
        public.is_admin()
        OR public.teaches_offering(
               public.safe_uuid((storage.foldername(name))[1]))
    )
);


-- Leave documents: the first folder is the student's own
-- profile id, so a student can only ever write into their own
-- folder. Reviewers reach the file through the request row.
CREATE POLICY "Upload own leave documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'kdu-leave-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
);

CREATE POLICY "Read permitted leave documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'kdu-leave-documents'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        OR public.is_admin()
        OR EXISTS (
            SELECT 1
            FROM public.leave_requests lr
            WHERE lr.supporting_file_path = storage.objects.name
              AND public.teaches_session(lr.session_id)
        )
    )
);
