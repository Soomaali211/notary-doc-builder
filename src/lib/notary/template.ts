import type {
  ClauseMapping,
  DocumentConfig,
  FormValues,
} from "./types";
import { evaluateCondition, makeGetter } from "./conditions";
import {
  formatValueByKind,
  joinNonEmpty,
  resolveKey,
} from "./format";
import type { PartyRow } from "./types";
import JSZip from "jszip";

/* ------------------------------------------------------------------ */
/* File naming                                                         */
/* ------------------------------------------------------------------ */

/** Make a filesystem-safe filename (no path traversal / illegal chars). */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_\. ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

/** "Ref-DPN-K-001_Heshiis-Kiro" style base name. */
export function buildFileBaseName(
  config: DocumentConfig,
  referenceNumber: string,
): string {
  const ref = sanitizeFileName(referenceNumber);
  const prefix = sanitizeFileName(config.fileNamePrefix);
  return `Ref-${ref}_${prefix}`;
}

/* ------------------------------------------------------------------ */
/* Value resolution                                                    */
/* ------------------------------------------------------------------ */

function firstOf(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = typeof item === "string" ? item : "";
      if (s.trim()) return s;
    }
    return "";
  }
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function partyRows(values: FormValues, key: string): PartyRow[] {
  const v = values[key];
  return Array.isArray(v) ? (v as PartyRow[]) : [];
}

function joinPartyField(
  values: FormValues,
  partyId: string,
  fieldId: string,
  separator = ", ",
): string {
  const rows = partyRows(values, partyId);
  return joinNonEmpty(
    rows.map((r) => (r.values?.[fieldId] ?? "").trim()),
    separator,
  );
}

function firstPartyField(
  values: FormValues,
  partyId: string,
  fieldId: string,
): string {
  const rows = partyRows(values, partyId);
  for (const r of rows) {
    const v = (r.values?.[fieldId] ?? "").trim();
    if (v) return v;
  }
  return "";
}

function subTypeLabel(config: DocumentConfig, value: string): string {
  return config.subTypes.find((s) => s.value === value)?.label ?? value;
}

/** English → Somali select labels used inside the document. */
const SOMALI_LABELS: Record<string, string> = {
  cash: "Cash (Lacag Cuskan)",
  bank: "Bank Transfer (Wareejin Bangi)",
  mobile: "Mobile Money (EVC / Sahal)",
  muqadin: "MUQADIN (horay — bil kasta bilowga)",
  muakhir: "MU'AKHIR (dambe — dhamaadka bisha)",
  guri_xaas: "Guri Xaas",
  qol_meherad: "Qol Meherad",
  jiingad: "Jiingad",
};

function somaliLabel(value: string): string {
  return SOMALI_LABELS[value] ?? value;
}

/* ------------------------------------------------------------------ */
/* Dynamic clause lines                                                */
/* ------------------------------------------------------------------ */

function buildDeebaajiLines(config: DocumentConfig, values: FormValues): string[] {
  const amount = formatValueByKind(
    resolveKey(values, "deebaaji.lacagta_deebaajiga"),
    "currency",
  );
  const conditions = resolveKey(values, "deebaaji.shuruudaha_deebaajiga");
  const lines: string[] = [];
  lines.push(
    amount
      ? `Deebaajiga (koronto, biyo iyo wixii la mid ah) wuxuu gaaraya ${amount} bil kasta, kaas oo kiraystuhu mas'uul ka yahay bixintiisa.`
      : "Deebaajiga (koronto, biyo iyo wixii la mid ah) wuxuu kiraystuhu mas'uul ka yahay bixintiisa.",
  );
  const cond = typeof conditions === "string" ? conditions.trim() : "";
  if (cond) lines.push(`Shuruudaha deebaajiga: ${cond}`);
  return lines;
}

