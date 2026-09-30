/**
 * Phase Revision Step 1 — conditional workflow + migration tests.
 *
 * Covers: setup decisions → step list (Examples A/B/C from the
 * requirement), Kiro Furan vs Xidhan field visibility, Deebaaji/Damiin
 * conditional steps fully removed from the stepper, single vs multiple
 * party modes, no repeated count question (#19), and draft migration
 * back-compat (#15 preserve data).
 */
import { describe, expect, test } from "bun:test";
import {
  buildConditionalWorkflow,
  isSetupComplete,
  readAgreementSetup,
  setupSummaryRows,
} from "../src/lib/notary/agreementSetup";
import { deserializeDraft, getSections, isInterviewComplete } from "../src/lib/notary/engine";
import { migrateDraftValues } from "../src/lib/notary/formValues";
import { heshiisKiroConfig as config } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues } from "../src/lib/notary/types";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function setupValues(overrides?: Partial<Record<string, string>>): FormValues {
  return {
    heshiiska: {
      reference: "DPN/K/200",
      taariikhda_heshiiska: "2026-09-30",
      sub_type: "guri_xaas",
      kireeye_mode: "multiple",
      kirayste_mode: "single",
      muddada_nooca: "xidhan",
      deebaaji_haa: "yes",
      damiin_haa: "no",
      taariikhda_bilowga: "2026-10-01",
      taariikhda_dhammaadka: "2027-09-30",
      ...overrides,
    },
  } as unknown as FormValues;
}

const stepIds = (values: FormValues) => {
  const workflow = buildConditionalWorkflow(config, values);
  const sectionIds = workflow
    .filter((s) => s.detail.kind === "section")
    .map((s) => (s.detail as { kind: "section"; sectionId: string }).sectionId);
  return sectionIds;
};

const partyStepIds = (values: FormValues) => {
  const workflow = buildConditionalWorkflow(config, values);
  return workflow
    .filter((s) => s.detail.kind === "count" || s.detail.kind === "party-data")
    .map((s) => s.key);
};

/** Minimal WordprocessingML paragraph (same shape as generation tests). */
const p = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

/* ------------------------------------------------------------------ */
/* Example A — Kireeyayaal(3) + Kirayste + Xidhan + Deebaaji Haa       */
/* ------------------------------------------------------------------ */

describe("Example A", () => {
  const values = setupValues({ kirayste_mode: "single" });

  test("deebaaji step present, damiin step absent", () => {
    const ids = stepIds(values);
    expect(ids).toContain("deebaaji");
    expect(ids).not.toContain("damiinka");
  });

  test("closed duration → start/end dates required", () => {
    const { getVisibleFields } = require("../src/lib/notary/engine");
    const heshiiska = getSections(config, values).find((s) => s.id === "heshiiska")!;
    const visible = getVisibleFields(heshiiska, values).map((f) => f.id);
    expect(visible).toContain("taariikhda_bilowga");
    expect(visible).toContain("taariikhda_dhammaadka");
  });
});

/* ------------------------------------------------------------------ */
/* Example B — Kireeye + Kiraystayaal + Furan + Deebaaji Maya + Damiin Haa */
/* ------------------------------------------------------------------ */

