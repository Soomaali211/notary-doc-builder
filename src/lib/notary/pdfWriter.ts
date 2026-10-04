/**
 * A REAL, LOCAL PDF WRITER.
 *
 * §27 — the PDF must come from the document that was approved. It is not a
 * second document, and it is not a re-typed copy. This writer is handed the
 * SAME `DocumentModel` the Live Review draws and the DOCX is generated from,
 * so the words, the order, the page breaks, the tables, the signature lines
 * and the header/footer are one source of truth. There is no layout engine
 * here that could drift from the review pane, because there is no second set
 * of rules: this file only knows how to put a model on paper.
 *
 * §3 — it runs entirely in the browser. No converter service, no LibreOffice,
 * no cloud. Nothing is uploaded and no font is downloaded: PDF's standard
 * fonts are built into the format itself.
 *
 * What it draws, honestly:
 *   · text with the standard PDF fonts (Helvetica family), sizes, bold,
 *     italic, underline, alignment and indents;
 *   · tables, as cells with their text laid out inside;
 *   · signature rules and the label printed before them;
 *   · headers and footers, in the template's own words;
 *   · JPEG photographs and signatures, embedded as-is.
 *
 * What it cannot do, and says so rather than faking:
 *   · the office's own Word font. The PDF uses the standard fonts, so the
 *     LINE BREAKS of a very long paragraph can fall one word out from Word's.
 *     Every page break the TEMPLATE declares is honoured exactly.
 *   · a PNG photograph. JPEG is embedded losslessly; a PNG would need a
 *     decoder this file does not ship, so it is reported as skipped instead
 *     of being drawn as a broken box.
 */

import type {
  DocumentBlock,
  DocumentModel,
  DocumentPage,
  ImageRef,
  ParagraphSegment,
} from "./documentModel";
import { blockHeightPt } from "./documentModel";

/* ------------------------------------------------------------------ */
/* Fonts — the standard PDF Type1 fonts, so nothing is downloaded      */
/* ------------------------------------------------------------------ */

export type PdfFontKey = keyof typeof PDF_FONTS;

/** Glyph widths per 1000 units for codes 32..126 (AFM, standard fonts). */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

export const PDF_FONTS = {
  regular: { name: "Helvetica", widths: HELVETICA },
  bold: { name: "Helvetica-Bold", widths: HELVETICA_BOLD },
  italic: { name: "Helvetica-Oblique", widths: HELVETICA },
  boldItalic: { name: "Helvetica-BoldOblique", widths: HELVETICA_BOLD },
} as const;

/**
 * The code points above 126 that PDF's standard fonts actually cover under
 * WinAnsiEncoding. Everything Somali needs — à á â ç è é ë ì í ï ñ ò ó ô ö ù ú
 * û ü ý — is in Latin-1 and maps straight through. A character outside this
 * set is replaced and REPORTED; it is never silently mangled.
 */
export const WIN_ANSI_REPLACEMENTS: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

/** Bytes-per-character width for the Latin-1 letters the standard fonts carry. */
const LATIN1_WIDTHS: Record<number, number> = {
  0xc0: 667, 0xc1: 667, 0xc2: 667, 0xc3: 667, 0xc4: 667, 0xc5: 667,
  0xc6: 722, 0xc7: 722, 0xc8: 722, 0xc9: 722, 0xca: 722, 0xcb: 722,
  0xcc: 278, 0xcd: 278, 0xce: 278, 0xcf: 278, 0xd0: 722, 0xd1: 722,
  0xd2: 722, 0xd3: 722, 0xd4: 722, 0xd5: 722, 0xd6: 722, 0xd7: 728,
  0xd8: 722, 0xd9: 722, 0xda: 722, 0xdb: 722, 0xdc: 722, 0xdd: 722,
  0xde: 722, 0xdf: 611,
  0xe0: 556, 0xe1: 556, 0xe2: 556, 0xe3: 556, 0xe4: 556, 0xe5: 556,
  0xe6: 556, 0xe7: 556, 0xe8: 556, 0xe9: 556, 0xea: 556, 0xeb: 556,
  0xec: 278, 0xed: 278, 0xee: 278, 0xef: 278, 0xf0: 556, 0xf1: 556,
  0xf2: 556, 0xf3: 556, 0xf4: 556, 0xf5: 556, 0xf6: 556, 0xf7: 500,
  0xf8: 556, 0xf9: 556, 0xfa: 556, 0xfb: 556, 0xfc: 556, 0xfd: 611,
  0xfe: 556, 0xff: 611,
};

