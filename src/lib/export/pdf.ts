import fontkit from "@pdf-lib/fontkit";
import type { JSONContent } from "@tiptap/core";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import subsetFont from "subset-font";

const FONT_FILES = {
  regular: "NotoSans-Regular.ttf",
  bold: "NotoSans-Bold.ttf",
  italic: "NotoSans-Italic.ttf",
  boldItalic: "NotoSans-BoldItalic.ttf",
};
type FontKey = keyof typeof FONT_FILES;
type Fonts = Record<FontKey, { font: PDFFont; glyphs: Set<number> }>;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const LINE_HEIGHT = 1.45;
const BODY_SIZE = 11;
const HEADING_SIZE: Record<number, number> = { 1: 22, 2: 17, 3: 14 };
const LIST_INDENT = 20;
const COLOR = { text: rgb(0.06, 0.09, 0.16), muted: rgb(0.4, 0.45, 0.52), rule: rgb(0.8, 0.83, 0.87), code: rgb(0.95, 0.96, 0.97) };

type Style = { font: FontKey; size: number; color: RGB; underline: boolean; strike: boolean };
type Piece = { text: string; style: Style };
type Segment = Piece & { width: number };
type Context = { x: number; color: RGB; quote: boolean };

// Characters the renderer adds itself: list markers and page numbers.
const LAYOUT_CHARACTERS = "•0123456789./ ";

// Font files are read once per server instance.
let fontBytes: Promise<Record<FontKey, Uint8Array>> | undefined;

function loadFontBytes() {
  return (fontBytes ??= Promise.all(
    Object.entries(FONT_FILES).map(async ([key, file]) => [key, await readFile(path.join(process.cwd(), "assets/fonts", file))]),
  ).then(Object.fromEntries));
}

class PdfWriter {
  private page!: PDFPage;
  private y = 0;
  private marker: string | null = null;

  constructor(
    private readonly pdf: PDFDocument,
    private readonly fonts: Fonts,
  ) {
    this.addPage();
  }

  private addPage() {
    this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) this.addPage();
  }

  space(height: number) {
    this.y -= height;
  }

  setMarker(marker: string) {
    this.marker = marker;
  }

  // Characters the font cannot draw (for example emoji) are dropped instead of rendering as empty boxes.
  private clean(text: string, font: FontKey) {
    const { glyphs } = this.fonts[font];
    return Array.from(text.replace(/\t/g, "    "))
      .filter((char) => glyphs.has(char.codePointAt(0)!))
      .join("");
  }

  private measure(text: string, style: Style) {
    return this.fonts[style.font].font.widthOfTextAtSize(text, style.size);
  }

  private wrap(pieces: Piece[], maxWidth: number): Segment[][] {
    const lines: Segment[][] = [[]];
    let width = 0;
    const push = (text: string, style: Style) => {
      const segmentWidth = this.measure(text, style);
      lines[lines.length - 1].push({ text, style, width: segmentWidth });
      width += segmentWidth;
    };
    const newLine = () => {
      const line = lines[lines.length - 1];
      if (line.at(-1)?.text === " ") line.pop();
      lines.push([]);
      width = 0;
    };
    for (const { text, style } of pieces) {
      if (text === "\n") {
        newLine();
        continue;
      }
      for (const token of this.clean(text, style.font).split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          if (width > 0) push(" ", style);
          continue;
        }
        const tokenWidth = this.measure(token, style);
        if (width > 0 && width + tokenWidth > maxWidth) newLine();
        if (tokenWidth <= maxWidth) {
          push(token, style);
          continue;
        }
        // Words longer than a whole line are split by character.
        let chunk = "";
        for (const char of Array.from(token)) {
          if (chunk && width + this.measure(chunk + char, style) > maxWidth) {
            push(chunk, style);
            newLine();
            chunk = "";
          }
          chunk += char;
        }
        if (chunk) push(chunk, style);
      }
    }
    return lines;
  }

  text(pieces: Piece[], ctx: Context, size: number, after: number) {
    const lines = this.wrap(pieces, PAGE_WIDTH - MARGIN - ctx.x);
    const lineHeight = size * LINE_HEIGHT;
    for (const line of lines) {
      this.ensure(lineHeight);
      const baseline = this.y - size * 1.1;
      if (ctx.quote) this.page.drawRectangle({ x: ctx.x - 12, y: this.y - lineHeight, width: 2.5, height: lineHeight, color: COLOR.rule });
      if (this.marker) {
        const style: Style = { font: "regular", size, color: ctx.color, underline: false, strike: false };
        const markerWidth = this.measure(this.marker, style);
        this.draw(this.marker, ctx.x - markerWidth - 6, baseline, style);
        this.marker = null;
      }
      let x = ctx.x;
      for (const segment of line) {
        this.draw(segment.text, x, baseline, segment.style);
        if (segment.style.underline) this.rule(x, baseline - size * 0.12, segment.width, size, segment.style.color);
        if (segment.style.strike) this.rule(x, baseline + size * 0.3, segment.width, size, segment.style.color);
        x += segment.width;
      }
      this.y -= lineHeight;
    }
    this.y -= after;
  }

  code(text: string, ctx: Context) {
    const size = BODY_SIZE - 1;
    const style: Style = { font: "regular", size, color: COLOR.text, underline: false, strike: false };
    const lineHeight = size * LINE_HEIGHT;
    const maxWidth = PAGE_WIDTH - MARGIN - ctx.x - 16;
    const rows = text
      .split("\n")
      .map((row) => this.clean(row, "regular"))
      .flatMap((row) => {
        const parts: string[] = [];
        let current = "";
        for (const char of Array.from(row)) {
          if (current && this.measure(current + char, style) > maxWidth) {
            parts.push(current);
            current = "";
          }
          current += char;
        }
        return [...parts, current];
      });
    for (const row of rows) {
      this.ensure(lineHeight);
      this.page.drawRectangle({ x: ctx.x, y: this.y - lineHeight, width: PAGE_WIDTH - MARGIN - ctx.x, height: lineHeight, color: COLOR.code });
      this.draw(row, ctx.x + 8, this.y - size * 1.1, style);
      this.y -= lineHeight;
    }
    this.y -= 8;
  }

  divider(ctx: Context) {
    this.ensure(18);
    this.page.drawLine({ start: { x: ctx.x, y: this.y - 9 }, end: { x: PAGE_WIDTH - MARGIN, y: this.y - 9 }, thickness: 0.75, color: COLOR.rule });
    this.y -= 18;
  }

  private draw(text: string, x: number, y: number, style: Style) {
    if (text) this.page.drawText(text, { x, y, size: style.size, font: this.fonts[style.font].font, color: style.color });
  }

  private rule(x: number, y: number, width: number, size: number, color: RGB) {
    this.page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: Math.max(0.5, size * 0.06), color });
  }

  numberPages() {
    const font = this.fonts.regular.font;
    const pages = this.pdf.getPages();
    pages.forEach((page, index) => {
      const label = `${index + 1} / ${pages.length}`;
      page.drawText(label, { x: (PAGE_WIDTH - font.widthOfTextAtSize(label, 9)) / 2, y: MARGIN / 2, size: 9, font, color: COLOR.muted });
    });
  }
}

