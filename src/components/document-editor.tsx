"use client";

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import type { User } from "@/db/schema";
import { can, type Role } from "@/lib/access";
import { extensions } from "@/lib/editor-extensions";
import { AppHeader } from "./app-header";
import { DeleteButton } from "./delete-button";
import { ExportMenu } from "./export-menu";
import { ShareDialog } from "./share-dialog";
import { TitleField } from "./title-field";
import { Toolbar } from "./toolbar";
import { useAutosave, type SaveStatus } from "./use-autosave";

type Props = {
  user: User;
  doc: { id: string; title: string; content: JSONContent; version: number; role: Role; ownerName: string };
};

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "All changes saved",
  unsaved: "Unsaved changes",
  saving: "Saving...",
  conflict: "Not saved: conflict",
  error: "Not saved",
};

export function DocumentEditor({ user, doc }: Props) {
  const canEdit = can(doc.role, "edit");
  const isOwner = doc.role === "owner";
  const editor = useEditor({
    extensions,
    content: doc.content,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: { attributes: { class: "doc-content", "aria-label": "Document content" } },
  });
  const { status, error, resolveConflict } = useAutosave(editor, doc.id, doc.version);

  return (
    <>
      <div className="sticky top-0 z-10">
        <AppHeader user={user}>
          <TitleField docId={doc.id} initialTitle={doc.title} canRename={can(doc.role, "rename")} />
          <span
            role="status"
            className={`shrink-0 text-xs ${status === "error" || status === "conflict" ? "text-red-600" : "text-slate-500"}`}
          >
            {canEdit ? STATUS_LABEL[status] : "View only"}
          </span>
          <span className="ml-auto flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
            <ExportMenu docId={doc.id} />
            {isOwner && (
              <>
                <DeleteButton docId={doc.id} />
                <ShareDialog docId={doc.id} />
              </>
            )}
          </span>
        </AppHeader>

        {canEdit && editor && (
          <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto max-w-3xl px-4 py-1.5">
              <Toolbar editor={editor} />
            </div>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {!isOwner && (
          <p className="mb-3 text-sm text-slate-500">
            Shared by {doc.ownerName}. You can {canEdit ? "edit" : "view"} this document.
          </p>
        )}
        {status === "conflict" && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <p>Someone else saved a newer version while you were editing. Your recent changes are not saved yet.</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => resolveConflict(false)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50"
              >
                Load their version
              </button>
              <button
                onClick={() => resolveConflict(true)}
                className="rounded-md bg-amber-600 px-3 py-1 text-white hover:bg-amber-700"
              >
                Keep mine and overwrite
              </button>
            </div>
          </div>
        )}
        {status === "error" && error && (
          <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <article className="rounded-lg border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-12 sm:py-10">
          <EditorContent editor={editor} />
        </article>
      </main>
    </>
  );
}
