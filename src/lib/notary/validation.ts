import type { AnyFieldDef, DocumentConfig, FormValues, PartyDef, PartyRow } from "./types";
import { evaluateCondition, makeGetter } from "./conditions";
import { formatValueByKind, resolveKey } from "./format";

const SOMALI_DIGITS_ONLY = /^[0-9()+\-\s]{6,20}$/;

export interface FieldError {
  fieldId: string;
  message: string;
}

export interface PartyError {
  index: number;
  errors: FieldError[];
}

export interface SectionErrors {
  fieldErrors: Record<string, string>;
  partyErrors: Record<string, PartyError[]>; // keyed by party def id
  general: string[];
}

const MONTHS_30 = new Set([4, 6, 9, 11]);

/** Validate a date string "YYYY-MM-DD"; returns Somali error or null. */
export function validateDateString(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "Taariikhda waa mid aan sax ahayn (YYYY-MM-DD).";
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12) return "Bisha waa inay u dhexeysaa 1 iyo 12.";
  if (d < 1 || d > 31) return "Maalintu waa inay u dhexeysaa 1 iyo 31.";
  if (MONTHS_30.has(m) && d > 30) return "Bishaas ma laha maalin 31aad.";
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const maxDay = leap ? 29 : 28;
    if (d > maxDay) return "Febraayo ma laha maalintaas.";
  }
  if (y < 1900 || y > 2100) return "Sanadka waa mid aan macquul ahayn.";
  return null;
}

