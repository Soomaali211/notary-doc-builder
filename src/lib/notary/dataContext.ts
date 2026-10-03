/**
 * Phase 3B — Data Context Builder.
 *
 * One immutable context carries everything the generation pipeline needs:
 * the config, the answers, the configurable formatting, resolved boolean
 * flags for {{IF:…}} blocks, and helpers for mapped-value formatting.
 */

import type {
  ClauseMapping,
  DerivedValueDef,
  DocumentConfig,
  DocumentFormatConfig,
  FormValues,
  PartyDef,
  PartyRow,
} from "./types";
import { evaluateCondition, makeGetter } from "./conditions";
import { genderWord, type PartyGender, type PartyNumber } from "./partyModel";
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

/**
 * Filled rows only — empty optional rows never reach the document.
 *
 * A party that is ABSENT but REPRESENTED still belongs in the document: the
 * row carries no data of its own, but the representative linked to it must
 * be listed, otherwise the wakiil silently disappears and the parties it
 * stands for are dropped from the count. Attendance is therefore part of
 * "filled" (data mapping only — the renderer is untouched).
 */
function filledRows(rows: PartyRow[]): PartyRow[] {
  return rows.filter(
    (r) =>
      Object.values(r.values ?? {}).some((v) => (v ?? "").trim() !== "") ||
      !!r.attendance?.status ||
      !!r.attendance?.representativeId,
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

/**
 * Print a `type: "person"` row field as the person's NAME, not the id.
 *
 * A person field stores the row id of somebody already entered elsewhere in
 * the interview — that id is the LINK, and it must never reach the document:
 * a legal paper must print "AHMED CALI", never "s1".
 *
 * This is opt-in per FIELD, not per document type: only a field declared
 * `type: "person"` resolves this way, and no other document config declares
 * one. A config with no person fields takes exactly the code path it took
 * before, so Heshiis Kiro and its frozen template are untouched.
 *
 * Returns "" when the id matches nobody — an unresolvable person prints
 * nothing at all rather than guessing a name or leaking the id.
 */
function personRowTokens(
  config: DocumentConfig,
  values: FormValues,
  partyId: string,
  row: PartyRow,
): Record<string, string> {
  const partyDef = config.sections
    .flatMap((s) => s.parties ?? [])
    .find((p) => p.id === partyId);
  if (!partyDef) return {};
  const tokens: Record<string, string> = {};
  for (const field of partyDef.fields ?? []) {
    if (field.type !== "person" || !field.personSource) continue;
    const id = (row.values?.[field.id] ?? "").trim();
    const name = id ? personNameFor(config, values, field.personSource, id) : "";
    tokens[field.id.toUpperCase()] = name;
    // The name is what prints; the id stays available for a template that
    // wants a cross-reference, but under a name that says what it is.
    tokens[`${field.id.toUpperCase()}_ID`] = id;
  }
  return tokens;
}

/** Find a person by row id across the party lists a picker draws from. */
function personNameFor(
  config: DocumentConfig,
  values: FormValues,
  personSource: string,
  id: string,
): string {
  for (const sourceId of personSource.split(",").map((s) => s.trim())) {
    if (!sourceId) continue;
    const def = config.sections
      .flatMap((s) => s.parties ?? [])
      .find((p) => p.id === sourceId);
    const nameField = def?.fields?.find((f) => f.id === "magac")?.id ?? "magac";
    for (const candidate of partyRows(values, sourceId)) {
      if (candidate.id !== id) continue;
      return (candidate.values?.[nameField] ?? "").trim();
    }
  }
  return "";
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
    const bare = p.placeholder.replace(/[{}]/g, "").toUpperCase();
    const raw = singularPartyValue(resolveKey(values, key), bare);
    let value = formatValueByKind(raw, kind, format);
    if (!value && fallback) value = fallback;
    // Selects and stored enums translate into their Somali wording inside
    // the document — the raw storage value ("xidhan") must never be printed.
    if (value && !kind && value === raw) {
      // Order matters: config wording wins, the built-in Somali label map is
      // the fallback. Both return "" when nothing is declared, so the empty
      // string — not ?? — decides whether the raw value survives.
      const label =
        derivedTextFor(config, key, String(raw ?? "")) ||
        selectSomaliLabel(key, String(raw ?? ""));
      if (label) value = label;
    }
    map[p.placeholder] = value;
  }

  // Data annex — form fields the legal wording has no clause for, printed as
  // neutral "Label: value" lines. See DocumentConfig.annexFields.
  for (const field of config.annexFields ?? []) {
    const raw = resolveKey(values, field.key);
    const first = singularPartyValue(raw, field.token.toUpperCase());
    const value = formatValueByKind(first, field.format, format);
    map[`{{${field.token}}}`] = value;
  }

  // Joined party lists (legacy Phase 1 placeholders still supported).
  map["{{KIREYEYAYAAL_LIST}}"] = joinPartyList(values, "kireeyayaal");
  map["{{KIRAYSTAYAAL_LIST}}"] = joinPartyList(values, "kiraystayaal");

  // Values the SYSTEM derives from other answers (money still owed, party
  // counts…). Declared per document type; when a config declares none the
  // loop body never runs and the map is unchanged.
  for (const derived of config.derivedValues ?? []) {
    map[`{{${derived.token}}}`] = deriveValue(config, values, derived);
  }

  if (config.witnessPlaceholder) {
    map[config.witnessPlaceholder] = joinPartyList(
      values,
      "maragyo",
      config.witnessSeparator ?? "\n",
    );
  }

  // Sub-type label — read from the config's OWN setup section, so a document
  // type that calls it something other than "heshiiska" resolves too.
  const setupRaw = values[config.setupSectionId ?? "heshiiska"];
  const subType =
    setupRaw && !Array.isArray(setupRaw)
      ? String((setupRaw as Record<string, string>)["sub_type"] ?? "")
      : "";
  if (subType) {
    map["{{SUB_TYPE}}"] =
      config.subTypes.find((s) => s.value === subType)?.label ?? subType;
  }

  // Step 1 correction — Kiro Furan has no end date: a stale value left in
  // the draft (user switched Xidhan → Furan and chose "Hay draft-ka") must
  // never reach the document. Every end-date placeholder alias (the long
  // Somali name AND the short user-template aliases) is blanked.
  // Heshiis Kiro only: this correction reads the rental answers by name.
  // A document type without a "heshiiska" section never enters the block.
  const subTypeRaw = values["heshiiska"];
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

/**
 * Compute ONE declared derived value.
 *
 * `subtract` treats an empty input as 0 and never prints a negative figure:
 * a balance can be outstanding, never a refund invented out of thin air.
 * Empty in, empty out — an unfilled form produces no line at all.
 */
function deriveValue(
  config: DocumentConfig,
  values: FormValues,
  derived: DerivedValueDef,
): string {
  const format = config.format ?? {};
  if (derived.op === "party_count") {
    return String(filledRows(partyRows(values, derived.partyId)).length);
  }
  if (derived.op === "conditional") {
    // ONE token, ONE name: the same document slot holds different people
    // depending on a stored answer (a third-party guarantor, or the seller
    // guaranteeing his own sale). The singular-party rule still applies — a
    // party LIST key yields its first filled row, never a joined list.
    const key = evaluateCondition(derived.when, makeGetter(values))
      ? derived.thenKey
      : derived.elseKey;
    const raw = singularPartyValue(resolveKey(values, key), "");
    return formatValueByKind(raw, derived.format, format);
  }
  if (derived.op === "party_gender_word") {
    return partyGenderWord(derived, values);
  }
  const [first, ...rest] = derived.keys;
  const head = numericValue(resolveKey(values, first));
  if (head === null) return "";
  const total = rest.reduce((sum, key) => {
    const n = numericValue(resolveKey(values, key));
    return n === null ? sum : sum - n;
  }, head);
  const clamped = Math.max(0, total);
  return formatValueByKind(String(clamped), derived.format ?? "number", format);
}

/**
 * The legal role word for a party list, e.g. "iibisada" / "iibsadayaal".
 *
 * GENDER and NUMBER are resolved independently and deliberately:
 *
 *   • gender  — read from the person's OWN answer. NEVER inferred from the
 *               name (a man can be called Halima; the office decides).
 *   • number  — from the list length when "auto", else exactly as declared.
 *
 * A singular word with no chosen gender prints NOTHING. The alternative —
 * defaulting to the masculine — would put a wrong legal word into a signed
 * contract, so the empty result is the safe failure: the template's line
 * stays blank and the notary is asked in the UI instead.
 *
 * Empty list → empty string: an unfilled form never prints a legal word.
 */
function partyGenderWord(
  derived: Extract<DerivedValueDef, { op: "party_gender_word" }>,
  values: FormValues,
): string {
  const rows = filledRows(partyRows(values, derived.partyId));
  if (rows.length === 0) return "";
  const number: PartyNumber =
    derived.number === "auto" || derived.number === undefined
      ? rows.length === 1
        ? "singular"
        : "plural"
      : derived.number;
  // The plural carries no gender in the table, so a mixed or unchosen
  // gender is fine for TWO OR MORE people and only the singular needs it.
  const raw = (rows[0].values?.[derived.genderField ?? "jinsi"] ?? "").trim();
  const gender = (raw === "male" || raw === "female" ? raw : "unknown") as PartyGender;
  return genderWord({
    role: derived.role,
    gender,
    number,
    ...(derived.definite ? { definite: true } : {}),
  }) ?? "";
}

/** A form value as a number, or null when it is empty/not a number. */
function numericValue(raw: unknown): number | null {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const n = numericValue(item);
      if (n !== null) return n;
    }
    return null;
  }
  const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * A SINGULAR party placeholder ({{KIREYE_MAGAC}}, {{KIRAYSTE_TELEFOON}}, …)
 * points at a party LIST field, so resolveKey returns string[]. Printing it
 * raw produced "AHMED CALI,OMAR FARAH,…" on ONE line — several people's names
 * in a single party slot.
 *
 * A singular slot must hold ONE person: the first filled row. List
 * placeholders ({{KIREEYAYAAL_LIST}}, {{MARAGYO_LIST}}) keep the joined form,
 * because joining is exactly what they are for.
 */
function singularPartyValue(raw: unknown, bareToken: string): unknown {
  if (!Array.isArray(raw)) return raw;
  if (bareToken.endsWith("_LIST")) return raw;
  const first = raw.find((v) => String(v ?? "").trim() !== "");
  return first ?? "";
}

/**
 * Config-driven Somali wording for a stored value. Returns undefined when
 * the config declares no wording for this field/value pair, so the caller
 * can fall back to the value itself.
 */
function derivedTextFor(
  config: DocumentConfig,
  key: string,
  raw: string,
): string | undefined {
  return config.derivedText?.[key]?.[raw];
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

  // Attendance-derived document flags. These answer "does THIS group have a
  // party represented by a wakiil?", which the declarative conditionFlags
  // cannot express (it reads form fields, not per-party attendance status).
  // Added as data mapping only — the condition engine is untouched.
  for (const partyDef of config.sections.flatMap((s) => s.parties ?? [])) {
    if (!partyDef.attendance) continue;
    const group = partyDef.singular.toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const rows = partyRows(values, partyDef.id);
    flags[`${group}_WAKIIL`] = rows.some(
      (r) => r.attendance?.status === "wakiil" && !!r.attendance.representativeId,
    );
    flags[`${group}_JOOGA`] = rows.some((r) => r.attendance?.status === "jooga");
  }

  // Count flags — "is there exactly ONE, or several?" for a group whose count
  // the user picks directly (PartyDef.countFirst). The group name comes from
  // the PLURAL storage key, not the singular label, so the token can never
  // drift away from the block name ({{#IIBIYEYAAL}} ↔ {{IF:IIBIYEYAAL_BADAN}}).
  // Groups without countFirst produce no flags at all — the whole block is
  // inert for every document type that does not ask for a count.
  for (const partyDef of config.sections.flatMap((s) => s.parties ?? [])) {
    if (!partyDef.countFirst) continue;
    const group = partyDef.id.toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const count = filledRows(partyRows(values, partyDef.id)).length;
    flags[`${group}_HAL`] = count === 1;
    flags[`${group}_BADAN`] = count > 1;
  }

  // Annex group flags. Each annex field belongs to a named group so the
  // template can wrap a few lines in ONE {{IF:…}} and print nothing at all
  // when the group has no value. Groups are declared by the annex field's
  // `key` prefix — never hard-coded per document type.
  for (const field of config.annexFields ?? []) {
    const raw = resolveKey(values, field.key);
    const value = String(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "")).trim();
    if (value) flags[annexGroupFlag(field.group)] = true;
  }
  const annexFlags = (config.annexFields ?? [])
    .map((f) => annexGroupFlag(f.group))
    .filter((f, i, arr) => arr.indexOf(f) === i);
  for (const flag of annexFlags) if (flags[flag] === undefined) flags[flag] = false;
  // Only a document type that actually declares annex fields gets the
  // umbrella flag — a config with no annex has nothing to hide.
  if ((config.annexFields ?? []).length > 0) {
    flags.ANNEX_HAS_VALUES = annexFlags.some((f) => flags[f] === true);
  }
  return flags;
}

