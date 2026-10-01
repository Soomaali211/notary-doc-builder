import type {
  DocumentConfig,
  FieldDef,
  FormValues,
  PartyDef,
  PartyRow,
  SectionDef,
} from "./types";
import { evaluateCondition, makeGetter } from "./conditions";
import { formatValueByKind, resolveKey } from "./format";
import { getRepresentatives, representedByRep, representativeNameFor } from "./formValues";
import { FIELD_SKIPPED } from "./types";

/**
 * Effective requiredness of one field for the CURRENT answers — the single
 * source the interview's guided pre-check and the validator both use.
 * `requiredWhen` wins over `optional` (conditional requiredness).
 */
export function isFieldRequired(
  field: FieldDef,
  values: FormValues,
  get: (key: string) => unknown,
): boolean {
  if (field.requiredWhen && evaluateCondition(field.requiredWhen, get)) return true;
  return !field.optional && field.validation?.required !== false;
}

const PHONE_RE = /^[0-9()+\-\s]{6,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MONTHS_30 = new Set([4, 6, 9, 11]);

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
  partyErrors: Record<string, PartyError[]>;
  general: string[];
}

/** Validate a date string "YYYY-MM-DD"; returns a Somali error or null. */
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
    if (d > (leap ? 29 : 28)) return "Febraayo ma laha maalintaas.";
  }
  if (y < 1900 || y > 2100) return "Sanadka waa mid aan macquul ahayn.";
  return null;
}

/** Numeric amount: digits with optional 2-decimal fraction. */
function isAmount(text: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(text);
}

/**
 * Validate one field value against its declarative rules.
 * Returns a Somali error message or null when valid.
 */
