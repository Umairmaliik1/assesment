import type { JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html/server";
import mammoth from "mammoth";
import { marked } from "marked";
import { extensions } from "./editor-extensions";
import { HttpError } from "./http";
import { IMPORT_EXTENSIONS, IMPORT_MAX_BYTES } from "./import-limits";
import { contentSchema } from "./validation";

type ImportExtension = (typeof IMPORT_EXTENSIONS)[number];

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function textToHtml(text: string): string {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

async function toHtml(extension: ImportExtension, data: Buffer): Promise<string> {
  if (extension === ".docx") {
    const result = await mammoth.convertToHtml({ buffer: data }).catch(() => {
      throw new HttpError(400, "This .docx file could not be read");
    });
    return result.value;
  }
  const text = data.toString("utf8").replace(/^﻿/, "");
  return extension === ".md" ? marked.parse(text, { async: false }) : textToHtml(text);
}

export async function fileToDocument(fileName: string, data: Buffer): Promise<{ title: string; content: JSONContent }> {
  const dot = fileName.lastIndexOf(".");
  const extension = IMPORT_EXTENSIONS.find((ext) => ext === fileName.slice(dot).toLowerCase());
  if (dot < 0 || !extension) throw new HttpError(415, "Only .txt, .md and .docx files can be imported");
  if (data.byteLength > IMPORT_MAX_BYTES) throw new HttpError(413, "Files must be 4 MB or smaller");
  // Parsing through the editor schema drops anything it cannot represent, including scripts and raw HTML.
  const content = generateJSON(await toHtml(extension, data), extensions);
  if (!contentSchema.safeParse(content).success) throw new HttpError(413, "This file is too large to edit as a document");
  const title = fileName.slice(0, dot).trim().slice(0, 200) || "Imported document";
  return { title, content };
}