function buildDamiinLines(config: DocumentConfig, values: FormValues): string[] {
  const get = makeGetter(values);
  const name = firstPartyField(values, "damiinka", "damiin_magac") ||
    (typeof get("damiinka.damiin_magac") === "string"
      ? String(get("damiinka.damiin_magac"))
      : "");
  const phone = typeof get("damiinka.damiin_telefoon") === "string"
    ? String(get("damiinka.damiin_telefoon"))
    : "";
  const id = typeof get("damiinka.damiin_aqoonsi") === "string"
    ? String(get("damiinka.damiin_aqoonsi"))
    : "";
  const address = typeof get("damiinka.damiin_cinwaan") === "string"
    ? String(get("damiinka.damiin_cinwaan"))
    : "";
  const details = joinNonEmpty([phone, id, address], " — ");
  return [
    details
      ? `Damiin: ${name}${details ? ` — ${details}` : ""}. Damiinku wuxuu noqonayaa dammaanad qadka heshiiskan, isla markaana wuxuu mas'uul ka yahay haddii kiraystuhu ku guuldarreysto xilalkiisa.`
      : `Damiin: ${name}. Damiinku wuxuu noqonayaa dammaanad qadka heshiiskan.`,
  ];
}

function buildAdvanceLines(config: DocumentConfig, values: FormValues): string[] {
  const kind = firstOf(resolveKey(values, "lacagta.bixinta_hore"));
  if (kind === "muqadin") {
    return [
      "Kirada bishii waxay kiraystuhu bixinayaa MUQADIN (horay) — waxay dhaafaysaa bilowga bil kasta, horey u bixin.",
    ];
  }
  if (kind === "muakhir") {
    return [
      "Kirada bishii waxay kiraystuhu bixinayaa MU'AKHIR (dambe) — waxay dhaafaysaa dhamaadka bil kasta.",
    ];
  }
  return [];
}

function buildClauseLines(
  clause: ClauseMapping,
  config: DocumentConfig,
  values: FormValues,
): string[] {
  if (clause.dynamic) {
    switch (clause.dynamic.kind) {
      case "deebaaji":
        return buildDeebaajiLines(config, values);
      case "damiin":
        return buildDamiinLines(config, values);
      case "advance":
        return buildAdvanceLines(config, values);
      case "custom": {
        const extra = resolveKey(values, "dheeraad.shuruudo_dheeraad");
        return typeof extra === "string" && extra.trim()
          ? [`Shuruudo dheeraad ah: ${extra.trim()}`]
          : [];
      }
    }
  }
  return clause.lines ?? [];
}

/* ------------------------------------------------------------------ */
/* Placeholder computation                                             */
/* ------------------------------------------------------------------ */

/** Compute every placeholder → replacement string for a document. */
export function computeReplacements(
  config: DocumentConfig,
  values: FormValues,
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const p of config.placeholders) {
    const { key, format, fallback } = p.mapping;
    const raw = resolveKey(values, key);
    let value: string;
    if (Array.isArray(raw)) {
      value = joinNonEmpty(raw.map((v) => String(v)), ", ");
      if (format) value = formatValueByKind(value, format);
    } else {
      value = formatValueByKind(firstOf(raw), format);
    }
    if (!value && fallback) value = fallback;
    // Translate known select values into Somali wording
    if (value && !format && ["habka_bixinta", "bixinta_hore", "nooca_guriga", "sub_type"].some((k) => key.endsWith(k))) {
      value = somaliLabel(value);
    }
    map[p.placeholder] = value;
  }

  // Party list placeholders (joined)
  map["{{KIREYEYAYAAL_LIST}}"] = joinPartyList(values, "kireeyayaal");
  map["{{KIRAYSTAYAAL_LIST}}"] = joinPartyList(values, "kiraystayaal");

  // Witnesses
  if (config.witnessPlaceholder) {
    map[config.witnessPlaceholder] = joinPartyList(
      values,
      "maragyo",
      config.witnessSeparator ?? "\n",
    );
  }

  // Sub type handled explicitly
  const subTypeRaw = firstOf(resolveKey(values, "heshiiska.sub_type"));
  if (subTypeRaw) map["{{SUB_TYPE}}"] = somaliLabel(subTypeRaw);

  return map;
}

function joinPartyList(values: FormValues, partyId: string, separator = ", "): string {
  const rows = partyRows(values, partyId);
  const lines = rows
    .map((r) => {
      const parts = [
        r.values?.magac,
        r.values?.telefoon,
        r.values?.aqoonsi,
        r.values?.cinwaan,
      ].map((v) => (v ?? "").trim()).filter(Boolean);
      return parts.join(" — ");
    })
    .filter((s) => s.length > 0);
  return lines.join(separator);
}

