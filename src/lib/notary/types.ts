/**
 * Notary Form/Interview Engine — Core Types (Phase 2)
 *
 * The engine is configuration-driven: a document type is a `DocumentConfig`
 * (sections + fields + conditional rules + repeaters + template mapping).
 * The interview UI, validation, review, and generation all read from the
 * config, so adding a future document type (Heshiis Deyn, Wakiilnimo, …)
 * means adding a new config — not new engine code.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "phone"
  | "email"
  | "select"
  | "radio"
  | "checkbox"
  | "multiselect"
  | "yes_no";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Validation is declarative — the engine builds Somali error messages.
 * All rules are optional; `required`/`optional` on the field control the
 * default requiredness, and `requiredWhen` can make a field conditionally
 * required (see conditional validation).
 */
export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** ECMAScript regex source; matched against the trimmed value. */
  pattern?: string;
  /** Somali message used when `pattern` fails (falls back to a generic one). */
  patternMessage?: string;
  /** This field's value must be >= the value of the referenced sibling field. */
  notBefore?: string;
}

export interface BaseField {
  /** Stable technical id, e.g. "monthly_rent". */
  id: string;
  type: FieldType;
  /** Somali label shown in the UI (never the technical field name). */
  label: string;
  /** Optional machine name; defaults to `id`. */
  name?: string;
  /** Longer helper text shown under the label. */
  description?: string;
  /** Short hint shown at the end of the label row. */
  hint?: string;
  /** Somali placeholder for empty inputs. */
  placeholder?: string;
  /** Field is never required. */
  optional?: boolean;
  /** For select/radio/multiselect. */
  options?: SelectOption[];
  /** Applied when creating a fresh interview (checkbox: "yes"/"no"). */
  default?: string;
  validation?: FieldValidation;
  /**
   * Conditional requiredness: when this condition holds, the field becomes
   * required even if `optional` is set (e.g. IF payment_method = bank
   * THEN account_number is required).
   */
  requiredWhen?: Condition;
  /** Visibility rule — hidden fields are not rendered or validated. */
  visibleWhen?: Condition;
  /** Layout width in the two-column grid (default 1). */
  colSpan?: 1 | 2;
  /** Display order; falls back to array position. */
  order?: number;
}

export type FieldDef = BaseField;

/**
 * A repeatable party/group (e.g. Kireeyayaal, Kiraystayaal, Maragyo).
 * Rows are stored as arrays — never as fixed seller_1/seller_2 fields.
 */
export interface PartyDef {
  /** Key inside form values, e.g. "kireeyayaal". */
  id: string;
  label: string;
  /** One-word Somali label used in UI, e.g. "Kireeye". */
  singular: string;
  description?: string;
  /** Minimum number of filled rows. */
  min: number;
  /**
   * Maximum rows the user may add. Omit (or 0) for unlimited.
   */
  max?: number;
  /** Rows are optional beyond `min` (empty rows are ignored). */
  optionalList?: boolean;
  /** Custom Somali error for the minimum rule, e.g. "Ugu yaraan hal marag ayaa loo baahan yahay." */
  minMessage?: string;
  /** Visibility rule for the whole repeater block. */
  visibleWhen?: Condition;
  fields: FieldDef[];
}

/* ------------------------------------------------------------------ */
/* Condition rules (reusable rules engine — see conditions.ts)         */
/* ------------------------------------------------------------------ */

export type Condition =
  | { op: "equals"; field: string; value: unknown }
  | { op: "not_equals"; field: string; value: unknown }
  | { op: "greater_than"; field: string; value: number }
  | { op: "less_than"; field: string; value: number }
  | { op: "contains"; field: string; value: string }
  | { op: "is_empty"; field: string }
  | { op: "is_not_empty"; field: string }
  | { op: "is_true"; field: string }   // value === "yes"
  | { op: "is_false"; field: string }  // value !== "yes"
  | { op: "and"; conditions: Condition[] }
  | { op: "or"; conditions: Condition[] }
  | { op: "not"; condition: Condition };

/* ------------------------------------------------------------------ */
/* Sections & document config                                          */
/* ------------------------------------------------------------------ */

export interface SectionDef {
  id: string;
  title: string;
  /** Short subtitle shown under the section title. */
  description?: string;
  /** Display order; falls back to array position. */
  order?: number;
  fields: FieldDef[];
  parties?: PartyDef[];
  /**
   * Conditional section: when this rule evaluates false the whole section
   * (fields + repeaters) disappears from the interview, review, and
   * validation.
   */
  visibleWhen?: Condition;
}

/** How a value is rendered inside the generated document. */
export type FormatKind = "text" | "currency" | "date" | "yes_no" | "number";

export interface FieldMapping {
  /** Form value key: a scalar path ("heshiiska.reference") or a
   *  party-derived key ("kireeyayaal.names", "maragyo.joined"). */
  key: string;
  format?: FormatKind;
  /** Used when the value is empty (optional fields). */
  fallback?: string;
}

/**
 * A placeholder in the Word template, e.g. {{REFERENCE_NUMBER}}.
 * `list` placeholders (joined party values) receive a separator.
 */
export interface PlaceholderMapping {
  placeholder: string;
  mapping: FieldMapping;
  separator?: string;
}

/**
 * A conditional clause inserted into a {{CLAUSE_*}} block in the template.
 * `when` false → block is removed entirely.
 */
export interface ClauseMapping {
  placeholder: string;
  when: Condition;
  lines?: string[];
  dynamic?:
    | { kind: "deebaaji" }
    | { kind: "damiin" }
    | { kind: "advance" }
    | { kind: "custom" };
  fallbackLines?: string[];
}

export interface DocumentConfig {
  /** Stable id, e.g. "heshiis_kiro". */
  id: string;
  title: string;
  description: string;
  /** Sub-types the user chooses from. */
  subTypes: SelectOption[];
  /** Filename prefix, e.g. "Heshiis-Kiro". */
  fileNamePrefix: string;
  /** Path of the .docx template, relative to /public. */
  templatePath: string;
  /** Reference number prefix, e.g. "DPN-K". */
  referencePrefix: string;
  sections: SectionDef[];
  placeholders: PlaceholderMapping[];
  clauses: ClauseMapping[];
  /** Whether at least one marag (witness) is required. */
  requiresWitness: boolean;
  /** Placeholder that receives the list of witnesses. */
  witnessPlaceholder?: string;
  witnessSeparator?: string;
}

/* ------------------------------------------------------------------ */
/* Form values                                                         */
/* ------------------------------------------------------------------ */

/** One row of a repeatable group. */
export interface PartyRow {
  id: string;
  values: Record<string, string>;
}

/**
 * Section scalar fields → Record<string, string>.
 * Repeatable groups → PartyRow[].
 * checkbox values are "yes"/"no"; multiselect is a comma-joined string.
 */
export interface FormValues {
  [key: string]: Record<string, string> | PartyRow[] | undefined;
}

/* ------------------------------------------------------------------ */
/* Archive record                                                      */
/* ------------------------------------------------------------------ */

export type DocumentStatus = "draft" | "completed" | "generated" | "archived";

/** Payload persisted with every draft / archive record. */
export interface StoredDocumentPayload {
  documentType: string;
  documentTypeTitle: string;
  subType: string;
  subTypeLabel: string;
  referenceNumber: string;
  /** Party summary rows for the archive: [roleLabel, name, phone, id]. */
  parties: { role: string; name: string; phone?: string; idNumber?: string }[];
  fileBaseName: string;
  values: FormValues;
}
