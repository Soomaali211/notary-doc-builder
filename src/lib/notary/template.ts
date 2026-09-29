/**
 * Phase 3 facade — back-compat re-exports over the split generation modules.
 *
 * Phase 1/2 callers (pages, scripts, tests) import from here; the real work
 * now lives in the separated Phase 3 modules:
 *
 *   TemplateRegistry/Loader → registry.ts
 *   TemplateValidator       → templateValidator.ts
 *   DataContextBuilder      → dataContext.ts
 *   ConditionEvaluator      → conditions.ts (Phase 2)
 *   ClauseResolver          → clauses.ts
 *   RepeaterRenderer        → repeaters.ts
 *   DocxRenderer            → docxRenderer.ts
 *   PdfRenderer             → pdfRenderer.ts
 *   DocumentArchiver        → archiver.ts
 *   Pipeline                → pipeline.ts
 */

export {
  computeReplacements,
  buildDataContext,
  resolveFlags,
  buildRepeatBlockData,
  type DataContext,
  type RepeatBlockInfo,
} from "./dataContext";

export { generateDocx, processDocumentXml, escapeXml } from "./docxRenderer";

export { convertToPdf } from "./pdfRenderer";

export { generateDocument, type PipelineInput, type PipelineOutput } from "./pipeline";

export { resolveClauses, resolveClauseLines, type ResolvedClause } from "./clauses";

export {
  sanitizeFileName,
  buildFileBaseName,
  buildOutputFolder,
  referenceToFileName,
  type GenerationResult,
} from "./archiver";

export { selectTemplate, getTemplate, registryTemplates } from "./registry";

export { validateTemplate, type TemplateValidationResult } from "./templateValidator";

import { generateDocx } from "./docxRenderer";
import type { DocumentConfig, FormValues } from "./types";

/**
 * Legacy entry point kept for Phase 1/2 callers: fill a template blob.
 * Internally it now runs the full Phase 3 block pipeline (repeaters,
 * conditionals, clauses, formatting-preserving placeholders).
 */
export async function fillTemplate(
  templateBytes: ArrayBuffer,
  config: DocumentConfig,
  values: FormValues,
): Promise<Blob> {
  const { blob } = await generateDocx(templateBytes, config, values);
  return blob;
}
