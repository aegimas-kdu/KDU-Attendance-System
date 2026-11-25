"use client";

import { useState } from "react";
import { getMaterialDownloadUrl } from "@/lib/actions/materials";
import { small } from "@/components/form-kit";

/**
 * Opens one course file.
 *
 * The link is signed when you ask for it and lasts a minute, so there is no
 * URL sitting in the page that could be passed to someone not enrolled.
 */
export function Download({ materialId }: { materialId: string }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center justify-end gap-2">
      {error && <span className="text-[13px] text-absent-ink">{error}</span>}
      <button
        type="button"
        disabled={opening}
        className={small}
        onClick={async () => {
          setOpening(true);
          setError(null);
          const result = await getMaterialDownloadUrl(materialId);
          setOpening(false);
          if (result.ok) window.open(result.data.url, "_blank", "noreferrer");
          else setError(result.error);
        }}
      >
        {opening ? "Opening…" : "Open"}
      </button>
    </span>
  );
}
