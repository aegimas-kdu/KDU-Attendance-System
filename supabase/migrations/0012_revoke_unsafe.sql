-- =========================================================
-- KDU GLOBAL ATTENDANCE SYSTEM - 0012
-- REMOVING PRIVILEGES NOBODY SHOULD HAVE
-- =========================================================
-- Checking the grants after 0011 showed that `anon` and
-- `authenticated` still carried TRUNCATE, REFERENCES and
-- TRIGGER on every table — left over from the project's
-- defaults rather than anything this schema asked for.
--
-- TRUNCATE is the one that matters:
--
--   Row Level Security does not apply to TRUNCATE.
--
-- A policy can restrict which rows a DELETE touches. TRUNCATE
-- empties the whole table and no policy is consulted, so a
-- role holding it can erase every attendance record in the
-- university regardless of how carefully the policies are
-- written. PostgREST exposes no TRUNCATE endpoint, so this is
-- not reachable today — but it is a privilege with no purpose
-- here, and the gap between "not currently reachable" and
-- "not possible" is exactly where incidents live.
--
-- REFERENCES and TRIGGER are less alarming and equally
-- pointless: the ability to add foreign keys and triggers to
-- our tables belongs to the schema owner.
-- =========================================================

REVOKE TRUNCATE, REFERENCES, TRIGGER
ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

-- And for anything added later.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;


-- ---------------------------------------------------------
-- CHECK
-- ---------------------------------------------------------
-- Expect only SELECT for anon (on intake_batches and
-- academic_levels), and SELECT / INSERT / UPDATE / DELETE for
-- authenticated. No TRUNCATE anywhere.
--
-- If TRUNCATE survives, the grant was made by a role this one
-- cannot revoke from; say so and we will go through the
-- dashboard instead.
-- ---------------------------------------------------------
SELECT grantee,
       string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privileges_held,
       COUNT(DISTINCT table_name) AS tables
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY grantee
ORDER BY grantee;
