import "server-only";

import { createClient } from "@/lib/supabase/server";

export const MATERIALS_BUCKET = "kdu-course-materials";
export const LEAVE_BUCKET = "kdu-leave-documents";

/**
 * Both buckets are private, and their Storage policies read the FIRST FOLDER
 * of the object path to decide who may touch the file:
 *
 *   kdu-course-materials/<offering_id>/<uuid>-<filename>
 *   kdu-leave-documents/<profile_id>/<uuid>-<filename>
 *
 * Deviate from that and the policy either denies a legitimate request or, far
 * worse, lets the wrong person through. Always build paths with the two
 * helpers below rather than by hand.
 */

/** Strips anything that would confuse a path or a Content-Disposition header. */
function safeName(filename: string): string {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120)
    .replace(/^[-.]+/, "") || "file";
}

export function materialPath(offeringId: string, filename: string): string {
  return `${offeringId}/${crypto.randomUUID()}-${safeName(filename)}`;
}

export function leaveDocumentPath(profileId: string, filename: string): string {
  return `${profileId}/${crypto.randomUUID()}-${safeName(filename)}`;
}

/**
 * A short-lived link to a private file.
 *
 * Generated per request against the caller's own session, so Storage applies
 * the same policies as the database. Never cache the result or hand it to
 * anyone else — it works for whoever holds it until it expires.
 */
export async function signedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export function materialUrl(path: string, expiresInSeconds = 60) {
  return signedUrl(MATERIALS_BUCKET, path, expiresInSeconds);
}

export function leaveDocumentUrl(path: string, expiresInSeconds = 60) {
  return signedUrl(LEAVE_BUCKET, path, expiresInSeconds);
}

/** Removes an object. Storage policies decide whether it is allowed. */
export async function removeObject(bucket: string, path: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return !error;
}

/** Bytes as something readable, for a file list. */
export function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The short label shown on a file row. */
export function fileKind(mimeType: string | null, filename: string): string {
  const ext = filename.split(".").pop()?.toUpperCase() ?? "";
  if (ext && ext.length <= 4) return ext;
  if (!mimeType) return "FILE";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("presentation")) return "PPTX";
  if (mimeType.includes("word")) return "DOCX";
  if (mimeType.startsWith("image/")) return "IMAGE";
  return "FILE";
}
