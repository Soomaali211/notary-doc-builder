/**
 * PDF RENDERING (§27).
 *
 * §27 says the PDF must come from the document that was approved, and that
 * the DOCX and the PDF must be the same content. So the PDF is NOT produced
 * by converting the DOCX — there is no converter here, no LibreOffice and no
 * cloud service, because §3 forbids all of them. Instead the PDF is written
 * from the very same `DocumentModel` that Live Review draws and that the DOCX
 * is generated from. One model, three surfaces: preview, DOCX, PDF.
 *
 * §25 offers the user TWO ways to get a PDF, and both are honest:
 *   · "Soo Saar PDF"  → the operating system's own print-to-PDF. Identical to
 *     what comes out of the printer, and identical to the print button.
 *   · "PDF dhaqaaq ah" → the file this module builds locally, byte for byte,
 *     with no dialog and no page setup the user has to guess.
 *
 * The DOCX is mandatory and is never blocked by a PDF problem, so
 * `convertToPdf` still returns `null` when there is nothing to convert from
 * — callers report "DOCX ✓ · PDF ✗" and continue.
 */

import type { DocumentModel } from "./documentModel";
import { modelToPdf, type PdfResult } from "./pdfWriter";

export type { PdfResult };
export { modelToPdf };

/**
 * Build the PDF for a document model. This is the local generator behind
 * "PDF dhaqaaq ah".
 */
export function documentToPdf(model: DocumentModel): PdfResult {
  return modelToPdf(model);
}

/**
 * DOCX → PDF, when the caller only has the DOCX bytes.
 *
 * There is deliberately no converter here: a reliable one means a service or
 * a desktop application, and §3 forbids both. The DOCX path never depends on
 * this function returning anything — it returns `null` and the pipeline warns.
 */
export async function convertToPdf(docx: Blob): Promise<Blob | null> {
  void docx;
  return null;
}