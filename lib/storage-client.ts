"use client";

import { createClient } from "@/lib/supabase/client";

export const MATERIALS_BUCKET = "kdu-course-materials";
export const LEAVE_BUCKET = "kdu-leave-documents";

export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
export const MAX_LEAVE_DOCUMENT_BYTES = 10 * 1024 * 1024;

function safeName(filename: string): string {
  return (
    filename
      .normalize("NFKD")
      .replace(/[^\w.\- ]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(-120)
      .replace(/^[-.]+/, "") || "file"
  );
}

export type UploadResult =
  | { ok: true; path: string; size: number; mimeType: string }
  | { ok: false; error: string };

/**
 * Uploads straight from the browser to Supabase Storage.
 *
 * The file never passes through the Next.js server, which keeps large
 * uploads off the serverless request path. Safety comes from the Storage
 * policies: the path's first folder decides who is allowed, so a student
 * cannot write into another student's folder or into a course they do not
 * teach.
 */
async function upload(
  bucket: string,
  path: string,
  file: File,
  maxBytes: number,
): Promise<UploadResult> {
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
        maxBytes / 1024 / 1024
      } MB.`,
    };
  }

  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.message.toLowerCase().includes("row-level security") ||
        error.message.toLowerCase().includes("unauthorized")
          ? "You are not allowed to upload to this course."
          : `The upload failed: ${error.message}`,
    };
  }

  return {
    ok: true,
    path,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

/** Course material. The first folder must be the offering id. */
export function uploadMaterial(offeringId: string, file: File) {
  const path = `${offeringId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  return upload(MATERIALS_BUCKET, path, file, MAX_MATERIAL_BYTES);
}

/** Leave document. The first folder must be the student's own profile id. */
export function uploadLeaveDocument(profileId: string, file: File) {
  const path = `${profileId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  return upload(LEAVE_BUCKET, path, file, MAX_LEAVE_DOCUMENT_BYTES);
}
