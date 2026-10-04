/**
 * Universal Export Surface — Live Review · DOCX · PDF · Print.
 *
 * ONE model, ONE template, ONE set of placeholder/conditional rules:
 *
 *   DocumentState → DocumentModel → { Live Review, DOCX, PDF, Print }
 *
 * There is no `HantiPDF`, `KiroDOCX` or `CilaajPreview` anywhere. A new
 * document type gets all four surfaces for free by registering a config.
 *
 *  · DOCX — fills the OFFICIAL template through the existing pipeline
 *    (`generateDocx`). No standalone document is ever invented.
 *  · PDF  — the browser's own "Save as PDF" over the SAME rendered document
 *    the user is looking at (see `printDocument`). This is deliberate: a
 *    second, separate PDF layout engine would be exactly the duplication
 *    this architecture exists to remove, and it would drift from the DOCX.
 *  · PRINT — the document, not the form: only `[data-print-doc]` survives.
 *
 * Every function is safe in a non-browser context (tests, SSR): printing and
 * downloading degrade to a reported no-op instead of throwing.
 */

import type { DocumentConfig, FormValues, TemplateSpec } from "./types";
import { loadTemplate, selectTemplate } from "./registry";
import { buildDocumentModel, printedReference, type DocumentModel } from "./documentModel";
import { generateDocx } from "./docxRenderer";
import { buildFileBaseName } from "./archiver";
import { fetchTemplateBytes } from "./userTemplate";

export interface DocumentSource {
  config: DocumentConfig;
  values: FormValues;
  /** Reference as the notary typed it; composed for print/export downstream. */
  referenceNumber?: string;
  subTypeLabel?: string;
  /** Bytes already in hand — skips the registry fetch. */
  templateBytes?: ArrayBuffer;
  /** Explicit template (a user-uploaded one); overrides the registry pick. */
  spec?: TemplateSpec;
  /** Bytes of a user-uploaded template at its storage URL. */
  templateUrl?: string;
}

export interface ResolvedSource {
  spec: TemplateSpec;
  bytes: ArrayBuffer;
}

/**
 * Resolve the OFFICIAL template for this document type + answers.
 * Returns null when the type has no template registered for the chosen
 * sub-type — the caller shows that plainly instead of previewing nothing.
 */
export async function resolveTemplate(
  source: DocumentSource,
): Promise<ResolvedSource | null> {
  const { config, values } = source;
  if (source.templateBytes) {
    const spec = source.spec ?? selectTemplate(config, values);
    return {
      spec: spec ?? {
        templateId: `${config.id}-adhoc`,
        documentType: config.id,
        subtype: "",
        name: config.title,
        filePath: "",
        version: 1,
        status: "active",
        createdAt: 0,
        updatedAt: 0,
      },
      bytes: source.templateBytes,
    };
  }
  if (source.templateUrl && source.spec) {
    return { spec: source.spec, bytes: await fetchTemplateBytes(source.templateUrl) };
  }
  const spec = selectTemplate(config, values);
  if (!spec) return null;
  return { spec, bytes: await loadTemplate(spec) };
}

/**
 * The shared document model behind every surface. Throws only when the
 * template itself cannot be loaded — partial answers never throw.
 */
export async function buildUniversalDocument(
  source: DocumentSource,
): Promise<{ model: DocumentModel; spec: TemplateSpec }> {
  const resolved = await resolveTemplate(source);
  if (!resolved) {
    throw new Error(
      `Template looma helin nooca "${source.config.id}" — Live Review ma shaqeyn karto.`,
    );
  }
  const model = await buildDocumentModel({
    config: source.config,
    values: source.values,
    templateBytes: resolved.bytes,
    referenceNumber: source.referenceNumber,
    subTypeLabel: source.subTypeLabel,
    templateId: resolved.spec.templateId,
  });
  return { model, spec: resolved.spec };
}

/* ------------------------------------------------------------------ */
/* DOCX                                                                */
/* ------------------------------------------------------------------ */

export interface DocxExportResult {
  blob: Blob;
  fileName: string;
  /** The reference the document prints — identical to Live Review. */
  printedReference: string;
}

/**
 * Fill the OFFICIAL template with the same data and rules the live review
 * renders. Tables, images, signatures and conditional sections are the
 * template's own — the app only fills it.
 */
export async function exportDocx(source: DocumentSource): Promise<DocxExportResult> {
  const resolved = await resolveTemplate(source);
  if (!resolved) {
    throw new Error(
      `Template looma helin nooca "${source.config.id}" — DOCX lama soo saari karo.`,
    );
  }
  const reference = (source.referenceNumber ?? "").trim();
  const printed = reference
    ? printedReference(source.config, source.values, reference)
    : "";
  const { blob } = await generateDocx(resolved.bytes, source.config, source.values, {
    "{{REFERENCE_NUMBER}}": printed,
    "{{REF_NUMBER}}": printed,
  });
  const fileName = `${buildFileBaseName(source.config, printed || "PREVIEW", source.subTypeLabel)}.docx`;
  return { blob, fileName, printedReference: printed };
}

/** Save a blob to disk. No-op (returns false) outside a browser. */
export function downloadBlob(blob: Blob, fileName: string): boolean {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/* ------------------------------------------------------------------ */
/* PDF + Print                                                         */
/* ------------------------------------------------------------------ */

/** Attribute the print stylesheet isolates: only the document is printed. */
export const PRINT_DOC_ATTRIBUTE = "data-print-doc";

/**
 * Print the DOCUMENT (never the form) and, for the PDF button, hand the
 * browser's own "Save as PDF" the same page. The document title is swapped
 * for the reference so the suggested file name matches the archive.
 */
export function printDocument(options?: { fileName?: string }): boolean {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof window.print !== "function"
  ) {
    return false;
  }
  const root = document.documentElement;
  const previousTitle = document.title;
  if (options?.fileName) {
    document.title = options.fileName.replace(/\.(docx|pdf)$/i, "");
  }
  root.setAttribute("data-printing", "document");
  const cleanup = () => {
    // Defensive: the browser may tear the document down (or a test may have
    // restored a stub) before afterprint or the fallback timer fires.
    if (typeof document !== "undefined") {
      document.title = previousTitle;
      const el = document.documentElement;
      if (el?.removeAttribute) el.removeAttribute("data-printing");
    }
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    window.print();
  } finally {
    // Some environments never fire afterprint (headless, tests): the flag
    // must not stay set, or the app stays invisible on screen.
    setTimeout(cleanup, 500);
  }
  return true;
}

/** File name the PDF/print dialog should suggest. */
export function exportFileBaseName(source: DocumentSource): string {
  const reference = (source.referenceNumber ?? "").trim();
  return buildFileBaseName(
    source.config,
    reference ? printedReference(source.config, source.values, reference) : "PREVIEW",
    source.subTypeLabel,
  );
}

export type { DocumentModel };