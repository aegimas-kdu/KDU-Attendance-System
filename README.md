# KDU Global Attendance System

An integrated student and academic portal for **Kyungdong University Global** —
attendance, course materials, class schedules and leave requests in one place,
replacing a process currently split across paper registers, WhatsApp and email.

Final project for System Analysis and Design, 4th semester.

---

## What problem it solves

Today a student logs into the university portal and little else happens.
Attendance is taken on paper, so it cannot be checked or disputed. Materials
arrive by WhatsApp or email depending on the professor, so students who join
late or lose a phone lose the files. Leave is requested face to face, with no
status and no record.

The portal captures each fact once, at its source, and links the processes:
approving a leave request updates the attendance record automatically, rather
than requiring someone to remember to correct it.

## Who uses it

| Role            | What they do                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Student**     | Enter the attendance code, read their own record, download materials, check the schedule, request leave              |
| **Professor**   | Open a class, generate the code, watch the roll fill, close the class, correct marks, review leave, upload materials |
| **Admin**       | Register students, maintain intake batches, levels, terms, sections, courses and the timetable                       |
| **Super admin** | All of that, plus granting and revoking administrator access                                                         |

## How attendance works

1. The professor opens the class and generates a four-digit code. It is shown
   once and stored only as a bcrypt hash.
2. Students enter it. Correct code, inside the window, enrolled: **present**.
3. A late code may be issued afterwards; it marks **late** instead.
4. Closing the class marks every unmarked student **absent**.
5. Three unexcused late marks count as one absence — calculated in a view, so
   the original marks are never rewritten.
6. An approved leave request sets the record to **excused**, even after the
   class has closed.

Every correction and every leave decision is written to an audit log that
nobody can edit.

## Repository layout

```
supabase/
  migrations/      0001 … 0010, run in order in the SQL editor
  seed.sql         Fall 2026 Sophomore Section: batches, courses, eligibility
  verify.sql       read-only checks for tables, RLS, policies, functions
  README.md        run order, bootstrap, function reference
docs/              diagrams and written deliverables
```

Design documents in the project root: the BPR report, the context diagram, the
Level 1 DFD, and the database design document.

## Stack

- **Database** — Supabase (PostgreSQL), with Row Level Security as the actual
  security boundary rather than a second line behind the interface
- **Auth** — Supabase Auth; students sign in with their student number, which
  the server resolves to an email
- **Storage** — two private buckets, served through short-lived signed URLs
- **Frontend** — Next.js (App Router), to be built

## Getting started

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/0001` through `0010` **one file
   at a time**, in order, checking each succeeds before the next.
3. Run `supabase/seed.sql`, then `supabase/verify.sql`.
4. Create the first super admin by hand — see `supabase/README.md`.

Never put the Supabase **service role key** in client code or in this
repository. It bypasses Row Level Security completely.

---
