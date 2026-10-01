/**
 * Phase 3I — Template Validator.
 *
 * Pre-generation structural validation of a Word template against the data
 * it will be filled with:
 *   - template exists / file readable
 *   - placeholder syntax valid
 *   - required mappings available in the data context
 *   - {{IF:}}…{{ENDIF}} and {{#}}…{{/#}} blocks balanced
 *   - no unknown variables (with a Somali error naming the placeholder)
 *
 * A failed validation throws before any DOCX is produced — a broken
 * document is never generated from missing data.
 */

import JSZip from "jszip";
import type { DataContext } from "./dataContext";

export interface TemplateIssue {
  level: "error" | "warning";
  message: string;
}

export interface TemplateValidationResult {
  templateId: string;
  templatePath: string;
  valid: boolean;
  checks: { label: string; ok: boolean; detail?: string }[];
  issues: TemplateIssue[];
}

function tokenName(token: string): string {
  return token.replace(/[{}]/g, "").trim().toUpperCase();
}

/** Pull all visible text tokens out of a document part's XML. */
function extractTokens(xml: string): string[] {
  const tokens: string[] = [];
  const pRe = /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  for (const pMatch of xml.matchAll(pRe)) {
    const p = pMatch[0];
    const textMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
    const text = textMatches
      .map((m) => m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, "$1"))
      .join("")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    for (const m of text.matchAll(/\{\{([^{}]+)\}\}/g)) tokens.push(m[1]);
  }
  return tokens;
}

