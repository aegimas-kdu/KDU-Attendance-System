import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AdminLevel, Profile, UserRole } from "@/lib/database.types";

/**
 * Who is making this request.
 *
 * `studentId` and `professorId` are the primary keys of the `students` and
 * `professors` rows, not the profile id — most queries join on those.
 */
export type Viewer = {
  userId: string;
  profile: Profile;
  studentId: string | null;
  professorId: string | null;
  isStudent: boolean;
  isProfessor: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

/**
 * These helpers are a convenience for rendering — they decide what to *show*.
 * They are not what keeps data safe: every query underneath still goes through
 * Row Level Security, so a student who forged their way onto an admin page
 * would be met with empty tables rather than somebody else's records.
 */

/**
 * The signed-in user's id and email, or null. Cached for one request.
 *
 * Uses getClaims(), not getUser(). Both are safe — getClaims verifies the
 * token's signature cryptographically, unlike getSession(), which believes
 * whatever the cookie says. The difference is cost: with asymmetric JWT
 * signing keys getClaims verifies locally against a cached JWKS, so it costs
 * nothing, while getUser is an HTTP call to the Auth server on every single
 * render. That call was being made twice per page load.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub as string, email: (claims.email as string) ?? null };
});

/** The full picture of who is asking, or null when signed out. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  // One request, not three. students.profile_id and professors.profile_id are
  // both UNIQUE, so PostgREST embeds a single row rather than a list — but a
  // regenerated types file could describe it either way, so both are handled.
  const { data: row } = await supabase
    .from("profiles")
    .select("*, students(id), professors(id)")
    .eq("id", user.id)
    .single();

  // Signed in but no profile means the sign-up trigger did not run.
  if (!row) return null;

  const { students, professors, ...profile } = row as typeof row & {
    students: { id: string } | { id: string }[] | null;
    professors: { id: string } | { id: string }[] | null;
  };

  const one = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  const student = one(students);
  const professor = one(professors);

  return {
    userId: user.id,
    profile,
    studentId: student?.id ?? null,
    professorId: professor?.id ?? null,
    isStudent: profile.role === "student",
    isProfessor: profile.role === "professor",
    isAdmin: profile.role === "admin" && profile.account_status === "active",
    isSuperAdmin:
      profile.role === "admin" &&
      profile.admin_level === "super_admin" &&
      profile.account_status === "active",
  };
});

/** Signed in, or off to the sign-in page. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  return viewer;
}

/** Signed in and holding one of these roles, or off to their own home. */
export async function requireRole(...roles: UserRole[]): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!roles.includes(viewer.profile.role)) redirect(homeFor(viewer));
  return viewer;
}

export async function requireStudent(): Promise<Viewer & { studentId: string }> {
  const viewer = await requireRole("student");
  if (!viewer.studentId) redirect("/dashboard");
  return viewer as Viewer & { studentId: string };
}

export async function requireProfessor(): Promise<Viewer & { professorId: string }> {
  const viewer = await requireRole("professor");
  if (!viewer.professorId) redirect("/dashboard");
  return viewer as Viewer & { professorId: string };
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect(homeFor(viewer));
  return viewer;
}

export async function requireSuperAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isSuperAdmin) redirect(homeFor(viewer));
  return viewer;
}

/** Where this person's portal starts. */
export function homeFor(viewer: Viewer): string {
  if (viewer.isAdmin) return "/admin";
  if (viewer.isProfessor) return "/teach";
  if (viewer.isStudent) return "/student";
  return "/dashboard";
}

/** Initials for an avatar, from a full name. */
export function initials(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** How an administrator's level reads on screen. */
export function roleLabel(role: UserRole, adminLevel?: AdminLevel | null): string {
  if (role === "admin") {
    return adminLevel === "super_admin" ? "Super administrator" : "Administrator";
  }
  return role === "professor" ? "Professor" : "Student";
}