/** Validate one field value; returns Somali error message or null. */
export function validateField(field: AnyFieldDef, value: string): string | null {
  const text = (value ?? "").trim();
  const required = !field.optional && field.validation?.required !== false;

  if (required && text === "") {
    return `Fadlan buuxi: ${field.label}`;
  }
  if (text === "") return null; // nothing else to check

  switch (field.type) {
    case "number":
    case "currency": {
      if (!/^\d+(\.\d{1,2})?$/.test(text)) {
        return `${field.label}: fadlan geli tiro sax ah (tusaale: 350).`;
      }
      const n = Number(text);
      if (field.validation?.min !== undefined && n < field.validation.min) {
        return `${field.label}: waa inay ka weyn tahay ${field.validation.min}.`;
      }
      if (field.validation?.max !== undefined && n > field.validation.max) {
        return `${field.label}: waa inay ka yar tahay ${field.validation.max}.`;
      }
      return null;
    }
    case "phone": {
      if (!SOMALI_DIGITS_ONLY.test(text)) {
        return `${field.label}: geli nambar telefoon sax ah (tusaale: +252 61 5551234).`;
      }
      return null;
    }
    case "date": {
      return validateDateString(text);
    }
    case "text":
    case "textarea": {
      if (field.validation?.maxLength && text.length > field.validation.maxLength) {
        return `${field.label}: waa inay ka gaaban tahay ${field.validation.maxLength} xaraf.`;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Cross-field checks that need two values (e.g. end date after start date). */
export function validateSectionCross(
  fields: AnyFieldDef[],
  values: Record<string, string>,
): string[] {
  const errors: string[] = [];
  const start = values["taariikhda_bilowga"];
  const end = values["taariikhda_dhammaadka"];
  const hasStart = fields.some((f) => f.id === "taariikhda_bilowga");
  if (hasStart && start && end) {
    const startErr = validateDateString(start);
    const endErr = validateDateString(end);
    if (!startErr && !endErr && new Date(end) <= new Date(start)) {
      errors.push(
        "Taariikhda dhammaadka waa inay ka horreysaa taariikhda bilowga — fadlan sax.",
      );
    }
  }
  return errors;
}

function validatePartyList(
  partyDef: PartyDef,
  rows: PartyRow[],
  general: string[],
): Record<number, FieldError[]> {
  const perRow: Record<number, FieldError[]> = {};
  const filledRows = rows.filter((r) =>
    Object.values(r.values ?? {}).some((v) => (v ?? "").trim() !== ""),
  );

  if (filledRows.length < partyDef.min) {
    general.push(
      `${partyDef.label}: ugu yaraan ${partyDef.min} ${partyDef.singular} waa loo baahan yahay.`,
    );
    return perRow;
  }

  rows.forEach((row, index) => {
    const rowHasAny = Object.values(row.values ?? {}).some(
      (v) => (v ?? "").trim() !== "",
    );
    if (!rowHasAny && partyDef.optionalList) return;
    if (!rowHasAny && partyDef.min > 0 && index >= partyDef.min) return;

    const rowErrors: FieldError[] = [];
    for (const field of partyDef.fields) {
      const err = validateField(field, row.values?.[field.id] ?? "");
      if (err) rowErrors.push({ fieldId: field.id, message: err });
    }
    if (rowErrors.length > 0) perRow[index] = rowErrors;
  });
  return perRow;
}

/** Validate an entire document against its config. Returns per-section errors. */
export function validateDocument(
  config: DocumentConfig,
  values: FormValues,
): Record<string, SectionErrors> {
  const get = makeGetter(values);
  const result: Record<string, SectionErrors> = {};

  for (const section of config.sections) {
    const sectionValues = values[section.id];
    const fieldErrors: Record<string, string> = {};
    const partyErrors: Record<string, PartyError[]> = {};
    const general: string[] = [];

    if (sectionValues && !Array.isArray(sectionValues)) {
      const record = sectionValues as Record<string, string>;

      for (const field of section.fields) {
        if ("visibleWhen" in field && !evaluateCondition(field.visibleWhen, get)) {
          continue; // hidden conditional fields are not validated
        }
        const err = validateField(field, record[field.id] ?? "");
        if (err) fieldErrors[field.id] = err;
      }

      general.push(...validateSectionCross(section.fields, record));
    }

    for (const partyDef of section.parties ?? []) {
      const rows = (Array.isArray(values[partyDef.id]) ? values[partyDef.id] : []) as PartyRow[];
      const perRow = validatePartyList(partyDef, rows, general);
      if (Object.keys(perRow).length > 0) {
        partyErrors[partyDef.id] = Object.entries(perRow).map(([index, errs]) => ({
          index: Number(index),
          errors: errs,
        }));
      }
    }

    if (Object.keys(fieldErrors).length || general.length || Object.keys(partyErrors).length) {
      result[section.id] = { fieldErrors, partyErrors, general };
    }
  }

  // Witness requirement from document configuration
  if (config.requiresWitness && config.witnessPlaceholder) {
    const witnessSection = config.sections.find((s) =>
      (s.parties ?? []).some((p) => p.id === "maragyo"),
    );
    if (witnessSection) {
      const rows = (values["maragyo"] as PartyRow[] | undefined) ?? [];
      if (rows.length === 0) {
        const existing = result[witnessSection.id] ?? {
          fieldErrors: {},
          partyErrors: {},
          general: [],
        };
        existing.general.push("Ugu yaraan hal marag waa loo baahan yahay.");
        result[witnessSection.id] = existing;
      }
    }
  }

  return result;
}

/** Build the plain-text review summary data for a config (used by review page). */
export function collectFilledValues(
  config: DocumentConfig,
  values: FormValues,
): { label: string; value: string }[] {
  const get = makeGetter(values);
  const rows: { label: string; value: string }[] = [];

  for (const section of config.sections) {
    const sectionValues = values[section.id];
    for (const field of section.fields) {
      if ("visibleWhen" in field && !evaluateCondition(field.visibleWhen, get)) continue;
      const raw = resolveKey(values, `${section.id}.${field.id}`);
      const formatted = formatValueByKind(raw, field.type === "date" ? "date" : field.type === "currency" ? "currency" : field.type === "yesno" ? "yesno" : undefined);
      if (formatted) rows.push({ label: field.label, value: formatted });
    }
    for (const partyDef of section.parties ?? []) {
      const partyRows = (Array.isArray(values[partyDef.id]) ? values[partyDef.id] : []) as PartyRow[];
      partyRows.forEach((row, i) => {
        const name = row.values?.[partyDef.fields[0]?.id ?? ""] ?? "";
        if (!name.trim()) return;
        const details = partyDef.fields
          .slice(1)
          .map((f) => row.values?.[f.id] ?? "")
          .filter(Boolean)
          .join(" — ");
        rows.push({
          label: `${partyDef.singular} ${i + 1}`,
          value: details ? `${name} — ${details}` : name,
        });
      });
    }
  }
  return rows;
}
