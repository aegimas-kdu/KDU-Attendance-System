import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Material } from "@/lib/database.types";

export type MaterialRow = Material & {
  uploader_name: string | null;
};

/**
 * Files for one course offering.
 *
 * The policy on `materials` requires an active enrolment, the teaching
 * professor, or an administrator — so a student who is merely in an eligible
 * intake batch, but not enrolled, gets nothing back.
 */
export async function listMaterials(offeringId: string): Promise<MaterialRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materials")
    .select(`*, profiles:uploaded_by ( full_name )`)
    .eq("offering_id", offeringId)
    .order("uploaded_at", { ascending: false });

  type Raw = Material & { profiles: { full_name: string } | null };

  return ((data ?? []) as unknown as Raw[]).map(({ profiles, ...rest }) => ({
    ...rest,
    uploader_name: profiles?.full_name ?? null,
  }));
}

/** The most recent files across everything the caller can see. */
export async function listRecentMaterials(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materials")
    .select(
      `id, title, uploaded_at, offering_id,
       course_offerings ( courses ( course_name ) )`,
    )
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  type Raw = {
    id: string;
    title: string;
    uploaded_at: string;
    offering_id: string;
    course_offerings: { courses: { course_name: string } | null } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    id: row.id,
    title: row.title,
    uploaded_at: row.uploaded_at,
    offering_id: row.offering_id,
    course_name: row.course_offerings?.courses?.course_name ?? "",
  }));
}

export async function getMaterial(id: string): Promise<Material | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("materials").select("*").eq("id", id).maybeSingle();
  return data;
}
