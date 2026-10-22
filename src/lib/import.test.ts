import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { fileToDocument } from "./import";
import { IMPORT_MAX_BYTES } from "./import-limits";

async function buildDocx(bodyXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("fileToDocument", () => {
  it("converts markdown structure and marks into editor nodes", async () => {
    const md = "# Plan\n\nShip **fast** and _safe_.\n\n- one\n- two\n\n1. first\n";
    const { title, content } = await fileToDocument("Q3 plan.md", Buffer.from(md));
    expect(title).toBe("Q3 plan");
    expect(content.content?.map((node) => node.type)).toEqual(["heading", "paragraph", "bulletList", "orderedList"]);
    expect(content.content?.[0].attrs?.level).toBe(1);
    const marks = content.content?.[1].content?.flatMap((node) => node.marks?.map((mark) => mark.type) ?? []);
    expect(marks).toEqual(["bold", "italic"]);
  });

  it("drops script tags and raw HTML that the editor cannot represent", async () => {
    const { content } = await fileToDocument("x.md", Buffer.from('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\nsafe'));
    expect(JSON.stringify(content)).not.toMatch(/alert|onerror|img/);
    expect(JSON.stringify(content)).toContain("safe");
  });

  it("splits plain text into paragraphs and escapes markup", async () => {
    const { content } = await fileToDocument("notes.TXT", Buffer.from("﻿line one\nline two\n\n<b>not bold</b>"));
    expect(content.content).toHaveLength(2);
    expect(content.content?.[0].content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);
    expect(content.content?.[1].content?.[0]).toEqual({ type: "text", text: "<b>not bold</b>" });
  });

  it("converts .docx headings and bold runs", async () => {
    const docx = await buildDocx(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold text</w:t></w:r></w:p>`,
    );
    const { content } = await fileToDocument("brief.docx", docx);
    expect(content.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(content.content?.[1].content?.[0]).toMatchObject({ text: "Bold text", marks: [{ type: "bold" }] });
  });

  it("rejects unsupported, corrupt and oversized files", async () => {
    await expect(fileToDocument("image.png", Buffer.from("x"))).rejects.toMatchObject({ status: 415 });
    await expect(fileToDocument("noextension", Buffer.from("x"))).rejects.toMatchObject({ status: 415 });
    await expect(fileToDocument("broken.docx", Buffer.from("not a zip"))).rejects.toMatchObject({ status: 400 });
    await expect(fileToDocument("big.txt", Buffer.alloc(IMPORT_MAX_BYTES + 1))).rejects.toMatchObject({ status: 413 });
  });

  it("rejects files that fit the upload limit but would be too large to save", async () => {
    const text = Buffer.from("lorem ipsum dolor sit amet\n\n".repeat(80_000));
    await expect(fileToDocument("long.txt", text)).rejects.toMatchObject({ status: 413 });
  });
});
