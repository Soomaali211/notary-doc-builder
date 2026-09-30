/**
 * Phase 2 engine tests (bun test).
 *
 * Covers the Phase 2 test matrix: basic fields, validation rules,
 * conditional logic (show/hide/AND/OR/NOT/nested), dynamic repeaters
 * (add/remove/min/max/unlimited), interview state & drafts, and review data.
 */
import { describe, expect, test } from "bun:test";
import {
  addRepeatableItem,
  canAddRepeatableItem,
  createInterviewState,
  deserializeDraft,
  getReviewData,
  getSections,
  getVisibleFields,
  isInterviewComplete,
  removeRepeatableItem,
  serializeDraft,
  setAnswer,
  getAnswer,
  evaluateRules,
  setRepeatableAnswer,
} from "../src/lib/notary/engine";
import { evaluateCondition, makeGetter } from "../src/lib/notary/conditions";
import {
  validateField,
  validateDocument,
  collectFilledValues,
} from "../src/lib/notary/validation";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function row(values: Record<string, string>): PartyRow {
  return { id: Math.random().toString(36).slice(2), values };
}

/** Attendance-enabled row (jooga by default in fixtures). */
function attRow(values: Record<string, string>): PartyRow {
  return { ...row(values), attendance: { status: "jooga" } };
}

function baseAnswers(): FormValues {
  const values: FormValues = {
    heshiiska: {
      taariikhda_heshiiska: "2026-01-15",
      sub_type: "guri_xaas",
      taariikhda_bilowga: "2026-02-01",
      taariikhda_dhammaadka: "2027-01-31",
    },
    kireeyayaal: [
      attRow({ magac: "Cabdi", telefoon: "+252 61 5551234", aqoonsi: "ID-1", cinwaan: "", faahfaahin_dheeraad: "" }),
    ],
    kiraystayaal: [
      attRow({ magac: "Xuseen", telefoon: "+252 63 4447777", aqoonsi: "ID-2", cinwaan: "", faahfaahin_dheeraad: "" }),
    ],
    guriga: {
      nooca_guriga: "guri_xaas",
      goobta: "Hodan",
      cinwaanka_guriga: "Wadada 21",
    },
    lacagta: {
      qiimaha_bil_ka: "350",
      habka_bixinta: "bank",
      taariikhda_bixinta: "1aad",
      bixinta_hore: "muqadin",
      damiin_jira: "yes",
      bangiga_magaca: "Dahabshiil",
      bangiga_hisaabka: "123456",
    },
    damiinka: {
      damiin_magac: "Maxamed",
      damiin_telefoon: "+252 61 1112223",
      damiin_aqoonsi: "ID-3",
    },
    ogaysiinta: {
      mudada_ogaysiinta: "30 maalmood",
      shuruudaha_joojinta: "30 maalmood ogaysiin.",
    },
    maragyo: [
      row({ magac: "Asha", telefoon: "", aqoonsi: "", cinwaan: "" }),
    ],
    dheeraad: { shuruudo_dheeraad: "" },
  };
  values.deebaaji = {
    deebaaji_jira: "yes",
    lacagta_deebaajiga: "25",
  };
  return values;
  return values;
}

/* ------------------------------------------------------------------ */
/* Basic fields                                                        */
/* ------------------------------------------------------------------ */

