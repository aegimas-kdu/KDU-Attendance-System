-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - SEED DATA
-- =========================================================
-- Run after 0001 to 0010. Safe to run more than once.
--
-- This is the real Fall 2026 Sophomore Section of the
-- Department of Smart Computing: four 50-minute periods from
-- 09:00 to 12:50, 29 students from the 2025-2 intake and 24
-- from 2025-1, and six courses.
--
-- Course codes are placeholders. Replace them with KDU's own
-- codes before the demonstration; nothing else depends on them.
--
-- The timetable itself is NOT seeded here, because a timetable
-- slot needs a professor, and a professor needs a real Supabase
-- Auth account. The last section of this file has the script to
-- run once those accounts exist.
-- =========================================================


-- ---------------------------------------------------------
-- 1. INTAKE BATCHES
-- Named with KDU's own notation: year-semester.
-- ---------------------------------------------------------
INSERT INTO public.intake_batches (name, semester, start_year)
VALUES
    ('2025-1', 'Spring', 2025),
    ('2025-2', 'Fall',   2025),
    ('2026-1', 'Spring', 2026),
    ('2026-2', 'Fall',   2026)
ON CONFLICT (name) DO NOTHING;


-- ---------------------------------------------------------
-- 2. ACADEMIC LEVELS
-- ---------------------------------------------------------
INSERT INTO public.academic_levels (name, sequence_number)
VALUES
    ('Freshman',  1),
    ('Sophomore', 2),
    ('Junior',    3),
    ('Senior',    4)
ON CONFLICT (name) DO NOTHING;


-- ---------------------------------------------------------
-- 3. ACADEMIC TERMS
-- ---------------------------------------------------------
INSERT INTO public.academic_terms (name, start_date, end_date, status)
VALUES ('Fall 2026', '2026-09-01', '2026-12-31', 'active')
ON CONFLICT (name) DO NOTHING;


-- ---------------------------------------------------------
-- 4. COURSES
-- ---------------------------------------------------------
INSERT INTO public.courses (course_code, course_name, credits)
VALUES
    ('SC201', 'Python for AI',                           3.0),
    ('SC202', 'Seminar on AI Literacy',                  3.0),
    ('SC203', 'Computer Graphics',                       3.0),
    ('SC204', 'Data Communication and Computer Network', 3.0),
    ('SC205', 'System Analysis and Design',              3.0),
    ('GE210', 'Communication in Korean III',             2.0)
ON CONFLICT (course_code) DO NOTHING;


-- ---------------------------------------------------------
-- 5. THE SOPHOMORE SECTION FOR FALL 2026
-- 2025-2 (29 students) and 2025-1 (24) in one section.
-- ---------------------------------------------------------
INSERT INTO public.class_sections (
    academic_level_id, academic_term_id, section_name
)
SELECT al.id, at.id, 'Sophomore Section'
FROM public.academic_levels al
CROSS JOIN public.academic_terms at
WHERE al.name = 'Sophomore'
  AND at.name = 'Fall 2026'
ON CONFLICT (academic_level_id, academic_term_id, section_name) DO NOTHING;

INSERT INTO public.section_batches (section_id, batch_id)
SELECT cs.id, ib.id
FROM public.class_sections cs
JOIN public.academic_terms at ON at.id = cs.academic_term_id
CROSS JOIN public.intake_batches ib
WHERE cs.section_name = 'Sophomore Section'
  AND at.name = 'Fall 2026'
  AND ib.name IN ('2025-2', '2025-1')
ON CONFLICT (section_id, batch_id) DO NOTHING;


-- ---------------------------------------------------------
-- 6. COURSE OFFERINGS FOR FALL 2026
-- ---------------------------------------------------------
INSERT INTO public.course_offerings (
    course_id, academic_term_id, offering_name, status
)
SELECT c.id, t.id, c.course_name || ' - Fall 2026', 'active'
FROM public.courses c
CROSS JOIN public.academic_terms t
WHERE t.name = 'Fall 2026'
  AND c.course_code IN ('SC201', 'SC202', 'SC203', 'SC204', 'SC205', 'GE210')
ON CONFLICT (course_id, academic_term_id, offering_name) DO NOTHING;


-- ---------------------------------------------------------
-- 7. WHO MAY TAKE WHAT
-- Five courses are open to both intakes in the section.
-- Communication in Korean III is open to 2025-2 only, which is
-- why 29 of the 53 students attend it.
-- ---------------------------------------------------------
INSERT INTO public.offering_batches (offering_id, batch_id)
SELECT co.id, ib.id
FROM public.course_offerings co
JOIN public.courses c          ON c.id = co.course_id
JOIN public.academic_terms t   ON t.id = co.academic_term_id
CROSS JOIN public.intake_batches ib
WHERE t.name = 'Fall 2026'
  AND c.course_code IN ('SC201', 'SC202', 'SC203', 'SC204', 'SC205')
  AND ib.name IN ('2025-2', '2025-1')
ON CONFLICT (offering_id, batch_id) DO NOTHING;

