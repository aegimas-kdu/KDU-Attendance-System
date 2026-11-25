"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  prepareLeaveDocumentUpload,
  submitLeaveRequest,
} from "@/lib/actions/leave";
import { createClient } from "@/lib/supabase/client";
import { Alert, Empty } from "@/components/ui";
import { field, label, primary } from "@/components/form-kit";

const MAX_BYTES = 10 * 1024 * 1024;

export type MissedClass = {
  session_id: string;
  session_date: string;
  start_time: string;
  course_name: string;
};

/**
 * One request, for one class.
 *
 * Only classes you were actually marked absent for and have not already asked
 * about are offered — the database would refuse anything else, so there is no
 * point in letting the form ask.
 */
export function RequestForm({ classes }: { classes: MissedClass[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const [sessionId, setSessionId] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (classes.length === 0) {
    return (
      <div className="p-5">
        <Empty title="Nothing to request leave for">
          A request covers one class you were marked absent for. You have no absences
          waiting — or you have already sent a request for each of them.
        </Empty>
      </div>
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(null);

    if (file && file.size > MAX_BYTES) {
      setError("That document is larger than 10 MB. Please attach a smaller one.");
      return;
    }

    start(async () => {
      let path: string | null = null;

      if (file) {
        const prepared = await prepareLeaveDocumentUpload(file.name);
        if (!prepared.ok) {
          setError(prepared.error);
          return;
        }

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(prepared.data.bucket)
          .upload(prepared.data.path, file, { upsert: false });

        if (uploadError) {
          setError(`The document could not be uploaded. ${uploadError.message}`);
          return;
        }

        path = prepared.data.path;
      }

      const result = await submitLeaveRequest({
        sessionId,
        reason,
        supportingFilePath: path,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDone(
        "Sent. Your professor decides, and their answer and note will appear in the list.",
      );
      setSessionId("");
      setReason("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <form className="p-5" onSubmit={submit}>
      <div className="mb-4">
        <label className={label} htmlFor="leave-session">
          Which class
        </label>
        <select
          id="leave-session"
          required
          className={field}
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        >
          <option value="">Choose the class you missed</option>
          {classes.map((c) => (
            <option key={c.session_id} value={c.session_id}>
              {new Date(c.session_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}{" "}
              — {c.course_name}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[13px] text-muted">
          One request per class. Three missed classes are three requests.
        </p>
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="leave-reason">
          Why you were away
        </label>
        <textarea
          id="leave-reason"
          required
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="I was at the hospital that morning and have the note from the clinic."
          className={`${field} min-h-28`}
        />
        <p className="mt-1.5 text-[13px] text-muted">
          {reason.trim().length < 10
            ? "At least a sentence, so your professor can decide."
            : "Your professor reads exactly this."}
        </p>
      </div>

      <div className="mb-4">
        <label className={label} htmlFor="leave-file">
          A document, if you have one (optional)
        </label>
        <input
          id="leave-file"
          ref={fileRef}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:border-line-2 file:bg-white file:px-4 file:text-sm file:font-semibold hover:file:bg-page"
        />
        <p className="mt-1.5 text-[13px] text-muted">
          A medical note or similar, up to 10 MB. Only you and the professor deciding can
          open it.
        </p>
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

      <button
        type="submit"
        disabled={pending || !sessionId || reason.trim().length < 10}
        className={primary}
      >
        {pending ? "Sending…" : "Send the request"}
      </button>
      <p className="mt-2 text-center text-[13px] text-muted">
        If it is approved, that absence stops counting against your 75%.
      </p>
    </form>
  );
}
