# KDU Global Attendance System — database

Integrated Student & Academic Portal. 22 application tables, two views and
two private Storage buckets on Supabase (PostgreSQL), plus Supabase's own
`auth.users` table for authentication.

## Run order

Open the Supabase SQL editor and run each file once, in order. Only move to
the next file after the previous one has succeeded.

| File | Contents |
| --- | --- |
| `migrations/0001_extensions.sql` | pgcrypto, `safe_uuid()`, `set_updated_at()` |
| `migrations/0002_identity.sql` | profiles, students, professors, sign-up trigger, privilege guard, authorisation helpers |
| `migrations/0003_academic_config.sql` | intake_batches, academic_levels, academic_terms |
| `migrations/0004_sections.sql` | class_sections, section_batches, student_section_assignments |
| `migrations/0005_courses.sql` | courses, course_offerings, offering_batches, enrollments |
| `migrations/0006_timetable.sql` | timetable_slots, class_sessions, `generate_class_sessions()` |
| `migrations/0007_attendance.sql` | attendance_codes, attendance_records, attendance_attempts, code RPCs, summary view |
| `migrations/0008_materials_leave.sql` | materials, leave_requests, Storage buckets and policies |
| `migrations/0009_audit_and_admin.sql` | audit_logs, audit triggers, professor and administrator provisioning |
| `migrations/0010_cross_role_access.sql` | cross-role profile visibility, class lists, sign-in by student number, attendance sheet view |
| `migrations/0011_grants.sql` | table privileges for `anon` and `authenticated`, and three DELETE policies |
| `migrations/0012_revoke_unsafe.sql` | removes TRUNCATE, REFERENCES and TRIGGER from the API roles |
| `seed.sql` | intake batches 2025-1 to 2026-2, levels, Fall 2026 term, the six real courses, the Sophomore Section and course eligibility |
| `verify.sql` | read-only checks: tables, RLS, policies, functions, triggers, views, buckets |

Run `verify.sql` last. Every query in it states the result to expect, so a
wrong number tells you which file to look at. Its output also works as the
testing appendix for the report.

### Why 0011 exists

Row Level Security decides *which rows* a request may touch. It does not grant
the right to touch the table at all — that is an ordinary SQL privilege. Miss
it and every API call fails with `42501: permission denied for table …` before
any policy is consulted. The two layers are separate and both are required:
the **grant** lets a role use the table, the **policy** decides what it sees
inside. Granting broadly is safe here precisely because RLS is on everywhere.

The Fall 2026 timetable is **not** in `seed.sql`, because a timetable slot
needs a professor and a professor needs a real Auth account. The script for it
is at the foot of that file, commented out; run it once the five professors
exist.

## Creating the first super admin

Public registration always produces a student, so the first administrator is
made by hand, once, from the SQL editor.

1. Create the account through **Authentication → Users → Add user** in the
   Supabase dashboard, or by registering through the portal.
2. Run, replacing the email:

```sql
update public.profiles
set role = 'admin',
    admin_level = 'super_admin',
    account_status = 'active'
where email = 'you@kdu.edu';
```

The privilege guard allows this because the SQL editor has no `auth.uid()`.
From then on, use `grant_admin_access()` and `revoke_admin_access()`.

## Creating a professor

First the person needs a Supabase Auth account — **Authentication → Users →
Add user**, with *Auto Confirm User* ticked. The sign-up trigger gives them a
profile and, because self-registration always produces a student, a `students`
row as well.

### From the application

Once an administrator is signed in, the app calls:

```sql
select public.register_professor(
    (select id from public.profiles where email = 'sarwar@kdu.edu'),
    'EMP-SARWAR',
    'Smart Computing'
);
```

Looking the profile up by email avoids copying UUIDs by hand.

### From the SQL editor

`register_professor()` **will not work in the SQL editor.** It begins with
`IF NOT public.is_admin()`, and `is_admin()` reads `auth.uid()`, which is null
there — so it refuses every time, even for a super admin. That is correct
behaviour: the function is written for a signed-in administrator.

