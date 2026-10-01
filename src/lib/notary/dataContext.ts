/**
 * Phase 3B — Data Context Builder.
 *
 * One immutable context carries everything the generation pipeline needs:
 * the config, the answers, the configurable formatting, resolved boolean
 * flags for {{IF:…}} blocks, and helpers for mapped-value formatting.
 */

import type {
  ClauseMapping,
  DocumentConfig,
  DocumentFormatConfig,
  FormValues,
  PartyDef,
  PartyRow,
} from "./types";
import { evaluateCondition, makeGetter } from "./conditions";
import { formatValueByKind, resolveKey, joinNonEmpty } from "./format";
import { representedByRep } from "./formValues";
import { representativesKeyFor } from "./types";

export interface DataContext {
  config: DocumentConfig;
  values: FormValues;
  format: DocumentFormatConfig;
  get: (key: string) => unknown;
  /** Resolved named flags: {{IF:DEEBAAJI_HAA}} → boolean. */
  flags: Record<string, boolean>;
  /** Case-insensitive placeholder → replacement string. */
  replacements: Record<string, string>;
  /** Every placeholder name the context can resolve (for validation). */
  knownNames: Set<string>;
  /** Clause mappings by template marker name, e.g. CLAUSE_DEEBAAJI. */
  clausesByName: Map<string, ClauseMapping>;
  /** Repeat blocks by block id (case-insensitive lookup key). */
  repeatBlocks: Map<string, RepeatBlockInfo>;
}

import type { RepeatBlockMapping } from "./types";

export interface RepeatBlockInfo {
  mapping: RepeatBlockMapping;
  /** 1-based item numbers with the row's token values (case-insensitive). */
  rows: Record<string, string>[];
}

/* ------------------------------------------------------------------ */
/* Party helpers                                                       */
/* ------------------------------------------------------------------ */

function partyRows(values: FormValues, partyId: string): PartyRow[] {
  const v = values[partyId];
  return Array.isArray(v) ? (v as PartyRow[]) : [];
}

/** Filled rows only — empty optional rows never reach the document. */
function filledRows(rows: PartyRow[]): PartyRow[] {
  return rows.filter((r) =>
    Object.values(r.values ?? {}).some((v) => (v ?? "").trim() !== ""),
  );
}