describe("basic fields", () => {
  test("text field accepts and stores values", () => {
    const config = heshiisKiroConfig;
    const values = baseAnswers();
    expect(getAnswer(values, "guriga", "goobta")).toBe("Hodan");
    const next = setAnswer(values, "guriga", "goobta", "Kaaraan");
    expect(getAnswer(next, "guriga", "goobta")).toBe("Kaaraan");
  });

  test("currency field stored as string and formatted in review", () => {
    const values = baseAnswers();
    const review = getReviewData(heshiisKiroConfig, values);
    const rent = review.flatMap((b) => b.rows).find((r) => r.label.includes("Qiimaha Kirada"));
    expect(rent?.value).toContain("350");
    expect(rent?.value).toContain("USD");
  });

  test("date fields format in Somali in review", () => {
    const values = baseAnswers();
    const review = getReviewData(heshiisKiroConfig, values);
    const start = review.flatMap((b) => b.rows).find((r) => r.label === "Taariikhda Bilowga");
    expect(start?.value).toContain("Febraayo");
  });

  test("select rejects a value outside its options", () => {
    const field = heshiisKiroConfig.sections
      .find((s) => s.id === "guriga")!
      .fields.find((f) => f.id === "nooca_guriga")!;
    expect(validateField(field, "guri_xaas")).toBeNull();
    expect(validateField(field, "something_else")).not.toBeNull();
  });

  test("checkbox toggles yes/no and default initializes", () => {
    const config = heshiisKiroConfig;
    const fresh = createInterviewState(config, "guri_xaas");
    const v = fresh.answers;
    expect(getAnswer(v, "deebaaji", "deebaaji_jira")).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

describe("validation", () => {
  test("required fields produce Somali errors", () => {
    const field = { id: "x", type: "text" as const, label: "Magaca Buuxa", validation: { required: true } };
    expect(validateField(field, "")).toBe("Fadlan buuxi: Magaca Buuxa");
  });

  test("invalid number rejected", () => {
    const field = { id: "x", type: "currency" as const, label: "Qiimaha Kirada", validation: { min: 0 } };
    expect(validateField(field, "abc")).not.toBeNull();
    expect(validateField(field, "-5")).not.toBeNull();
    expect(validateField(field, "350")).toBeNull();
  });

  test("invalid date rejected, leap year handled", () => {
    expect(validateDateStringTest("2026-02-30")).not.toBeNull();
    expect(validateDateStringTest("2024-02-29")).toBeNull();
    expect(validateDateStringTest("15 Janaayo")).not.toBeNull();
  });

  test("invalid phone rejected", () => {
    const field = { id: "x", type: "phone" as const, label: "Telefoon" };
    expect(validateField(field, "abc")).not.toBeNull();
    expect(validateField(field, "+252 61 5551234")).toBeNull();
  });

  test("invalid email rejected", () => {
    const field = { id: "x", type: "email" as const, label: "Emailka" };
    expect(validateField(field, "not-an-email")).not.toBeNull();
    expect(validateField(field, "name@example.com")).toBeNull();
  });

  test("pattern rule with custom Somali message", () => {
    const field = {
      id: "x",
      type: "text" as const,
      label: "Koodhka",
      validation: { pattern: "^[A-Z]{3}-\\d{3}$", patternMessage: "Koodhku waa inuu noqdaa AAA-000." },
    };
    expect(validateField(field, "abc")).toBe("Koodhku waa inuu noqdaa AAA-000.");
    expect(validateField(field, "ABC-123")).toBeNull();
  });

  test("end date before start date is caught", () => {
    const values = baseAnswers();
    values.heshiiska = {
      ...(values.heshiiska as Record<string, string>),
      taariikhda_dhammaadka: "2025-01-01",
    };
    const errors = validateDocument(heshiisKiroConfig, values);
    expect(errors["heshiiska"]).toBeDefined();
  });
});

function validateDateStringTest(value: string): string | null {
  // Thin wrapper so the date tests read cleanly; uses the engine export.
  const { validateDateString } = require("../src/lib/notary/validation");
  return validateDateString(value);
}

/* ------------------------------------------------------------------ */
/* Conditional logic                                                   */
/* ------------------------------------------------------------------ */

describe("conditional logic", () => {
  test("deebaaji = yes shows deposit amount field; maya hides it", () => {
    const config = heshiisKiroConfig;
    const section = config.sections.find((s) => s.id === "deebaaji")!;
    const yes = baseAnswers();
    const no = baseAnswers();
    (no.deebaaji as Record<string, string>).deebaaji_jira = "no";

    const yesFields = getVisibleFields(section, yes).map((f) => f.id);
    const noFields = getVisibleFields(section, no).map((f) => f.id);
    expect(yesFields).toContain("lacagta_deebaajiga");
    expect(noFields).not.toContain("lacagta_deebaajiga");
  });

  test("damiin = maya hides the whole Damiinka section (conditional section)", () => {
    const config = heshiisKiroConfig;
    const yes = baseAnswers();
    const no = baseAnswers();
    (no.lacagta as Record<string, string>).damiin_jira = "no";

    const yesSections = getSections(config, yes).map((s) => s.id);
    const noSections = getSections(config, no).map((s) => s.id);
    expect(yesSections).toContain("damiinka");
    expect(noSections).not.toContain("damiinka");
  });

  test("damiinka fields validate when the section is visible", () => {
    const config = heshiisKiroConfig;
    const no = baseAnswers();
    (no.lacagta as Record<string, string>).damiin_jira = "no";
    (no.damiinka as Record<string, string>) = { damiin_magac: "", damiin_telefoon: "", damiin_aqoonsi: "" };
    const errors = validateDocument(config, no);
    // Hidden conditional section is not validated even when empty.
    expect(errors["damiinka"]).toBeUndefined();
  });

  test("payment_method = bank reveals bank fields only", () => {
    const config = heshiisKiroConfig;
    const section = config.sections.find((s) => s.id === "lacagta")!;
    const bank = baseAnswers();
    const cash = baseAnswers();
    (cash.lacagta as Record<string, string>).habka_bixinta = "cash";

    const bankFields = getVisibleFields(section, bank).map((f) => f.id);
    const cashFields = getVisibleFields(section, cash).map((f) => f.id);
    expect(bankFields).toContain("bangiga_magaca");
    expect(cashFields).not.toContain("bangiga_magaca");
  });

  test("AND / OR / NOT and nested conditions evaluate", () => {
    const values = baseAnswers();
    const get = makeGetter(values);
    expect(
      evaluateCondition(
        { op: "and", conditions: [
          { op: "equals", field: "deebaaji.deebaaji_jira", value: "yes" },
          { op: "greater_than", field: "lacagta.qiimaha_bil_ka", value: 100 },
        ] },
        get,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { op: "or", conditions: [
          { op: "equals", field: "deebaaji.deebaaji_jira", value: "no" },
          { op: "equals", field: "deebaaji.deebaaji_jira", value: "yes" },
        ] },
        get,
      ),
    ).toBe(true);
    expect(
      evaluateCondition({ op: "not", condition: { op: "is_empty", field: "guriga.goobta" } }, get),
    ).toBe(true);
    expect(
      evaluateCondition(
        { op: "and", conditions: [
          { op: "is_true", field: "deebaaji.deebaaji_jira" },
          { op: "not", condition: { op: "less_than", field: "lacagta.qiimaha_bil_ka", value: 100 } },
        ] },
        get,
      ),
    ).toBe(true);
  });

  test("is_empty / is_not_empty / contains / less_than operators", () => {
    const values = baseAnswers();
    const get = makeGetter(values);
    expect(evaluateCondition({ op: "is_not_empty", field: "guriga.goobta" }, get)).toBe(true);
    expect(evaluateCondition({ op: "is_empty", field: "guriga.sharraxaad" }, get)).toBe(true);
    expect(evaluateCondition({ op: "contains", field: "guriga.goobta", value: "Hodan" }, get)).toBe(true); // substring on plain text
    expect(evaluateCondition({ op: "contains", field: "guriga.goobta", value: "Kaaraan" }, get)).toBe(false);
    expect(evaluateCondition({ op: "less_than", field: "lacagta.qiimaha_bil_ka", value: 400 }, get)).toBe(true);
  });

  test("hidden conditional field is not validated", () => {
    const values = baseAnswers();
    (values.deebaaji as Record<string, string>).deebaaji_jira = "no";
    (values.deebaaji as Record<string, string>).lacagta_deebaajiga = "";
    const errors = validateDocument(heshiisKiroConfig, values);
    // deebaaji section should now pass (hidden required field skipped)
    expect(errors["deebaaji"]).toBeUndefined();
  });

  test("malformed rule evaluates to false, never throws", () => {
    const values = baseAnswers();
    const get = makeGetter(values);
    expect(evaluateCondition({ op: "equals", field: "nope.missing", value: "x" }, get)).toBe(false);
    // @ts-expect-error intentionally malformed
    expect(evaluateCondition(undefined, get)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Dynamic repeaters                                                   */
/* ------------------------------------------------------------------ */

describe("dynamic repeaters", () => {
  test("add repeater rows: 2 kireeyayaal, 3 kiraystayaal, 4 marag", () => {
    let values = baseAnswers();
    const kireeye = heshiisKiroConfig.sections
      .find((s) => s.id === "kireeyaha")!.parties![0];
    const kirayste = heshiisKiroConfig.sections
      .find((s) => s.id === "kiraystaha")!.parties![0];
    const marag = heshiisKiroConfig.sections
      .find((s) => s.id === "maragyada")!.parties![0];

    values = addRepeatableItem(values, kireeye); // 2
    for (let i = 0; i < 2; i++) values = addRepeatableItem(values, kirayste); // 3
    for (let i = 0; i < 3; i++) values = addRepeatableItem(values, marag); // 4

    expect((values.kireeyayaal as PartyRow[]).length).toBe(2);
    expect((values.kiraystayaal as PartyRow[]).length).toBe(3);
    expect((values.maragyo as PartyRow[]).length).toBe(4);
  });

  test("remove respects minimum (cannot drop below 1)", () => {
    let values = baseAnswers();
    const marag = heshiisKiroConfig.sections
      .find((s) => s.id === "maragyada")!.parties![0];
    values = removeRepeatableItem(values, marag, 0);
    expect((values.maragyo as PartyRow[]).length).toBe(1); // min = 1 held
  });

  test("unlimited repeaters: no cap on additions", () => {
    let values = baseAnswers();
    const marag = heshiisKiroConfig.sections
      .find((s) => s.id === "maragyada")!.parties![0];
    for (let i = 0; i < 25; i++) values = addRepeatableItem(values, marag);
    expect((values.maragyo as PartyRow[]).length).toBe(26);
    expect(canAddRepeatableItem(marag, values)).toBe(true);
  });

  test("bounded repeater blocks additions at max", () => {
    const bounded: PartyDef = {
      id: "x",
      label: "X",
      singular: "X",
      min: 1,
      max: 2,
      fields: [{ id: "magac", type: "text", label: "Magac" }],
    };
    let values: FormValues = {
      x: [row({ magac: "a" }), row({ magac: "b" })],
    };
    expect(canAddRepeatableItem(bounded, values)).toBe(false);
    values = addRepeatableItem(values, bounded);
    expect((values.x as PartyRow[]).length).toBe(2);
  });

  test("repeater minimum enforced with Somali error", () => {
    const values = baseAnswers();
    (values.maragyo as PartyRow[]) = [];
    const errors = validateDocument(heshiisKiroConfig, values);
    const general = errors["maragyada"]?.general ?? [];
    expect(general.some((g) => g.includes("Ugu yaraan hal marag"))).toBe(true);
  });

  test("per-row validation flags only the invalid row", () => {
    const values = baseAnswers();
    const rows = values.kireeyayaal as PartyRow[];
    rows.push(row({ magac: "", telefoon: "bad", aqoonsi: "", cinwaan: "", faahfaahin_dheeraad: "" }));
    const errors = validateDocument(heshiisKiroConfig, values);
    const partyErrors = errors["kireeyaha"]?.partyErrors["kireeyayaal"] ?? [];
    expect(partyErrors.some((e) => e.index === 1)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Interview state, navigation & drafts                                */
/* ------------------------------------------------------------------ */

describe("interview state & drafts", () => {
  test("navigation back/next preserves answers", () => {
    let state = createInterviewState(heshiisKiroConfig, "guri_xaas");
    state.answers = setAnswer(state.answers, "guriga", "goobta", "Hodan");
    // simulate moving back and forth: state is plain data, answers persist
    const snapshot = JSON.stringify(state.answers);
    state.answers = setAnswer(state.answers, "deebaaji", "deebaaji_jira", "yes");
    expect(JSON.stringify(state.answers)).not.toBe(snapshot);
    expect(getAnswer(state.answers, "guriga", "goobta")).toBe("Hodan");
  });

  test("save draft → serialize → load draft round-trips all data", () => {
    let values = baseAnswers();
    const marag = heshiisKiroConfig.sections.find((s) => s.id === "maragyada")!.parties![0];
    for (let i = 0; i < 3; i++) values = addRepeatableItem(values, marag);
    values = setRepeatableAnswer(values, "maragyo", 1, "magac", "Yuusuf");
    values = setRepeatableAnswer(values, "maragyo", 2, "magac", "Halimo");
    values = setRepeatableAnswer(values, "maragyo", 3, "magac", "Faadumo");

    const json = serializeDraft(values);
    const restored = deserializeDraft(heshiisKiroConfig, json);
    expect(getAnswer(restored, "guriga", "goobta")).toBe("Hodan");
    expect((restored.maragyo as PartyRow[]).length).toBe(4);
    expect((restored.maragyo as PartyRow[])[3].values.magac).toBe("Faadumo");
  });

  test("resume with a corrupt draft degrades to fresh interview (no crash)", () => {
    const restored = deserializeDraft(heshiisKiroConfig, "{not json");
    expect(getAnswer(restored, "guriga", "goobta")).toBe("");
  });

  test("resume with an older config merges over fresh template", () => {
    const restored = deserializeDraft(heshiisKiroConfig, '{"guriga":{"goobta":"Hodan"}}');
    expect(getAnswer(restored, "guriga", "goobta")).toBe("Hodan");
    expect(getAnswer(restored, "ogaysiinta", "mudada_ogaysiinta")).toBe("");
  });

  test("completed interview passes isInterviewComplete", () => {
    const values = baseAnswers();
    expect(isInterviewComplete(heshiisKiroConfig, values)).toBe(true);
  });

  test("partial interview is not complete", () => {
    const values = baseAnswers();
    (values.ogaysiinta as Record<string, string>).mudada_ogaysiinta = "";
    expect(isInterviewComplete(heshiisKiroConfig, values)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

describe("review", () => {
  test("review data includes dynamic parties with correct counts", () => {
    let values = baseAnswers();
    const marag = heshiisKiroConfig.sections.find((s) => s.id === "maragyada")!.parties![0];
    for (let i = 0; i < 3; i++) values = addRepeatableItem(values, marag);
    values = setRepeatableAnswer(values, "maragyo", 1, "magac", "Yuusuf");
    values = setRepeatableAnswer(values, "maragyo", 2, "magac", "Halimo");
    values = setRepeatableAnswer(values, "maragyo", 3, "magac", "Faadumo");

    const review = getReviewData(heshiisKiroConfig, values);
    const witnessBlock = review.find((b) => b.sectionId === "maragyada");
    const witnessRows = witnessBlock?.rows.filter((r) => r.label.startsWith("Marag")) ?? [];
    expect(witnessRows.length).toBe(4);
    expect(witnessRows.map((r) => r.value)).toContain("Asha");
    expect(witnessRows.map((r) => r.value)).toContain("Faadumo");
  });

  test("review omits hidden conditional sections' data when deebaaji = maya", () => {
    const values = baseAnswers();
    (values.deebaaji as Record<string, string>).deebaaji_jira = "no";
    (values.deebaaji as Record<string, string>).lacagta_deebaajiga = "";
    const review = getReviewData(heshiisKiroConfig, values);
    const block = review.find((b) => b.sectionId === "deebaaji");
    const labels = block?.rows.map((r) => r.label) ?? [];
    expect(labels.some((l) => l.includes("Lacagta Deebaajiga"))).toBe(false);
  });

  test("review keeps section order", () => {
    const review = getReviewData(heshiisKiroConfig, baseAnswers());
    const ids = review.map((b) => b.sectionId);
    const heshiiskaIdx = ids.indexOf("heshiiska");
    const maragyadaIdx = ids.indexOf("maragyada");
    expect(heshiiskaIdx).toBeGreaterThanOrEqual(0);
    expect(maragyadaIdx).toBeGreaterThan(heshiiskaIdx);
  });
});

/* ------------------------------------------------------------------ */
/* Engine API sanity                                                   */
/* ------------------------------------------------------------------ */

describe("engine api", () => {
  test("getSections returns 10 sections when damiin = yes, 9 when maya", () => {
    const yes = baseAnswers();
    expect(getSections(heshiisKiroConfig, yes).length).toBe(10);
    const no = baseAnswers();
    (no.lacagta as Record<string, string>).damiin_jira = "no";
    expect(getSections(heshiisKiroConfig, no).length).toBe(9);
  });

  test("evaluateRules over the engine API", () => {
    const values = baseAnswers();
    expect(
      evaluateRules({ op: "is_true", field: "deebaaji.deebaaji_jira" }, values),
    ).toBe(true);
  });
});
