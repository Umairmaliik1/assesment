"use client";

import { useEffect, useRef, useState } from "react";
import { flushPendingSaves } from "./pending-saves";

const FORMATS = [
  { format: "pdf", label: "PDF document (.pdf)" },
  { format: "md", label: "Markdown (.md)" },
] as const;

function fileName(disposition: string | null, fallback: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  return encoded ? decodeURIComponent(encoded) : fallback;
}

export function ExportMenu({ docId }: { docId: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function download(format: "pdf" | "md") {
    setOpen(false);
    setError(null);
    if (!(await flushPendingSaves()) && !window.confirm("Your latest changes are not saved. Export the last saved version?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${docId}/export?format=${format}`).catch(() => null);
      if (!res?.ok) throw new Error((await res?.json().catch(() => null))?.error ?? "Export failed. Check your connection and try again.");
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(res.headers.get("content-disposition"), `document.${format}`);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={container} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-60"
      >
        {busy ? "Exporting..." : "Export"}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {FORMATS.map(({ format, label }) => (
            <button
              key={format}
              role="menuitem"
              onClick={() => download(format)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="absolute right-0 top-full mt-1 w-64 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
