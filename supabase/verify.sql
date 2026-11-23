-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - POST-MIGRATION CHECK
-- =========================================================
-- Run this after 0001 to 0010. Every query should return the
-- expected result shown above it. Nothing here changes data,
-- so it is safe to run at any time.
--
-- The output also makes a good appendix for the testing
-- chapter of the report.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Is pgcrypto where the attendance code functions expect?
-- Expect: pgcrypto | extensions
-- If it says "public" instead, the two functions in 0007 will
-- fail when called. Fix with:
--   ALTER EXTENSION pgcrypto SET SCHEMA extensions;
-- ---------------------------------------------------------
SELECT e.extname, n.nspname AS installed_in
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pgcrypto';


-- ---------------------------------------------------------
-- 2. All 22 tables, and row level security on every one.
-- Expect: 22 rows, rls_enabled = true in all of them.
-- ---------------------------------------------------------
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;


-- ---------------------------------------------------------
-- 3. Any table with RLS on but no policy at all is invisible
-- to the application. Expect: no rows.
-- ---------------------------------------------------------
SELECT c.relname AS table_with_rls_but_no_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (
      SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
  );


-- ---------------------------------------------------------
-- 4. How many policies each table carries.
-- audit_logs should have exactly 1 (read only, admins).
-- ---------------------------------------------------------
SELECT tablename, COUNT(*) AS policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;


-- ---------------------------------------------------------
-- 5. Nobody may delete academic configuration or history.
-- Expect: no rows.
-- ---------------------------------------------------------
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'DELETE'
  AND tablename IN (
      'intake_batches', 'academic_levels', 'academic_terms',
      'attendance_records', 'audit_logs', 'enrollments'
  );


-- ---------------------------------------------------------
-- 6. The functions the application calls. Expect 14 rows,
-- and security_definer = true on every one.
-- ---------------------------------------------------------
SELECT p.proname AS function_name, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'is_admin', 'is_super_admin', 'current_student_id', 'current_professor_id',
      'is_enrolled_in_offering', 'teaches_offering', 'teaches_session',
      'attends_session', 'can_view_profile', 'generate_class_sessions',
      'generate_attendance_code', 'submit_attendance_code', 'close_class_session',
      'next_student_number'
  )
ORDER BY p.proname;


-- ---------------------------------------------------------
-- 7. The triggers that do the real work. Expect 10 rows,
-- including on_auth_user_created on auth.users.
-- ---------------------------------------------------------
SELECT c.relname AS on_table, t.tgname AS trigger_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname IN ('public', 'auth')
ORDER BY c.relname, t.tgname;


-- ---------------------------------------------------------
-- 8. The two reporting views. Expect both, security_invoker.
-- ---------------------------------------------------------
SELECT c.relname AS view_name,
       COALESCE(
           (SELECT option_value FROM pg_options_to_table(c.reloptions)
            WHERE option_name = 'security_invoker'),
           'not set'
       ) AS security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
ORDER BY c.relname;


-- ---------------------------------------------------------
-- 9. The two private Storage buckets. Expect both, public =
-- false. If this returns nothing, 0008's bucket inserts did
-- not run — create them in Storage and re-run that file.
-- ---------------------------------------------------------
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('kdu-course-materials', 'kdu-leave-documents');


-- ---------------------------------------------------------
-- 10. Storage policies. Expect 5: three for materials,
-- two for leave documents.
-- ---------------------------------------------------------
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;


-- ---------------------------------------------------------
-- 11. Who the administrators are. After the one-time
-- bootstrap, expect exactly one super_admin.
-- ---------------------------------------------------------
SELECT full_name, email, role, admin_level, account_status
FROM public.profiles
WHERE role = 'admin'
ORDER BY admin_level, full_name;
