/**
 * KALA IIBSI HANTI — SCAN EVIDENCE REGISTER.
 *
 * The office's rule: the form is a translation of the REAL documents, not of
 * a data model the developer invented. This file is the audit trail that
 * keeps that honest.
 *
 * For every point on the office's reading list it records, per scan:
 *
 *   scan_confirmed — read off the actual paper, so the form MUST carry it
 *   spec_only      — the office stated it; no scan read so far shows it
 *   gap            — the scans show it and the form does not collect it
 *                    yet (see SCAN_GAPS; each one names its fix)
 *   not_form_data  — it lives in the Word template and is deliberately NOT a
 *                    form question (legal prose must never be re-typed)
 *
 * Two scans were actually analysed:
 *
 *   DHUL BANAAN "D/SALAAM"   2pp · Ref/Dpn/MG/000432/08/026 · 1 seller,
 *                            1 buyer, 3 witnesses, 5 fingerprint ovals,
 *                            letterhead on page 1 only
 *   BEER "DAARA-SALAAM"      2pp · Ref/Dpn/MG/000250/05/025 · group
 *                            "Ilma Xassan Qaalib", 13 persons, 8 photos,
 *                            6 signature lines, 2 witnesses, 6 clauses,
 *                            roles IIBISO / IIBISO/WAKIIL / M/QIYAM /
 *                            D/MAALKA, certs MDH/C/839-842/2025 +
 *                            Ref:APN/096/2025, Ruun + Farax as wakiil
 *
 * THE SINGLE MOST IMPORTANT LINE IN THIS FILE: a count in a scan is a
 * POSSIBLE CASE, never a required number. 13 sellers and 8 photographs is
 * one document, not the shape of every document. So `counts` below describe
 * what the scans were free to do, and nothing in the form may enforce them.
 */

/** What a single reading-list point costs us to be wrong about. */
export type EvidenceStatus =
  | "scan_confirmed"
  | "spec_only"
  | "gap"
  | "not_form_data";

export interface ScanPoint {
  /** The office's numbering, so a gap can be quoted back verbatim. */
  point: number;
  /** What the reading-list point is called. */
  title: string;
  dhul_banaan: EvidenceStatus;
  beer: EvidenceStatus;
  /** Where the answer lives in the app, or why it does not. */
  livesIn: string;
  note?: string;
}