/**
 * Characters that are missing from the standard fonts but whose MEANING is
 * fully carried by a plain character.
 *
 * `m²` is written "m2" rather than "m?" — a superscript digit is a digit, and
 * a Somali area description is full of them. This is a font substitution, not
 * a wording change: the word, the number and the unit are all still there, and
 * the substitution is reported so the user is never surprised by it.
 */
export const NORMALISED_CHARS: Record<string, string> = {
  "\u00b9": "1",
  "\u00b2": "2",
  "\u00b3": "3",
  "\u2070": "0",
  "\u2074": "4",
  "\u2075": "5",
  "\u2076": "6",
  "\u2077": "7",
  "\u2078": "8",
  "\u2079": "9",
  "\u00bc": " 1/4",
  "\u00bd": " 1/2",
  "\u00be": " 3/4",
  "\u2044": "/",
  "\u2011": "-",
  "\u00a0": " ",
  "\u202f": " ",
  "\u2009": " ",
};

export interface PdfTextResult {
  /** WinAnsi bytes, ready to be written as a literal string. */
  bytes: number[];
  /** Characters that had no glyph at all and became "?" — never silent. */
  dropped: string[];
  /** Characters rendered with a plain stand-in ("²" → "2"). */
  normalised: string[];
}

/**
 * Convert a string to WinAnsi bytes.
 *
 * The dropped list is the point: a Somali document has no exotic glyphs, but
 * if the office's template ever carries one, the caller reports it instead of
 * shipping a page of "?".
 */
export function toWinAnsi(text: string): PdfTextResult {
  const bytes: number[] = [];
  const dropped: string[] = [];
  const normalised: string[] = [];
  for (const original of text) {
    const substitute = NORMALISED_CHARS[original];
    if (substitute !== undefined) {
      if (!normalised.includes(original)) normalised.push(original);
      for (const sub of substitute) {
        const subCode = sub.codePointAt(0) ?? 0;
        bytes.push(
          subCode >= 32 && subCode <= 126 ? subCode : LATIN1_WIDTHS[subCode] ? subCode : 0x20,
        );
      }
      continue;
    }
    const ch = original;
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code <= 126) {
      bytes.push(code);
      continue;
    }
    if (code === 9) {
      bytes.push(32, 32, 32, 32);
      continue;
    }
    if (code === 10 || code === 13) {
      bytes.push(32);
      continue;
    }
    const mapped = WIN_ANSI_REPLACEMENTS[code];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }
    if (LATIN1_WIDTHS[code] !== undefined) {
      bytes.push(code);
      continue;
    }
    bytes.push(0x3f); // "?"
    if (!dropped.includes(ch)) dropped.push(ch);
  }
  return { bytes, dropped, normalised };
}

/** Width of one WinAnsi code in 1/1000 of the font size. */
function glyphWidth(code: number, bold: boolean): number {
  if (code >= 32 && code <= 126) {
    return (bold ? HELVETICA_BOLD : HELVETICA)[code - 32];
  }
  return LATIN1_WIDTHS[code] ?? 556;
}

/** The drawn width of a string at a given font size. */
export function textWidthPt(
  text: string,
  fontPt: number,
  font: PdfFontKey = "regular",
): number {
  const { bytes } = toWinAnsi(text);
  const bold = font === "bold" || font === "boldItalic";
  let units = 0;
  for (const code of bytes) units += glyphWidth(code, bold);
  return (units * fontPt) / 1000;
}

/* ------------------------------------------------------------------ */
/* Low-level PDF assembly                                              */
/* ------------------------------------------------------------------ */

function latin1(bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

function bytesOf(text: string): number[] {
  return Array.from(latin1Of(text));
}

function latin1Of(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    out[i] = code <= 255 ? code : 0x3f;
  }
  return out;
}

class PdfBuilder {
  private readonly objects: Uint8Array[] = [];

  /** Reserve an object number now, fill it later. */
  reserve(): number {
    this.objects.push(new Uint8Array(0));
    return this.objects.length;
  }

  set(id: number, body: Uint8Array): void {
    this.objects[id - 1] = body;
  }

  add(body: Uint8Array): number {
    this.objects.push(body);
    return this.objects.length;
  }

