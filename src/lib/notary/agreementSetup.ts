/**
 * Phase Revision Step 1 — Conditional Workflow Engine (config-driven).
 *
 * Step 1 "Dejinta Heshiiska" is the source of truth: its answers (rental
 * type, single/multiple landlords & tenants, open/closed duration,
 * deposit yes/no, guarantor yes/no) determine which steps exist at all.
 *
 * The workflow is derived from the DocumentConfig itself — sections carry
 * `visibleWhen` rules and attendance groups define their count/data/
 * attendance steps — so this module adds ZERO hard-coded step lists.
 * Future document types inherit the same conditional behavior.
 */

import type { DocumentConfig, FormValues, PartyDef, SectionDef } from "./types";
import { getAnswer, getSections } from "./engine";
import { getPartyRows } from "./formValues";

/* ------------------------------------------------------------------ */
/* Setup decisions                                                     */
/* ------------------------------------------------------------------ */

export type PartyMode = "single" | "multiple" | "";
export type DurationKind = "furan" | "xidhan" | "";

export interface AgreementSetup {
  /** Nooca Kirada (sub-type value, e.g. guri_xaas). */
  subType: string;
  /** Kireeye | Kireeyayaal. */
  landlordMode: PartyMode;
  /** Kirayste | Kiraystayaal. */
  tenantMode: PartyMode;
  /** Kiro Furan | Kiro Xidhan. */
  durationKind: DurationKind;
  /** Deebaaji Haa/Maya. */
  deposit: boolean | null;
  /** Damiin Haa/Maya. */
  guarantor: boolean | null;
  /** Effective landlord count (single → 1, multiple → chosen count). */
  landlordCount: number;
  /** Effective tenant count (single → 1, multiple → chosen count). */
  tenantCount: number;
}

/** Step 1 field ids (heshiiska section). */
export const SETUP_FIELDS = {
  subType: "sub_type",
  landlordMode: "kireeye_mode",
  tenantMode: "kirayste_mode",
  durationKind: "muddada_nooca",
  deposit: "deebaaji_haa",
  guarantor: "damiin_haa",
} as const;

export function readAgreementSetup(values: FormValues): AgreementSetup {
  const mode = (key: string): PartyMode => {
    const v = getAnswer(values, "heshiiska", key);
    return v === "single" || v === "multiple" ? v : "";
  };
  const yesNo = (key: string): boolean | null => {
    const v = getAnswer(values, "heshiiska", key);
    if (v === "yes") return true;
    if (v === "no") return false;
    return null;
  };
  const duration = (key: string): DurationKind => {
    const v = getAnswer(values, "heshiiska", key);
    return v === "furan" || v === "xidhan" ? v : "";
  };

  const landlordMode = mode(SETUP_FIELDS.landlordMode);
  const tenantMode = mode(SETUP_FIELDS.tenantMode);

  return {
    subType: getAnswer(values, "heshiiska", SETUP_FIELDS.subType),
    landlordMode,
    tenantMode,
    durationKind: duration(SETUP_FIELDS.durationKind),
    deposit: yesNo(SETUP_FIELDS.deposit),
    guarantor: yesNo(SETUP_FIELDS.guarantor),
    landlordCount:
      landlordMode === "single"
        ? 1
        : getPartyRows(values, "kireeyayaal").length,
    tenantCount:
      tenantMode === "single"
        ? 1
        : getPartyRows(values, "kiraystayaal").length,
  };
}

/** True when every Step 1 question is answered. */
export function isSetupComplete(setup: AgreementSetup): boolean {
  return Boolean(
    setup.subType &&
      setup.landlordMode &&
      setup.tenantMode &&
      setup.durationKind &&
      setup.deposit !== null &&
      setup.guarantor !== null,
  );
}

