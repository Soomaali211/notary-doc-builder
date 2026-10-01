/**
 * Phase Document Generation — user-owned template helpers (client side).
 *
 * Bridges the Convex `notary_templates` records and the generation
 * pipeline: fetch the user's .docx bytes from file storage, shape them
 * into the pipeline's TemplateSpec, and categorize the scanned
 * placeholders into recognized / unknown for the Template Manager UI.
 *
 * The template DESIGN always stays the user's — this module never touches
 * layout, it only lists the {{PLACEHOLDERS}} the user typed.
 */

import type { DocumentConfig, TemplateSpec } from "./types";
import { knownPlaceholderNames } from "./dataContext";
import { listTemplateTokens } from "./templateValidator";

/** A notary_templates row as returned by the Convex query. */
export interface UserTemplateRecord {
  _id: string;
  _creationTime: number;
  documentType: string;
  subtype?: string;
  name: string;
  fileName: string;
  storageId: string;
  sizeBytes: number;
  placeholdersJson?: string;
  warningsJson?: string;
  isDefault: boolean;
  status: "active" | "retired";
  createdAt: number;
  updatedAt: number;
}

export function parseStoredList(json: string | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Shape a Convex record into the pipeline's TemplateSpec. */
export function toTemplateSpec(record: UserTemplateRecord): TemplateSpec {
  return {
    templateId: `USER_${record._id}`,
    documentType: record.documentType,
    subtype: record.subtype ?? "",
    name: record.name,
    filePath: `storage:${record.storageId}`,
    version: 1,
    status: "active",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** Fetch the user's template bytes from Convex file storage. */
export async function fetchTemplateBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Template-ka lama helin — isku day mar kale.");
  }
  return await res.arrayBuffer();
}

export interface TemplateTokenReport {
  /** Every {{TOKEN}} found in the uploaded .docx (deduped). */
  tokens: string[];
  /** Tokens the config recognizes (placeholders, row tokens, blocks…). */
  recognized: string[];
  /** Tokens the config does NOT know — warning only, never blocks. */
  unknown: string[];
  /** Structure problems (unclosed blocks, bad syntax) — these DO block. */
  syntaxErrors: string[];
}

const TOKEN_NAME_RE = /^[A-Za-z0-9_.]+$/;

/**
 * Scan an uploaded .docx and categorize its placeholders against the
 * config's known names. Unknown placeholders are a WARNING (the token is
 * stripped from the final document); unbalanced/broken structure tokens
 * are errors the user must fix in THEIR template.
 */
export async function scanTemplateTokens(
  bytes: ArrayBuffer,
  config: DocumentConfig,
): Promise<TemplateTokenReport> {
  const tokens = await listTemplateTokens(bytes);
  const known = knownPlaceholderNames(config);

  const recognized: string[] = [];
  const unknown: string[] = [];
  const syntaxErrors: string[] = [];

  // Balance tracking for IF / END / repeat markers (report, don't throw).
  const openIfs: string[] = [];
  const openBlocks: string[] = [];
  for (const raw of tokens) {
    const name = raw.trim().toUpperCase();
    if (name.startsWith("IF:")) {
      openIfs.push(name);
      // Global flags resolve via conditionFlags; row-scoped ones (WAKIIL…)
      // resolve inside repeat blocks — both live in the known-name set.
      if (!known.has(name.slice(3))) unknown.push(raw.trim());
      continue;
    }
    if (name === "ENDIF" || name.startsWith("END:")) {
      openIfs.pop();
      continue;
    }
    if (name.startsWith("#")) {
      openBlocks.push(name);
      if (!known.has(name)) syntaxErrors.push(`Block-ka la aqoon: {{${name}}}`);
      continue;
    }
    if (name.startsWith("/")) {
      openBlocks.pop();
      if (!known.has(`#${name}`)) syntaxErrors.push(`Block-ka la aqoon: {{${name}}}`);
      continue;
    }
    const bare = name.replace(/^#/, "").replace(/^\//, "");
    if (known.has(name) || known.has(bare)) {
      recognized.push(raw.trim());
    } else {
      unknown.push(raw.trim());
    }
  }
  for (const open of openIfs) syntaxErrors.push(`{{${open}}} lama xirin ({{END:${open.slice(3)}}} maqan).`);
  for (const open of openBlocks) syntaxErrors.push(`{{${open}}} lama xirin ({{/${open.slice(1)}}} maqan).`);

  return {
    tokens,
    recognized: [...new Set(recognized)],
    unknown: [...new Set(unknown)],
    syntaxErrors: [...new Set(syntaxErrors)],
  };
}