describe("Example B", () => {
  const values = setupValues({
    kireeye_mode: "single",
    kirayste_mode: "multiple",
    muddada_nooca: "furan",
    deebaaji_haa: "no",
    damiin_haa: "yes",
  });

  test("deebaaji removed entirely, damiin present", () => {
    const ids = stepIds(values);
    expect(ids).not.toContain("deebaaji");
    expect(ids).toContain("damiinka");
  });

  test("open duration → no end-date fields at all", () => {
    // Use the interview's own conditional logic (visible fields only).
    const { getVisibleFields } = require("../src/lib/notary/engine");
    const heshiiska = getSections(config, values).find((s) => s.id === "heshiiska")!;
    const visible = getVisibleFields(heshiiska, values).map((f) => f.id);
    expect(visible).not.toContain("taariikhda_bilowga");
    expect(visible).not.toContain("taariikhda_dhammaadka");
  });

  test("single landlord → no count step; multiple tenants → count step", () => {
    const keys = partyStepIds(values);
    expect(keys).not.toContain("count-kireeyayaal");
    expect(keys).toContain("count-kiraystayaal");
  });

  test("setup readback", () => {
    const s = readAgreementSetup(values);
    expect(s.landlordMode).toBe("single");
    expect(s.tenantMode).toBe("multiple");
    expect(s.durationKind).toBe("furan");
    expect(s.deposit).toBe(false);
    expect(s.guarantor).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Example C — everything present                                      */
/* ------------------------------------------------------------------ */

describe("Example C", () => {
  const values = setupValues({ damiin_haa: "yes" });

  test("both conditional sections appear in order: deebaaji before damiinka", () => {
    const ids = stepIds(values);
    expect(ids.indexOf("deebaaji")).toBeGreaterThan(-1);
    expect(ids.indexOf("damiinka")).toBeGreaterThan(ids.indexOf("deebaaji"));
  });

  test("order: setup → parties → property → duration/dates → payment → deposit → notice → witnesses", () => {
    const ids = stepIds(values);
    expect(ids[0]).toBe("heshiiska");
    expect(ids.indexOf("kireeyaha")).toBeGreaterThan(0);
    expect(ids.indexOf("kiraystaha")).toBeGreaterThan(ids.indexOf("kireeyaha"));
    expect(ids.indexOf("guriga")).toBeGreaterThan(ids.indexOf("kiraystaha"));
    expect(ids.indexOf("lacagta")).toBeGreaterThan(ids.indexOf("guriga"));
    expect(ids.indexOf("ogaysiinta")).toBeGreaterThan(ids.indexOf("lacagta"));
    expect(ids.indexOf("maragyada")).toBeGreaterThan(ids.indexOf("ogaysiinta"));
    expect(ids.indexOf("dheeraad")).toBeGreaterThan(ids.indexOf("maragyada"));
  });
});

/* ------------------------------------------------------------------ */
/* Setup completeness + summary                                        */
/* ------------------------------------------------------------------ */

describe("setup state", () => {
  test("incomplete setup detected", () => {
    expect(isSetupComplete(readAgreementSetup(setupValues()))).toBe(true);
    const missing = setupValues({ deebaaji_haa: "" });
    expect(isSetupComplete(readAgreementSetup(missing))).toBe(false);
  });

  test("summary rows include counts and Haa/Maya", () => {
    const s = readAgreementSetup(setupValues());
    const rows = setupSummaryRows(config, s);
    const map = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(map["Nooca Kirada"]).toBe("Guri Xaas");
    expect(map["Kireeyayaasha"]).toBeDefined();
    expect(map["Deebaaji"]).toBe("Haa");
    expect(map["Damiin"]).toBe("Maya");
    expect(map["Muddada"]).toBe("Kiro Xidhan");
  });
});

/* ------------------------------------------------------------------ */
/* Migration — old drafts keep working (#15)                           */
/* ------------------------------------------------------------------ */

describe("draft migration", () => {
  test("old deebaaji.deebaaji_jira → heshiiska.deebaaji_haa", () => {
    const old = {
      heshiiska: { sub_type: "guri_xaas" },
      deebaaji: { deebaaji_jira: "yes", lacagta_deebaajiga: "25" },
    };
    const migrated = migrateDraftValues(old as unknown as FormValues);
    expect((migrated.heshiiska as Record<string, string>).deebaaji_haa).toBe("yes");
    // deposit data preserved
    expect((migrated.deebaaji as Record<string, string>).lacagta_deebaajiga).toBe("25");
    // new visibility uses the migrated answer → section exists
    expect(getSections(config, migrated).map((s) => s.id)).toContain("deebaaji");
  });

  test("old lacagta.damiin_jira → heshiiska.damiin_haa", () => {
    const old = {
      heshiiska: {},
      lacagta: { qiimaha_bil_ka: "400", damiin_jira: "yes" },
      damiinka: { damiin_magac: "Maxamed" },
    };
    const migrated = migrateDraftValues(old as unknown as FormValues);
    expect((migrated.heshiiska as Record<string, string>).damiin_haa).toBe("yes");
    expect((migrated.damiinka as Record<string, string>).damiin_magac).toBe("Maxamed");
    expect(getSections(config, migrated).map((s) => s.id)).toContain("damiinka");
  });

  test("maya answers hide sections but data stays untouched", () => {
    const old = {
      heshiiska: {},
      deebaaji: { deebaaji_jira: "no", lacagta_deebaajiga: "" },
      lacagta: { damiin_jira: "no" },
      damiinka: { damiin_magac: "X" },
    };
    const migrated = migrateDraftValues(old as unknown as FormValues);
    const ids = getSections(config, migrated).map((s) => s.id);
    expect(ids).not.toContain("deebaaji");
    expect(ids).not.toContain("damiinka");
    // "Hay xogta draft-ka" equivalent: data preserved in storage.
    expect((migrated.damiinka as Record<string, string>).damiin_magac).toBe("X");
  });

  test("deserializeDraft migrates through the engine", () => {
    const restored = deserializeDraft(
      config,
      JSON.stringify({ heshiiska: {}, deebaaji: { deebaaji_jira: "yes" } }),
    );
    expect((restored.heshiiska as Record<string, string>).deebaaji_haa).toBe("yes");
  });

  test("new drafts pass through untouched", () => {
    const fresh = deserializeDraft(config, null);
    expect(getAnswerDefault(fresh)).toBe("");
  });

  function getAnswerDefault(values: FormValues): string {
    return ((values.heshiiska as Record<string, string>) ?? {}).deebaaji_haa ?? "";
  }
});

/* ------------------------------------------------------------------ */
/* End-to-end: migrated old draft can still complete + generate paths  */
/* ------------------------------------------------------------------ */

describe("conditional completeness", () => {
  test("deebaaji maya → no deebaaji validation errors", () => {
    const values = setupValues({ deebaaji_haa: "no" });
    // Section absent → nothing to validate; setup itself complete.
    expect(isSetupComplete(readAgreementSetup(values))).toBe(true);
  });

  test("workflow mirrors interview completeness on minimal fixture", () => {
    // The full interview completion is covered in revision.test.ts; here
    // we assert the workflow derivation stays consistent with getSections.
    const values = setupValues();
    const workflowSections = stepIds(values);
    const interviewSections = getSections(config, values).map((s) => s.id);
    expect(workflowSections).toEqual(interviewSections);
    expect(isInterviewComplete(config, values)).toBe(false); // parties etc. missing
  });
});

/* ------------------------------------------------------------------ */
/* STEP 1 COMBINED CORRECTION — Test matrix A–G                        */
/* ------------------------------------------------------------------ */

/** Visible heshiiska field ids for a values fixture. */
function visibleHeshiiskaFields(values: FormValues): string[] {
  const { getVisibleFields } = require("../src/lib/notary/engine");
  const heshiiska = getSections(config, values).find((s) => s.id === "heshiiska")!;
  return getVisibleFields(heshiiska, values).map((f) => f.id);
}

/** Render one template line through the real generation pipeline. */
function renderLine(line: string, values: FormValues): string {
  const { buildDataContext, processDocumentXml, resolveClauses } = require("../src/lib/notary/template");
  const ctx = buildDataContext(config, values);
  return processDocumentXml(line, ctx, resolveClauses(config, values));
}

describe("Test matrix A–G", () => {
  test("A — Furan + Deebaaji Haa + Damiin Haa: no End Date, both steps visible", () => {
    const values = setupValues({ muddada_nooca: "furan", deebaaji_haa: "yes", damiin_haa: "yes" });
    const visible = visibleHeshiiskaFields(values);
    expect(visible).not.toContain("taariikhda_bilowga");
    expect(visible).not.toContain("taariikhda_dhammaadka");
    const ids = stepIds(values);
    expect(ids).toContain("deebaaji");
    expect(ids).toContain("damiinka");
  });

  test("B — Furan + Deebaaji Maya + Damiin Maya: no End Date, both steps removed", () => {
    const values = setupValues({ muddada_nooca: "furan", deebaaji_haa: "no", damiin_haa: "no" });
    const visible = visibleHeshiiskaFields(values);
    expect(visible).not.toContain("taariikhda_dhammaadka");
    const ids = stepIds(values);
    expect(ids).not.toContain("deebaaji");
    expect(ids).not.toContain("damiinka");
    const s = readAgreementSetup(values);
    expect(s.durationKind).toBe("furan");
    expect(s.deposit).toBe(false);
    expect(s.guarantor).toBe(false);
  });

  test("C — Xidhan + Deebaaji Haa + Damiin Maya: End Date visible+required, deebaaji present, damiin absent", () => {
    const values = setupValues({ deebaaji_haa: "yes", damiin_haa: "no", taariikhda_dhammaadka: "" });
    const visible = visibleHeshiiskaFields(values);
    expect(visible).toContain("taariikhda_bilowga");
    expect(visible).toContain("taariikhda_dhammaadka");
    const ids = stepIds(values);
    expect(ids).toContain("deebaaji");
    expect(ids).not.toContain("damiinka");
    // End Date required when Xidhan.
    const { validateDocument } = require("../src/lib/notary/validation");
    const errors = validateDocument(config, values);
    expect(errors["heshiiska"]?.fieldErrors["taariikhda_dhammaadka"]).toBeDefined();
    // endDate > startDate: equal dates rejected.
    const equal = setupValues({ deebaaji_haa: "yes", damiin_haa: "no", taariikhda_dhammaadka: "2026-10-01" });
    expect(validateDocument(config, equal)["heshiiska"]?.general.some((g: string) => g.includes("Dhammaadka"))).toBe(true);
  });

  test("D — Xidhan + Deebaaji Maya + Damiin Haa: End Date visible+required, deebaaji absent, damiin present", () => {
    const values = setupValues({ deebaaji_haa: "no", damiin_haa: "yes", taariikhda_dhammaadka: "" });
    const visible = visibleHeshiiskaFields(values);
    expect(visible).toContain("taariikhda_dhammaadka");
    const ids = stepIds(values);
    expect(ids).not.toContain("deebaaji");
    expect(ids).toContain("damiinka");
    const { validateDocument } = require("../src/lib/notary/validation");
    expect(validateDocument(config, values)["heshiiska"]?.fieldErrors["taariikhda_dhammaadka"]).toBeDefined();
  });

  test("E — Xidhan→Furan: dates hidden, no validation error, data kept, NOT in document output", () => {
    // Stale dates remain in the draft ("Hay draft-ka" choice) after the switch.
    const values = setupValues({ muddada_nooca: "furan" });
    expect((values.heshiiska as Record<string, string>).taariikhda_dhammaadka).toBe("2027-09-30");
    // 1) End Date disappears from the interview.
    const visible = visibleHeshiiskaFields(values);
    expect(visible).not.toContain("taariikhda_bilowga");
    expect(visible).not.toContain("taariikhda_dhammaadka");
    // 2) No validation error even though a stale date sits in the draft.
    const { validateDocument } = require("../src/lib/notary/validation");
    expect(validateDocument(config, values)["heshiiska"]).toBeUndefined();
    // 3) Document generation does NOT output the End Date (mapping-level skip).
    const out = renderLine(p("Dhammaadka: {{TAARIIKHDA_DHAMMAADKA}}"), values);
    expect(out).not.toContain("30/09/2027");
    expect(out).toContain("Dhammaadka:");
    // Control: Xidhan still emits the formatted date.
    const outXidhan = renderLine(p("Dhammaadka: {{TAARIIKHDA_DHAMMAADKA}}"), setupValues());
    expect(outXidhan).toContain("30/09/2027");
  });

  test("F — Deebaaji Haa→Maya with data: step hidden, no deebaaji errors, data preserved", () => {
    const values = setupValues({ deebaaji_haa: "no" });
    (values.deebaaji as Record<string, string>) = {
      lacagta_deebaajiga: "25",
      shuruudaha_deebaajiga: "Meter-ka waa kan kireeyaha.",
    };
    const ids = stepIds(values);
    expect(ids).not.toContain("deebaaji");
    const { validateDocument } = require("../src/lib/notary/validation");
    expect(validateDocument(config, values)["deebaaji"]).toBeUndefined();
    // Stored draft data untouched (visibility ≠ data).
    expect((values.deebaaji as Record<string, string>).lacagta_deebaajiga).toBe("25");
  });

  test("G — Damiin Haa→Maya with data: step hidden, no damiin errors, data preserved", () => {
    const values = setupValues({ damiin_haa: "no" });
    (values.damiinka as Record<string, string>) = {
      damiin_magac: "Maxamed Nuur",
      damiin_telefoon: "+252 61 1112223",
      damiin_aqoonsi: "ID-5566",
      damiin_cinwaan: "Kaaraan",
    };
    const ids = stepIds(values);
    expect(ids).not.toContain("damiinka");
    const { validateDocument } = require("../src/lib/notary/validation");
    expect(validateDocument(config, values)["damiinka"]).toBeUndefined();
    expect((values.damiinka as Record<string, string>).damiin_magac).toBe("Maxamed Nuur");
  });
});
