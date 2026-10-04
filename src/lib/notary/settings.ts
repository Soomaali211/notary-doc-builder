/**
 * SETTINGS STORAGE.
 *
 * The settings belong to the office, live on the office's own machine, and
 * are read by more than one page — the settings screen writes them, the
 * backup reads them, the export names files from them. So the storage lives
 * here, in the library, and the page is only the form that edits it.
 *
 * §63 — office information must never be invented. Every field starts EMPTY,
 * and what the notary types is what the header reads, character for
 * character.
 */

/** Bumped only when the stored shape changes. */
const STORAGE_KEY = "notary.settings.v1";

export interface OfficeSettings {
  /** Office name — as the office writes it, never auto-generated. */
  officeName: string;
  address: string;
  phone: string;
  /** Extra line printed under the phone (e.g. email). */
  extra: string;
  /** Date format used on exported file names. */
  dateFormat: "iso" | "dmy";
}

/** Every field starts blank: an unverified office detail must stay unset. */
export const EMPTY_SETTINGS: OfficeSettings = {
  officeName: "",
  address: "",
  phone: "",
  extra: "",
  dateFormat: "iso",
};

/** Read the stored settings, tolerating absent/partial/corrupt storage. */
export function readSettings(): OfficeSettings {
  if (typeof localStorage === "undefined") return { ...EMPTY_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<OfficeSettings> | null;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_SETTINGS };
    return {
      officeName: String(parsed.officeName ?? ""),
      address: String(parsed.address ?? ""),
      phone: String(parsed.phone ?? ""),
      extra: String(parsed.extra ?? ""),
      dateFormat: parsed.dateFormat === "dmy" ? "dmy" : "iso",
    };
  } catch {
    return { ...EMPTY_SETTINGS };
  }
}

export function writeSettings(value: OfficeSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the settings simply do not persist. Never
    // throw into the notary's face over a preference.
  }
}

/**
 * The header lines these settings produce — in the order they print, with
 * blank lines dropped so an unfilled field leaves no empty line behind.
 * This is typography only: it invents no wording and adds no label.
 */
export function headerLines(s: OfficeSettings): string[] {
  return [s.officeName, s.address, s.phone, s.extra]
    .map((line) => line.trim())
    .filter((line) => line !== "");
}