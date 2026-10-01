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
import { listTemplateTokens } from "./templateValidator";
import {
  classifyTemplateTokens,
  extractTemplateTokenStream,
  type CompatibilityReport,
} from "./templateCompatibility";

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
  /** Every {{TOKEN}} found in the uploaded .docx (deduped), bare names. */
  tokens: string[];
  /** Tokens the config recognizes (placeholders, row tokens, blocks…). */
  recognized: string[];
  /** Tokens the config does NOT know — warning only, never blocks. */
  unknown: string[];
  /** Structure problems (unclosed blocks, bad syntax) — these DO block. */
  syntaxErrors: string[];
  /** Full compatibility report: statuses, aliases, unused names. */
  report: CompatibilityReport;
}

const TOKEN_NAME_RE = /^[A-Za-z0-9_.]+$/;

/**
 * Scan an uploaded .docx and categorize its placeholders against the
 * config's known names.
 *
 * This is the Template Compatibility Validator (classifyTemplateTokens) —
 * the same classification the audit script prints, so the two can never
 * disagree. Unknown placeholders are a WARNING (the token is stripped from
 * the final document); unbalanced/broken structure blocks generation.
 */
export async function scanTemplateTokens(
  bytes: ArrayBuffer,
  config: DocumentConfig,
): Promise<TemplateTokenReport> {
  const stream = await extractTemplateTokenStream(bytes);
  const tokens = listUniqueTokens(stream);
  const report = classifyTemplateTokens(stream, config);
  // The top-level lists stay BARE names (the shape the rest of the app and
  // the stored warningsJson expect); `report` carries the {{…}} form.
  const bare = (s: string) => s.replace(/[{}]/g, "");
  return {
    tokens,
    recognized: report.recognized.map(bare),
    unknown: report.unknown.map(bare),
    syntaxErrors: report.blocking,
    report,
  };
}

/** Dedupe a token stream while keeping document order. */
function listUniqueTokens(stream: string[]): string[] {
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