function collectText(node: JSONContent): string {
  return (node.text ?? "") + (node.content ?? []).map(collectText).join("");
}

function inline(nodes: JSONContent[] = [], size: number, color: RGB, baseBold = false): Piece[] {
  return nodes.map((node) => {
    if (node.type === "hardBreak") return { text: "\n", style: { font: "regular", size, color, underline: false, strike: false } };
    const marks = new Set(node.marks?.map((mark) => mark.type));
    const bold = baseBold || marks.has("bold");
    const italic = marks.has("italic");
    return {
      text: node.text ?? "",
      style: {
        font: bold && italic ? "boldItalic" : bold ? "bold" : italic ? "italic" : "regular",
        size,
        color: marks.has("code") ? rgb(0.62, 0.12, 0.3) : color,
        underline: marks.has("underline"),
        strike: marks.has("strike"),
      },
    };
  });
}

function renderBlocks(writer: PdfWriter, nodes: JSONContent[] = [], ctx: Context, inList = false) {
  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        const size = HEADING_SIZE[node.attrs?.level] ?? BODY_SIZE;
        writer.space(size * 0.5);
        writer.text(inline(node.content, size, ctx.color, true), ctx, size, size * 0.3);
        break;
      }
      case "paragraph":
        writer.text(inline(node.content, BODY_SIZE, ctx.color), ctx, BODY_SIZE, inList ? 2 : 8);
        break;
      case "bulletList":
      case "orderedList": {
        const start = node.attrs?.start ?? 1;
        node.content?.forEach((item, index) => {
          writer.setMarker(node.type === "bulletList" ? "•" : `${start + index}.`);
          renderBlocks(writer, item.content, { ...ctx, x: ctx.x + LIST_INDENT }, true);
        });
        if (!inList) writer.space(6);
        break;
      }
      case "blockquote":
        renderBlocks(writer, node.content, { x: ctx.x + 16, color: COLOR.muted, quote: true }, inList);
        break;
      case "codeBlock":
        writer.code(node.content?.map((child) => child.text ?? "").join("") ?? "", ctx);
        break;
      case "horizontalRule":
        writer.divider(ctx);
        break;
      default:
        renderBlocks(writer, node.content, ctx, inList);
    }
  }
}

export async function documentToPdf(title: string, content: JSONContent): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(title);
  pdf.setCreator("Ajaia Docs");
  const bytes = await loadFontBytes();
  const characters = collectText(content) + LAYOUT_CHARACTERS;
  // pdf-lib's own subsetting drops glyphs from these fonts, so HarfBuzz trims each font to the document's characters first.
  const fonts = Object.fromEntries(
    await Promise.all(
      (Object.keys(FONT_FILES) as FontKey[]).map(async (key) => {
        const font = await pdf.embedFont(await subsetFont(Buffer.from(bytes[key]), characters, { targetFormat: "truetype" }));
        return [key, { font, glyphs: new Set(font.getCharacterSet()) }];
      }),
    ),
  ) as Fonts;
  const writer = new PdfWriter(pdf, fonts);
  renderBlocks(writer, content.content, { x: MARGIN, color: COLOR.text, quote: false });
  writer.numberPages();
  return pdf.save();
}
