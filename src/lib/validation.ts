import { getSchema, type JSONContent } from "@tiptap/core";
import { z } from "zod";
import { extensions } from "./editor-extensions";

const editorSchema = getSchema(extensions);
const MAX_CONTENT_CHARS = 1_000_000;

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

function isValidDoc(value: unknown): boolean {
  try {
    const node = editorSchema.nodeFromJSON(value);
    node.check();
    return node.type.name === "doc";
  } catch {
    return false;
  }
}

const titleSchema = z
  .string({ error: "Title is required" })
  .trim()
  .min(1, "Title cannot be empty")
  .max(200, "Title must be 200 characters or fewer");

export const contentSchema = z
  .custom<JSONContent>(isValidDoc, "Content is not a valid document")
  .refine((doc) => JSON.stringify(doc).length <= MAX_CONTENT_CHARS, "Document is too large");

export const idSchema = z.uuid({ error: "Document not found" });

export const createDocumentInput = z.strictObject({ title: titleSchema.optional() });

export const updateDocumentInput = z.union([
  z.strictObject({ title: titleSchema }),
  z.strictObject({ content: contentSchema, baseVersion: z.int().positive() }),
], { error: "Send either a title, or content with baseVersion" });

export const shareInput = z.strictObject({
  userId: z.string().min(1, "Choose a user"),
  role: z.enum(["viewer", "editor"], { error: "Role must be viewer or editor" }),
});

export const loginInput = z.strictObject({ userId: z.string().min(1, "Choose a user") });