To set professors up before any application exists, do the three steps by
hand. Direct database access is exempt from the privilege guard, which is why
this works and only here:

```sql
-- 1. drop the student rows the sign-up trigger created
delete from public.students
where profile_id in (
    select id from public.profiles
    where email in ('sarwar@kdu.edu', 'hussein@kdu.edu')
);

-- 2. change the role
update public.profiles
set role = 'professor', admin_level = NULL, updated_at = NOW()
where email in ('sarwar@kdu.edu', 'hussein@kdu.edu');

-- 3. create the professor records
insert into public.professors (profile_id, employee_id, department)
select p.id, v.employee_id, 'Smart Computing'
from (values
    ('sarwar@kdu.edu',  'EMP-SARWAR'),
    ('hussein@kdu.edu', 'EMP-HUSSEIN')
) as v(email, employee_id)
join public.profiles p on p.email = v.email
on conflict (profile_id) do update
set employee_id = excluded.employee_id,
    department  = excluded.department;
```

The employee IDs matter: the timetable script at the foot of `seed.sql` joins
on them. It expects `EMP-SARWAR`, `EMP-HUSSEIN`, `EMP-VILLA`, `EMP-ABSI` and
`EMP-YOON`.

The same applies to `grant_admin_access()` and `revoke_admin_access()` — both
check `is_super_admin()` and so are unusable from the SQL editor. That is why
the first super admin is made with a plain `update`.

## Functions the application calls

| Function | Who may call it | What it does |
| --- | --- | --- |
| `generate_class_sessions(offering_id)` | admin, teaching professor | creates one session per timetabled date in the term |
| `generate_attendance_code(session_id, type, seconds)` | admin, teaching professor | opens the session and returns a four-digit code once |
| `submit_attendance_code(session_id, code)` | enrolled student | marks the student present or late |
| `close_class_session(session_id)` | admin, teaching professor | closes the session and marks the rest absent |
| `register_professor(profile_id, employee_id, dept)` | admin | converts an account into a professor |
| `grant_admin_access(profile_id, level)` | super admin | promotes an account |
| `revoke_admin_access(profile_id)` | super admin | demotes an account |
| `email_for_student_id(student_id)` | anonymous | resolves a student number to a sign-in email |
| `next_student_number()` | sign-up trigger | allocates the next number in the university scheme |

## Student numbers

One scheme for the whole university: seven digits, the last two of the year the
student joined followed by a running number. 2025 entrants are `2500001`
upwards, 2026 entrants `2600001` upwards, and the prefix advances by itself
each year. The registry normally issues the number and the registration form
carries it; `next_student_number()` is the fallback when it does not.

## Views

- `student_attendance_summary` — per student per offering: sessions held,
  present, late, absent, excused, the three-late penalty and the attendance
  rate. The penalty is calculated here, never written into the records.
- `session_attendance_sheet` — one row per enrolled student per session for
  the professor's attendance screen.

Both use `security_invoker`, so each reader sees only the rows their own
policies allow.

## Storage path convention

The Storage policies read the first folder of the object path. Uploads must
follow it exactly.

```
kdu-course-materials/<offering_id>/<uuid>-<filename>
kdu-leave-documents/<profile_id>/<uuid>-<filename>
```

Both buckets are private. Serve files with short-lived signed URLs created on
the server.

## Things the database deliberately does not do

- It never stores a readable attendance code. Only a bcrypt hash is kept, and
  verification happens inside `submit_attendance_code()`.
- It never deletes academic configuration. Retire a row with
  `is_active = false` so historical records stay readable.
- It never lets a user change their own role. Only
  `grant_admin_access()` and `revoke_admin_access()` can, and both are
  restricted to a super admin.
- It never exposes the service role key to the browser. Any server-only work
  belongs in a Next.js route handler or a Supabase Edge Function.
