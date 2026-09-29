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
 * Filename base, e.g. "Ref-DPN-K-001_Heshiis-Kiro_Guri-Xaas".
 * The user-entered reference is the source of truth — never auto-incremented.
 */
export function buildFileBaseName(
  config: DocumentConfig,
  reference: string,
  subtypeLabel?: string,
): string {
  // Normalize the user-entered reference into "Ref-…" form. A reference
  // that already carries a "Ref/" or "Ref-" prefix is kept as-is (no
  // doubling). Sanitize AFTER converting slashes — sanitizeFileName
  // strips "/", so the order matters (Ref/DPN/K/001 → Ref-DPN-K-001).
  const raw = referenceToFileName(reference).trim();
  const ref = /^(ref[-/])/i.test(reference.trim())
    ? raw.replace(/^(ref[-/]*)/i, "Ref-")
    : `Ref-${raw}`;
  const parts = [sanitizeFileName(ref), sanitizeFileName(config.fileNamePrefix)];
  if (subtypeLabel) parts.push(sanitizeFileName(subtypeLabel));
  return parts.filter(Boolean).join("_");
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
