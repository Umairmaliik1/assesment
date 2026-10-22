import type { JSONContent } from "@tiptap/core";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { fileToDocument } from "../import";
import { attachmentHeader } from "./filename";
import { documentToMarkdown } from "./markdown";
import { documentToPdf } from "./pdf";

const text = (value: string, ...marks: string[]): JSONContent => ({ type: "text", text: value, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const item = (...content: JSONContent[]): JSONContent => ({ type: "listItem", content });

const richDoc: JSONContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [text("Launch plan")] },
    paragraph(text("Ship "), text("bold", "bold"), text(", "), text("italic", "italic"), text(" and "), text("underlined", "underline")),
    paragraph(text("Literal *stars* and <b>tags</b>")),
    { type: "bulletList", content: [item(paragraph(text("first")), { type: "bulletList", content: [item(paragraph(text("nested")))] }), item(paragraph(text("second")))] },
    { type: "orderedList", attrs: { start: 1 }, content: [item(paragraph(text("step one"))), item(paragraph(text("step two")))] },
    { type: "blockquote", content: [paragraph(text("quoted"))] },
  ],
};

describe("documentToMarkdown", () => {
  it("writes standard Markdown, with <u> for underline", () => {
    expect(documentToMarkdown(richDoc)).toBe(
      "# Launch plan\n\nShip **bold**, *italic* and <u>underlined</u>\n\nLiteral \\*stars\\* and &lt;b&gt;tags&lt;/b&gt;\n\n- first\n  - nested\n- second\n\n1. step one\n2. step two\n\n> quoted\n",
    );
  });

  it("round-trips through import without losing structure or formatting", async () => {
    const markdown = documentToMarkdown(richDoc);
    const { content } = await fileToDocument("roundtrip.md", Buffer.from(markdown));
    expect(documentToMarkdown(content)).toBe(markdown);
    expect(JSON.stringify(content)).toContain('"marks":[{"type":"underline"}]');
  });
});

describe("documentToPdf", () => {
  it("produces a valid multi-page PDF titled after the document", async () => {
    const long: JSONContent = { type: "doc", content: [...richDoc.content!, ...Array.from({ length: 120 }, (_, i) => paragraph(text(`Paragraph ${i} `.repeat(12))))] };
    const pdf = await PDFDocument.load(await documentToPdf("Launch plan", long));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toBe("Launch plan");
  });

  it("handles emoji, non-Latin scripts, unbreakable words, code and empty documents", async () => {
    const tricky: JSONContent = {
      type: "doc",
      content: [
        paragraph(text("Rocket 🚀 Привет Ελληνικά café")),
        paragraph(text("x".repeat(400))),
        paragraph(text("line"), { type: "hardBreak" }, text("break", "strike")),
        { type: "codeBlock", content: [text("const a = 1;\n\tindented();")] },
        { type: "horizontalRule" },
        paragraph(),
      ],
    };
    await expect(documentToPdf("Edge cases 🚀", tricky)).resolves.toBeInstanceOf(Uint8Array);
    const empty = await PDFDocument.load(await documentToPdf("Empty", { type: "doc", content: [paragraph()] }));
    expect(empty.getPageCount()).toBe(1);
  });
});

describe("attachmentHeader", () => {
  it("keeps the exact UTF-8 title and a safe ASCII fallback", () => {
    expect(attachmentHeader('Q4 "Plan" / 2026 🚀', "pdf")).toBe(
      "attachment; filename=\"Q4 Plan 2026 __.pdf\"; filename*=UTF-8''Q4%20Plan%202026%20%F0%9F%9A%80.pdf",
    );
    expect(attachmentHeader("   ", "md")).toBe("attachment; filename=\"document.md\"; filename*=UTF-8''document.md");
  });
});