/* ------------------------------------------------------------------ */
/* DOCX template filling (JSZip)                                       */
/* ------------------------------------------------------------------ */

const XML_PLACEHOLDER_RE = /\{\{[A-Z0-9_]+\}\}/g;

/**
 * Fill the .docx template.
 * - Replaces {{PLACEHOLDER}} tokens across runs (Word splits text across
 *   runs; we merge run text inside each paragraph first).
 * - Removes {{CLAUSE_*}} blocks when the condition is false; inserts the
 *   clause lines when true.
 */
export async function fillTemplate(
  templateBytes: ArrayBuffer,
  config: DocumentConfig,
  values: FormValues,
): Promise<Blob> {
  const zip = await JSZip.loadAsync(templateBytes);
  const replacements = computeReplacements(config, values);
  const get = makeGetter(values);

  const fileNames = Object.keys(zip.files).filter((n) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
  );

  for (const name of fileNames) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async("string");
    const filled = processDocumentXml(xml, config, replacements, values, get);
    zip.file(name, filled);
  }

  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/** Extract plain text of a paragraph <w:p>…</w:p> block. */
function paragraphText(paragraphXml: string): string {
  const matches = paragraphXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
  return matches
    .map((m) => m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, "$1"))
    .join("");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function processDocumentXml(
  xml: string,
  config: DocumentConfig,
  replacements: Record<string, string>,
  values: FormValues,
  get: (key: string) => unknown,
): string {
  // 1. Split into paragraphs so clause blocks / placeholders can't leak
  //    across paragraph boundaries.
  const paragraphRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let result = xml.replace(paragraphRe, (paragraph) => {
    const text = paragraphText(paragraph);

    // Conditional clause markers — whole paragraph(s) act as the block.
    const clauseMatch = /\{\{(CLAUSE_[A-Z0-9_]+)\}\}/.exec(text);
    if (clauseMatch) {
      const clause = config.clauses.find(
        (c) => c.placeholder === `{{${clauseMatch[1]}}}`,
      );
      if (!clause) return ""; // unknown marker: drop the line
      if (evaluateCondition(clause.when, get)) {
        const lines = buildClauseLines(clause, config, values);
        if (lines.length === 0) return "";
        const lineText = lines.map(escapeXml).join(" ");
        // Keep the paragraph but swap its visible text for the clause lines.
        return replaceParagraphText(paragraph, lineText);
      }
      return ""; // condition false → remove the block entirely
    }

    // Regular placeholders — merge runs, then replace.
    if (XML_PLACEHOLDER_RE.test(text) || text.includes("{{")) {
      XML_PLACEHOLDER_RE.lastIndex = 0;
      const replaced = text.replace(XML_PLACEHOLDER_RE, (token) => {
        const value = replacements[token];
        return value !== undefined ? value : token;
      });
      if (replaced !== text) {
        return replaceParagraphText(paragraph, escapeXml(replaced));
      }
    }
    return paragraph;
  });

  // 2. Any leftover placeholder tokens inside tables / non-paragraph nodes
  //    (rare, but e.g. placeholders in table cells are still inside w:p so
  //    this is a safety net).
  result = result.replace(XML_PLACEHOLDER_RE, (token) => {
    const value = replacements[token];
    return value !== undefined ? escapeXml(value) : token;
  });

  return result;
}

/**
 * Replace the visible text of a paragraph while keeping the formatting of
 * its first run. Runs beyond the first have their text emptied.
 */
function replaceParagraphText(paragraph: string, newText: string): string {
  let first = true;
  return paragraph.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (_m, _content) => {
    if (first) {
      first = false;
      return `<w:t xml:space="preserve">${newText}</w:t>`;
    }
    return `<w:t xml:space="preserve"></w:t>`;
  });
}

/* ------------------------------------------------------------------ */
/* PDF conversion (Phase 1: best-effort)                               */
/* ------------------------------------------------------------------ */

/**
 * Phase 1: DOCX → PDF needs a full converter (LibreOffice / cloud API).
 * Not available client-side; the app offers DOCX only, and the archive
 * records that PDF was skipped. Phase 2 can plug a converter service here.
 */
export async function convertToPdf(
  _docx: Blob,
): Promise<Blob | null> {
  return null;
}
