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

import type { DocumentConfig, FormValues, PartyDef } from "./types";
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
  | { kind: "section"; sectionId: string }
  | { kind: "count"; partyDef: PartyDef }
  | { kind: "party-data"; partyDef: PartyDef }
  | { kind: "attendance"; partyDef: PartyDef };

export interface WorkflowStep {
  key: string;
  short: string;
  detail: WorkflowStepKind;
}

/** The Step 1 setup step itself. */
export function setupStep(config: DocumentConfig): WorkflowStep {
  const section = config.sections.find((s) => s.id === "heshiiska")!;
  return { key: "sec-heshiiska", short: section.title, detail: { kind: "section", sectionId: section.id } };
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
        detail: { kind: "section", sectionId: section.id },
      });
    }

    for (const partyDef of section.parties ?? []) {
      if (!partyDef.attendance) {
        steps.push({ key: `party-${partyDef.id}`, short: partyDef.label, detail: { kind: "party-data", partyDef } });
        continue;
      }
      const isLandlord = partyDef.id === "kireeyayaal";
      const isTenant = partyDef.id === "kiraystayaal";
      const mode = isLandlord ? setup.landlordMode : isTenant ? setup.tenantMode : "multiple";
      const singularTitle =
        (isLandlord ? "Kireeyaha" : isTenant ? "Kiraystaha" : partyDef.singular) + (mode === "single" ? "" : "");

      if (mode === "single") {
        // 02 Kireeyaha — hal qof: data + attendance in one combined flow.
        steps.push({
          key: `data-${partyDef.id}`,
          short: singularTitle,
          detail: { kind: "party-data", partyDef },
        });
        steps.push({
          key: `att-${partyDef.id}`,
          short: `Xaaladda ${singularTitle}`,
          detail: { kind: "attendance", partyDef },
        });
      } else {
        // 02 Kireeyayaasha — dynamic party list with count-first.
        steps.push({
          key: `count-${partyDef.id}`,
          short: `Tirada ${partyDef.label}`,
          detail: { kind: "count", partyDef },
        });
        steps.push({
          key: `data-${partyDef.id}`,
          short: partyDef.label,
          detail: { kind: "party-data", partyDef },
        });
        steps.push({
          key: `att-${partyDef.id}`,
          short: `Joogitaanka ${partyDef.label}`,
          detail: { kind: "attendance", partyDef },
        });
      }
    }
  }

  return steps;
}
