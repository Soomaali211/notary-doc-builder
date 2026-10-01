/**
 * Phase 2 — Form Engine API
 *
 * A clean internal interface over the configuration-driven engine. The
 * interview UI talks ONLY to this module; it never inspects configs directly.
 * Responsibilities are separated:
 *
 *   load_form / get_sections      → configuration access
 *   get_visible_fields            → conditional logic
 *   validate_field/section/form   → validation
 *   add/remove_repeatable_item    → dynamic repeaters
 *   save_draft / load_draft       → persistence
 *   get_review_data               → review page
 */

import type {
  Condition,
  DocumentConfig,
  FieldDef,
  FormValues,
  PartyDef,
  PartyRow,
  SectionDef,
  DocumentStatus,
} from "./types";
import { evaluateCondition, makeGetter, conditionFields } from "./conditions";
import {
  collectFilledValues,
  orderedFields,
  orderedSections,
  validateDocument,
  validateField,
  type SectionErrors,
} from "./validation";
import {
  addPartyRow,
  buildPartySummary,
  createInitialValues,
  getPartyRows,
  getSectionValues,
  removePartyRow,
  stripSkipMarkers,
  updatePartyField,
  updateSectionField,
} from "./formValues";
import {
  addRepresentative,
  assignRepresentative,
  createValuesFromDraft,
  getRepresentatives,
  removeRepresentative,
  representedByRep,
  representativeNameFor,
  setAttendanceStatus,
  setPartyCount,
  updateRepresentativeField,
} from "./formValues";
import { representativesKeyFor } from "./types";

/* ------------------------------------------------------------------ */
/* Configuration access                                                */
/* ------------------------------------------------------------------ */

/** load_form(): resolve the config for a document type. */
export function loadForm(documentTypeId: string): DocumentConfig | undefined {
  return getConfigById(documentTypeId);
}

/** get_sections(): visible, ordered sections for the current answers. */
export function getSections(
  config: DocumentConfig,
  values: FormValues,
): SectionDef[] {
  const get = makeGetter(values);
  return orderedSections(config).filter(
    (s) => !s.visibleWhen || evaluateCondition(s.visibleWhen, get),
  );
}

/** get_visible_fields(): fields of a section whose visibility rules hold. */
export function getVisibleFields(section: SectionDef, values: FormValues): FieldDef[] {
  const get = makeGetter(values);
  return orderedFields(section).filter(
    (f) => !f.visibleWhen || evaluateCondition(f.visibleWhen, get),
  );
}

