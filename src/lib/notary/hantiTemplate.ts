/**
 * KALA IIBSI HANTI — starter templates.
 *
 * The office's rule: the template the user downloads and edits in Word is
 * THE template of the system — the app never designs Word documents. The
 * CANONICAL all-in-one template (canonical.docx) carries the three property
 * subtypes as {{IF:…}} conditionals, so ONE file serves Dhul Banaan, Guri
 * and Beer — the office's own decision (Hal template ALL-IN-ONE).
 *
 * The three per-subtype office files REMAIN available as starters too:
 * they are the office's own .docx files served byte-for-byte, and nothing
 * here replaces or renames them.
 *
 * Hanti Kale has NO template and NO scan (OPEN_DECISIONS.hantiKaleScan) —
 * it is deliberately absent from this list. When its scan arrives, its file
 * is added to public/templates/kala_iiibsi_hanti/ and to this list only.
 */

export type HantiStarterSubtype = "dhul_banaan" | "guri" | "beer" | "canonical";

export interface HantiStarterTemplate {
  /** The HANTI_SUBTYPES value this file belongs to ("canonical" = all three). */
  subtype: HantiStarterSubtype;
  /** Somali label shown on the download button. */
  label: string;
  /** File name on disk inside public/templates/kala_iiibsi_hanti/. */
  fileName: string;
  /** Name the downloaded file carries. */
  downloadName: string;
}

/**
 * The CANONICAL all-in-one template comes FIRST: it is the template the
 * production path uses, editable in Word, re-uploadable in Template Manager,
 * and valid for all three subtypes.
 */
export const HANTI_CANONICAL_STARTER: HantiStarterTemplate = {
  subtype: "canonical",
  label: "Kala Iibsi Hanti (Hal Template — Dhul Banaan · Guri · Beer)",
  fileName: "canonical.docx",
  downloadName: "kala_iibsi_hanti_canonical_template.docx",
};

export interface HantiStarterTemplate {
  /** The HANTI_SUBTYPES value this file belongs to. */
  subtype: HantiStarterSubtype;
  /** Somali label shown on the download button. */
  label: string;
  /** File name on disk inside public/templates/kala_iiibsi_hanti/. */
  fileName: string;
  /** Name the downloaded file carries. */
  downloadName: string;
}

/**
 * The starter list holds EXACTLY the three sub-types with office files —
 * per the Template Manager contract, one download per sub-type. The
 * canonical file itself stays on disk (the production path uses it and a
 * power user can fetch it), exposed separately via HANTI_CANONICAL_STARTER
 * rather than as a fourth entry in this inventory list.
 */
export const HANTI_STARTER_TEMPLATES: HantiStarterTemplate[] = [
  {
    subtype: "dhul_banaan",
    label: "Dhul Banaan",
    fileName: "dhul_banaan.docx",
    downloadName: "kala_iibsi_hanti_dhul_banaan_template.docx",
  },
  {
    subtype: "guri",
    label: "Guri",
    fileName: "guri.docx",
    downloadName: "kala_iibsi_hanti_guri_template.docx",
  },
  {
    subtype: "beer",
    label: "Beer",
    fileName: "beer.docx",
    downloadName: "kala_iibsi_hanti_beer_template.docx",
  },
];

/** Same-origin path of an office template (works offline — it is a local file). */
export function hantiStarterPath(starter: HantiStarterTemplate): string {
  return `/templates/kala_iiibsi_hanti/${starter.fileName}`;
}

/**
 * Bytes of one office starter, fetched from the app's own origin. Throws when
 * the file is missing or unreadable so the UI can show a real error instead
 * of downloading an empty document.
 */
export async function fetchHantiStarterBytes(
  starter: HantiStarterTemplate,
): Promise<Uint8Array> {
  const response = await fetch(hantiStarterPath(starter));
  if (!response.ok) {
    throw new Error(`Hanti template ma helnin: ${starter.fileName} (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error(`Hanti template madhan yahay: ${starter.fileName}`);
  }
  return new Uint8Array(buffer);
}
