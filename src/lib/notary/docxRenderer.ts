/**
 * Phase 3C/3F — DOCX Renderer (block-aware, formatting-preserving).
 *
 * Processes the WordprocessingML of a .docx (JSZip) paragraph by paragraph:
 *
 *   1. Repeat blocks   {{#BLOCK}}…{{/BLOCK}}   → duplicated per party row
 *   2. Conditionals    {{IF:FLAG}}…{{ENDIF}}   → false removes the whole
 *      section INCLUDING its headings
 *   3. Clause markers  {{CLAUSE_*}}            → resolved lines or removed
 *   4. Placeholders    {{NAME}}                → replaced case-insensitively
 *
 * Formatting is preserved: each paragraph's visible text is swapped while
 * keeping the formatting of its first run (bold/italic/font/size/alignment),
 * and table cells + headers/footers are processed too (they contain w:p).
 * It never designs or restyles the template — the office owns the layout.
 */

import type { DocumentConfig, FormValues } from "./types";
import type { DataContext } from "./dataContext";
import { buildDataContext } from "./dataContext";
import { resolveClauses, type ResolvedClause } from "./clauses";
import {
  buildRepeatParagraphTexts,
  findInlineRepeatBlock,
  repeatMarkerId,
} from "./repeaters";
import JSZip from "jszip";

/* ------------------------------------------------------------------ */
/* XML helpers                                                         */
/* ------------------------------------------------------------------ */

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Visible plain text of a <w:p>…</w:p> block. */
export function paragraphText(paragraphXml: string): string {
  const matches = paragraphXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
  return matches
    .map((m) => m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, "$1"))
    .join("")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Replace a paragraph's visible text while keeping the formatting of its
 * first run (later runs are emptied, not deleted, so rPr chains survive).
 */
export function replaceParagraphText(
  paragraph: string,
  newText: string,
): string {
  let first = true;
  return paragraph.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, () => {
    if (first) {
      first = false;
      return `<w:t xml:space="preserve">${newText}</w:t>`;
    }
    return `<w:t xml:space="preserve"></w:t>`;
  });
}

interface Item {
  kind: "p" | "raw";
  xml: string;
  text?: string;
}

/** Split document XML into an ordered item list (paragraphs + everything else). */
function splitItems(xml: string): Item[] {
  const items: Item[] = [];
  const re = /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let last = 0;
  for (const m of xml.matchAll(re)) {
    if (m.index > last) items.push({ kind: "raw", xml: xml.slice(last, m.index) });
    if (m[0].endsWith("/>")) {
      items.push({ kind: "raw", xml: m[0] }); // self-closing empty paragraph
    } else {
      items.push({ kind: "p", xml: m[0], text: paragraphText(m[0]) });
    }
    last = m.index + m[0].length;
  }
  if (last < xml.length) items.push({ kind: "raw", xml: xml.slice(last) });
  return items;
}

function itemsToXml(items: Item[]): string {
  return items.map((i) => i.xml).join("");
}

/* ------------------------------------------------------------------ */
/* Token helpers                                                       */
/* ------------------------------------------------------------------ */

const TOKEN_RE = /\{\{([^{}]+)\}\}/g;

function tokenName(token: string): string {
  return token.replace(/[{}]/g, "").trim().toUpperCase();
}

function isIfMarker(text: string): string | null {
  const m = /\{\{IF:([A-Za-z0-9_]+)\}\}/.exec(text);
  return m ? m[1].toUpperCase() : null;
}

function isEndifMarker(text: string): boolean {
  // {{ENDIF}} is the canonical close; {{END:NAME}} is accepted as an alias
  // (the template owner chooses whichever reads clearer).
  return /\{\{ENDIF\}\}|\{\{END:[A-Za-z0-9_]+\}\}/.test(text);
}

/* ------------------------------------------------------------------ */
/* Pass 1 — repeat blocks                                              */
/* ------------------------------------------------------------------ */