export function validateField(field: FieldDef, value: string): string | null {
  const text = (value ?? "").trim();
  const rules = field.validation ?? {};
  const required = !field.optional && rules.required !== false;

  // Guided form: an explicitly skipped field behaves like a deliberate
  // empty optional value — never a format/pattern error. A marker on a
  // NON-skippable field is invalid bookkeeping: required fields surface
  // their error, optional ones degrade to empty.
  if (text === FIELD_SKIPPED) {
    if (field.skippable) return null;
    return required ? `Fadlan buuxi: ${field.label}` : null;
  }

  if (text === "") {
    if (required) return `Fadlan buuxi: ${field.label}`;
    return null;
  }

  if (rules.minLength !== undefined && text.length < rules.minLength) {
    return `${field.label}: waa inay ka dhaafsan tahay ${rules.minLength} xaraf.`;
  }
  if (rules.maxLength !== undefined && text.length > rules.maxLength) {
    return `${field.label}: waa inay ka gaaban tahay ${rules.maxLength} xaraf.`;
  }
  if (rules.pattern !== undefined) {
    try {
      if (!new RegExp(rules.pattern).test(text)) {
        return rules.patternMessage ?? `${field.label}: fadlan geli qoraal sax ah.`;
      }
    } catch {
      // Invalid pattern in config: treat as pass rather than crash.
      return null;
    }
  }

  switch (field.type) {
    case "number":
    case "currency": {
      if (!isAmount(text)) {
        return `${field.label}: fadlan geli tiro sax ah (tusaale: 350).`;
      }
      const n = Number(text);
      if (rules.min !== undefined && n < rules.min) {
        return `${field.label}: waa inay ka weyn tahay ${rules.min}.`;
      }
      if (rules.max !== undefined && n > rules.max) {
        return `${field.label}: waa inay ka yar tahay ${rules.max}.`;
      }
      return null;
    }
    case "phone":
      return PHONE_RE.test(text)
        ? null
        : `${field.label}: geli nambar telefoon sax ah (tusaale: +252 61 5551234).`;
    case "email":
      return EMAIL_RE.test(text)
        ? null
        : `${field.label}: geli email sax ah (tusaale: name@example.com).`;
    case "date":
      return validateDateString(text);
    case "select":
    case "radio": {
      const options = field.options ?? [];
      if (options.length > 0 && !options.some((o) => o.value === text)) {
        return `${field.label}: dooro mid ka mid ah ikhtiyaarada.`;
      }
      return null;
    }
    case "checkbox":
      return text === "yes" || text === "no" ? null : null;
    case "multiselect": {
      const options = field.options ?? [];
      if (options.length === 0) return null;
      const chosen = text.split(",").map((s) => s.trim()).filter(Boolean);
      const invalid = chosen.filter((c) => !options.some((o) => o.value === c));
      if (invalid.length > 0) {
        return `${field.label}: dooro ikhtiyaarada la oggol yahay oo keliya.`;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Cross-field date-range check: end > start (strictly after).
 * Step 1 rule — Kiro Xidhan: endDate > startDate.
 */
export function validateSectionCross(
  fields: FieldDef[],
  values: Record<string, string>,
): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    if (!field.validation?.notBefore) continue;
    const end = (values[field.id] ?? "").trim();
    const start = (values[field.validation.notBefore] ?? "").trim();
    if (!end || !start) continue;
    const endErr = validateDateString(end);
    const startErr = validateDateString(start);
    if (endErr || startErr) continue; // individual date errors already reported
    if (new Date(end) <= new Date(start)) {
      errors.push(
        `${field.label} waa inay ka dambeysaa taariikhda bilowga.`,
      );
    }
  }
  return errors;
}

/** Validate one repeater (min/max count + per-row field rules). */
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
      partyDef.minMessage ??
        `${partyDef.label}: ugu yaraan ${partyDef.min} ${partyDef.singular} ayaa loo baahan yahay.`,
    );
    return perRow;
  }
  if (partyDef.max && partyDef.max > 0 && filledRows.length > partyDef.max) {
    general.push(
      `${partyDef.label}: ugu badnaan ${partyDef.max} ${partyDef.singular}.`,
    );
    return perRow;
  }

  rows.forEach((row, index) => {
    const rowHasAny = Object.values(row.values ?? {}).some(
      (v) => (v ?? "").trim() !== "",
    );
    // Ignore trailing empty rows on optional lists.
    if (!rowHasAny && partyDef.optionalList) return;
    if (!rowHasAny && index >= partyDef.min) return;

    const rowErrors: FieldError[] = [];
    for (const field of partyDef.fields) {
      const err = validateField(field, row.values?.[field.id] ?? "");
      if (err) rowErrors.push({ fieldId: field.id, message: err });
    }
    if (rowErrors.length > 0) perRow[index] = rowErrors;
  });
  return perRow;
}

/* ------------------------------------------------------------------ */
/* Phase Revision — attendance & representative validation             */
/* ------------------------------------------------------------------ */

const ATTENDANCE_VALID = new Set(["jooga", "ma_joogo", "wakiil"]);

/**
 * Validate one attendance-enabled group: every party needs a status, and
 * every "wakiil" party must be linked to a named, complete representative.
 * One shared rep may serve many parties (never duplicated).
 */
