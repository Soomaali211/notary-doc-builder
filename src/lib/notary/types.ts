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
  | "yes_no"
  /**
   * Photo of a person, uploaded to Convex storage. The VALUE is the storage
   * id string — never the image bytes — so a draft stays small and the DOCX
   * step can fetch the file on demand.
   */
  | "photo"
  /**
   * A PICKER over people already entered in this document.
   *
   * The value is the person's ID — the real link — with the name shown as the
   * label. This exists so the same person is never typed twice: a photograph,
   * a signature line and a representation edge all point at the person the
   * notary already entered, instead of asking for their name again.
   *
   * `BaseField.personSource` names the party lists to offer (e.g.
   * "iibiyeyaal,iibsadayaal"), so a picker can never offer a person who has
   * not been entered.
   */
  | "person";

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
  /**
   * Numeric sibling rule: this field's value must be <= the referenced sibling
   * field's value (e.g. the amount paid may never exceed the total price).
   * Omitted on every existing field, so documents that do not declare it are
   * completely unaffected.
   */
  notMoreThan?: string;
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
  /**
   * Guided-form metadata: the user may explicitly skip this field
   * ("Xog aan hadda la hayn laakiin dambe la heli karo"). A skipped field
   * is never a validation error and never blocks navigation; it is stored
   * as a skip marker so it stays distinct from a plain empty value
   * (empty ≠ skipped) and is stripped before document generation.
   */
  skippable?: boolean;
  /**
   * Step-2 combined party editor: the field is shown ONLY when the party
   * row's attendance status equals this value. Fields about the PERSON
   * present (Telefoon/Aqoonsi/Cinwaan) are hidden when a wakiil represents
   * them — never rendered, never validated (N/A).
   */
  showOnlyWhenRowStatus?: AttendanceStatus;
  /**
   * Shown only when ANOTHER field of the SAME row holds one of these values.
   *
   * This is how one row asks a follow-up and no other: pick "Wakiil" and the
   * representative picker appears; pick "Ma jiro" and it does not. Purely
   * opt-in — a document that declares none behaves exactly as before, and the
   * condition engine itself is untouched.
   */
  showWhenRowValueAnyOf?: { field: string; values: string[] };
  /**
   * Step-2 combined party editor: the field becomes REQUIRED when the row's
   * attendance status equals this value (e.g. Telefoon for a jooga party).
   */
  requiredWhenRowStatus?: AttendanceStatus;
  /** For select/radio/multiselect. */
  options?: SelectOption[];
  /**
   * For type "person": which party lists the picker offers, comma separated
   * ("iibiyeyaal,iibsadayaal"). The options are built at RENDER time from the
   * people actually entered, never from a static list.
   */
  personSource?: string;
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
  /**
   * Phase Revision — enable the per-row attendance flow
   * (Jooga / Ma Joogo / Wakiil ayaa matalaya). When true the interview
   * adds attendance + representative steps for this group.
   */
  attendance?: boolean;
  /**
   * Phase Revision — data collected ONCE per representative (wakiil) of
   * this group. Representatives are shared: one rep can represent many
   * parties (PartyRepresentative relationship).
   */
  representativeFields?: FieldDef[];
  /**
   * The interview asks "Tirada …?" (how many?) in its OWN step before the
   * data/attendance step, driven by the generic NumberSelector. The chosen
   * count is written straight into the row list (setRepeatableCount).
   *
   * Groups that omit it (every group in Heshiis Kiro) keep the old
   * behaviour: the count is decided inside their own setup question.
   */
  countFirst?: boolean;
  /**
   * Where the count is asked, when it is asked somewhere OTHER than this
   * group's own step — a form path like "dejinta.tirada_iibiyayaasha".
   *
   * The office rule is ONE question, asked once. A group that names a
   * `countFrom` gets NO "Tirada …?" step of its own: the number comes from
   * the setup step and is written straight into this row list, so the same
   * figure can never be asked in two places or disagree with itself.
   *
   * Additive and opt-in: no Heshiis Kiro party declares it, so a config that
   * omits it produces exactly the steps it produced before.
   *
   * The `_HAL` / `_BADAN` count flags still come from `countFirst` — a group
   * keeps its plural wording either way.
   */
  countFrom?: string;
  /**
   * Whether this list renders INSIDE its section step as well as in its own
   * row step.
   *
   * Default (undefined) renders it in the section — Heshiis Kiro's shape,
   * unchanged. A document that gives the list its OWN step sets
   * `renderInline: false` so the editor appears exactly once; otherwise the
   * notary is shown the same list twice and re-enters the same data, which
   * is the one thing a guided form must never do.
   */
  renderInline?: boolean;
  /**
   * FormValues key holding the group's shared representative list.
   * Defaults to `wakiilo_<partyId>`.
   */
  representativesKey?: string;
}

