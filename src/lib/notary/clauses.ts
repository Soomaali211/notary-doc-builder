/**
 * Phase 3E — Clause Engine (ClauseResolver).
 *
 * Architecture: Interview Data → Rule Engine → Clause Selection → Assembly.
 * A clause renders its lines only when its condition holds; otherwise the
 * {{CLAUSE_*}} marker paragraph is removed entirely — no empty section, no
 * placeholder leakage, and no invented legal wording. All wording is either
 * the office's approved static lines or the Phase 1 dynamic lines driven by
 * the user's answers (deebaaji / damiin / MUQADIN–MU'AKHIR / custom terms).
 */

import type {
  ClauseMapping,
  DocumentConfig,
  FormValues,
} from "./types";
import { evaluateCondition, makeGetter } from "./conditions";
import {
  formatCurrencyValue,
  formatValueByKind,
  joinNonEmpty,
  resolveKey,
} from "./format";

/* ------------------------------------------------------------------ */
/* Dynamic line builders (approved Phase 1 wording, data-driven)       */
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

function partyRows(values: FormValues, key: string) {
  const v = values[key];
  return Array.isArray(v) ? v : [];
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

function str(get: (key: string) => unknown, key: string): string {
  const v = get(key);
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function strOrNum(v: unknown): string | number | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return v;
  return undefined;
}

export function buildDeebaajiLines(
  config: DocumentConfig,
  values: FormValues,
): string[] {
  const amount = formatCurrencyValue(
    strOrNum(resolveKey(values, "deebaaji.lacagta_deebaajiga")),
    config.format?.currency,
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

export function buildDamiinLines(
  config: DocumentConfig,
  values: FormValues,
): string[] {
  const name = firstPartyField(values, "damiinka", "damiin_magac");
  const get = makeGetter(values);
  const phone = str(get, "damiinka.damiin_telefoon");
  const id = str(get, "damiinka.damiin_aqoonsi");
  const address = str(get, "damiinka.damiin_cinwaan");
  const details = joinNonEmpty([phone, id, address], " — ");
  return [
    details
      ? `Damiin: ${name}${details ? ` — ${details}` : ""}. Damiinku wuxuu noqonayaa dammaanad qadka heshiiskan, isla markaana wuxuu mas'uul ka yahay haddii kiraystuhu ku guuldarreysto xilalkiisa.`
      : `Damiin: ${name}. Damiinku wuxuu noqonayaa dammaanad qadka heshiiskan.`,
  ];
}

/** MUQADIN / MU'AKHIR wording — the form choice decides the document text. */
export function buildAdvanceLines(
  config: DocumentConfig,
  values: FormValues,
): string[] {
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

function buildCustomLines(
  config: DocumentConfig,
  values: FormValues,
): string[] {
  const extra = resolveKey(values, "dheeraad.shuruudo_dheeraad");
  return typeof extra === "string" && extra.trim()
    ? [`Shuruudo dheeraad ah: ${extra.trim()}`]
    : [];
}

/* ------------------------------------------------------------------ */
/* Clause resolution                                                   */
/* ------------------------------------------------------------------ */

/** Render a clause's lines for the current answers (empty → block removed). */
export function resolveClauseLines(
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
      case "custom":
        return buildCustomLines(config, values);
    }
  }
  return clause.lines ?? [];
}

export interface ResolvedClause {
  clause: ClauseMapping;
  /** True when `when` holds and the clause has content. */
  included: boolean;
  lines: string[];
}

/**
 * Resolve every clause for a document: rule engine (conditions) → selection.
 * Clauses whose condition fails resolve to `included: false` so the renderer
 * removes their marker paragraphs entirely.
 */
export function resolveClauses(
  config: DocumentConfig,
  values: FormValues,
): Map<string, ResolvedClause> {
  const get = makeGetter(values);
  const out = new Map<string, ResolvedClause>();
  for (const clause of config.clauses) {
    const included =
      evaluateCondition(clause.when, get) &&
      resolveClauseLines(clause, config, values).length > 0;
    out.set(clause.placeholder.replace(/[{}]/g, ""), {
      clause,
      included,
      lines: included ? resolveClauseLines(clause, config, values) : [],
    });
  }
  return out;
}

/** Marker name ("CLAUSE_DEEBAAJI") for a {{CLAUSE_*}} token. */
export function clauseMarkerName(token: string): string {
  return token.replace(/[{}]/g, "").toUpperCase();
}

/** Helper kept for parity with the format module (kinded formatting). */
export function formatKinded(
  config: DocumentConfig,
  raw: unknown,
  kind: string | undefined,
): string {
  return formatValueByKind(raw, kind, config.format);
}