export function validateAttendanceGroup(
  partyDef: PartyDef,
  values: FormValues,
  general: string[],
): Record<number, FieldError[]> {
  const perRow: Record<number, FieldError[]> = {};
  if (!partyDef.attendance) return perRow;

  const rows = (Array.isArray(values[partyDef.id]) ? values[partyDef.id] : []) as PartyRow[];
  const reps = getRepresentatives(values, partyDef);
  const nameField = partyDef.representativeFields?.[0]?.id ?? "magac";

  rows.forEach((row, index) => {
    const name = (row.values?.[partyDef.fields[0]?.id ?? ""] ?? "").trim();
    if (!name) return; // row-level field rules already cover empty rows
    const att = row.attendance;
    if (!att || !ATTENDANCE_VALID.has(att.status)) {
      perRow[index] = [
        {
          fieldId: "attendance",
          message: `${partyDef.singular} ${index + 1}: dooro xaaladda (Jooga / Ma Joogo / Wakiil).`,
        },
      ];
      return;
    }
    if (att.status === "wakiil") {
      if (!att.representativeId) {
        perRow[index] = [
          { fieldId: "attendance", message: `${partyDef.singular} ${index + 1}: dooro wakiilka matalaya.` },
        ];
        return;
      }
      const rep = reps.find((r) => r.id === att.representativeId);
      if (!rep) {
        perRow[index] = [
          { fieldId: "attendance", message: `${partyDef.singular} ${index + 1}: wakiilka la doortay waa lama baaba'ay — dooro wakiil kale.` },
        ];
        return;
      }
      const repName = (rep.values?.[nameField] ?? "").trim();
      if (!repName) {
        perRow[index] = [
          { fieldId: "attendance", message: `Wakiilka ${partyDef.singular} ${index + 1}: buuxi magaca wakiilka.` },
        ];
      }
    }
  });

  // A representative entered but linked to nobody is flagged so the user
  // links or removes it (keeps the document truthful). Linked reps must
  // have their own data complete — their field rules apply too.
  for (const rep of reps) {
    const repName = (rep.values?.[nameField] ?? "").trim();
    const linked = representedByRep(values, partyDef, rep.id).length > 0;
    if (repName && !linked) {
      general.push(`Wakiil "${repName}": xiriir wakiilka iyo xisbi (Matalaya) si uu heshiisku ugu muuqdo.`);
    }
    if (linked) {
      for (const field of partyDef.representativeFields ?? []) {
        const err = validateField(field, rep.values?.[field.id] ?? "");
        if (err) {
          general.push(`Wakiil "${repName || "(magac la'aan)"}": ${err}`);
        }
      }
    }
  }
  return perRow;
}

/**
 * Validate the whole interview against its config.
 * Hidden conditional sections/fields are skipped; `requiredWhen` can make a
 * visible field conditionally required. Returns per-section errors.
 */