/**
 * Group flag name for one annex group: "bangiga" → ANNEX_BANGIGA.
 * Declared in the config, never derived from a form key.
 */
export function annexGroupFlag(group: string): string {
  return `ANNEX_${group.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
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
      // LAST, so a person field's token is the resolved NAME and not the
      // raw id that `...row.values` just spread in.
      ...personRowTokens(config, values, mapping.partyId, row),
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
  // The witness list ({{MARAGYO_LIST}}) is a real, resolvable placeholder —
  // it is declared through witnessPlaceholder, not through config.placeholders,
  // so it has to be registered here or the Template Manager reports the
  // office's own witness token as "placeholder aan system-ku aqoon".
  if (config.witnessPlaceholder) {
    names.add(config.witnessPlaceholder.replace(/[{}]/g, "").toUpperCase());
  }
  // Attendance-derived flags. resolveFlags() ALWAYS produces a <GROUP>_JOOGA
  // and a <GROUP>_WAKIIL for every attendance party, so the Template Manager
  // must accept them even when the current answers make them false — they are
  // valid {{IF:}} flags, not typos. (Without this, an uploaded template using
  // them was wrongly reported as "placeholder aan system-ku aqoon".)
  for (const partyDef of config.sections.flatMap((s) => s.parties ?? [])) {
    if (!partyDef.attendance) continue;
    const group = partyDef.singular.toUpperCase().replace(/[^A-Z0-9_]/g, "");
    names.add(`${group}_JOOGA`);
    names.add(`${group}_WAKIIL`);
  }
  // Count flags — resolveFlags() ALWAYS emits <GROUP>_HAL / <GROUP>_BADAN
  // for a countFirst group, so the Template Manager must accept them even
  // when the current answers make them false.
  for (const partyDef of config.sections.flatMap((s) => s.parties ?? [])) {
    if (!partyDef.countFirst) continue;
    const group = partyDef.id.toUpperCase().replace(/[^A-Z0-9_]/g, "");
    names.add(`${group}_HAL`);
    names.add(`${group}_BADAN`);
  }
  // Derived values ({{LACAGTA_HADHAY}}, {{TIRADA_IIBIYEYAAL}}, …) are real,
  // resolvable placeholders — the validator must accept them.
  for (const derived of config.derivedValues ?? []) {
    names.add(derived.token.toUpperCase());
  }
  for (const clause of config.clauses) {
    names.add(clause.placeholder.replace(/[{}]/g, "").toUpperCase());
  }
  // Sequential clause number — resolved by the renderer after conditionals,
  // so {{CLAUSE_NO}} is only ever legal when numbering is enabled.
  if (config.clauseNumbering) names.add("CLAUSE_NO");
  for (const field of config.annexFields ?? []) {
    names.add(field.token.toUpperCase());
  }
  // Annex group flags — {{IF:ANNEX_BANGIGA}} … {{END:ANNEX_BANGIGA}} and the
  // umbrella {{IF:ANNEX_HAS_VALUES}} that hides the whole annex when empty.
  if ((config.annexFields ?? []).length > 0) {
    names.add("ANNEX_HAS_VALUES");
    for (const field of config.annexFields ?? []) {
      names.add(annexGroupFlag(field.group));
    }
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
