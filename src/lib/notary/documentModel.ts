/**
 * Universal Document Model — ONE renderer for every document type.
 *
 * The notary office owns the Word template. This module never designs or
 * restyles it: it runs the SAME resolution pipeline the DOCX export runs
 * (`processDocumentXml` — repeat blocks, `{{IF:}}` sections, clause lines,
 * placeholders, clause numbering) and then READS the resolved
 * `word/document.xml` back into a structured model:
 *
 *   paragraphs (alignment, bold/italic/underline, size, spacing, indents,
 *               tabs, line breaks, numbered clauses)
 *   tables (rows × cells × nested paragraphs)
 *   images (media parts → data URLs, real dimensions)
 *   signature lines (underscore / ruled paragraphs)
 *   explicit page breaks + estimated pagination from the template's own
 *   `sectPr` page size and margins
 *   headers / footers
 *
 * Everything downstream — Live Review, Print, PDF-by-print — consumes this one
 * model, so Preview ≈ DOCX ≈ PDF by construction: same data, same template,
 * same placeholder and conditional logic. There is no per-document-type branch
 * anywhere in this file: a new document type works by adding a config.
 *
 * LIVE-SAFE: the live path must never throw because a form is unfinished.
 * `buildDocumentModel` catches resolver failures and returns a model carrying
 * the message, so the pane can show it instead of crashing.
 */

import JSZip from "jszip";
import type { DocumentConfig, FormValues } from "./types";
import { buildDataContext } from "./dataContext";
import { resolveClauses } from "./clauses";
import { processDocumentXml } from "./docxRenderer";
import { composeReferenceNumber } from "./referenceNumber";
import { resolveKey } from "./format";
import { stripSkipMarkers } from "./formValues";

/* ------------------------------------------------------------------ */
/* Model types                                                         */
/* ------------------------------------------------------------------ */

export type Alignment = "left" | "center" | "right" | "justify";

export interface ParagraphStyle {
  alignment: Alignment;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** Resolved font size in points, or null when the template defers to the style. */
  fontSizePt: number | null;
  spacingBeforePt: number | null;
  spacingAfterPt: number | null;
  /** 0 = body, 1–6 = Word heading level, 6 = subtitle, 7 = document title. */
  headingLevel: number;
  indentLeftPt: number | null;
  indentRightPt: number | null;
  /** The paragraph is a numbered list item (w:numPr) or carries {{CLAUSE_NO}}. */
  numbered: boolean;
}

export interface ImageRef {
  /** data: URL built from the package media part — no network needed. */
  src: string;
  altText: string;
  widthPt: number;
  heightPt: number;
}

export interface SignatureLine {
  /** Text printed before the rule, e.g. "Saxeexa Damiinka:". */
  label: string;
  /** The literal rule characters as written in the template. */
  rule: string;
}

export type ParagraphSegment =
  | {
      kind: "text";
      text: string;
      bold: boolean;
      italic: boolean;
      underline: boolean;
      fontSizePt: number | null;
      color: string | null;
    }
  | { kind: "tab" }
  | { kind: "lineBreak" }
  | { kind: "pageBreak" }
  | { kind: "image"; image: ImageRef };

export interface TableCell {
  blocks: DocumentBlock[];
  /** Cell width in points when the template declares one. */
  widthPt: number | null;
}

export interface TableBlock {
  rows: TableCell[][];
}

export type DocumentBlock =
  | {
      kind: "paragraph";
      segments: ParagraphSegment[];
      text: string;
      style: ParagraphStyle;
      signature: SignatureLine | null;
      /** The template itself starts a new page here. */
      pageBreakBefore: boolean;
      /** The template itself ends the page here. */
      pageBreakAfter: boolean;
    }
  | { kind: "table"; table: TableBlock }
  | { kind: "image"; image: ImageRef; style: ParagraphStyle };

export interface PageGeometry {
  widthPt: number;
  heightPt: number;
  marginTopPt: number;
  marginRightPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
}

export interface DocumentPage {
  index: number;
  blocks: DocumentBlock[];
}