export async function validateTemplate(
  templateId: string,
  templatePath: string,
  bytes: ArrayBuffer,
  ctx: DataContext,
): Promise<TemplateValidationResult> {
  const checks: TemplateValidationResult["checks"] = [];
  const issues: TemplateIssue[] = [];
  const add = (
    ok: boolean,
    label: string,
    detail?: string,
    level: TemplateIssue["level"] = "error",
  ) => {
    checks.push({ label, ok, detail });
    if (!ok) issues.push({ level, message: detail ?? label });
  };

  add(bytes.byteLength > 0, "Template exists & readable");

  let tokens: string[] = [];
  let syntaxOk = true;
  try {
    const zip = await JSZip.loadAsync(bytes);
    const partNames = Object.keys(zip.files).filter((n) =>
      /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
    );
    if (partNames.length === 0) {
      syntaxOk = false;
      add(false, "File readable", "Faylka .docx waa mid aan sax ahayn.");
    } else {
      for (const name of partNames) {
        const xml = await zip.file(name)!.async("string");
        tokens.push(...extractTokens(xml));
      }
    }
  } catch {
    syntaxOk = false;
    add(false, "File readable", "Faylka .docx lama furin karo.");
  }

  if (syntaxOk) {
    add(true, "File readable");

    // Token syntax — {{ENDIF}} and the alias {{END:NAME}} both close an IF.
    const malformed = tokens.filter(
      (t) =>
        !/^(IF:[A-Za-z0-9_]+|ENDIF|END:[A-Za-z0-9_]+|#[A-Za-z0-9_]+|\/[A-Za-z0-9_]+|[A-Za-z0-9_.]+)$/.test(
          t.trim(),
        ),
    );
    add(
      malformed.length === 0,
      "Placeholders valid",
      malformed.length
        ? `Syntax aan sax ahayn: ${malformed.map((t) => `{{${t}}}`).join(", ")}`
        : "Dhammaan placeholders-ka waxay sax yihiin.",
    );

    // Known mappings. Block-context aware: tokens INSIDE a repeat block
    // may legally be that block's row tokens (e.g. {{WAKIIL_MAGAC}} inside
    // {{#KIREYEYAYAAL}}) and row-scoped IF flags ({{IF:WAKIIL}}) — they are
    // checked against the block's row data, not the global placeholders.
    const unknown: string[] = [];
    const repeatBlocks = new Set(
      [...ctx.repeatBlocks.keys()].map((k) => `#${k}`),
    );
    const rowNamesFor = (blockId: string): Set<string> => {
      const info = ctx.repeatBlocks.get(blockId.replace(/^#/, ""));
      const names = new Set<string>();
      if (info) {
        for (const row of info.rows) {
          for (const token of Object.keys(row)) names.add(token.toUpperCase());
        }
      }
      return names;
    };
    const blockStack: string[] = [];
    for (const t of tokens) {
      const name = tokenName(t);
      if (name === "ENDIF" || name.startsWith("END:")) continue; // structural marker, balance-checked below
      const currentRows =
        blockStack.length > 0 ? rowNamesFor(`#${blockStack[blockStack.length - 1]}`) : new Set<string>();
      if (name.startsWith("IF:")) {
        const flag = name.slice(3);
        // Inside a repeat block a row-scoped flag (a row token like WAKIIL)
        // is valid even when it is not a global condition flag.
        if (!(flag in ctx.flags) && !currentRows.has(flag)) {
          unknown.push(`{{${t.trim()}}}`);
        }
        continue;
      }
      if (name.startsWith("#")) {
        if (!repeatBlocks.has(name)) unknown.push(`{{${t.trim()}}}`);
        blockStack.push(name.slice(1));
        continue;
      }
      if (name.startsWith("/")) {
        if (!repeatBlocks.has(`#${name.slice(1)}`)) unknown.push(`{{${t.trim()}}}`);
        blockStack.pop();
        continue;
      }
      if (name.startsWith("CLAUSE_")) {
        if (!ctx.clausesByName.has(name)) unknown.push(`{{${t.trim()}}}`);
        continue;
      }
      if (!ctx.knownNames.has(name) && !currentRows.has(name)) {
        unknown.push(`{{${t.trim()}}}`);
      }
    }
    // Unknown placeholders are a WARNING, not an error: the user owns the
    // template and may keep extra notes inside it — generation must not
    // break; unknown tokens are simply stripped from the final document.
    add(
      unknown.length === 0,
      "All required mappings found",
      unknown.length
        ? `Placeholder-ka aan la aqoon (waa la saari doonaa): ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? " …" : ""}`
        : "Dhammaan placeholders-ka waxay helay data mapping.",
      "warning",
    );

    // Block balance — {{ENDIF}} and {{END:NAME}} both count as closes.
    const opens = tokens.filter((t) => /^IF:/i.test(t.trim())).length;
    const endifs = tokens.filter((t) => /^(ENDIF|END:[A-Za-z0-9_]+)$/i.test(t.trim())).length;
    add(opens === endifs, "Conditional blocks balanced", opens === endifs ? undefined : `{{IF:}} ${opens} · {{ENDIF}} ${endifs}`);

    const repOpens = tokens.filter((t) => /^#[A-Za-z0-9_]+$/.test(t.trim()));
    const repCloses = tokens.filter((t) => /^\/[A-Za-z0-9_]+$/.test(t.trim()));
    const markerName = (t: string) => tokenName(t).replace(/^[#/]/, "");
    const repBalanced =
      repOpens.length === repCloses.length &&
      repOpens.every((o) =>
        repCloses.some((c) => markerName(c) === markerName(o)),
      );
    add(
      repBalanced,
      "Repeat blocks balanced",
      repBalanced ? undefined : `{{#BLOCK}} ${repOpens.length} · {{/BLOCK}} ${repCloses.length}`,
    );
  }

  return {
    templateId,
    templatePath,
    valid: issues.every((i) => i.level !== "error"),
    checks,
    issues,
  };
}

/**
 * Every {{…}} token in document order, WITH duplicates and WITHOUT dedup.
 *
 * The Compatibility Validator needs the raw order because a token's meaning
 * depends on where it sits: {{WAKIIL}} is a legal row-scoped flag inside
 * {{#KIREYEYAYAAL}} but an unknown name in plain body text. Deduping would
 * destroy that context, so this function keeps the stream intact.
 */
export async function extractTemplateTokenStream(
  bytes: ArrayBuffer,
): Promise<string[]> {
  const tokens: string[] = [];
  const zip = await JSZip.loadAsync(bytes);
  const partNames = Object.keys(zip.files).filter((n) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
  );
  for (const name of partNames) {
    const xml = await zip.file(name)!.async("string");
    tokens.push(...extractTokens(xml));
  }
  // Bare names ("KIREYE_MAGAC"), the shape every existing caller expects.
  return tokens.map((t) => t.trim());
}

/**
 * Scan a .docx for every {{…}} placeholder token (document + headers +
 * footers). Used by the Template Manager to show the user exactly which
 * placeholders their own template contains.
 */
export async function listTemplateTokens(bytes: ArrayBuffer): Promise<string[]> {
  const stream = await extractTemplateTokenStream(bytes);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of stream) {
    const key = t.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}
