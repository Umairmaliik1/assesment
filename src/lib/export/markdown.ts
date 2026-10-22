import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import { extensions } from "../editor-extensions";

const manager = new MarkdownManager({ extensions });

export function documentToMarkdown(content: JSONContent): string {
  return `${manager.serialize(content).trim()}\n`;
}