export interface DocumentModel {
  /** Config id, e.g. "heshiis_kiro" / "kala_iiibsi_hanti". */
  documentType: string;
  documentTypeTitle: string;
  subTypeLabel: string | null;
  templateId: string | null;
  pages: DocumentPage[];
  geometry: PageGeometry;
  headerText: string[];
  footerText: string[];
  warnings: string[];
  /** Set when the template itself could not be opened. */
  error: string | null;
  /**
   * Page count is exact where the template declares breaks; beyond that it is
   * estimated from the template's own page size, margins and font sizes.
   * Word's own line breaker may still differ by a line.
   */
  pagination: "template-breaks+estimated";
}

export interface BuildModelInput {
  config: DocumentConfig;
  values: FormValues;
  /** Bytes of the OFFICIAL template chosen through the registry. */
  templateBytes: ArrayBuffer;
  /** The reference the document will print (composed exactly like export). */
  referenceNumber?: string;
  subTypeLabel?: string;
  templateId?: string;
}

/* ------------------------------------------------------------------ */
/* Small XML helpers                                                   */
/* ------------------------------------------------------------------ */

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function num(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** twips → points (1 pt = 20 twips). */
function pt(twips: number | null): number | null {
  return twips == null ? null : twips / 20;
}

/** EMU → points (1 pt = 12700 EMU). */
function emuToPt(emu: number | null): number | null {
  return emu == null ? null : emu / 12700;
}

function attr(tag: string | undefined | null, name: string): string | null {
  if (!tag) return null;
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

/** Plain visible text of a fragment. */
export function xmlText(fragment: string): string {
  const parts: string[] = [];
  for (const m of fragment.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)) parts.push(m[1]);
  return decodeEntities(parts.join(""));
}

/* ------------------------------------------------------------------ */
/* Depth-aware element scanner                                         */
/* ------------------------------------------------------------------ */

/**
 * Given the index of an opening tag (`<w:p…`), return the end index (exclusive)
 * of its matching close tag. Handles nesting, so a table inside a table cell
 * or a paragraph inside a text box never truncates a block.
 */
function matchElement(xml: string, start: number, tag: string): number {
  const open = new RegExp(`<${tag}\\b[^>]*>`, "g");
  const close = `</${tag}>`;
  const selfClosing = new RegExp(`<${tag}\\b[^>]*/>`, "g");
  const firstHead = /<w:[a-zA-Z]+\b[^>]*>/.exec(xml.slice(start));
  if (!firstHead) return xml.length;
  if (firstHead[0].endsWith("/>")) return start + firstHead[0].length;

  let depth = 1;
  let cursor = start + firstHead[0].length;
  while (cursor < xml.length) {
    open.lastIndex = cursor;
    selfClosing.lastIndex = cursor;
    const nextOpen = open.exec(xml);
    const nextSelfClose = selfClosing.exec(xml);
    const nextOpenAt =
      nextOpen && (!nextSelfClose || nextOpen.index < nextSelfClose.index)
        ? nextOpen.index
        : Number.POSITIVE_INFINITY;
    const closeAt = xml.indexOf(close, cursor);
    if (closeAt === -1) return xml.length;
    if (nextOpenAt < closeAt) {
      depth++;
      cursor = nextOpenAt + nextOpen![0].length;
      continue;
    }
    depth--;
    if (depth === 0) return closeAt + close.length;
    cursor = closeAt + close.length;
  }
  return xml.length;
}

type RawBlock = { kind: "p" | "tbl" | "sectPr"; xml: string };

/** Split `<w:body>` content into ordered top-level paragraphs and tables. */
function splitBody(body: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  let pos = 0;
  while (pos < body.length) {
    const next = /<w:(p|tbl|sectPr)\b/.exec(body.slice(pos));
    if (!next) break;
    const kind = next[1] as RawBlock["kind"];
    const start = pos + next.index;
    const end = matchElement(body, start, `w:${kind}`);
    blocks.push({ kind, xml: body.slice(start, end) });
    pos = end;
  }
  return blocks;
}

function splitByTag(xml: string, tag: string): string[] {
  const out: string[] = [];
  let pos = 0;
  while (pos < xml.length) {
    const start = xml.indexOf(`<${tag}`, pos);
    if (start === -1) break;
    const end = matchElement(xml, start, tag);
    out.push(xml.slice(start, end));
    pos = end;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

const MEDIA_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  webp: "image/webp",
};

type ImageResolver = (drawing: string) => Promise<ImageRef | null>;

async function buildImageResolver(
  zip: JSZip,
  warnings: string[],
): Promise<ImageResolver> {
  const rels: Record<string, string> = {};
  const relXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
  if (relXml) {
    for (const m of relXml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
      const id = attr(m[0], "Id");
      const target = attr(m[0], "Target");
      if (id && target) rels[id] = target;
    }
  }
  const cache = new Map<string, ImageRef | null>();
  return async (drawing: string) => {
    const embed = /r:embed="([^"]+)"/.exec(drawing)?.[1];
    if (!embed) return null;
    const target = rels[embed];
    if (!target) return null;
    if (cache.has(target)) return cache.get(target) ?? null;
    const name = target.replace(/^\.\.\//, "").replace(/^\//, "");
    const path = name.startsWith("word/") ? name : `word/${name}`;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime = MEDIA_MIME[ext];
    const file = zip.file(path);
    if (!mime || !file) {
      warnings.push(
        `Sawir "${path}" (${ext || "nooc lama garanay"}) ma render gareeyo preview-ga.`,
      );
      cache.set(target, null);
      return null;
    }
    let base64: string;
    try {
      base64 = await file.async("base64");
    } catch {
      cache.set(target, null);
      return null;
    }
    const image: ImageRef = {
      src: `data:${mime};base64,${base64}`,
      altText: decodeEntities(attr(drawing, "descr") ?? attr(drawing, "name") ?? "Sawir"),
      widthPt: emuToPt(num(/cx="(\d+)"/.exec(drawing)?.[1])) ?? 200,
      heightPt: emuToPt(num(/cy="(\d+)"/.exec(drawing)?.[1])) ?? 150,
    };
    cache.set(target, image);
    return image;
  };
}

/* ------------------------------------------------------------------ */
/* Paragraph parsing                                                   */
/* ------------------------------------------------------------------ */

const EMPTY_STYLE: ParagraphStyle = {
  alignment: "left",
  bold: false,
  italic: false,
  underline: false,
  fontSizePt: null,
  spacingBeforePt: null,
  spacingAfterPt: null,
  headingLevel: 0,
  indentLeftPt: null,
  indentRightPt: null,
  numbered: false,
};

function headingLevelOf(styleId: string | null): number {
  if (!styleId) return 0;
  const s = styleId.toLowerCase();
  const m = /heading\s*([1-6])/.exec(s);
  if (m) return Number(m[1]);
  if (s === "title" || s === "documenttitle") return 7;
  if (s === "subtitle") return 6;
  return 0;
}

function alignmentOf(jc: string | null): Alignment {
  switch ((jc ?? "").toLowerCase()) {
    case "center":
      return "center";
    case "right":
    case "end":
      return "right";
    case "both":
    case "justify":
    case "distribute":
      return "justify";
    default:
      return "left";
  }
}

/** Underlined / underscored rules are where a party signs. */
function signatureOf(text: string, underlined: boolean): SignatureLine | null {
  const ruleMatch = /_{3,}/.exec(text);
  if (ruleMatch) {
    return { label: text.slice(0, ruleMatch.index).trim(), rule: ruleMatch[0] };
  }
  if (underlined && text.trim() === "") {
    return { label: "", rule: "" };
  }
  return null;
}

interface RunProps {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSizePt: number | null;
  color: string | null;
}

function parseRunProps(rpr: string | null): RunProps {
  const p: RunProps = {
    bold: false,
    italic: false,
    underline: false,
    fontSizePt: null,
    color: null,
  };
  if (!rpr) return p;
  if (/<w:b\s*\/>/.test(rpr) || /<w:b\b(?![a-zA-Z])[^>]*>/.test(rpr)) p.bold = true;
  if (/<w:i\s*\/>/.test(rpr) || /<w:i\b(?![a-zA-Z])[^>]*>/.test(rpr)) p.italic = true;
  const u = /<w:u\b[^>]*\/?>/.exec(rpr);
  if (u && !/w:val="none"/.test(u[0])) p.underline = true;
  const sz = /<w:sz\b[^>]*w:val="(\d+)"/.exec(rpr);
  if (sz) p.fontSizePt = Number(sz[1]) / 2;
  const color = /<w:color\b[^>]*w:val="([0-9A-Fa-f]{6})"/.exec(rpr);
  if (color) p.color = `#${color[1]}`;
  return p;
}

const PIECE_RE =
  /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b([^>]*)\/>|<w:drawing\b[\s\S]*?<\/w:drawing>|<w:pict\b[\s\S]*?<\/w:pict>/g;

async function parseParagraph(
  xml: string,
  resolveImage: ImageResolver,
  warn: (message: string) => void,
): Promise<DocumentBlock> {
  const ppr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(xml)?.[1] ?? "";
  const style: ParagraphStyle = { ...EMPTY_STYLE };
  style.alignment = alignmentOf(attr(/<w:jc\b[^>]*\/?>/.exec(ppr)?.[0], "w:val"));
  style.headingLevel = headingLevelOf(attr(/<w:pStyle\b[^>]*\/?>/.exec(ppr)?.[0], "w:val"));
  const spacingTag = /<w:spacing\b[^>]*\/?>/.exec(ppr)?.[0];
  style.spacingBeforePt = pt(num(attr(spacingTag, "w:before")));
  style.spacingAfterPt = pt(num(attr(spacingTag, "w:after")));
  const indTag = /<w:ind\b[^>]*\/?>/.exec(ppr)?.[0];
  style.indentLeftPt = pt(num(attr(indTag, "w:left")));
  style.indentRightPt = pt(num(attr(indTag, "w:right")));
  style.numbered = /<w:numPr>/.test(ppr);

  const segments: ParagraphSegment[] = [];
  let onlyUnderline = true;
  for (const run of xml.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>|<w:r\b[^>]*\/>/g)) {
    const body = run[1] ?? "";
    const props = parseRunProps(/<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(body)?.[1] ?? null);
    if (props.bold) style.bold = true;
    if (props.italic) style.italic = true;
    if (props.underline) style.underline = true;
    if (style.fontSizePt == null && props.fontSizePt != null) {
      style.fontSizePt = props.fontSizePt;
    }
    for (const piece of body.matchAll(PIECE_RE)) {
      const whole = piece[0];
      if (whole.startsWith("<w:t")) {
        const text = decodeEntities(piece[1] ?? "");
        if (text.trim() !== "" && !props.underline) onlyUnderline = false;
        segments.push({
          kind: "text",
          text,
          bold: props.bold,
          italic: props.italic,
          underline: props.underline,
          fontSizePt: props.fontSizePt,
          color: props.color,
        });
      } else if (whole.startsWith("<w:tab")) {
        segments.push({ kind: "tab" });
      } else if (whole.startsWith("<w:br")) {
        segments.push(
          attr(whole, "w:type") === "page"
            ? { kind: "pageBreak" }
            : { kind: "lineBreak" },
        );
      } else {
        const image = await resolveImage(whole);
        if (image) segments.push({ kind: "image", image });
        else if (whole.startsWith("<w:pict")) {
          warn("Sawir VML ah wuxuu template-ka ka baxay — preview-ga lama muujiyo.");
        }
      }
    }
  }

  const text = segments
    .filter((s): s is Extract<ParagraphSegment, { kind: "text" }> => s.kind === "text")
    .map((s) => s.text)
    .join("");
  if (style.numbered || text.includes("{{CLAUSE_NO}}")) style.numbered = true;

  const images = segments.filter(
    (s): s is Extract<ParagraphSegment, { kind: "image" }> => s.kind === "image",
  );
  const isImageOnly =
    images.length > 0 && segments.every((s) => s.kind === "image" || s.kind === "tab");

  return {
    kind: isImageOnly ? "image" : "paragraph",
    ...(isImageOnly
      ? { image: images[0].image, style }
      : {
          segments,
          text,
          style,
          signature: signatureOf(text, onlyUnderline && style.underline),
          pageBreakBefore: /<w:pageBreakBefore\s*\/>/.test(ppr),
          pageBreakAfter: segments.some((s) => s.kind === "pageBreak"),
        }),
  } as DocumentBlock;
}