/* ------------------------------------------------------------------ */
/* Phase Revision — attendance & representative model                  */
/* ------------------------------------------------------------------ */

/** Per-party attendance status (Kireeye/Kirayste kasta si gaar ah). */
export type AttendanceStatus = "jooga" | "ma_joogo" | "wakiil";

/** A UI string ready for multilingual rendering (Somali primary). */
export interface LocalizedLabel {
  so: string;
  en?: string;
}

/** The three attendance choices with their UI labels. */
export const ATTENDANCE_OPTIONS: {
  value: AttendanceStatus;
  label: LocalizedLabel;
  hint: LocalizedLabel;
}[] = [
  {
    value: "jooga",
    label: { so: "Jooga", en: "Present" },
    hint: { so: "Wuxuu saxiixayaa isaga oo joogo", en: "Signs in person" },
  },
  {
    value: "ma_joogo",
    label: { so: "Ma Joogo", en: "Absent" },
    hint: { so: "Ma soo gaaray fadhiga", en: "Not attending" },
  },
  {
    value: "wakiil",
    label: { so: "Wakiil ayaa matalaya", en: "Represented" },
    hint: { so: "Wakiil ayaa saxiixayaa xilli beddelka", en: "A representative signs" },
  },
];

/** Attendance answer of one party row + its representative link. */
export interface PartyAttendance {
  status: AttendanceStatus;
  /** PartyRow.id of the representative inside the group's rep list. */
  representativeId?: string;
}

/** FormValues key of a group's shared representative list. */
export function representativesKeyFor(
  partyDef: Pick<PartyDef, "id" | "representativesKey">,
): string {
  return partyDef.representativesKey ?? `wakiilo_${partyDef.id}`;
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
  /**
   * Which numbered flow step this section belongs to.
   *
   * A document that declares it on EVERY section walks its sections grouped
   * into these steps instead of one step per section: the notary gets the
   * small fixed interview the office expects, and each step renders all of
   * its sections and all of their lists in order.
   *
   * Opt-in and additive: no Heshiis Kiro section declares it, so Kiro keeps
   * its one-section-per-step flow exactly as it was.
   */
  flowStep?: { n: number; title: string; order?: number };
  parties?: PartyDef[];
  /**
   * Conditional section: when this rule evaluates false the whole section
   * (fields + repeaters) disappears from the interview, review, and
   * validation.
   */
  visibleWhen?: Condition;
}

/** How a value is rendered inside the generated document. */
export type FormatKind =
  | "text"
  | "currency"
  | "currency_words"
  | "date"
  | "month"
  | "yes_no"
  | "number";

/**
 * Config-driven Somali WORDING for a raw stored value.
 *
 * A stored value is machine data ("xidhan", "muqadin", "cash"); the contract
 * needs Somali prose ("Kiro Xidhan", "MUQADIN …"). The wording therefore
 * lives in the document CONFIG, never in the resolver and never in the
 * template — so a raw storage value can never leak into a signed document.
 *
 *   derivedText: {
 *     "heshiiska.muddada_nooca": { furan: "…", xidhan: "…" },
 *   }
 */
export type DerivedText = Record<string, Record<string, string>>;

