"use client";

import type { Editor, JSONContent } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { registerFlush, UNSAVED_CONFIRM } from "./pending-saves";

export type SaveStatus = "saved" | "unsaved" | "saving" | "conflict" | "error";

const SAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 5000;

export function useAutosave(editor: Editor | null, docId: string, initialVersion: number) {
  const router = useRouter();
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const state = useRef({
    version: initialVersion,
    dirty: false,
    conflict: false,
    disposed: false,
    snapshot: null as JSONContent | null,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    inflight: null as Promise<void> | null,
  });

  const save = useCallback(
    function save(): Promise<void> {
      const s = state.current;
      clearTimeout(s.timer);
      if (s.inflight) return s.inflight;
      if (!editor || !s.dirty || s.conflict) return Promise.resolve();
      s.dirty = false;
      setStatus("saving");
      s.inflight = (async () => {
        let retryIn: number | null = SAVE_DELAY_MS;
        try {
          const saved = await api<{ version: number }>(`/api/documents/${docId}`, {
            method: "PATCH",
            json: { content: s.snapshot ?? editor.getJSON(), baseVersion: s.version },
          });
          s.version = saved.version;
          setError(null);
          setStatus(s.dirty ? "unsaved" : "saved");
        } catch (err) {
          s.dirty = true;
          s.conflict = err instanceof ApiError && err.status === 409;
          const transient = err instanceof ApiError && (err.status === 0 || err.status >= 500);
          retryIn = transient ? RETRY_DELAY_MS : null;
          setError((err as Error).message);
          setStatus(s.conflict ? "conflict" : "error");
        } finally {
          s.inflight = null;
        }
        if (!s.dirty || s.conflict || retryIn === null) return;
        // After unmount, send edits made during this save once more, but never keep retrying.
        if (s.disposed) {
          if (retryIn === SAVE_DELAY_MS) void save();
        } else s.timer = setTimeout(save, retryIn);
      })();
      return s.inflight;
    },
    [editor, docId],
  );

  // Waits for pending edits to reach the server; resolves true when nothing is left unsaved.
  const flush = useCallback(async () => {
    await state.current.inflight;
    await save();
    return !state.current.dirty;
  }, [save]);

  const resolveConflict = useCallback(
    async (keepMine: boolean) => {
      const s = state.current;
      if (!keepMine) {
        // Re-rendering with the newer version remounts the editor, which also clears undo history.
        s.dirty = false;
        s.conflict = false;
        return router.refresh();
      }
      try {
        const latest = await api<{ version: number }>(`/api/documents/${docId}`);
        s.version = latest.version;
        s.conflict = false;
        setError(null);
        await save();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [docId, router, save],
  );

  // Pages restored by browser back or forward come from the client cache, so re-check for a newer version.
  useEffect(() => router.refresh(), [router]);

  useEffect(() => {
    if (!editor) return;
    const s = state.current;
    const onUpdate = () => {
      s.dirty = true;
      if (s.conflict) return;
      setStatus("unsaved");
      clearTimeout(s.timer);
      s.timer = setTimeout(save, SAVE_DELAY_MS);
    };
    // Leaving the site skips React cleanup, so send pending edits in a request that outlives the page.
    const onPageHide = () => {
      if (!s.dirty || s.conflict) return;
      const body = JSON.stringify({ content: editor.getJSON(), baseVersion: s.version });
      fetch(`/api/documents/${docId}`, { method: "PATCH", keepalive: true, headers: { "content-type": "application/json" }, body }).catch(() => {});
    };
    editor.on("update", onUpdate);
    window.addEventListener("pagehide", onPageHide);
    const unregister = registerFlush(flush);
    return () => {
      editor.off("update", onUpdate);
      window.removeEventListener("pagehide", onPageHide);
      unregister();
      clearTimeout(s.timer);
      s.disposed = true;
      s.snapshot = editor.getJSON();
      if (s.dirty && !s.conflict) void save();
    };
  }, [editor, docId, save, flush]);

  // Hold in-app navigation until pending edits are saved, and warn before closing the tab.
  useEffect(() => {
    const s = state.current;
    const hasPending = () => s.dirty || s.inflight !== null;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href^='/']");
      if (!link || !hasPending() || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      flush().then((clean) => (clean || window.confirm(UNSAVED_CONFIRM)) && router.push(link.getAttribute("href")!));
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasPending()) event.preventDefault();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flush, router]);

  return { status, error, resolveConflict };
}