export const SCAN_EVIDENCE: ScanPoint[] = [
  {
    point: 1,
    title: "Qaybaha document-ka",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "config.sections — dejinta, iibiyaha, kooxaha, wakiillada, sawirrada, saxeexayaasha, shaxadaha, iibsadaha, hantida_*, damiinka, qiimaha, maragyada",
  },
  {
    point: 2,
    title: "Noocyada dadka ku jira",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "partyModel.Person + per-row `jinsi` select (male / female / unknown)",
    note: "Gender is an INPUT. It is never read from the name and never defaulted.",
  },
  {
    point: 3,
    title: "Xiriirka dadka",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "wakiillada.xiriirka_qoyska → personModel.Person.familyRelationship",
    note: "Ruun is 'mother'. A relationship is DATA and grants no authority.",
  },
  {
    point: 4,
    title: "Doorarka dadka",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "iibiyeyaal.dooro → IIBIYAHA_DOORO",
    note: "Role ≠ gender. 'M/QIYAM' and 'D/MAALKA' are roles, not genders.",
  },
  {
    point: 5,
    title: "Wakiillada",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "wakiillo list + per-person `wakiil` field + partyModel.Representation",
    note: "One wakiil may stand for many people; several may split one group.",
  },
  {
    point: 6,
    title: "Wakiil-Qayimka",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "wakiillo.nooca_wakiilka → Representation.type ('wakiil' | 'wakiil_qayim')",
    note: "Never defaulted to 'wakiil'. A different answer about the REPRESENTED person's capacity.",
  },
  {
    point: 7,
    title: "Qoysaska / kooxaha",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "kooxaha list + iibiyeyaal.koox → SellerGroup (a NAME, never a person)",
  },
  {
    point: 8,
    title: "Sawirrada",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "sawirrada list → PersonPhoto (independent; per-person requiredWhenRowStatus only)",
    note: "1 seller → 3 photos, and 13 sellers → 8 photos, are BOTH valid. No count is ever compared.",
  },
  {
    point: 9,
    title: "Saxeexyada",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "saxeexayaasha list → PersonSignature",
    note: "13 sellers → 6 signatories is valid. A seller is never required to sign.",
  },
  {
    point: 10,
    title: "Magacyada iyo captions-ka",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "row `magac` on every list; sawirrada.caption for the photo label",
  },
  {
    point: 11,
    title: "Certificates iyo references",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "shaxadaha list (MDH/C/839-842/2025, Ref:APN/096/2025)",
    note: "Five papers in one scan. A single certificate slot could not hold them.",
  },
  {
    point: 12,
    title: "Hantida iyo nooca hantida",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "dejinta.sub_type + the matching hantida_dhul_banaan / hantida_guri / hantida_beer",
  },
  {
    point: 13,
    title: "Xuduudaha iyo jihooyinka",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "degmada, xaafada, cabbirka, jiho_1..3, soohdimaha (Dhul Banaan) · magaca_beerta, degmada_xaafadda, cabbirka, jiho_1..2, xuduudaha (Beer)",
    note: "Beer carries its OWN Beer name, which Dhul Banaan does not — the two must not collapse into one field set.",
  },
  {
    point: 14,
    title: "Qiimaha iyo lacag-bixinta",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "qiimaha.qiimaha_guud (+ QIIMAHA_QORAAL derived) and qiimaha.lacagta_bixiyay",
  },
  {
    point: 15,
    title: "Maragyada",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "maragyo list → MARAGYO repeat block",
    note: "Dhul Banaan scan had 3 witnesses and Beer had 2 — so the count is dynamic, min 1.",
  },
  {
    point: 16,
    title: "Qodobbada / clauses",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "not_form_data — every legal sentence lives in the office's own .docx",
    note: "Beer scan had 6 clauses. The app must NOT re-ask for them as questions and must NOT rewrite them as text.",
  },
  {
    point: 17,
    title: "Fiiro gaar ah",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "hantida_*.faahfaahin_dheeraad + damiinka.gurmadka_dammaanadda",
  },
  {
    point: 18,
    title: "Erayada gender-ka",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "partyModel.GENDER_WORDS / GENDER_WORDS_DEFINITE → {{IIBIYE_WORD(S)}}, {{IIBSADE_WORD(S)}}",
    note: "The Beer scan prints IIBISO and IIBIYE-shaped prefixes; the exact plural remains OPEN — see partyModel.OPEN_DECISIONS.pluralSpelling.",
  },
  {
    point: 19,
    title: "Qaabka xogta loogu soo bandhigo document-ka",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "repeat blocks ({{#IIBIYEYAAL}}, {{#SAWIRRADA}}, {{#SAXEEXAYAASHA}} …) + composed Ref/Dpn/MG/{serial}/{MM}/{YY}",
  },
];

/**
 * Every reading-list point the scans raise that the form does not yet
 * collect, named so it can be fixed rather than forgotten.
 *
 * This list is meant to reach EMPTY. An entry here is an admission, not a
 * design: it says "the paper shows this and we cannot yet type it in".
 */
export interface ScanGap {
  /** Reading-list point number, so it can be quoted back. */
  point: number;
  /** What the scan shows. */
  found: string;
  /** Which scan(s) show it. */
  seenIn: "dhul_banaan" | "beer" | "both";
  /** Where the form must grow to hold it. */
  fix: string;
}

export const SCAN_GAPS: ScanGap[] = [
  {
    point: 13,
    found: "Beer-ka wuxuu leeyahay MAGAC (Beer Daara-Salaam) — goobta iyo beerka labo arrimo.",
    seenIn: "beer",
    fix: "hantida_beer.magaca_beerta — ADDED (required, prints as BEER_MAGAC).",
  },
  {
    point: 13,
    found: "Beer-ka wuxuu qabtay jihooyin (Xadka), sida Dhul Banaan.",
    seenIn: "beer",
    fix: "hantida_beer.jiho_1 / jiho_2 (optional) — ADDED, prints as BEER_JIHO_1 / BEER_JIHO_2.",
  },
  {
    point: 13,
    found: "Dhul Banaan-ka wuxuu qabtay soohdimo dhulka.",
    seenIn: "dhul_banaan",
    fix: "hantida_dhul_banaan.soohdimaha (optional, skippable) — ADDED, prints as SOOHDIMADA.",
  },
];

/** Reading-list points with NO open gap — i.e. the form covers them today. */
export function coveredScanPoints(): number[] {
  const gapped = new Set(SCAN_GAPS.map((g) => g.point));
  return SCAN_EVIDENCE.filter((p) => !gapped.has(p.point)).map((p) => p.point);
}