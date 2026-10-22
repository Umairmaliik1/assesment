"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { IMPORT_EXTENSIONS, IMPORT_MAX_BYTES } from "@/lib/import-limits";

export function DashboardActions() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(request: () => Promise<{ id: string }>) {
    setBusy(true);
    setError(null);
    try {
      const { id } = await request();
      router.push(`/documents/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function importFile(file: File | undefined) {
    if (!file) return;
    if (fileInput.current) fileInput.current.value = "";
    if (file.size > IMPORT_MAX_BYTES) return setError("Files must be 4 MB or smaller");
    const body = new FormData();
    body.set("file", file);
    run(() => api("/api/documents/import", { method: "POST", body }));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          Import file
        </button>
        <button
          onClick={() => run(() => api("/api/documents", { method: "POST", json: {} }))}
          disabled={busy}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          New document
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={IMPORT_EXTENSIONS.join(",")}
        className="hidden"
        aria-label="Import file"
        onChange={(event) => importFile(event.target.files?.[0])}
      />
      <p className="text-xs text-slate-500">Import .txt, .md or .docx (up to 4 MB) as a new document.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
