/**
 * Phase 3 — Document Generation Pipeline.
 *
 *   validate answers → resolve template (registry) → validate template →
 *   load template → build data context → evaluate conditions →
 *   resolve clauses → resolve repeaters → replace placeholders →
 *   generate DOCX → validate output → (best-effort) PDF → archive record
 *
 * Each stage is a separate module; the pipeline only orchestrates. The
 * user-entered reference is the source of truth (never auto-incremented).
 * The DOCX is returned even when PDF conversion is unavailable.
 */

import type {
  DocumentConfig,
  FormValues,
  GeneratedDocumentMetadata,
  TemplateSpec,
} from "./types";
import { isInterviewComplete } from "./engine";
import { loadTemplate, selectTemplate } from "./registry";
import { buildDataContext, computeReplacements } from "./dataContext";
import { generateDocx, processDocumentXml } from "./docxRenderer";
import { validateTemplate, type TemplateValidationResult } from "./templateValidator";
import { convertToPdf } from "./pdfRenderer";
import {
  buildFileBaseName,
  buildOutputFolder,
  type GenerationResult,
} from "./archiver";

export interface PipelineInput {
  config: DocumentConfig;
  values: FormValues;
  referenceNumber: string;
  /** Label used in the filename, e.g. "Guri Xaas". */
  subTypeLabel?: string;
  /** Injected for tests; defaults to fetching the registered template. */
  templateBytes?: ArrayBuffer;
  /** Injected for tests; skips the fetch-based template validation. */
  spec?: TemplateSpec;
}

export interface PipelineOutput {
  result: GenerationResult;
  templateValidation: TemplateValidationResult | null;
  outputValidation: TemplateValidationResult | null;
  warnings: string[];
}

function subTypeOf(config: DocumentConfig, values: FormValues): string {
  const v = values["heshiiska"];
  if (v && !Array.isArray(v)) {
    return String((v as Record<string, string>)["sub_type"] ?? "");
  }
  return config.subTypes[0]?.value ?? "";
}

/**
 * Run the full generation pipeline. Throws (with a Somali message) before
 * any document is produced when answers or the template fail validation.
 */
export async function generateDocument(input: PipelineInput): Promise<PipelineOutput> {
  const { config, values, referenceNumber } = input;
  const warnings: string[] = [];

  // 1. Validate answers — a broken interview never reaches the template.
  if (!isInterviewComplete(config, values)) {
    throw new Error("Xogta heshiisku weli dhammaystirnayn — fadlan sax qaladaha.");
  }
  if (!referenceNumber.trim()) {
    throw new Error("Nambarka tixraaca waa waajib (user-ka ayaa geliya).");
  }

  // 2. Resolve the template through the registry (config-driven, no
  //    arbitrary paths).
  const spec =
    input.spec ??
    selectTemplate(config, values);
  if (!spec) {
    throw new Error(
      `Template looma helin nooca "${config.id}" — fadlan diiwaangeli template-ka registry-ga.`,
    );
  }

  // 3–4. Load + validate the template structurally.
  let bytes = input.templateBytes;
  let templateValidation: TemplateValidationResult | null = null;
  if (bytes) {
    const ctx = buildDataContext(config, values);
    templateValidation = await validateTemplate(
      spec.templateId,
      spec.filePath,
      bytes,
      ctx,
    );
    if (!templateValidation.valid) {
      const first = templateValidation.issues[0]?.message ?? "Template invalid";
      throw new Error(`Template Error: ${first}`);
    }
  } else {
    bytes = await loadTemplate(spec);
    const ctx = buildDataContext(config, values);
    templateValidation = await validateTemplate(
      spec.templateId,
      spec.filePath,
      bytes,
      ctx,
    );
    if (!templateValidation.valid) {
      const first = templateValidation.issues[0]?.message ?? "Template invalid";
      throw new Error(`Template Error: ${first}`);
    }
  }

  // 5–8. Data context → conditions → clauses → repeaters → placeholders → DOCX.
  const { blob, ctx } = await generateDocx(bytes, config, values);

  // 9. Validate the OUTPUT — no unresolved required placeholder may remain.
  const outBytes = await blob.arrayBuffer();
  const outputValidation = await validateTemplate(
    spec.templateId,
    spec.filePath,
    outBytes,
    ctx,
  );
  if (!outputValidation.valid) {
    const first = outputValidation.issues[0]?.message ?? "Output invalid";
    throw new Error(`Output Error: ${first}`);
  }

  // 10. Best-effort PDF — failure never breaks the DOCX.
  let pdfBlob: Blob | null = null;
  try {
    pdfBlob = await convertToPdf(blob);
  } catch {
    warnings.push("PDF conversion failed — DOCX generated successfully.");
  }
  if (!pdfBlob) {
    warnings.push(
      "Dukumeentiga DOCX waa la sameeyay. PDF conversion hadda lama heli karo.",
    );
  }

  // 11. Archive metadata (paths + template version + snapshot).
  const baseName = buildFileBaseName(config, referenceNumber, input.subTypeLabel);
  const folder = buildOutputFolder(config, subTypeOf(config, values));
  const metadata: GeneratedDocumentMetadata = {
    templateId: spec.templateId,
    templateVersion: spec.version,
    outputDocxPath: `${folder}/${baseName}.docx`,
    outputPdfPath: pdfBlob ? `${folder}/${baseName}.pdf` : undefined,
    fileName: `${baseName}.docx`,
  };

  return {
    result: {
      referenceNumber,
      templateId: spec.templateId,
      templateVersion: spec.version,
      fileName: metadata.fileName,
      outputDocxPath: metadata.outputDocxPath,
      outputPdfPath: metadata.outputPdfPath,
      pdfAvailable: Boolean(pdfBlob),
      blob,
      valuesSnapshot: values,
      metadata,
    },
    templateValidation,
    outputValidation,
    warnings,
  };
}

/** Exposed for tests: flat replacement computation over the context. */
export function replacementsFor(
  config: DocumentConfig,
  values: FormValues,
): Record<string, string> {
  return computeReplacements(config, values);
}

/** Exposed for tests: run only the XML block pipeline. */
export function renderXmlForTest(
  xml: string,
  config: DocumentConfig,
  values: FormValues,
): string {
  const ctx = buildDataContext(config, values);
  return processDocumentXml(xml, ctx, new Map());
}
