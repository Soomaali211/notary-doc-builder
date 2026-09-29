/**
 * Notary Document Engine — Core Types
 *
 * The engine is configuration-driven: a document type is a `DocumentConfig`
 * (sections + fields + conditional rules + template mapping). The form UI,
 * validation, and generation all read from the config, so adding a future
 * document type (Heshiis Deyn, Wakiilnimo, …) means adding a new config —
 * not new UI code.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "phone"
  | "select"
  | "yesno";

export interface SelectOption {
  value: string;
  label: string;
}

/** Validation is declarative — the engine builds Somali error messages. */
export interface FieldValidation {
  required?: boolean;
  /** Minimum numeric value (numbers/currency). */
  min?: number;
  /** Maximum numeric value (numbers/currency). */
  max?: number;
  /** Maximum character length (text). */
  maxLength?: number;
}

export interface BaseField {
  id: string;
  type: FieldType;
  label: string;
  /** Helper text shown under the field. */
  hint?: string;
  /** Somali placeholder text for empty inputs. */
  placeholder?: string;
  optional?: boolean;
  options?: SelectOption[];
  validation?: FieldValidation;
  /** Layout width in the two-column grid (default 1). */
  colSpan?: 1 | 2;
}

export type FieldDef = BaseField;

/**
 * A field whose visibility depends on a condition evaluated against the
 * form values (see conditions.ts). Unknown conditions render hidden.
 */
export interface ConditionalFieldDef extends FieldDef {
  visibleWhen: Condition;
}

export type AnyFieldDef = FieldDef | ConditionalFieldDef;

export function isConditionalField(
  field: AnyFieldDef,
): field is ConditionalFieldDef {
  return "visibleWhen" in field;
}

/** A party list (repeatable group), e.g. Kireeyayaal, Kiraystayaal, Maragyo. */
export interface PartyDef {
  /** Key inside form values, e.g. "kireeyayaal". */
  id: string;
  label: string;
  /** One-word Somali label used in UI, e.g. "Kireeye". */
  singular: string;
  description?: string;
  min: number;
  max: number;
  optionalList?: boolean;
  fields: FieldDef[];
}

/* ------------------------------------------------------------------ */
/* Condition rules (simple, extensible rules engine)                   */
/* ------------------------------------------------------------------ */

export type Condition =
  | { op: "equals"; field: string; value: unknown }
  | { op: "notEquals"; field: string; value: unknown }
  | { op: "isTrue"; field: string }
  | { op: "isFalse"; field: string }
  | { op: "notEmpty"; field: string }
  | { op: "gt"; field: string; value: number }
  | { op: "and"; conditions: Condition[] }
  | { op: "or"; conditions: Condition[] };

/* ------------------------------------------------------------------ */
/* Sections & document config                                          */
/* ------------------------------------------------------------------ */

export interface SectionDef {
  id: string;
  title: string;
  /** Short subtitle shown under the section title. */
  description?: string;
  fields: AnyFieldDef[];
  parties?: PartyDef[];
}

/** How a value is rendered inside the generated document. */
export type FormatKind =
  | "text"
  | "currency"
  | "date"
  | "yesno"
  | "number";

export interface FieldMapping {
  /** Form value key: either a scalar path ("heshiiska.reference") or a
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
  /** For joined party placeholders. */
  separator?: string;
}

/**
 * A conditional clause inserted into a {{CLAUSE_*}} block in the template.
 * `when` false → block is removed entirely.
 */
export interface ClauseMapping {
  placeholder: string;
  when: Condition;
  /** Literal text lines inserted when the condition holds. */
  lines?: string[];
  /** Dynamic lines built from values, e.g. deebaaji details. */
  dynamic?:
    | { kind: "deebaaji" }
    | { kind: "damiin" }
    | { kind: "advance" }
    | { kind: "custom" };
  /** Fallback text when the condition does not hold. */
  fallbackLines?: string[];
}

export interface DocumentConfig {
  /** Stable id, e.g. "heshiis_kiro". */
  id: string;
  /** Somali title shown in the UI. */
  title: string;
  description: string;
  /** Sub-types the user chooses from. */
  subTypes: SelectOption[];
  /** Filename prefix, e.g. "Kiro". */
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

/** Repeated party row values, keyed by party list id. */
export interface PartyRow {
  id: string;
  values: Record<string, string>;
}

export interface FormValues {
  [sectionId: string]:
    | Record<string, string>
    | PartyRow[]
    | string
    | undefined;
}

/* ------------------------------------------------------------------ */
/* Archive record                                                      */
/* ------------------------------------------------------------------ */

export type DocumentStatus = "draft" | "generated";

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