INSERT INTO public.offering_batches (offering_id, batch_id)
SELECT co.id, ib.id
FROM public.course_offerings co
JOIN public.courses c        ON c.id = co.course_id
JOIN public.academic_terms t ON t.id = co.academic_term_id
CROSS JOIN public.intake_batches ib
WHERE t.name = 'Fall 2026'
  AND c.course_code = 'GE210'
  AND ib.name = '2025-2'
ON CONFLICT (offering_id, batch_id) DO NOTHING;


-- =========================================================
-- CHECK WHAT LANDED
-- =========================================================
SELECT 'intake batches' AS seeded, COUNT(*) FROM public.intake_batches
UNION ALL SELECT 'academic levels',  COUNT(*) FROM public.academic_levels
UNION ALL SELECT 'academic terms',   COUNT(*) FROM public.academic_terms
UNION ALL SELECT 'courses',          COUNT(*) FROM public.courses
UNION ALL SELECT 'class sections',   COUNT(*) FROM public.class_sections
UNION ALL SELECT 'section batches',  COUNT(*) FROM public.section_batches
UNION ALL SELECT 'course offerings', COUNT(*) FROM public.course_offerings
UNION ALL SELECT 'offering batches', COUNT(*) FROM public.offering_batches;
-- Expect: 4, 4, 1, 6, 1, 2, 6, 11
--   (11 = five courses x two batches, plus Korean III x one)


-- =========================================================
-- THE TIMETABLE — RUN THIS LATER
-- =========================================================
-- Do this once the five professors have Supabase Auth accounts
-- and have been converted with register_professor(). It writes
-- the real Fall 2026 grid:
--
--   Period 1  09:00-09:50   Period 3  11:00-11:50
--   Period 2  10:00-10:50   Period 4  12:00-12:50
--
-- Uncomment and run.
-- ---------------------------------------------------------
/*
WITH slot(course_code, weekday, start_time, end_time, lecture_type, room, employee_id) AS (
    VALUES
    -- Monday
    ('SC201', 1, TIME '09:00', TIME '09:50', 'Lecture',  '5302', 'EMP-SARWAR'),
    ('SC201', 1, TIME '10:00', TIME '10:50', 'Lecture',  '5302', 'EMP-SARWAR'),
    ('SC205', 1, TIME '11:00', TIME '11:50', 'Tutorial', '5302', 'EMP-ABSI'),
    ('SC205', 1, TIME '12:00', TIME '12:50', 'Lecture',  '5302', 'EMP-ABSI'),
    -- Tuesday
    ('SC202', 2, TIME '09:00', TIME '09:50', 'Lecture',  '5302', 'EMP-HUSSEIN'),
    ('SC202', 2, TIME '10:00', TIME '10:50', 'Lecture',  '5302', 'EMP-HUSSEIN'),
    ('SC205', 2, TIME '11:00', TIME '11:50', 'Lecture',  '5302', 'EMP-ABSI'),
    ('SC202', 2, TIME '12:00', TIME '12:50', 'Tutorial', '5302', 'EMP-HUSSEIN'),
    -- Wednesday
    ('SC203', 3, TIME '09:00', TIME '09:50', 'Tutorial', '5302', 'EMP-VILLA'),
    ('SC204', 3, TIME '10:00', TIME '10:50', 'Lecture',  '5302', 'EMP-SARWAR'),
    ('SC204', 3, TIME '11:00', TIME '11:50', 'Lecture',  '5302', 'EMP-SARWAR'),
    ('SC204', 3, TIME '12:00', TIME '12:50', 'Tutorial', '5302', 'EMP-SARWAR'),
    -- Thursday
    ('SC201', 4, TIME '09:00', TIME '09:50', 'Tutorial', '5302', 'EMP-SARWAR'),
    ('SC203', 4, TIME '10:00', TIME '10:50', 'Lecture',  '5302', 'EMP-VILLA'),
    ('SC203', 4, TIME '11:00', TIME '11:50', 'Lecture',  '5302', 'EMP-VILLA'),
    -- Friday  (Communication in Korean III, 2025-2 intake only)
    ('GE210', 5, TIME '09:00', TIME '09:50', 'Lecture',  '1403', 'EMP-YOON'),
    ('GE210', 5, TIME '10:00', TIME '10:50', 'Lecture',  '1403', 'EMP-YOON'),
    ('GE210', 5, TIME '11:00', TIME '11:50', 'Tutorial', '1403', 'EMP-YOON')
)
INSERT INTO public.timetable_slots (
    offering_id, professor_id, weekday, start_time, end_time, room, lecture_type
)
SELECT co.id, p.id, s.weekday, s.start_time, s.end_time, s.room, s.lecture_type
FROM slot s
JOIN public.courses c          ON c.course_code = s.course_code
JOIN public.academic_terms t   ON t.name = 'Fall 2026'
JOIN public.course_offerings co ON co.course_id = c.id AND co.academic_term_id = t.id
JOIN public.professors p       ON p.employee_id = s.employee_id;

-- Then create the term's class meetings, one offering at a time:
--   SELECT public.generate_class_sessions(id)
--   FROM public.course_offerings co
--   JOIN public.academic_terms t ON t.id = co.academic_term_id
--   WHERE t.name = 'Fall 2026';
*/