/**
 * One field of the optional DATA ANNEX.
 *
 * Real notary wording covers only the clauses the office actually reads
 * aloud. Fields the form collects but the reference wording has no home
 * for (bank details, notice period, termination terms…) are printed in a
 * neutral "XOGTA HESHIISKA" annex as `Label: value` — data, not invented
 * legal prose. A line is omitted entirely when its value is empty.
 */
export interface AnnexFieldDef {
  /** Form-state path, e.g. "lacagta.bangiga_hisaabka". */
  key: string;
  /** Canonical placeholder token, e.g. "BANGIGA_HISAABKA". */
  token: string;
  /** Somali label printed before the value. */
  label: string;
  /**
   * Group name — the template wraps a group in ONE {{IF:ANNEX_<GROUP>}} so
   * the line disappears when the field has no value. Declared here
   * explicitly; never derived from the key, so renaming a form field can
   * never silently move an annex line.
   *
   * Use ONE group per printed LINE (default) so an empty field never leaves
   * a dangling "Label:" in the document. Only group several fields together
   * when they are always filled together.
   */
  group: string;
  /** Format applied to the value (currency/date/… ). */
  format?: FormatKind;
  /** Print the line only when this rule holds (e.g. bank transfer only). */
  when?: Condition;
}

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

/**
 * A value the SYSTEM computes from other answers — the user never types it.
 *
 * Two kinds exist so far:
 *   subtract    → first key minus the following keys (money left to pay)
 *   party_count → number of filled rows of a repeatable group
 *
 * A derived value is written into the document exactly like a mapped
 * placeholder and is listed in the placeholder inventory, so nothing
 * invisible ever reaches a signed document.
 */
export type DerivedValueDef =
  | {
      /** Canonical token name without braces, e.g. "LACAGTA_HADHAY". */
      token: string;
      /** Total minus the following keys. */
      op: "subtract";
      /** Form keys, e.g. ["qiimaha.qiimaha_guud", "qiimaha.lacagta_bixiyay"]. */
      keys: string[];
      format?: FormatKind;
      /** Somali label shown in the placeholder inventory. */
      label?: string;
    }
  | {
      token: string;
      /** Number of filled rows of this repeatable group. */
      op: "party_count";
      partyId: string;
      format?: FormatKind;
      label?: string;
    }
  | {
      token: string;
      /**
       * `thenKey` when `when` holds, otherwise `elseKey` — ONE token, ONE
       * value. Used where the same document slot holds different people
       * depending on a stored answer (e.g. the guarantor slot prints the
       * third-party guarantor OR the seller himself), so the template never
       * has to choose between two tokens.
       */
      op: "conditional";
      when: Condition;
      thenKey: string;
      elseKey: string;
      format?: FormatKind;
      label?: string;
    }
  | {
      token: string;
      /**
       * The legal ROLE WORD for a party list — "iibiye" / "iibiso" /
       * "iibiyayaal", "iibsade" / "iibsato" / "iibsadayaal".
       *
       * Two dimensions are decided SEPARATELY and this op keeps them apart:
       * GENDER (an answer the notary gives; NEVER inferred from the name)
       * and NUMBER (one person or several). That is why there is no
       * "feminise the seller word" rule anywhere — "iibiye" → "iibisada"
       * would change the gender AND the definiteness at once.
       *
       * `number: "auto"` reads the list length (1 → singular, 2+ → plural).
       * The plural is gender-independent; the SINGULAR needs a chosen
       * gender, and when none was chosen this op prints NOTHING rather than
       * guessing a gender (see partyModel.OPEN_DECISIONS).
       *
       * Declared per document type. Heshiis Kiro declares none, so its
       * replacement map is unchanged.
       */
      op: "party_gender_word";
      partyId: string;
      /** Which legal role the word belongs to. */
      role: "seller" | "buyer" | "guarantor";
      /** "auto" = singular for one filled row, plural for two or more. */
      number?: "auto" | "singular" | "plural";
      /** "iibiyaha" vs "iibiye" — definiteness is NOT the gender. */
      definite?: boolean;
      /** Row field holding the person's gender (default "jinsi"). */
      genderField?: string;
      label?: string;
    };