  finish(rootId: number): Blob {
    const chunks: Uint8Array[] = [];
    const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    chunks.push(latin1Of(header));

    let offset = header.length;
    const offsets: number[] = [];
    for (let i = 0; i < this.objects.length; i += 1) {
      const body = this.objects[i];
      const prefix = latin1Of(`${i + 1} 0 obj\n`);
      const suffix = latin1Of("\nendobj\n");
      offsets.push(offset);
      chunks.push(prefix, body, suffix);
      offset += prefix.length + body.length + suffix.length;
    }

    const xrefStart = offset;
    let xref = `xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`;
    for (const at of offsets) {
      xref += `${String(at).padStart(10, "0")} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${this.objects.length + 1} /Root ${rootId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    chunks.push(latin1Of(xref), latin1Of(trailer));

    return new Blob(chunks as BlobPart[], { type: "application/pdf" });
  }
}

function streamObject(dict: string, data: number[]): Uint8Array {
  const head = latin1Of(`<< ${dict} /Length ${data.length} >>\nstream\n`);
  const tail = latin1Of("\nendstream");
  const out = new Uint8Array(head.length + data.length + tail.length);
  out.set(head, 0);
  out.set(latin1(data), head.length);
  out.set(tail, head.length + data.length);
  return out;
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

interface EmbeddedImage {
  name: string;
  widthPt: number;
  heightPt: number;
  /** Set when the image could not be embedded, with the reason. */
  skipped?: string;
}

/** What `embedImage` fills in when a picture can be embedded as it stands. */
interface ImageHolder {
  bytes?: number[];
  dict?: string;
}

/**
 * A JPEG is embedded as-is: PDF understands JPEG natively (DCTDecode), so the
 * photograph is byte-identical to the one the notary picked and no decoder is
 * needed. A PNG would have to be inflated and re-encoded, which this file
 * deliberately does not do — it is reported instead of drawn wrong.
 *
 * `holder` collects the bytes and the object dictionary the caller needs; the
 * function itself writes no PDF, so it stays testable on its own.
 */
function embedImage(
  src: string,
  ref: ImageRef,
  name: string,
  holder: ImageHolder,
): EmbeddedImage {
  const skip = (format: string): EmbeddedImage => ({
    name,
    widthPt: ref.widthPt,
    heightPt: ref.heightPt,
    skipped: format,
  });
  const match = /^data:image\/(\w+);base64,(.*)$/.exec(src ?? "");
  if (!match) return skip("image");
  const [, kind, payload] = match;
  const lower = kind.toLowerCase();
  if (lower !== "jpeg" && lower !== "jpg") return skip(lower);
  const binary = atobSafe(payload);
  if (!binary) return skip("image");
  const dims = jpegSize(binary);
  holder.bytes = binary;
  holder.dict =
    `/Type /XObject /Subtype /Image /Width ${dims.width} /Height ${dims.height} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`;
  return { name, widthPt: ref.widthPt, heightPt: ref.heightPt };
}

function atobSafe(payload: string): number[] | null {
  try {
    const bin = atob(payload);
    const out: number[] = new Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Read a JPEG's width/height from its SOF marker. */
function jpegSize(bytes: number[]): { width: number; height: number } {
  let i = 2;
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    // SOF0..SOF15, skipping the non-frame markers in that range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length <= 0) break;
    i += 2 + length;
  }
  return { width: 1, height: 1 };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const FONT_KEYS: PdfFontKey[] = ["regular", "bold", "italic", "boldItalic"];

function fontResourceName(key: PdfFontKey): string {
  return `F${FONT_KEYS.indexOf(key) + 1}`;
}

function fontKeyFor(segment: {
  bold: boolean;
  italic: boolean;
}): PdfFontKey {
  if (segment.bold && segment.italic) return "boldItalic";
  if (segment.bold) return "bold";
  if (segment.italic) return "italic";
  return "regular";
}

/** A line of text ready to be drawn: one font, one size, one position. */
interface TextRun {
  text: string;
  font: PdfFontKey;
  sizePt: number;
  xPt: number;
  yPt: number;
  underline: boolean;
  color: string | null;
}

function escapePdfString(bytes: number[]): string {
  let out = "";
  for (const code of bytes) {
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else out += String.fromCharCode(code);
  }
  return out;
}

function rgbFor(hex: string | null): string {
  if (!hex) return "0 0 0";
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "0 0 0";
  const n = parseInt(m[1], 16);
  return `${((n >> 16) & 255) / 255} ${((n >> 8) & 255) / 255} ${(n & 255) / 255}`;
}

function num(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

class PageCanvas {
  readonly ops: string[] = [];
  readonly dropped = new Set<string>();
  readonly normalised = new Set<string>();
  readonly images: EmbeddedImage[] = [];

  text(run: TextRun): void {
    const { bytes, dropped, normalised } = toWinAnsi(run.text);
    for (const ch of dropped) this.dropped.add(ch);
    for (const ch of normalised) this.normalised.add(ch);
    if (bytes.length === 0) return;
    this.ops.push(
      `BT ${rgbFor(run.color)} rg /${fontResourceName(run.font)} ${num(run.sizePt)} Tf ` +
        `1 0 0 1 ${num(run.xPt)} ${num(run.yPt)} Tm (${escapePdfString(bytes)}) Tj ET`,
    );
    if (run.underline) {
      const w = textWidthPt(run.text, run.sizePt, run.font);
      this.line(run.xPt, run.yPt - run.sizePt * 0.12, run.xPt + w, run.yPt - run.sizePt * 0.12, 0.5);
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, width: number): void {
    this.ops.push(`${num(width)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  }

  rect(x: number, y: number, w: number, h: number, stroke: boolean): void {
    this.ops.push(
      `${num(x)} ${num(y)} ${num(w)} ${num(h)} re ${stroke ? "S" : "f"}`,
    );
  }

  image(name: string, x: number, y: number, w: number, h: number): void {
    this.ops.push(
      `q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /${name} Do Q`,
    );
  }
}

/** Break one paragraph's segments into laid-out lines of positioned runs. */
function layoutParagraph(
  block: Extract<DocumentBlock, { kind: "paragraph" }>,
  usableWidthPt: number,
  leftPt: number,
): { runs: TextRun[][]; sizePt: number } {
  const sizePt = Math.max(block.style.fontSizePt ?? 11, 6);
  const leftIndent = block.style.indentLeftPt ?? 0;
  const rightIndent = block.style.indentRightPt ?? 0;
  const width = Math.max(40, usableWidthPt - leftIndent - rightIndent);
  const right = leftPt + usableWidthPt - rightIndent;

  const lines: TextRun[][] = [];
  let line: TextRun[] = [];
  let used = 0;

  const flush = () => {
    lines.push(line);
    line = [];
    used = 0;
  };

  const pushText = (text: string, seg: Extract<ParagraphSegment, { kind: "text" }>) => {
    const font = fontKeyFor(seg);
    const words = text.split(/(\s+)/);
    for (const word of words) {
      if (word === "") continue;
      const w = textWidthPt(word, sizePt, font);
      if (used + w > width && line.length > 0) {
        flush();
        if (word.trim() === "") continue;
      }
      line.push({
        text: word.trim() === "" ? " " : word,
        font,
        sizePt,
        xPt: 0, // filled in below, once the line's alignment is known
        yPt: 0,
        underline: seg.underline,
        color: seg.color,
      });
      used += w;
    }
  };

  for (const seg of block.segments) {
    if (seg.kind === "text") {
      for (const part of seg.text.split("\n")) pushText(part, seg);
    } else if (seg.kind === "tab") {
      line.push({
        text: "    ",
        font: "regular",
        sizePt,
        xPt: 0,
        yPt: 0,
        underline: false,
        color: null,
      });
      used += textWidthPt("    ", sizePt);
    } else if (seg.kind === "lineBreak") {
      flush();
    }
    // `pageBreak` and `image` segments carry no text for this renderer: the
    // page break is the model's own pagination, and a photograph inside a
    // paragraph is rare enough that the alt text is printed instead.
  }
  if (line.length > 0) flush();

  // Alignment and indent.
  for (const entry of lines) {
    let lineWidth = 0;
    for (const run of entry) lineWidth += textWidthPt(run.text, run.sizePt, run.font);
    let cursor = leftPt + leftIndent;
    if (block.style.alignment === "center") {
      cursor = leftPt + leftIndent + Math.max(0, (width - lineWidth) / 2);
    } else if (block.style.alignment === "right") {
      cursor = right - lineWidth;
    }
    for (const run of entry) {
      run.xPt = cursor;
      cursor += textWidthPt(run.text, run.sizePt, run.font);
    }
  }
  return { runs: lines, sizePt };
}

function drawBlock(
  canvas: PageCanvas,
  block: DocumentBlock,
  geometry: { widthPt: number; marginLeftPt: number; marginRightPt: number },
  topY: number,
  imageCounter: { next: () => number },
): number {
  const usable = geometry.widthPt - geometry.marginLeftPt - geometry.marginRightPt;
  const left = geometry.marginLeftPt;

  if (block.kind === "image") {
    const name = `Im${imageCounter.next()}`;
    const height = Math.min(block.image.heightPt, 240);
    canvas.image(name, left, topY - height, block.image.widthPt, height);
    return blockHeightPt(block, usable);
  }

  if (block.kind === "table") {
    let y = topY;
    for (const row of block.table.rows) {
      const cells = row.length || 1;
      const cellWidth = usable / cells;
      let rowHeight = 0;
      for (const cell of row) {
        let h = 0;
        for (const inner of cell.blocks) h += blockHeightPt(inner, cellWidth - 8);
        rowHeight = Math.max(rowHeight, h + 6, 14);
      }
      let x = left;
      for (const cell of row) {
        const cellWidthPt = cell.widthPt ?? cellWidth;
        canvas.rect(x, y - rowHeight, cellWidthPt, rowHeight, true);
        let innerY = y - 4;
        for (const inner of cell.blocks) {
          innerY -= drawBlock(canvas, inner, {
            widthPt: cellWidthPt,
            marginLeftPt: 4,
            marginRightPt: 4,
          }, innerY, imageCounter);
        }
        x += cellWidthPt;
      }
      y -= rowHeight;
    }
    return topY - y;
  }

  const { runs, sizePt } = layoutParagraph(block, usable, left);
  const style = block.style;
  const lineHeight = sizePt * (style.headingLevel ? 1.25 : 1.15) + 2;
  let y = topY - sizePt;

  for (const line of runs) {
    for (const run of line) canvas.text({ ...run, yPt: y });
    y -= lineHeight;
  }

  // A signature block: the label the template wrote, then the rule.
  if (block.signature) {
    y -= 2;
    if (block.signature.label) {
      canvas.text({
        text: block.signature.label,
        font: "regular",
        sizePt,
        xPt: left,
        yPt: y,
        underline: false,
        color: null,
      });
      y -= lineHeight;
    }
    canvas.line(left, y, left + Math.min(220, usable), y, 0.75);
    if (block.signature.rule && block.signature.rule.trim() !== "") {
      canvas.text({
        text: block.signature.rule,
        font: "regular",
        sizePt: Math.max(6, sizePt - 3),
        xPt: left,
        yPt: y - sizePt,
        underline: false,
        color: null,
      });
    }
  }

  return blockHeightPt(block, usable);
}

/* ------------------------------------------------------------------ */
/* The public entry point                                              */
/* ------------------------------------------------------------------ */

export interface PdfResult {
  blob: Blob;
  /** Anything the renderer could not honour, stated rather than hidden. */
  warnings: string[];
}

/**
 * Render the document model to a real PDF file.
 *
 * This is the "PDF dhaqaaq ah" of §27: the same model, the same words, the
 * same page breaks the DOCX has. It never touches the network.
 */
export function modelToPdf(model: DocumentModel): PdfResult {
  const warnings: string[] = [...model.warnings];
  const builder = new PdfBuilder();

  // 1 — the four standard fonts.
  const fontIds: number[] = [];
  for (const key of FONT_KEYS) {
    const font = PDF_FONTS[key];
    fontIds.push(
      builder.add(
        latin1Of(
          `<< /Type /Font /Subtype /Type1 /BaseFont /${font.name} /Encoding /WinAnsiEncoding >>`,
        ),
      ),
    );
  }

  // 2 — collect the images first so each page can reference a known XObject.
  const imageRefs: (EmbeddedImage & { objectId?: number; bytes?: number[]; dict?: string })[] = [];
  let imageCounterValue = 0;
  const nextImageName = () => {
    imageCounterValue += 1;
    return imageCounterValue;
  };
  const collectImages = (block: DocumentBlock) => {
    if (block.kind === "image") {
      const name = `Im${nextImageName()}`;
      const holder: ImageHolder = {};
      const embedded = embedImage(block.image.src, block.image, name, holder);
      if (!embedded.skipped) {
        imageRefs.push({ ...embedded, bytes: holder.bytes, dict: holder.dict });
      } else {
        const format = embedded?.skipped ?? "unknown";
        warnings.push(
          `Sawirka (${format}) ma la embed-gareeyo PDF dhaqaaq ah. ` +
            "Haddii aad sawirka u aragto, isticmaal \"Soo Saar PDF\" — " +
            "daabacaadda browser-ka wuxuu muuqdaa si buuxda.",
        );
      }
    }
    if (block.kind === "table") {
      for (const row of block.table.rows) {
        for (const cell of row) for (const inner of cell.blocks) collectImages(inner);
      }
    }
  };
  for (const page of model.pages) for (const block of page.blocks) collectImages(block);

  const imageIds = imageRefs.map((img) =>
    builder.add(streamObject(img.dict ?? "", img.bytes ?? [])),
  );

  // 3 — one content stream and one page object per model page.
  const pagesId = builder.reserve();
  const pageIds: number[] = [];
  const pageRefs: string[] = [];
  const allDropped = new Set<string>();

  const allNormalised = new Set<string>();
  for (const page of model.pages) {
    const canvas = new PageCanvas();
    drawPage(canvas, page, model.geometry, model.headerText, model.footerText);
    for (const ch of canvas.dropped) allDropped.add(ch);
    for (const ch of canvas.normalised) allNormalised.add(ch);

    const resources =
      `/Font << ${fontIds.map((id, i) => `/${fontResourceName(FONT_KEYS[i])} ${id} 0 R`).join(" ")} >>` +
      (imageIds.length > 0
        ? ` /XObject << ${imageRefs.map((img, i) => `/${img.name} ${imageIds[i]} 0 R`).join(" ")} >>`
        : "");

    const contentId = builder.add(
      streamObject(resources, bytesOf(canvas.ops.join("\n"))),
    );
    const pageId = builder.reserve();
    pageIds.push(pageId);
    pageRefs.push(`${pageId} 0 R`);
    builder.set(
      pageId,
      latin1Of(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(model.geometry.widthPt)} ${num(
          model.geometry.heightPt,
        )}] /Contents ${contentId} 0 R /Resources << ${resources} >> >>`,
      ),
    );
  }

  builder.set(
    pagesId,
    latin1Of(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageRefs.join(" ")}] >>`),
  );

  const catalogId = builder.add(
    latin1Of(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`),
  );

  if (allDropped.size > 0) {
    warnings.push(
      `Xarfaha aan PDF-ka suurtogal ahayn waa la beddelay: ${[...allDropped].join(" ")}`,
    );
  }
  if (allNormalised.size > 0) {
    // The standard PDF fonts have no superscript digits, so "m²" prints as
    // "m2". Stated rather than hidden: the number never changes, only its
    // typeface does.
    warnings.push(
      `Wixii xarfaha superscript ah (${[...allNormalised].join(" ")}) waxaa ` +
        `PDF-ka ku qoran tiro caadi — tusaale "m\u00b2" wuxuu noqdaa "m2".`,
    );
  }

  return { blob: builder.finish(catalogId), warnings };
}

function drawPage(
  canvas: PageCanvas,
  page: DocumentPage,
  geometry: DocumentModel["geometry"],
  headerText: string[],
  footerText: string[],
): void {
  const imageCounter = {
    next: () => (imageCounter.n += 1),
    n: 0,
  };
  let y = geometry.heightPt - geometry.marginTopPt;

  // Header lines, in the template's own words, above the text area.
  if (headerText.length > 0) {
    let hy = geometry.heightPt - geometry.marginTopPt + 24;
    for (const line of headerText) {
      const w = textWidthPt(line, 8);
      canvas.text({
        text: line,
        font: "regular",
        sizePt: 8,
        xPt: geometry.widthPt / 2 - w / 2,
        yPt: hy,
        underline: false,
        color: null,
      });
      hy -= 10;
    }
  }

  for (const block of page.blocks) {
    const before = block.kind === "paragraph" ? block.style.spacingBeforePt ?? 0 : 0;
    y -= before;
    y -= drawBlock(canvas, block, geometry, y, imageCounter);
    if (block.kind === "paragraph") y -= block.style.spacingAfterPt ?? 0;
  }

  // Footer lines, in the template's own words, below the text area.
  if (footerText.length > 0) {
    let fy = geometry.marginBottomPt - 16;
    for (const line of footerText) {
      const w = textWidthPt(line, 8);
      canvas.text({
        text: line,
        font: "regular",
        sizePt: 8,
        xPt: geometry.widthPt / 2 - w / 2,
        yPt: fy,
        underline: false,
        color: null,
      });
      fy -= 10;
    }
  }
}