/** Visible repeaters of a section. */
export function getVisibleParties(section: SectionDef, values: FormValues): PartyDef[] {
  const get = makeGetter(values);
  return (section.parties ?? []).filter(
    (p) => !p.visibleWhen || evaluateCondition(p.visibleWhen, get),
  );
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

/** evaluate_rules(): run one declarative condition against answers. */
export function evaluateRules(condition: Condition, values: FormValues): boolean {
  return evaluateCondition(condition, makeGetter(values));
}

/** Fields (by path "section.field") this field's visibility depends on. */
export function fieldDependencies(field: FieldDef): string[] {
  return [
    ...(field.visibleWhen ? conditionFields(field.visibleWhen) : []),
    ...(field.requiredWhen ? conditionFields(field.requiredWhen) : []),
  ];
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** validate_field(): Somali error message or null. */
export function validateFieldByDef(field: FieldDef, value: string): string | null {
  return validateField(field, value);
}

/** validate_section(): errors for one visible section. */
export function validateSectionById(
  config: DocumentConfig,
  values: FormValues,
  sectionId: string,
): SectionErrors | undefined {
  return validateDocument(config, values)[sectionId];
}

/** validate_form(): errors across all visible sections. */
export function validateForm(
  config: DocumentConfig,
  values: FormValues,
): Record<string, SectionErrors> {
  return validateDocument(config, values);
}

/* ------------------------------------------------------------------ */
/* Answers                                                             */
/* ------------------------------------------------------------------ */

export function setAnswer(
  values: FormValues,
  sectionId: string,
  fieldId: string,
  value: string,
): FormValues {
  return updateSectionField(values, sectionId, fieldId, value);
}

export function getAnswer(
  values: FormValues,
  sectionId: string,
  fieldId: string,
): string {
  return getSectionValues(values, sectionId)[fieldId] ?? "";
}

export function setRepeatableAnswer(
  values: FormValues,
  partyId: string,
  rowIndex: number,
  fieldId: string,
  value: string,
): FormValues {
  return updatePartyField(values, partyId, rowIndex, fieldId, value);
}

/* ------------------------------------------------------------------ */
/* Dynamic repeaters                                                   */
/* ------------------------------------------------------------------ */

/** Whether the repeater can accept another row (respects max/unlimited). */
export function canAddRepeatableItem(partyDef: PartyDef, values: FormValues): boolean {
  const rows = getPartyRows(values, partyDef.id);
  return !partyDef.max || partyDef.max <= 0 || rows.length < partyDef.max;
}

/** add_repeatable_item(): append a row (no-op at max; unlimited supported). */
export function addRepeatableItem(values: FormValues, partyDef: PartyDef): FormValues {
  return addPartyRow(values, partyDef);
}

/** remove_repeatable_item(): delete a row (no-op below min). */
export function removeRepeatableItem(
  values: FormValues,
  partyDef: PartyDef,
  rowIndex: number,
): FormValues {
  return removePartyRow(values, partyDef, rowIndex);
}

/** repeater_count_bounds(): effective [min, max] (max 0 = unlimited). */
export function repeaterCountBounds(partyDef: PartyDef): { min: number; max: number } {
  return { min: partyDef.min, max: partyDef.max ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Phase Revision — count-first & representative model                 */
/* ------------------------------------------------------------------ */

/** Count-first: grow/shrink a party list to exactly N rows. */
export function setRepeatableCount(
  values: FormValues,
  partyDef: PartyDef,
  count: number,
): FormValues {
  return setPartyCount(values, partyDef, count);
}

/** Current row count of one party list. */
export function partyRowCount(values: FormValues, partyId: string): number {
  return getPartyRows(values, partyId).length;
}

/** Representatives (wakiillo) of one attendance-enabled group. */
export function listRepresentatives(
  values: FormValues,
  partyDef: PartyDef,
): PartyRow[] {
  return getRepresentatives(values, partyDef);
}

/** Representatives storage key, e.g. "wakiilo_kireeyayaal". */
export function representativesKey(partyDef: PartyDef): string {
  return representativesKeyFor(partyDef);
}

/** Create a fresh representative row ("Samee Wakiil Cusub"). */
export function createRepresentative(
  values: FormValues,
  partyDef: PartyDef,
): FormValues {
  return addRepresentative(values, partyDef);
}

/** Edit one representative field. */
export function setRepresentativeField(
  values: FormValues,
  partyDef: PartyDef,
  repId: string,
  fieldId: string,
  value: string,
): FormValues {
  return updateRepresentativeField(values, partyDef, repId, fieldId, value);
}

/** Delete a representative; linked parties fall back to unlinked wakiil. */
export function deleteRepresentative(
  values: FormValues,
  partyDef: PartyDef,
  repId: string,
): FormValues {
  return removeRepresentative(values, partyDef, repId);
}

/** Per-party attendance: Jooga / Ma Joogo / Wakiil. */
export function setPartyAttendance(
  values: FormValues,
  partyId: string,
  rowIndex: number,
  status: "jooga" | "ma_joogo" | "wakiil",
): FormValues {
  return setAttendanceStatus(values, partyId, rowIndex, status);
}

/** Link one party to a (shared) representative. */
export function linkPartyRepresentative(
  values: FormValues,
  partyId: string,
  rowIndex: number,
  representativeId: string | undefined,
): FormValues {
  return assignRepresentative(values, partyId, rowIndex, representativeId);
}

/** Name of the representative acting for one party row. */
export function repNameFor(
  values: FormValues,
  partyDef: PartyDef,
  row: PartyRow,
): string {
  return representativeNameFor(values, partyDef, row);
}

/** Parties one representative acts for ("Matalaya: Kireeye 2, Kireeye 3"). */
export function partiesRepresentedBy(
  values: FormValues,
  partyDef: PartyDef,
  repId: string,
): string[] {
  return representedByRep(values, partyDef, repId);
}

/* ------------------------------------------------------------------ */
/* Interview state                                                     */
/* ------------------------------------------------------------------ */

export interface InterviewState {
  documentType: string;
  subtype: string;
  currentSection: number;
  answers: FormValues;
  validation_errors: Record<string, SectionErrors>;
  completed_sections: string[];
}

/** Build a fresh interview state for a config + sub-type. */
export function createInterviewState(
  config: DocumentConfig,
  subtype: string,
): InterviewState {
  return {
    documentType: config.id,
    subtype,
    currentSection: 0,
    answers: createInitialValues(config),
    validation_errors: {},
    completed_sections: [],
  };
}

/**
 * Section completion: a section is complete when validation reports no
 * errors for it (hidden conditionals are excluded by the validator).
 */
export function computeCompletedSections(
  config: DocumentConfig,
  values: FormValues,
): string[] {
  const errors = validateDocument(config, values);
  const get = makeGetter(values);
  return orderedSections(config)
    .filter((s) => !s.visibleWhen || evaluateCondition(s.visibleWhen, get))
    .filter((s) => !errors[s.id])
    .map((s) => s.id);
}

/** Mark the interview complete (all visible sections pass validation). */
export function isInterviewComplete(
  config: DocumentConfig,
  values: FormValues,
): boolean {
  const visible = getSections(config, values);
  const errors = validateDocument(config, values);
  return visible.every((s) => !errors[s.id]);
}

/* ------------------------------------------------------------------ */
/* Draft persistence (serialization)                                   */
/* ------------------------------------------------------------------ */

/** save_draft(): serialize answers for persistence (JSON string). */
export function serializeDraft(values: FormValues): string {
  return JSON.stringify(values);
}

/**
 * load_draft(): deserialize a saved draft, merged over a fresh template so
 * every section/party key exists even if the config grew since saving.
 * Pre–Step-1 drafts are migrated (old deposit/guarantor answers map to
 * the new setup questions) — data is preserved, never dropped. Corrupt or
 * foreign payloads degrade to a fresh interview instead of throwing.
 */
export function deserializeDraft(
  config: DocumentConfig,
  json: string | null | undefined,
): FormValues {
  return createValuesFromDraft(config, json);
}

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

/**
 * get_review_data(): per-section review rows for the review page.
 * Skip markers are stripped first: a skipped field shows like any other
 * unfilled optional ("—"), never the internal marker string.
 */
export function getReviewData(config: DocumentConfig, values: FormValues) {
  return collectFilledValues(config, stripSkipMarkers(config, values));
}

/** Party summary rows (also stored with drafts/archive records). */
export function getPartySummary(config: DocumentConfig, values: FormValues) {
  return buildPartySummary(config, values);
}

/* ------------------------------------------------------------------ */
/* Registry import (kept at the bottom to avoid a cycle)               */
/* ------------------------------------------------------------------ */

import { getConfig as getConfigById } from "./documents";

/** Document lifecycle statuses used by the draft/archive system. */
export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "draft",
  "completed",
  "generated",
  "archived",
];