function processRepeatBlocks(items: Item[], ctx: DataContext): Item[] {
  const out: Item[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    const blockId =
      item.kind === "p" ? repeatMarkerId(item.text ?? "", false) : null;
    if (!blockId) {
      out.push(item);
      i++;
      continue;
    }
    // Find the matching close marker (no nesting).
    let closeIdx = -1;
    for (let j = i + 1; j < items.length; j++) {
      const t = items[j];
      if (t.kind === "p" && repeatMarkerId(t.text ?? "", true) === blockId) {
        closeIdx = j;
        break;
      }
    }
    if (closeIdx === -1) {
      out.push(item); // unbalanced: left in place, validation flags it
      i++;
      continue;
    }
    const info = ctx.repeatBlocks.get(blockId);
    const body = items.slice(i + 1, closeIdx);
    if (!info) {
      out.push(...body); // unknown block: keep body, markers dropped by validator
      i = closeIdx + 1;
      continue;
    }
    if (info.rows.length === 0) {
      // Empty list → the whole block disappears (no empty numbered lines).
      i = closeIdx + 1;
      continue;
    }
    const textsPerRow = buildRepeatParagraphTexts(
      info,
      body
        .filter((b) => b.kind === "p")
        .map((b) => b.text ?? "")
        .join("\n"),
    );
    for (const rowTexts of textsPerRow) {
      const lines = rowTexts.split("\n");
      body.forEach((b, idx) => {
        if (b.kind !== "p") {
          out.push(b);
          return;
        }
        const line = lines[idx] ?? "";
        if (line === "" && TOKEN_RE.test(b.text ?? "")) {
          TOKEN_RE.lastIndex = 0;
          return; // row line empty and paragraph held tokens → skip line
        }
        TOKEN_RE.lastIndex = 0;
        out.push({ kind: "p", xml: replaceParagraphText(b.xml, escapeXml(line)), text: line });
      });
    }
    i = closeIdx + 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pass 2 — conditional blocks                                         */
/* ------------------------------------------------------------------ */

function processConditionalBlocks(items: Item[], ctx: DataContext): Item[] {
  const out: Item[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    const flag = item.kind === "p" ? isIfMarker(item.text ?? "") : null;
    if (!flag) {
      out.push(item);
      i++;
      continue;
    }
    // Find matching ENDIF with nesting depth.
    let depth = 1;
    let endIdx = -1;
    for (let j = i + 1; j < items.length; j++) {
      const t = items[j];
      if (t.kind !== "p") continue;
      if (isIfMarker(t.text ?? "")) depth++;
      else if (isEndifMarker(t.text ?? "")) {
        depth--;
        if (depth === 0) {
          endIdx = j;
          break;
        }
      }
    }
    if (endIdx === -1) {
      out.push(item); // unbalanced: validation flags it
      i++;
      continue;
    }
    const body = processConditionalBlocks(items.slice(i + 1, endIdx), ctx);
    if (ctx.flags[flag] === true) {
      out.push(...body); // keep body, drop the marker lines
    }
    // flag false → whole section (headings included) is gone
    i = endIdx + 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pass 3 — clauses + placeholders per paragraph                       */
/* ------------------------------------------------------------------ */

function lookupReplacement(
  replacements: Record<string, string>,
  token: string,
): string | undefined {
  const name = tokenName(token);
  for (const [key, value] of Object.entries(replacements)) {
    if (tokenName(key) === name) return value;
  }
  return undefined;
}

function processParagraph(
  item: Item,
  ctx: DataContext,
  clauses: Map<string, ResolvedClause>,
): Item[] {
  const text = item.text ?? "";
  if (!text.includes("{{")) return [item];

  // Clause marker → resolved lines or complete removal.
  const clauseMatch = /\{\{(CLAUSE_[A-Z0-9_]+)\}\}/.exec(text);
  if (clauseMatch) {
    const resolved = clauses.get(clauseMatch[1]);
    if (!resolved || !resolved.included || resolved.lines.length === 0) return [];
    const lines = resolved.lines.map((l) => escapeXml(l));
    return lines.map((line, idx) => ({
      kind: "p" as const,
      xml: replaceParagraphText(item.xml, line),
      text: resolved.lines[idx],
    }));
  }

  // Inline repeat block: {{#X}}…{{/X}} inside one paragraph.
  const inline = findInlineRepeatBlock(text);
  if (inline) {
    const info = ctx.repeatBlocks.get(inline[1].toUpperCase());
    if (info) {
      if (info.rows.length === 0) return []; // empty list → line disappears
      const expanded = expandRepeatInline(inline, info);
      const replaced = text.replace(inline[0], expanded);
      return [{ kind: "p", xml: replaceParagraphText(item.xml, escapeXml(replaced)), text: replaced }];
    }
  }

  // Plain placeholder replacement (case-insensitive). A token with NO data
  // mapping is unknown — it is stripped so no {{…}} ever survives into the
  // final document (validation already warns the template owner).
  const replaced = text.replace(TOKEN_RE, (token) => {
    const value = lookupReplacement(ctx.replacements, token);
    return value !== undefined ? value : "";
  });
  if (replaced !== text) {
    return [{ kind: "p", xml: replaceParagraphText(item.xml, escapeXml(replaced)), text: replaced }];
  }
  return [item];
}

/** Render one inline block body per row and join with " · " (single line). */
function expandRepeatInline(
  inline: RegExpExecArray,
  info: import("./dataContext").RepeatBlockInfo,
): string {
  const body = inline[2];
  const texts = buildRepeatParagraphTexts(info, body);
  return texts.join(" · ");
}

/* ------------------------------------------------------------------ */
/* Document processing                                                 */
/* ------------------------------------------------------------------ */

/** Process one document part's XML through the full block pipeline. */
export function processDocumentXml(
  xml: string,
  ctx: DataContext,
  clauses: Map<string, ResolvedClause>,
): string {
  let items = splitItems(xml);
  items = processRepeatBlocks(items, ctx);
  items = processConditionalBlocks(items, ctx);
  const out: Item[] = [];
  for (const item of items) {
    if (item.kind === "p") out.push(...processParagraph(item, ctx, clauses));
    else out.push(item);
  }
  return itemsToXml(out);
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * generateDocx(): fill the template bytes into the final DOCX Blob.
 * Paragraphs, table cells, headers and footers are all processed.
 */
export async function generateDocx(
  templateBytes: ArrayBuffer,
  config: DocumentConfig,
  values: FormValues,
): Promise<{ blob: Blob; ctx: DataContext }> {
  const ctx = buildDataContext(config, values);
  const clauses = resolveClauses(config, values);
  const zip = await JSZip.loadAsync(templateBytes);

  const partNames = Object.keys(zip.files).filter((n) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
  );
  for (const name of partNames) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async("string");
    zip.file(name, processDocumentXml(xml, ctx, clauses));
  }

  const blob = await zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });
  return { blob, ctx };
}