export function validateDocument(
  config: DocumentConfig,
  values: FormValues,
): Record<string, SectionErrors> {
  const get = makeGetter(values);
  const result: Record<string, SectionErrors> = {};

  for (const section of orderedSections(config)) {
    if (section.visibleWhen && !evaluateCondition(section.visibleWhen, get)) {
      continue; // conditional section hidden → not validated
    }

    const sectionValues = values[section.id];
    const fieldErrors: Record<string, string> = {};
    const partyErrors: Record<string, PartyError[]> = {};
    const general: string[] = [];

    if (sectionValues && !Array.isArray(sectionValues)) {
      const record = sectionValues as Record<string, string>;

      for (const field of orderedFields(section)) {
        if (field.visibleWhen && !evaluateCondition(field.visibleWhen, get)) {
          continue; // hidden conditional field → not validated
        }
        const raw = record[field.id] ?? "";
        // Guided form: a field the user explicitly SKIPPED (skippable in
        // config) is a deliberate "empty", never an error. A stale marker
        // on a non-skippable field falls through to validateField, which
        // surfaces the required error (or treats it as empty if optional).
        if (raw === FIELD_SKIPPED && field.skippable) {
          continue;
        }
        if (
          field.requiredWhen &&
          evaluateCondition(field.requiredWhen, get) &&
          raw.trim() === ""
        ) {
          fieldErrors[field.id] = `Fadlan buuxi: ${field.label}`;
          continue;
        }
        const err = validateField(field, raw);
        if (err) fieldErrors[field.id] = err;
      }

      general.push(...validateSectionCross(orderedFields(section), record));
    }

    for (const partyDef of section.parties ?? []) {
      if (partyDef.visibleWhen && !evaluateCondition(partyDef.visibleWhen, get)) {
        continue;
      }
      const rows = (Array.isArray(values[partyDef.id]) ? values[partyDef.id] : []) as PartyRow[];
      const perRow = validatePartyList(partyDef, rows, general);
      const attRow = validateAttendanceGroup(partyDef, values, general);
      for (const [idx, errs] of Object.entries(attRow)) {
        const i = Number(idx);
        perRow[i] = [...(perRow[i] ?? []), ...errs];
      }
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

  // Witness requirement from document configuration.
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
        existing.general.push("Ugu yaraan hal marag ayaa loo baahan yahay.");
        result[witnessSection.id] = existing;
      }
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Ordering helpers                                                    */
/* ------------------------------------------------------------------ */

export function orderedSections(config: DocumentConfig): SectionDef[] {
  return [...config.sections].sort(
    (a, b) => (a.order ?? config.sections.indexOf(a)) - (b.order ?? config.sections.indexOf(b)),
  );
}

export function orderedFields(section: SectionDef): FieldDef[] {
  return [...section.fields].sort(
    (a, b) => (a.order ?? section.fields.indexOf(a)) - (b.order ?? section.fields.indexOf(b)),
  );
}

/* ------------------------------------------------------------------ */
/* Review data                                                         */
/* ------------------------------------------------------------------ */

/** Build the review summary rows for a config (only visible, filled values). */
export function collectFilledValues(
  config: DocumentConfig,
  values: FormValues,
): { sectionId: string; sectionTitle: string; rows: { label: string; value: string }[] }[] {
  const get = makeGetter(values);
  const out: { sectionId: string; sectionTitle: string; rows: { label: string; value: string }[] }[] = [];

  for (const section of orderedSections(config)) {
    if (section.visibleWhen && !evaluateCondition(section.visibleWhen, get)) continue;
    const rows: { label: string; value: string }[] = [];

    const sectionValues = values[section.id];
    if (sectionValues && !Array.isArray(sectionValues)) {
      for (const field of orderedFields(section)) {
        if (field.visibleWhen && !evaluateCondition(field.visibleWhen, get)) continue;
        const raw = resolveKey(values, `${section.id}.${field.id}`);
        const kind =
          field.type === "date"
            ? "date"
            : field.type === "currency"
              ? "currency"
              : field.type === "yes_no"
                ? "yes_no"
                : field.type === "number"
                  ? "number"
                  : undefined;
        const formatted = formatValueByKind(raw, kind);
        if (formatted) rows.push({ label: field.label, value: formatted });
      }
    }

    for (const partyDef of section.parties ?? []) {
      const partyRows = (Array.isArray(values[partyDef.id]) ? values[partyDef.id] : []) as PartyRow[];
      partyRows.forEach((row, i) => {
        const name = (row.values?.[partyDef.fields[0]?.id ?? ""] ?? "").trim();
        if (!name) return;
        const details = partyDef.fields
          .slice(1)
          .map((f) => row.values?.[f.id] ?? "")
          .filter(Boolean)
          .join(" — ");
        let value = details ? `${name} — ${details}` : name;
        // Attendance + representative shown clearly in review.
        if (partyDef.attendance) {
          const att = row.attendance;
          if (att?.status === "jooga") value += " — ✓ Jooga";
          else if (att?.status === "ma_joogo") value += " — ✗ Ma Joogo";
          else if (att?.status === "wakiil") {
            const repName = representativeNameFor(values, partyDef, row);
            value += repName ? ` — ◉ Wakiil: ${repName}` : " — ◉ Wakiil";
          }
        }
        rows.push({
          label: `${partyDef.singular} ${i + 1}`,
          value,
        });
      });
      // Shared representatives: entered once, shown with who they represent.
      if (partyDef.attendance) {
        for (const rep of getRepresentatives(values, partyDef)) {
          const nameField = partyDef.representativeFields?.[0]?.id ?? "magac";
          const repName = (rep.values?.[nameField] ?? "").trim();
          if (!repName) continue;
          const representing = representedByRep(values, partyDef, rep.id);
          if (representing.length === 0) continue;
          rows.push({
            label: `Wakiil (${partyDef.singular})`,
            value: `${repName} — Matalaya: ${representing.join(", ")}`,
          });
        }
      }
    }

    if (rows.length > 0) {
      out.push({ sectionId: section.id, sectionTitle: section.title, rows });
    }
  }
  return out;
}