/* ------------------------------------------------------------------ */
/* Block parsing (paragraphs + tables, recursively)                    */
/* ------------------------------------------------------------------ */

async function parseBlocks(
  xml: string,
  resolveImage: ImageResolver,
  warn: (message: string) => void,
): Promise<DocumentBlock[]> {
  const out: DocumentBlock[] = [];
  for (const raw of splitBody(xml)) {
    if (raw.kind === "sectPr") continue;
    if (raw.kind === "tbl") {
      const rows: TableCell[][] = [];
      for (const rowXml of splitByTag(raw.xml, "w:tr")) {
        const cells: TableCell[] = [];
        for (const cellXml of splitByTag(rowXml, "w:tc")) {
          const inner = cellXml
            .replace(/^<w:tc\b[^>]*>/, "")
            .replace(/<\/w:tc>$/, "");
          const tcPr = /<w:tcPr>([\s\S]*?)<\/w:tcPr>/.exec(inner)?.[1] ?? "";
          const wTag = /<w:tcW\b[^>]*\/?>/.exec(tcPr)?.[0];
          const wVal = num(attr(wTag, "w:w"));
          const wType = attr(wTag, "w:type");
          cells.push({
            blocks: await parseBlocks(inner, resolveImage, warn),
            widthPt: wVal == null ? null : pt(wType === "pct" ? null : wVal),
          });
        }
        rows.push(cells);
      }
      out.push({ kind: "table", table: { rows } });
      continue;
    }
    out.push(await parseParagraph(raw.xml, resolveImage, warn));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Page geometry + pagination                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_GEOMETRY: PageGeometry = {
  widthPt: 595.3, // A4 portrait
  heightPt: 841.9,
  marginTopPt: 72,
  marginRightPt: 72,
  marginBottomPt: 72,
  marginLeftPt: 72,
};

export function readPageGeometry(sectPr: string | null | undefined): PageGeometry {
  if (!sectPr) return { ...DEFAULT_GEOMETRY };
  const sizeTag = /<w:pgSz\b[^>]*\/?>/.exec(sectPr)?.[0];
  const marTag = /<w:pgMar\b[^>]*\/?>/.exec(sectPr)?.[0];
  const w = pt(num(attr(sizeTag, "w:w"))) ?? DEFAULT_GEOMETRY.widthPt;
  const h = pt(num(attr(sizeTag, "w:h"))) ?? DEFAULT_GEOMETRY.heightPt;
  return {
    widthPt: w,
    heightPt: h,
    marginTopPt: pt(num(attr(marTag, "w:top"))) ?? DEFAULT_GEOMETRY.marginTopPt,
    marginRightPt: pt(num(attr(marTag, "w:right"))) ?? DEFAULT_GEOMETRY.marginRightPt,
    marginBottomPt: pt(num(attr(marTag, "w:bottom"))) ?? DEFAULT_GEOMETRY.marginBottomPt,
    marginLeftPt: pt(num(attr(marTag, "w:left"))) ?? DEFAULT_GEOMETRY.marginLeftPt,
  };
}

const BASE_FONT_PT = 12;

/** Estimated line count of one paragraph at the given usable width. */
export function paragraphLines(
  block: Extract<DocumentBlock, { kind: "paragraph" }>,
  usableWidthPt: number,
): number {
  const fontPt = Math.max(block.style.fontSizePt ?? BASE_FONT_PT, 6);
  // Average glyph ≈ 0.5 em — an estimate, not a line breaker.
  const charsPerLine = Math.max(8, Math.floor(usableWidthPt / (fontPt * 0.5)));
  let lines = 1;
  let current = 0;
  for (const seg of block.segments) {
    if (seg.kind === "text") {
      seg.text.split(/\n/).forEach((part, i) => {
        if (i > 0) {
          lines++;
          current = 0;
        }
        current += part.length;
        while (current > charsPerLine) {
          lines++;
          current -= charsPerLine;
        }
      });
    } else if (seg.kind === "tab") {
      current += Math.floor(charsPerLine / 3);
    } else if (seg.kind === "lineBreak") {
      lines++;
      current = 0;
    }
  }
  return lines;
}

export function blockHeightPt(block: DocumentBlock, usableWidthPt: number): number {
  if (block.kind === "image") return block.image.heightPt + 8;
  if (block.kind === "table") {
    let total = 6;
    for (const row of block.table.rows) {
      let rowLines = 1;
      for (const cell of row) {
        let cellHeight = 0;
        for (const inner of cell.blocks) cellHeight += blockHeightPt(inner, usableWidthPt);
        rowLines = Math.max(rowLines, Math.ceil(cellHeight / 16));
      }
      total += rowLines * 16 + 6;
    }
    return total;
  }
  const fontPt = Math.max(block.style.fontSizePt ?? BASE_FONT_PT, 6);
  const lineHeight = fontPt * (block.style.headingLevel ? 1.25 : 1.15) + 2;
  return (
    paragraphLines(block, usableWidthPt) * lineHeight +
    (block.style.spacingBeforePt ?? 0) +
    (block.style.spacingAfterPt ?? 0)
  );
}

/**
 * Split the flat block list into pages. The template's own page breaks are
 * honoured exactly; anything beyond that is estimated from the template's
 * page size, margins and font sizes.
 */
export function paginate(
  blocks: DocumentBlock[],
  geometry: PageGeometry,
): DocumentPage[] {
  const usableWidth = geometry.widthPt - geometry.marginLeftPt - geometry.marginRightPt;
  const usableHeight =
    geometry.heightPt - geometry.marginTopPt - geometry.marginBottomPt;
  const pages: DocumentPage[] = [];
  let current: DocumentBlock[] = [];
  let used = 0;

  const flush = () => {
    if (current.length > 0) pages.push({ index: pages.length, blocks: current });
    current = [];
    used = 0;
  };

  for (const block of blocks) {
    const breakBefore =
      block.kind === "paragraph" && (block.pageBreakBefore || block.pageBreakAfter);
    if (breakBefore) flush();
    const height = blockHeightPt(block, usableWidth);
    if (current.length > 0 && used + height > usableHeight) {
      // Never leave a heading (or a half-used table) alone at the page foot.
      const isHeading = block.kind === "paragraph" && block.style.headingLevel > 0;
      const isTable = block.kind === "table";
      if (isHeading || (isTable && used < usableHeight * 0.5)) flush();
    }
    current.push(block);
    used += height;
  }
  flush();
  if (pages.length === 0) pages.push({ index: 0, blocks: [] });
  return pages;
}

/* ------------------------------------------------------------------ */
/* Reference number — identical to the export path                     */
/* ------------------------------------------------------------------ */

/**
 * The reference the document PRINTS, composed exactly like the generation
 * pipeline composes it, so Live Review shows the number the DOCX and the
 * archive file name will carry.
 */
export function printedReference(
  config: DocumentConfig,
  values: FormValues,
  referenceNumber: string,
): string {
  return composeReferenceNumber({
    format: config.referenceFormat,
    reference: referenceNumber,
    date: config.referenceDateKey
      ? String(resolveKey(values, config.referenceDateKey) ?? "")
      : undefined,
  });
}

/* ------------------------------------------------------------------ */
/* The universal builder                                               */
/* ------------------------------------------------------------------ */

function subTypeOf(config: DocumentConfig, values: FormValues): string {
  const v = values[config.setupSectionId ?? "heshiiska"];
  return v && !Array.isArray(v)
    ? String((v as Record<string, string>)["sub_type"] ?? "")
    : "";
}

/**
 * Resolve the OFFICIAL template with the document type's own data + rules and
 * return the structured, paginated model.
 *
 * Never throws: failures come back through `error`, so the live pane keeps
 * working while the user is still typing.
 */
export async function buildDocumentModel(
  input: BuildModelInput,
): Promise<DocumentModel> {
  const { config, values, templateBytes } = input;
  const warnings: string[] = [];

  const base: DocumentModel = {
    documentType: config.id,
    documentTypeTitle: config.title,
    subTypeLabel: input.subTypeLabel ?? (subTypeOf(config, values) || null),
    templateId: input.templateId ?? null,
    pages: [],
    geometry: { ...DEFAULT_GEOMETRY },
    headerText: [],
    footerText: [],
    warnings,
    error: null,
    pagination: "template-breaks+estimated",
  };

  try {
    const clean = stripSkipMarkers(config, values);
    const ctx = buildDataContext(config, clean);
    const reference = (input.referenceNumber ?? "").trim();
    if (reference) {
      const printed = printedReference(config, clean, reference);
      ctx.replacements = {
        ...ctx.replacements,
        "{{REFERENCE_NUMBER}}": printed,
        "{{REF_NUMBER}}": printed,
      };
    }
    const clauses = resolveClauses(config, clean);

    const zip = await JSZip.loadAsync(templateBytes);
    const docFile = zip.file("word/document.xml");
    if (!docFile) {
      return {
        ...base,
        error: "Template-ka ma la fahmi karin (word/document.xml ma jiro).",
      };
    }
    const resolvedXml = processDocumentXml(await docFile.async("string"), ctx, clauses);

    const resolveImage = await buildImageResolver(zip, warnings);
    const warn = (m: string) => warnings.push(m);
    const body = /<w:body>([\s\S]*?)<\/w:body>/.exec(resolvedXml)?.[1] ?? resolvedXml;
    const blocks = await parseBlocks(body, resolveImage, warn);

    const headerText: string[] = [];
    const footerText: string[] = [];
    for (const name of Object.keys(zip.files)) {
      if (!/^word\/(header|footer)\d*\.xml$/.test(name)) continue;
      const file = zip.file(name);
      if (!file) continue;
      const partXml = processDocumentXml(await file.async("string"), ctx, clauses);
      const text = splitBody(partXml)
        .filter((b) => b.kind === "p")
        .map((b) => xmlText(b.xml).trim())
        .filter((t) => t !== "")
        .join(" · ");
      if (!text) continue;
      (name.includes("header") ? headerText : footerText).push(text);
    }

    const geometry = readPageGeometry(
      /<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/.exec(resolvedXml)?.[0],
    );
    const pages = paginate(blocks, geometry);

    // §24 — a raw {{TOKEN}} must never survive into the visible document.
    for (const page of pages) {
      for (const block of page.blocks) {
        if (block.kind !== "paragraph") continue;
        for (const m of block.text.matchAll(/\{\{([^{}]+)\}\}/g)) {
          warnings.push(`Calmiyad aan la xalliin: {{${m[1]}}}`);
        }
      }
    }

    return { ...base, pages, geometry, headerText, footerText };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Document-ka ma la dhisin.",
    };
  }
}

/** Plain text of a model — used by tests and by accessibility fallbacks. */
export function modelToText(model: DocumentModel): string[] {
  const lines: string[] = [];
  for (const page of model.pages) {
    for (const block of page.blocks) {
      if (block.kind === "paragraph") lines.push(block.text);
      else if (block.kind === "table") {
        for (const row of block.table.rows) {
          lines.push(
            row
              .map((cell) =>
                cell.blocks
                  .map((b) => (b.kind === "paragraph" ? b.text : "[sawir]"))
                  .filter(Boolean)
                  .join(" "),
              )
              .join(" | "),
          );
        }
      } else {
        lines.push(`[sawir: ${block.image.altText}]`);
      }
    }
  }
  return lines;
}

/** Page count of a model (0 pages means nothing rendered yet). */
export function modelPageCount(model: DocumentModel): number {
  return model.pages.length;
}