export interface DocumentConfig {
  /** Stable id, e.g. "heshiis_kiro". */
  id: string;
  /**
   * Section that holds the document's own settings (sub-type, reference
   * number, dates). Defaults to "heshiiska" — the Heshiis Kiro layout is
   * unchanged. A document type with a differently-named section declares
   * it here so the interview, the pipeline and the template registry all
   * read the same place.
   */
  setupSectionId?: string;
  title: string;
  description: string;
  /** Sub-types the user chooses from. */
  subTypes: SelectOption[];
  /** Filename prefix, e.g. "Heshiis-Kiro". */
  fileNamePrefix: string;
  /** Output archive folder, e.g. "Kiro" (falls back to a title-derived name). */
  outputFolder?: string;
  /** Legacy single-template path (Phase 1). Phase 3 uses `templates[]`. */
  templatePath: string;
  /** Reference number prefix, e.g. "DPN-K". */
  referencePrefix: string;
  /**
   * The reference string that is PRINTED in the document, composed from the
   * serial the database stores plus values the system already has.
   * Supported tokens: {serial} (the digits of the stored reference) and the
   * document-date parts {MM} / {YY}.
   *
   * The database keeps the short serial (e.g. "DPN-MG-001") — that value is
   * what `referencePrefix` is for and it stays unchanged. Documents that
   * declare no `referenceFormat` print exactly what the database holds,
   * which is why Heshiis Kiro is untouched by this.
   */
  referenceFormat?: string;
  /**
   * Form key holding the document's own date ("dejinta.taariikhda_hantida"),
   * used to fill {MM}/{YY} of `referenceFormat`. Only read when a
   * `referenceFormat` is declared.
   */
  referenceDateKey?: string;
  sections: SectionDef[];
  placeholders: PlaceholderMapping[];
  clauses: ClauseMapping[];
  /** Whether at least one marag (witness) is required. */
  requiresWitness: boolean;
  /** Placeholder that receives the list of witnesses. */
  witnessPlaceholder?: string;
  witnessSeparator?: string;
  /**
   * Phase 3 — Template Registry source: one Word template per sub-type.
   * Selection is automatic by sub-type and config-driven (never hard-coded).
   */
  templates?: TemplateSpec[];
  /** Phase 3 — repeated blocks: {{#BLOCK_ID}}…{{/BLOCK_ID}} over a party list. */
  repeatBlocks?: RepeatBlockMapping[];
  /** Phase 3 — named boolean flags usable as {{IF:FLAG}}…{{ENDIF}}. */
  conditionFlags?: Record<string, Condition>;
  /** Phase 3 — configurable document formatting (dates, currency). */
  format?: DocumentFormatConfig;
  /**
   * Somali wording for stored values (see DerivedText). Consulted by the
   * data context whenever a placeholder's raw value has no dedicated
   * FormatKind — keeps raw values such as "xidhan" out of the document.
   */
  derivedText?: DerivedText;
  /**
   * Optional data-annex fields — collected by the form, printed as neutral
   * `Label: value` lines where the legal wording has no clause for them.
   * Empty values print nothing.
   */
  annexFields?: AnnexFieldDef[];
  /**
   * Sequential clause numbering.
   *
   * When true the renderer replaces every {{CLAUSE_NO}} with the next
   * number (1, 2, 3 …) counting ONLY the clauses that survived their
   * {{IF:FLAG}} sections, so removing a conditional clause closes the gap
   * instead of leaving 1,2,3,5,6.
   */
  clauseNumbering?: boolean;
  /**
   * Values the system derives from other answers (money still owed, party
   * counts…). Omitted by documents that need none, so their replacement
   * map is byte-identical to before.
   */
  derivedValues?: DerivedValueDef[];
}

/* ------------------------------------------------------------------ */
/* Phase 3 — template registry, blocks & formatting                    */
/* ------------------------------------------------------------------ */

