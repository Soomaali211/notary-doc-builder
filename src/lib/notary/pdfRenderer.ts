/**
 * Phase 3G — PDF Renderer (best-effort abstraction).
 *
 * DOCX is mandatory and must never be blocked by PDF conversion. Reliable
 * client-side DOCX→PDF needs a converter service (LibreOffice headless or a
 * cloud API); Phase 3 ships the seam: a real implementation plugs in here
 * without touching the pipeline. Failure returns null — callers report
 * "DOCX ✓ · PDF ✗" and continue.
 */

export async function convertToPdf(docx: Blob): Promise<Blob | null> {
  void docx;
  return null;
}
