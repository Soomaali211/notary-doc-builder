/**
 * Phase 3H — Document Archiver (naming + metadata).
 *
 * Pure naming/serialization helpers for the archive record:
 *   - safe filenames (no traversal characters)
 *   - output folder by document type + sub-type
 *   - GenerationResult carrying template metadata + the form-data snapshot
 *
 * Database records stay in Convex (see schema/mutations); generated
 * documents are immutable — regeneration always creates a new version.
 */

import type {
  DocumentConfig,
  FormValues,
  GeneratedDocumentMetadata,
} from "./types";

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_. ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

/** "Ref/DPN/K/001" → "Ref-DPN-K-001" (safe for filesystems). */
export function referenceToFileName(reference: string): string {
  return reference.replace(/\//g, "-").trim();
}

/** Output folder for a generated document, e.g. "output/Kiro/Guri_Xaas".
 *  Uses `config.outputFolder` when set, otherwise falls back to the title.
 *  `subtype` may be a sub-type value ("guri_xaas") or a label ("Guri Xaas")
 *  — values are resolved to their label first. */
export function buildOutputFolder(
  config: DocumentConfig,
  subtype: string,
): string {
  const label =
    config.subTypes.find((s) => s.value === subtype)?.label ?? subtype;
  const typeFolder = sanitizeFileName(
    (config.outputFolder ?? config.title).replace(/\s+/g, "_"),
  );
  const subFolder = label ? sanitizeFileName(label.replace(/\s+/g, "_")) : "";
  return ["output", typeFolder, subFolder].filter(Boolean).join("/");
}

/**
 * Filename base, e.g. "Heshiis_Kiro_Ref-DPN-K-001".
 * Pattern (user-owned template phase): <TypeFolder>_<Reference>. The
 * user-entered reference is the source of truth — never auto-incremented.
 * A reference that already carries a "Ref" prefix is kept as-is (no doubling).
 */
export function buildFileBaseName(
  config: DocumentConfig,
  reference: string,
  // Legacy parameter kept for call-site compatibility; the type label comes
  // from the config so the archive name stays stable across sub-types.
  _subtypeLabel?: string,
): string {
  // Normalize the user-entered reference into "Ref-…" form. A reference
  // that already carries a "Ref/" or "Ref-" prefix is kept as-is (no
  // doubling). Sanitize AFTER converting slashes — sanitizeFileName
  // strips "/", so the order matters (Ref/DPN/K/001 → Ref-DPN-K-001).
  const raw = referenceToFileName(reference).trim();
  const ref = /^(ref[-/])/i.test(reference.trim())
    ? raw.replace(/^(ref[-/]*)/i, "Ref-")
    : `Ref-${raw}`;
  const typeLabel = sanitizeFileName(
    (config.fileNamePrefix ?? config.title).replace(/[\s-]+/g, "_"),
  );
  return [sanitizeFileName(typeLabel), sanitizeFileName(ref)]
    .filter(Boolean)
    .join("_");
}

/**
 * No-overwrite guarantee: when the same base name was already produced in
 * this session (e.g. two generations bound to the same reference), a
 * numeric suffix -2, -3 … is appended so an existing file is never
 * silently replaced. The caller owns the tracking set (the interview page
 * passes one per session); without a set the base name passes through
 * unchanged. The Convex archive record itself is append-only by design
 * (commitGenerated is immutable).
 */
export function uniqueBaseName(baseName: string, taken?: Set<string>): string {
  if (!taken) return baseName;
  if (!taken.has(baseName)) {
    taken.add(baseName);
    return baseName;
  }
  let n = 2;
  while (taken.has(`${baseName}-${n}`)) n++;
  const unique = `${baseName}-${n}`;
  taken.add(unique);
  return unique;
}

export interface GenerationResult {
  documentId?: string;
  referenceNumber: string;
  templateId: string;
  templateVersion: number;
  fileName: string;
  /** Output path recorded in metadata (relative, safe characters only). */
  outputDocxPath: string;
  outputPdfPath?: string;
  pdfAvailable: boolean;
  blob: Blob;
  /** Form-data snapshot bound to this template version. */
  valuesSnapshot: FormValues;
  metadata: GeneratedDocumentMetadata;
}
