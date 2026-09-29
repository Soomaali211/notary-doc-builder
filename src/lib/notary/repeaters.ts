/**
 * Phase 3D — Repeater Renderer.
 *
 * Repeated blocks in the template:
 *   {{#MARAGYO}}
 *   {{NUMBER}}. {{MAGAC}}
 *   Telefoon: {{PHONE}}
 *   {{/MARAGYO}}
 *
 * The body repeats once per filled row of the mapped party list. Tokens
 * resolve case-insensitively to that row's fields ({{MAGAC}} → magac),
 * plus explicit aliases ({{PHONE}} → telefoon). When the list is empty the
 * whole block disappears — never empty numbered lines. Works on both the
 * flat template text (validation / preview) and DOCX paragraph lists.
 */

import type { RepeatBlockInfo } from "./dataContext";

export interface RepeatExpansion {
  /** Expanded paragraph texts for the block body (one entry per repeat). */
  paragraphs: string[];
  /** Whether the block matched a known repeat block mapping. */
  known: boolean;
}

function expandBody(
  body: string,
  info: RepeatBlockInfo,
): string[] {
  return info.rows.map((row) =>
    body.replace(/\{\{([^#/][A-Za-z0-9_.]*)\}\}/g, (token, name: string) => {
      const value = row[name.trim().toUpperCase()];
      return value !== undefined ? value : token; // unknown → main pass decides
    }),
  );
}

/**
 * Expand one repeat block found in flat text.
 * `open`/`close`/`body` are the raw token strings; returns null when the
 * tokens don't form a known block (caller keeps them for validation).
 */
export function expandRepeatBlockFlat(
  blockId: string,
  body: string,
  blocks: Map<string, RepeatBlockInfo>,
): string | null {
  const info = blocks.get(blockId.toUpperCase());
  if (!info) return null;
  if (info.rows.length === 0) return ""; // empty list → block vanishes
  return expandBody(body, info).join("\n");
}

/* ------------------------------------------------------------------ */
/* DOCX paragraph-level expansion                                      */
/* ------------------------------------------------------------------ */

export interface ParagraphLike {
  /** Full XML of the <w:p>…</w:p> element. */
  xml: string;
  /** Visible plain text of the paragraph. */
  text: string;
}

export interface RepeatBlockXmlExpansion {
  /** Replacement XML paragraphs (already escaped/processed). */
  paragraphs: string[] | null;
  /** True when this block id is configured (vs unknown → leave alone). */
  known: boolean;
}

/**
 * Extract the block id from a marker-only paragraph
 * ("{{#NAME}}" / "{{/NAME}}" with nothing else).
 */
export function repeatMarkerId(text: string, closing: boolean): string | null {
  const t = text.trim();
  const re = closing ? /^\{\{\/([A-Za-z0-9_]+)\}\}$/ : /^\{\{#([A-Za-z0-9_]+)\}\}$/;
  const m = re.exec(t);
  return m ? m[1].toUpperCase() : null;
}

const INLINE_BLOCK_RE = /\{\{#([A-Za-z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/;

/** Match an inline (single-paragraph) block: {{#X}}body{{/X}} in one line. */
export function findInlineRepeatBlock(text: string): RegExpExecArray | null {
  return INLINE_BLOCK_RE.exec(text);
}

/**
 * Build the replacement XML paragraphs for one repetition: the row's values
 * are substituted into the body paragraph's visible text. The caller injects
 * the text back with the paragraph's own formatting (see docxRenderer).
 */
export function buildRepeatParagraphTexts(
  info: RepeatBlockInfo,
  bodyText: string,
): string[] {
  if (info.rows.length === 0) return [];
  return expandBody(bodyText, info);
}