export type TemplateStatus = "active" | "draft" | "retired";

/** One registered Word template (per document type + sub-type). */
export interface TemplateSpec {
  templateId: string;
  documentType: string;
  subtype: string;
  /** Human label, e.g. "Guri Xaas". */
  name: string;
  /** Public path served to the browser, e.g. "/templates/heshiis_kiro/guri_xaas.docx". */
  filePath: string;
  version: number;
  status: TemplateStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * A repeated block in the template:
 *   {{#MARAGYO}} {{NUMBER}}. {{MAGAC}} … {{/MARAGYO}}
 * The body repeats once per filled row of the mapped party list; tokens
 * inside resolve to that row's fields (case-insensitive). `aliases` map
 * template token names to party field ids (e.g. PHONE → telefoon).
 */
export interface RepeatBlockMapping {
  blockId: string;
  partyId: string;
  /** Placeholder receiving the 1-based item number (default NUMBER). */
  numberPlaceholder?: string;
  /** Token name → party field id, e.g. { PHONE: "telefoon" }. */
  aliases?: Record<string, string>;
}

export interface CurrencyFormatConfig {
  /** "symbol" → $500 · "code" → 500 USD · "words" → Shan Boqol Dollar. */
  mode: "symbol" | "code" | "words";
  symbol?: string;
  code?: string;
  /** Somali word for the currency in words-mode, e.g. "Dollar". */
  wordsUnit?: string;
}

export interface DocumentFormatConfig {
  /** "DD/MM/YYYY" (29/09/2026) · "D MMMM YYYY" (29 Sebtembar 2026) · ISO. */
  dateFormat?: "DD/MM/YYYY" | "D MMMM YYYY" | "YYYY-MM-DD";
  currency?: CurrencyFormatConfig;
}

/* ------------------------------------------------------------------ */
/* Form values                                                         */
/* ------------------------------------------------------------------ */

/** One row of a repeatable group. */
export interface PartyRow {
  id: string;
  values: Record<string, string>;
  /**
   * Phase Revision — attendance + representative link of this row
   * (only for groups with PartyDef.attendance).
   */
  attendance?: PartyAttendance;
}

/**
 * Section scalar fields → Record<string, string>.
 * Repeatable groups → PartyRow[].
 * checkbox values are "yes"/"no"; multiselect is a comma-joined string.
 * A group's shared representatives (wakiilo) live at `wakiilo_<partyId>`.
 */
export interface FormValues {
  [key: string]: Record<string, string> | PartyRow[] | undefined;
}

/**
 * Guided form — stored marker for a field the user explicitly skipped.
 * Lives INSIDE the existing string state (empty ≠ skipped), survives
 * Back/Next navigation, and is stripped before review/generation.
 */
export const FIELD_SKIPPED = "__skipped__";

/* ------------------------------------------------------------------ */
/* Archive record                                                      */
/* ------------------------------------------------------------------ */

export type DocumentStatus = "draft" | "completed" | "generated" | "archived";

/** Payload persisted with every draft / archive record. */
export interface GeneratedDocumentMetadata {
  templateId: string;
  templateVersion: number;
  outputDocxPath: string;
  outputPdfPath?: string;
  fileName: string;
}

/** One party summary row (archive + generation metadata). */
export interface PartySummaryRow {
  role: string;
  name: string;
  phone?: string;
  idNumber?: string;
  /** Jooga / Ma Joogo / Wakiil — present for attendance-enabled groups. */
  attendance?: AttendanceStatus;
  /** Representative name when this party is represented. */
  representative?: string;
  /** Names of the parties this representative acts for (rep summary rows). */  
  representing?: string;
}

export interface StoredDocumentPayload {
  documentType: string;
  documentTypeTitle: string;
  subType: string;
  subTypeLabel: string;
  referenceNumber: string;
  /** Party summary rows for the archive: [roleLabel, name, phone, id]. */
  parties: PartySummaryRow[];
  fileBaseName: string;
  values: FormValues;
}
