/**
 * KALA IIBSI HANTI — starter templates.
 *
 * The office's OWN .docx files (public/templates/kala_iiibsi_hanti/) are the
 * starter. They are served byte-for-byte from this same machine, so the
 * downloaded Word file is 100% the office's wording — nothing is generated
 * and no legal sentence is invented. The user edits it in Word, keeps the
 * {{PLACEHOLDER}} tokens intact, and re-uploads it through Template Manager.
 *
 * Hanti Kale has NO template and NO scan (OPEN_DECISIONS.hantiKaleScan) — it
 * is deliberately absent from this list. When its scan arrives, its file is
 * added to public/templates/kala_iiibsi_hanti/ and to this list only.
 */

export type HantiStarterSubtype = "dhul_banaan" | "guri" | "beer";

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