function firstPartyField(
  values: FormValues,
  partyId: string,
  fieldId: string,
): string {
  for (const r of partyRows(values, partyId)) {
    const v = (r.values?.[fieldId] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/**
 * Phase Document Generation — the representative (wakiil) fields of the
 * FIRST absent party that has a linked rep. Empty when nobody is
 * represented: a jooga party NEVER shows wakiil data in the document.
 * Field ids come from the config's representativeFields (no hard-coded
 * party names), so any future document type inherits the same behavior.
 */
function firstWakiilValues(
  config: DocumentConfig,
  values: FormValues,
  partyDef: PartyDef,
): Record<string, string> {
  const fields = partyDef.representativeFields ?? [];
  const empty = Object.fromEntries(fields.map((f) => [f.id, ""]));
  const rows = partyRows(values, partyDef.id);
  const represented = rows.find(
    (r) => r.attendance?.status === "wakiil" && r.attendance.representativeId,
  );
  if (!represented) return empty;
  const reps = values[representativesKeyFor(partyDef)];
  const rep = Array.isArray(reps)
    ? (reps as PartyRow[]).find((r) => r.id === represented.attendance!.representativeId)
    : undefined;
  if (!rep) return empty;
  return Object.fromEntries(
    fields.map((f) => [f.id, (rep.values?.[f.id] ?? "").trim()]),
  );
}

function partyRowTokens(
  row: PartyRow,
  mapping: RepeatBlockMapping,
): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const field of Object.keys(row.values ?? {})) {
    tokens[field.toUpperCase()] = (row.values?.[field] ?? "").trim();
  }
  for (const [token, fieldId] of Object.entries(mapping.aliases ?? {})) {
    tokens[token.toUpperCase()] = (row.values?.[fieldId] ?? "").trim();
  }
  return tokens;
}

/* ------------------------------------------------------------------ */
/* Context builder                                                     */
/* ------------------------------------------------------------------ */

/** Compute every configured placeholder → replacement string. */
export function computeReplacements(
  config: DocumentConfig,
  values: FormValues,
): Record<string, string> {
  const format = config.format ?? {};
  const map: Record<string, string> = {};

  for (const p of config.placeholders) {
    const { key, format: kind, fallback } = p.mapping;
    const raw = resolveKey(values, key);
    let value = formatValueByKind(raw, kind, format);
    if (!value && fallback) value = fallback;
    // Selects translate into their Somali wording inside the document.
    if (value && !kind && value === raw) {
      const label = selectSomaliLabel(key, String(raw ?? ""));
      if (label) value = label;
    }
    map[p.placeholder] = value;
  }

  // Joined party lists (legacy Phase 1 placeholders still supported).
  map["{{KIREYEYAYAAL_LIST}}"] = joinPartyList(values, "kireeyayaal");
  map["{{KIRAYSTAYAAL_LIST}}"] = joinPartyList(values, "kiraystayaal");

  if (config.witnessPlaceholder) {
    map[config.witnessPlaceholder] = joinPartyList(
      values,
      "maragyo",
      config.witnessSeparator ?? "\n",
    );
  }

  const subTypeRaw = values["heshiiska"];
  const subType =
    subTypeRaw && !Array.isArray(subTypeRaw)
      ? String((subTypeRaw as Record<string, string>)["sub_type"] ?? "")
      : "";
  if (subType) {
    map["{{SUB_TYPE}}"] =
      config.subTypes.find((s) => s.value === subType)?.label ?? subType;
  }

  // Step 1 correction — Kiro Furan has no end date: a stale value left in
  // the draft (user switched Xidhan → Furan and chose "Hay draft-ka") must
  // never reach the document. Every end-date placeholder alias (the long
  // Somali name AND the short user-template aliases) is blanked.
  if (subTypeRaw && !Array.isArray(subTypeRaw)) {
    const heshiiska = subTypeRaw as Record<string, string>;
    if (heshiiska.muddada_nooca !== "xidhan") {
      for (const key of Object.keys(map)) {
        const name = key.replace(/[{}]/g, "").toUpperCase();
        if (name === "TAARIIKHDA_DHAMMAADKA" || name === "TAARIIKH_DHAMMAAD") {
          map[key] = "";
        }
      }
    }
  }

  // Phase Document Generation — wakiil (representative) placeholders for the
  // user's own template, derived from the config's attendance groups:
  //   {{WAKIIL_MAGAC}}                     → first represented group
  //   {{KIREYE_WAKIIL_MAGAC}}              → per group (singular name)
//   per-party wakiil data lives INSIDE repeat blocks (buildRepeatBlockData)
  const attendanceGroups = config.sections
    .flatMap((s) => s.parties ?? [])
    .filter((p) => p.attendance);
  attendanceGroups.forEach((partyDef, index) => {
    const rep = firstWakiilValues(config, values, partyDef);
    const group = partyDef.singular.toUpperCase().replace(/[^A-Z0-9_]/g, "");
    for (const [fieldId, value] of Object.entries(rep)) {
      const token = `WAKIIL_${fieldId.toUpperCase()}`;
      // The short {{WAKIIL_*}} alias points at the first attendance group.
      if (index === 0) map[`{{${token}}}`] = value;
      map[`{{${group}_${token}}}`] = value;
    }
  });

  return map;
}

function selectSomaliLabel(key: string, raw: string): string {
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
  if (
    ["habka_bixinta", "bixinta_hore", "nooca_guriga", "sub_type"].some((k) =>
      key.endsWith(k),
    )
  ) {
    return SOMALI_LABELS[raw] ?? raw;
  }
  return "";
}

function joinPartyList(
  values: FormValues,
  partyId: string,
  separator = ", ",
): string {
  return joinNonEmpty(
    filledRows(partyRows(values, partyId)).map((r) => {
      const parts = Object.values(r.values ?? {})
        .map((v) => (v ?? "").trim())
        .filter(Boolean);
      return parts.join(" — ");
    }),
    separator,
  );
}

/** Resolve every named condition flag ({{IF:…}}) against the answers. */
export function resolveFlags(
  config: DocumentConfig,
  values: FormValues,
): Record<string, boolean> {
  const get = makeGetter(values);
  const flags: Record<string, boolean> = {};
  for (const [name, condition] of Object.entries(config.conditionFlags ?? {})) {
    flags[name.toUpperCase()] = evaluateCondition(condition, get);
  }
  return flags;
}

/**
 * Phase Document Generation — per-row wakiil tokens for ATTENDANCE party
 * blocks (KIREYEYAYAAL / KIRAYSTAYAAL). Each row exposes the fields of ITS
 * OWN representative (empty for a jooga party — never leaks wakiil data for
 * a present person) plus row-scoped flags usable inside the repeat body:
 *   {{IF:WAKIIL}}…{{END:WAKIIL}}  → renders only when this party is absent
 *   {{IF:JOOGA}}…{{END:JOOGA}}    → renders only when this party is present
 */
function wakiilRowTokens(
  config: DocumentConfig,
  values: FormValues,
  partyId: string,
  row: PartyRow,
): Record<string, string> {
  const partyDef = config.sections
    .flatMap((s) => s.parties ?? [])
    .find((p) => p.id === partyId);
  if (!partyDef?.attendance) return {};
  const repFields = partyDef.representativeFields ?? [];
  const status = row.attendance?.status;
  const tokens: Record<string, string> = {
    JOOGA: status === "jooga" ? "1" : "",
    WAKIIL: status === "wakiil" ? "1" : "",
  };
  // Every configured representative field gets a WAKIIL_<FIELD> token,
  // empty unless THIS row is represented.
  for (const f of repFields) tokens[`WAKIIL_${f.id.toUpperCase()}`] = "";
  if (status !== "wakiil" || !row.attendance?.representativeId) return tokens;

  const reps = values[representativesKeyFor(partyDef)];
  const rep = Array.isArray(reps)
    ? (reps as PartyRow[]).find((r) => r.id === row.attendance!.representativeId)
    : undefined;
  if (!rep) return tokens;
  for (const f of repFields) {
    tokens[`WAKIIL_${f.id.toUpperCase()}`] = (rep.values?.[f.id] ?? "").trim();
  }
  return tokens;
}

/** Build repeat-block row data from the mapped party lists. */
export function buildRepeatBlockData(
  config: DocumentConfig,
  values: FormValues,
): Map<string, RepeatBlockInfo> {
  const map = new Map<string, RepeatBlockInfo>();
  for (const mapping of config.repeatBlocks ?? []) {
    const rows = filledRows(partyRows(values, mapping.partyId)).map((row, i) => ({
      NUMBER: String(i + 1),
      ...wakiilRowTokens(config, values, mapping.partyId, row),
      ...(row.values ?? {}),
      ...partyRowTokens(row, mapping),
    }));

    // Phase Revision — representative blocks carry a computed MATALAYA
    // token: the parties each wakiil represents ("Kireeye 2, Kireeye 3").
    if (mapping.partyId.startsWith("wakiilo_")) {
      const parentDef = config.sections
        .flatMap((s) => s.parties ?? [])
        .find((p) => representativesKeyFor(p) === mapping.partyId);
      if (parentDef) {
        const filled = filledRows(partyRows(values, mapping.partyId));
        rows.forEach((row, i) => {
          const repRow = filled[i];
          if (!repRow) return;
          (row as Record<string, string>).MATALAYA = representedByRep(
            values,
            parentDef,
            repRow.id,
          ).join(", ");
        });
      }
    }

    map.set(mapping.blockId.toUpperCase(), {
      mapping,
      rows: rows as Record<string, string>[],
    });
  }
  return map;
}

/** Build the full immutable generation context. */
export function buildDataContext(
  config: DocumentConfig,
  values: FormValues,
): DataContext {
  const replacements = computeReplacements(config, values);
  const knownNames = new Set<string>();
  for (const key of Object.keys(replacements)) {
    knownNames.add(key.replace(/[{}]/g, "").toUpperCase());
  }
  for (const block of config.repeatBlocks ?? []) {
    knownNames.add(`#${block.blockId.toUpperCase()}`);
    knownNames.add(`/${block.blockId.toUpperCase()}`);
    const info = buildRepeatBlockData(config, values).get(
      block.blockId.toUpperCase(),
    );
    if (info) {
      for (const row of info.rows) {
        for (const token of Object.keys(row)) knownNames.add(token.toUpperCase());
      }
    }
  }

  const clausesByName = new Map<string, ClauseMapping>();
  for (const clause of config.clauses) {
    clausesByName.set(clause.placeholder.replace(/[{}]/g, ""), clause);
  }

  return {
    config,
    values,
    format: config.format ?? {},
    get: makeGetter(values),
    flags: resolveFlags(config, values),
    replacements,
    knownNames,
    clausesByName,
    repeatBlocks: buildRepeatBlockData(config, values),
  };
}

/**
 * Every placeholder name this config CAN resolve — for the Template Manager
 * to categorize the tokens found in a user-uploaded .docx. Static and
 * value-independent: configured placeholders, condition flags, clause
 * markers, repeat-block ids and ALL row tokens (fields, aliases, NUMBER,
 * wakiil tokens, MATALAYA), even when the current answers are empty.
 */
export function knownPlaceholderNames(config: DocumentConfig): Set<string> {
  const names = new Set<string>();
  for (const p of config.placeholders) {
    names.add(p.placeholder.replace(/[{}]/g, "").toUpperCase());
  }
  for (const flag of Object.keys(config.conditionFlags ?? {})) {
    names.add(flag.toUpperCase());
  }
  for (const clause of config.clauses) {
    names.add(clause.placeholder.replace(/[{}]/g, "").toUpperCase());
  }
  for (const block of config.repeatBlocks ?? []) {
    const id = block.blockId.toUpperCase();
    names.add(`#${id}`);
    names.add(`/${id}`);
    names.add((block.numberPlaceholder ?? "NUMBER").toUpperCase());
    for (const alias of Object.keys(block.aliases ?? {})) {
      names.add(alias.toUpperCase());
    }
    const partyDef = config.sections
      .flatMap((s) => s.parties ?? [])
      .find((p) => p.id === block.partyId);
    for (const field of partyDef?.fields ?? []) {
      names.add(field.id.toUpperCase());
    }
    if (partyDef?.attendance) {
      names.add("JOOGA");
      names.add("WAKIIL");
      for (const f of partyDef.representativeFields ?? []) {
        names.add(`WAKIIL_${f.id.toUpperCase()}`);
        names.add(`${partyDef.singular.toUpperCase()}_WAKIIL_${f.id.toUpperCase()}`);
      }
    }
    if (block.partyId.startsWith("wakiilo_")) {
      names.add("MATALAYA");
      for (const field of partyDef?.representativeFields ?? []) {
        names.add(field.id.toUpperCase());
      }
    }
  }
  return names;
}

/** Format one mapped key with the document's format config. */
export function formatMappedValue(
  ctx: DataContext,
  key: string,
  kind?: string,
): string {
  return formatValueByKind(resolveKey(ctx.values, key), kind, ctx.format);
}

export { firstPartyField, filledRows };
