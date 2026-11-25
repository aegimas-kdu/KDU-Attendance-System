"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteMaterial,
  getMaterialDownloadUrl,
  prepareMaterialUpload,
  renameMaterial,
  saveMaterial,
} from "@/lib/actions/materials";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui";
import { field, label, primary, small, smallPrimary, useAction } from "@/components/form-kit";

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Uploads a file straight from the browser to Supabase Storage.
 *
 * The file never passes through the server, so a 20 MB slide deck does not
 * become a 20 MB request body. The server only decides the path — the Storage
 * policy reads its first folder to check that this really is your course —
 * and then records the row.
 */
export function Upload({ offeringId }: { offeringId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function pick(chosen: File | null) {
    setError(null);
    setDone(null);
    setFile(chosen);
    if (chosen && !title) {
      setTitle(chosen.name.replace(/\.[^.]+$/, ""));
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError("That file is larger than 25 MB. Please upload a smaller one.");
      return;
    }

    setError(null);
    setDone(null);

    start(async () => {
      const prepared = await prepareMaterialUpload(offeringId, file.name);
      if (!prepared.ok) {
        setError(prepared.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(prepared.data.bucket)
        .upload(prepared.data.path, file, { upsert: false });

      if (uploadError) {
        setError(`The file could not be uploaded. ${uploadError.message}`);
        return;
      }

      const saved = await saveMaterial({
        offeringId,
        title,
        description,
        filePath: prepared.data.path,
        fileSizeBytes: file.size,
        mimeType: file.type || null,
      });

      if (!saved.ok) {
        setError(saved.error);
        return;
      }

      setDone(`${title} is now available to your students.`);
      setFile(null);
      setTitle("");
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <form className="p-5" onSubmit={submit}>
      <div className="mb-4">
        <label className={label} htmlFor="material-file">
          The file
        </label>
        <input
          id="material-file"
          ref={inputRef}
          type="file"
          required
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:border-line-2 file:bg-white file:px-4 file:text-sm file:font-semibold hover:file:bg-page"
        />
        <p className="mt-1.5 text-[13px] text-muted">
          Up to 25 MB. Slides, notes, a reading list — whatever the class needs.
        </p>
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="material-title">
          What to call it
        </label>
        <input
          id="material-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Week 3 — Data flow diagrams"
          className={field}
        />
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="material-note">
          A note for students (optional)
        </label>
        <textarea
          id="material-note"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Read before Thursday's class."
          className={`${field} min-h-20`}
        />
      </div>

      {done && (
        <div className="mb-4">
          <Alert tone="info">{done}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <button type="submit" disabled={pending || !file} className={primary}>
        {pending ? "Uploading…" : "Upload"}
      </button>
      <p className="mt-2 text-center text-[13px] text-muted">
        Only students enrolled in this course can open it.
      </p>
    </form>
  );
}

/** Download, rename and delete for one file. */
export function FileActions({
  materialId,
  title,
  description,
}: {
  materialId: string;
  title: string;
  description: string | null;
}) {
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [newTitle, setNewTitle] = useState(title);
  const [newNote, setNewNote] = useState(description ?? "");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  async function download() {
    setOpening(true);
    setLinkError(null);
    const result = await getMaterialDownloadUrl(materialId);
    setOpening(false);
    if (result.ok) window.open(result.data.url, "_blank", "noreferrer");
    else setLinkError(result.error);
  }

  if (mode === "rename") {
    return (
      <div className="grid gap-2 text-left">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className={field}
          aria-label="New title"
        />
        <input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="A note for students"
          className={field}
          aria-label="New note"
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className={smallPrimary}
            onClick={() =>
              run(
                () => renameMaterial(materialId, newTitle, newNote),
                () => setMode("idle"),
              )
            }
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className={small} onClick={() => setMode("idle")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "delete") {
    return (
      <div className="grid gap-2 text-left">
        <p className="text-[13px] text-muted">
          The file goes too, and students lose access at once. This cannot be undone.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className={smallPrimary}
            onClick={() => run(() => deleteMaterial(materialId))}
          >
            {pending ? "Deleting…" : "Delete it"}
          </button>
          <button type="button" className={small} onClick={() => setMode("idle")}>
            Keep it
          </button>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {linkError && <span className="text-[13px] text-absent-ink">{linkError}</span>}
      <button type="button" disabled={opening} className={small} onClick={download}>
        {opening ? "Opening…" : "Download"}
      </button>
      <button type="button" className={small} onClick={() => setMode("rename")}>
        Rename
      </button>
      <button type="button" className={small} onClick={() => setMode("delete")}>
        Delete
      </button>
    </span>
  );
}