/** Somali labels for the Step 1 summary card. */
export function setupSummaryRows(
  config: DocumentConfig,
  setup: AgreementSetup,
): { label: string; value: string }[] {
  const opt = (fieldId: string, value: string) =>
    config.sections
      .flatMap((s) => s.fields)
      .find((f) => f.id === fieldId)
      ?.options?.find((o) => o.value === value)?.label ?? value;

  const yesNo = (v: boolean | null) => (v === null ? "—" : v ? "Haa" : "Maya");
  const rows: { label: string; value: string }[] = [
    { label: "Nooca Kirada", value: config.subTypes.find((s) => s.value === setup.subType)?.label ?? setup.subType },
    { label: "Kireeyayaasha", value: setup.landlordMode === "single" ? "1 (Kireeye)" : String(setup.landlordCount) },
    { label: "Kiraystayaasha", value: setup.tenantMode === "single" ? "1 (Kirayste)" : String(setup.tenantCount) },
    { label: "Muddada", value: opt(SETUP_FIELDS.durationKind, setup.durationKind) },
    { label: "Deebaaji", value: yesNo(setup.deposit) },
    { label: "Damiin", value: yesNo(setup.guarantor) },
  ];
  return rows;
}

/* ------------------------------------------------------------------ */
/* Conditional workflow (config-driven)                                */
/* ------------------------------------------------------------------ */

export type WorkflowStepKind =
  /**
   * One or more sections rendered together in a single step.
   *
   * A document that declares `SectionDef.flowStep` gets its sections grouped
   * into the fixed steps it names, so the notary walks six screens instead of
   * twenty. A config that declares none produces exactly one section per step,
   * byte for byte as before — which is every Heshiis Kiro section.
   *
   * `sectionId` stays alongside `sectionIds` as the FIRST section, so every
   * consumer written against the single-section shape keeps working unchanged.
   */
  | { kind: "section"; sectionIds: string[]; sectionId: string }
  | { kind: "party-data"; partyDef: PartyDef }
  /**
   * "Tirada …?" — how many of this group. Emitted ONLY for a group that
   * declares PartyDef.countFirst (a document type that asks the count as
   * its own step). Groups without it are unchanged: their count is decided
   * inside their own setup question, exactly as before.
   */
  | { kind: "party-count"; partyDef: PartyDef }
  /**
   * Step 2 — "Xogta iyo Xaaladda": ONE combined step per attendance group
   * (identity + presence + representation). The count is decided in Step 1
   * and there is no separate count or attendance step.
   */
  | { kind: "party-status"; partyDef: PartyDef };

export interface WorkflowStep {
  key: string;
  short: string;
  detail: WorkflowStepKind;
}

/** The Step 1 setup step itself. */
export function setupStep(config: DocumentConfig): WorkflowStep {
  const section = config.sections.find((s) => s.id === "heshiiska")!;
  return {
    key: "sec-heshiiska",
    short: section.title,
    detail: { kind: "section", sectionIds: [section.id], sectionId: section.id },
  };
}

/**
 * Group the visible sections into the fixed steps the config declares.
 *
 * Returns null when the document declares no flow at all, so the caller
 * falls through to its ordinary one-section-per-step behaviour. That is the
 * whole isolation story: Heshiis Kiro names no `flowStep`, gets null, and
 * is unaffected.
 *
 * A step is dropped entirely when every section inside it is hidden — a Guri
 * sale never sees the Dhul Banaan questions, so it never sees a step made
 * only of them. A step that would be EMPTY is never emitted: no header with
 * nothing under it.
 */
function buildFlowSteps(
  config: DocumentConfig,
  sections: SectionDef[],
): WorkflowStep[] | null {
  const declared = config.sections.filter((s) => s.flowStep);
  if (declared.length === 0) return null;

  const byNumber = new Map<number, { title: string; order: number; ids: string[] }>();
  for (const section of declared) {
    const step = section.flowStep!;
    const slot = byNumber.get(step.n) ?? { title: step.title, order: step.order ?? step.n, ids: [] };
    slot.ids.push(section.id);
    byNumber.set(step.n, slot);
  }

  const visible = new Set(sections.map((s) => s.id));
  const steps: WorkflowStep[] = [];
  for (const slot of [...byNumber.values()].sort((a, b) => a.order - b.order)) {
    const ids = slot.ids.filter((id) => visible.has(id));
    if (ids.length === 0) continue;
    steps.push({
      key: `flow-${slot.order}`,
      short: slot.title,
      detail: { kind: "section", sectionIds: ids, sectionId: ids[0] },
    });
  }
  return steps;
}

