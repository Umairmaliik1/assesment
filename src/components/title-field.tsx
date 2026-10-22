"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api-client";

export function TitleField({ docId, initialTitle, canRename }: { docId: string; initialTitle: string; canRename: boolean }) {
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(initialTitle);
  const requested = useRef(initialTitle);
  const queue = useRef(Promise.resolve());
  const cancelled = useRef(false);

  function commit() {
    const next = cancelled.current ? requested.current : title.trim();
    cancelled.current = false;
    if (!next) {
      setTitle(requested.current);
      return setError("Title cannot be empty");
    }
    setTitle(next);
    if (next === requested.current) return;
    requested.current = next;
    // Renames are sent one at a time so the server always ends on the latest title.
    queue.current = queue.current.then(async () => {
      try {
        await api(`/api/documents/${docId}`, { method: "PATCH", json: { title: next } });
        saved.current = next;
        setError(null);
      } catch (err) {
        if (requested.current === next) {
          requested.current = saved.current;
          setTitle(saved.current);
        }
        setError((err as Error).message);
      }
    });
  }

  if (!canRename) return <h1 className="min-w-0 flex-1 truncate font-medium">{title}</h1>;
  return (
    <div className="relative min-w-0 flex-1">
      <input
        value={title}
        maxLength={200}
        aria-label="Document title"
        onChange={(event) => {
          setTitle(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          cancelled.current = event.key === "Escape";
          if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
        }}
        className="w-full max-w-md truncate rounded-md border border-transparent px-2 py-1 font-medium hover:border-slate-300 focus:border-blue-500 focus:outline-none"
      />
      {error && <p role="alert" className="absolute left-2 top-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
