"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import {
  MATERIALS_BUCKET,
  materialPath,
  materialUrl,
  removeObject,
} from "@/lib/storage";
import { describe, fail, ok, type ActionResult } from "./result";

/**
 * Records a file that has already been uploaded.
 *
 * The upload itself happens in the browser, straight to Supabase Storage, so
 * large files never pass through the server. This writes the row that makes
 * it visible — and the `materials` policy checks that the caller really does
 * teach this course.
 */
export async function saveMaterial(input: {
  offeringId: string;
  title: string;
  description?: string | null;
  filePath: string;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();

  const title = input.title.trim();
  if (!title) return fail("Give the file a title.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .insert({
      offering_id: input.offeringId,
      uploaded_by: viewer.userId,
      title,
      description: input.description?.trim() || null,
      file_path: input.filePath,
      file_size_bytes: input.fileSizeBytes ?? null,
      mime_type: input.mimeType ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // The row was refused, so the file in Storage would be orphaned.
    await removeObject(MATERIALS_BUCKET, input.filePath);
    return fail(describe(error));
  }

  revalidatePath(`/teach/materials/${input.offeringId}`);
  revalidatePath(`/student/courses/${input.offeringId}`);
  return ok({ id: data.id });
}

export async function renameMaterial(
  materialId: string,
  title: string,
  description?: string | null,
): Promise<ActionResult> {
  await requireViewer();

  const trimmed = title.trim();
  if (!trimmed) return fail("Give the file a title.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("materials")
    .update({ title: trimmed, description: description?.trim() || null })
    .eq("id", materialId);

  if (error) return fail(describe(error));

  revalidatePath("/teach/materials");
  return ok();
}

/** Removes the row and the file. Students lose access immediately. */
export async function deleteMaterial(materialId: string): Promise<ActionResult> {
  await requireViewer();
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("file_path, offering_id")
    .eq("id", materialId)
    .maybeSingle();

  if (!material) return fail("That file is no longer there.");

  const { error } = await supabase.from("materials").delete().eq("id", materialId);
  if (error) return fail(describe(error));

  await removeObject(MATERIALS_BUCKET, material.file_path);

  revalidatePath(`/teach/materials/${material.offering_id}`);
  revalidatePath(`/student/courses/${material.offering_id}`);
  return ok();
}

/**
 * A link to download one file.
 *
 * Generated on demand and valid for a minute, so a URL copied out of the
 * page stops working almost immediately. The signing happens against the
 * caller's own session, so Storage applies the same rules as the database.
 */
export async function getMaterialDownloadUrl(
  materialId: string,
): Promise<ActionResult<{ url: string }>> {
  await requireViewer();
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("file_path")
    .eq("id", materialId)
    .maybeSingle();

  if (!material) return fail("That file is no longer available.");

  const url = await materialUrl(material.file_path, 60);
  if (!url) return fail("The download link could not be created.");

  return ok({ url });
}

/**
 * Where the browser should put a file it is about to upload.
 *
 * The Storage policies read the FIRST FOLDER of the object path to decide who
 * may write it, so the path is built on the server by `materialPath` rather
 * than guessed in the browser — a hand-made path would either be denied or,
 * worse, land where someone else's policy allows it.
 */
export async function prepareMaterialUpload(
  offeringId: string,
  filename: string,
): Promise<ActionResult<{ path: string; bucket: string }>> {
  await requireViewer();

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("teaches_offering", {
    p_offering_id: offeringId,
  });

  if (!allowed) return fail("You do not teach this course.");

  return ok({ path: materialPath(offeringId, filename), bucket: MATERIALS_BUCKET });
}