/**
 * buildConditionalWorkflow(): expand the config's VISIBLE sections into
 * steps, mirroring the interview's own conditional logic (getSections).
 * Conditional sections (Deebaaji/Damiinka) drop out automatically because
 * the config's visibleWhen reads the Step 1 answers.
 *
 * Section count/data/attendance steps follow #8/#9: "Kireeye" yields one
 * named person step; "Kireeyayaal" yields a dynamic numbered list.
 */
export function buildConditionalWorkflow(
  config: DocumentConfig,
  values: FormValues,
): WorkflowStep[] {
  const setup = readAgreementSetup(values);
  const sections = getSections(config, values); // config-driven visibility
  const steps: WorkflowStep[] = [];

  // A document that lays its sections out in named flow steps walks those
  // steps and nothing else. Handled first and returned early, so the
  // one-section-per-step path below is untouched for everyone else.
  const flow = buildFlowSteps(config, sections);
  if (flow) return flow;

  for (const section of sections) {
    // Header-only sections (no scalar fields, no inline non-attendance
    // repeaters) would render an EMPTY step — a card with a title and
    // description but nothing to answer. Their attendance parties are
    // fully rendered by their own count/data/attendance steps below, so
    // the standalone section step is skipped (config-driven, generic).
    const hasOwnContent =
      section.fields.length > 0 ||
      (section.parties ?? []).some((p) => !p.attendance);
    if (hasOwnContent) {
      steps.push({
        key: `sec-${section.id}`,
        short: section.title,
        detail: { kind: "section", sectionIds: [section.id], sectionId: section.id },
      });
    }

    for (const partyDef of section.parties ?? []) {
      // Count-first groups ask "how many?" in their own step, immediately
      // before the step that collects their rows. The chosen count is
      // written straight into the row list (setRepeatableCount). Asked for
      // attendance groups AND for plain data groups — a seller list that
      // declares countFirst is just as dynamic as a buyer list.
      //
      // A group whose count is asked ELSEWHERE (PartyDef.countFrom) gets NO
      // step of its own: the setup step already holds that number, and a
      // second "Tirada …?" would be the same question asked twice.
      if (partyDef.countFirst && !partyDef.countFrom) {
        steps.push({
          key: `count-${partyDef.id}`,
          short: `Tirada ${partyDef.label}`,
          detail: { kind: "party-count", partyDef },
        });
      }
      if (!partyDef.attendance) {
        steps.push({ key: `party-${partyDef.id}`, short: partyDef.label, detail: { kind: "party-data", partyDef } });
        continue;
      }
      // Step 2 — "Xogta iyo Xaaladda Kireeyaha/Kiraystaha": ONE combined
      // step (identity + Ma Joogaa Haa/Maya + inline wakiil inputs). The
      // count is decided in Step 1 (Kireeye/Kireeyayaal card + inline
      // Tirada selector) — it is NEVER asked again here, and there is no
      // separate attendance step. Rows render dynamically from Step 1.
      const isLandlord = partyDef.id === "kireeyayaal";
      const isTenant = partyDef.id === "kiraystayaal";
      const mode = isLandlord ? setup.landlordMode : isTenant ? setup.tenantMode : "multiple";
      const singularTitle = isLandlord ? "Kireeyaha" : isTenant ? "Kiraystaha" : partyDef.singular;
      steps.push({
        key: `party-${partyDef.id}`,
        short:
          mode === "single"
            ? `Xogta iyo Xaaladda ${singularTitle}`
            : `Xogta iyo Xaaladda ${partyDef.label}`,
        detail: { kind: "party-status", partyDef },
      });
    }
  }

  return steps;
}
