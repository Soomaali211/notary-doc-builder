/**
 * Phase Revision — attendance & representative model tests (scenarios A–F).
 *
 * A: 3 kireeye, dhammaan Jooga
 * B: 3 kireeye, 2 → Wakiil A, 1 → Jooga
 * C: 3 kireeye, 3 → Wakiil A (hal wakiil, hal mar geli)
 * D: 3 kireeye, 1 → Wakiil A, 1 → Wakiil B, 1 → Jooga
 * E: 5 kireeye, 3 → Wakiil A, 1 → Wakiil B, 1 → Jooga
 * F: 3 kirayste, 2 → Wakiil A, 1 → Jooga
 *
 * Covered: UI helpers (count-first), data model integrity, validation,
 * save/load round-trip, review rows, party summary, document generation
 * (docx contains shared-rep data once), archive summary.
 */
import { describe, expect, test } from "bun:test";
import {
  addRepeatableItem,
  createRepresentative,
  deserializeDraft,
  getReviewData,
  isInterviewComplete,
  linkPartyRepresentative,
  listRepresentatives,
  partiesRepresentedBy,
  repNameFor,
  serializeDraft,
  setPartyAttendance,
  setRepeatableAnswer,
  setRepeatableCount,
} from "../src/lib/notary/engine";
import { buildPartySummary } from "../src/lib/notary/formValues";
import { validateDocument } from "../src/lib/notary/validation";
import { heshiisKiroConfig as config } from "../src/lib/notary/documents/heshiisKiro";
import { row } from "../scripts/verify-helpers";
import { generateDocument } from "../src/lib/notary/pipeline";
import { selectTemplate } from "../src/lib/notary/registry";
import JSZip from "jszip";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

/* ------------------------------------------------------------------ */
/* Fixture helpers                                                     */
/* ------------------------------------------------------------------ */

const kireeyeDef = config.sections.find((s) => s.id === "kireeyaha")!.parties![0];
const kiraysteDef = config.sections.find((s) => s.id === "kiraystaha")!.parties![0];
const maragDef = config.sections.find((s) => s.id === "maragyada")!.parties![0];

function baseSectionValues(): Record<string, Record<string, string>> {
  return {
    heshiiska: {
      reference: "DPN/K/100",
      taariikhda_heshiiska: "2026-09-30",
      sub_type: "guri_xaas",
      taariikhda_bilowga: "2026-10-01",
      taariikhda_dhammaadka: "2027-09-30",
    },
    guriga: {
      nooca_guriga: "guri_xaas",
      goobta: "Hodan, Muqdisho",
      cinwaanka_guriga: "Wadada 21ka",
    },
    lacagta: {
      qiimaha_bil_ka: "400",
      habka_bixinta: "cash",
      taariikhda_bixinta: "1aad",
      bixinta_hore: "muqadin",
      damiin_jira: "no",
    },
    deebaaji: { deebaaji_jira: "no" },
    ogaysiinta: {
      mudada_ogaysiinta: "30 maalmood",
      shuruudaha_joojinta: "Ogaysiin 30 maalmood.",
    },
    dheeraad: { shuruudo_dheeraad: "" },
  };
}

function baseValues(): FormValues {
  return baseSectionValues() as unknown as FormValues;
}

/** Names a party row and links it to a rep (or sets plain attendance). */
function setupParty(
  values: FormValues,
  partyId: string,
  index: number,
  name: string,
  status: "jooga" | "ma_joogo" | "wakiil",
  repId?: string,
): FormValues {
  let v = setRepeatableAnswer(values, partyId, index, "magac", name);
  v = setRepeatableAnswer(v, partyId, index, "telefoon", "+252 61 0000000");
  v = setRepeatableAnswer(v, partyId, index, "aqoonsi", "ID-000");
  v = setPartyAttendance(v, partyId, index, status);
  if (status === "wakiil" && repId) {
    v = linkPartyRepresentative(v, partyId, index, repId);
  }
  return v;
}

function completeMaragAndKirayste(values: FormValues, kiraysteCount = 1): FormValues {
  let v = values;
  v = setRepeatableCount(v, kiraysteDef, kiraysteCount);
  v = setupParty(v, "kiraystayaal", 0, "Xuseen Maxamed", "jooga");
  v = setRepeatableCount(v, maragDef, 1);
  v = setRepeatableAnswer(v, "maragyo", 0, "magac", "Asha Omar");
  return v;
}

/* ------------------------------------------------------------------ */
/* Scenario A — 3 kireeye, dhammaan Jooga                              */
/* ------------------------------------------------------------------ */

function scenarioA(): FormValues {
  let v = baseValues();
  v = setRepeatableCount(v, kireeyeDef, 3);
  v = setupParty(v, "kireeyayaal", 0, "Axmed Cabdi", "jooga");
  v = setupParty(v, "kireeyayaal", 1, "Maxamed Ali", "jooga");
  v = setupParty(v, "kireeyayaal", 2, "Xasan Ibrahim", "jooga");
  v = completeMaragAndKirayste(v);
  return v;
}

/* ------------------------------------------------------------------ */
/* Scenario B — 2 → Wakiil A, 1 → Jooga                                */
/* ------------------------------------------------------------------ */

function scenarioB(): FormValues {
  let v = baseValues();
  v = setRepeatableCount(v, kireeyeDef, 3);
  v = createRepresentative(v, kireeyeDef); // Wakiil A
  const repA = listRepresentatives(v, kireeyeDef)[0].id;
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "magac", "Wakiil Guuleed");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "telefoon", "+252 61 9998888");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "aqoonsi", "ID-W1");
  v = setupParty(v, "kireeyayaal", 0, "Axmed Cabdi", "wakiil", repA);
  v = setupParty(v, "kireeyayaal", 1, "Maxamed Ali", "wakiil", repA);
  v = setupParty(v, "kireeyayaal", 2, "Xasan Ibrahim", "jooga");
  v = completeMaragAndKirayste(v);
  return v;
}

/* ------------------------------------------------------------------ */
/* Scenario C — 3 → Wakiil A (hal mar geli)                            */
/* ------------------------------------------------------------------ */

function scenarioC(): FormValues {
  let v = baseValues();
  v = setRepeatableCount(v, kireeyeDef, 3);
  v = createRepresentative(v, kireeyeDef);
  const repA = listRepresentatives(v, kireeyeDef)[0].id;
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "magac", "Wakiil Guuleed");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "telefoon", "+252 61 9998888");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "aqoonsi", "ID-W1");
  v = setupParty(v, "kireeyayaal", 0, "Axmed Cabdi", "wakiil", repA);
  v = setupParty(v, "kireeyayaal", 1, "Maxamed Ali", "wakiil", repA);
  v = setupParty(v, "kireeyayaal", 2, "Xasan Ibrahim", "wakiil", repA);
  v = completeMaragAndKirayste(v);
  return v;
}

/* ------------------------------------------------------------------ */
/* Scenario D — Wakiil A, Wakiil B, 1 Jooga                            */
/* ------------------------------------------------------------------ */

function scenarioD(): FormValues {
  let v = baseValues();
  v = setRepeatableCount(v, kireeyeDef, 3);
  v = createRepresentative(v, kireeyeDef);
  v = createRepresentative(v, kireeyeDef);
  const [repA, repB] = listRepresentatives(v, kireeyeDef).map((r) => r.id);
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "magac", "Wakiil Guuleed");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "telefoon", "+252 61 9998888");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "aqoonsi", "ID-W1");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 1, "magac", "Wakiil Hodan");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 1, "telefoon", "+252 61 7776666");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 1, "aqoonsi", "ID-W2");
  v = setupParty(v, "kireeyayaal", 0, "Axmed Cabdi", "wakiil", repA);
  v = setupParty(v, "kireeyayaal", 1, "Maxamed Ali", "wakiil", repB);
  v = setupParty(v, "kireeyayaal", 2, "Xasan Ibrahim", "jooga");
  v = completeMaragAndKirayste(v);
  return v;
}

/* ------------------------------------------------------------------ */
/* Scenario E — 5 kireeye: 3→A, 1→B, 1 Jooga                           */
/* ------------------------------------------------------------------ */

function scenarioE(): FormValues {
  let v = baseValues();
  v = setRepeatableCount(v, kireeyeDef, 5);
  v = createRepresentative(v, kireeyeDef);
  v = createRepresentative(v, kireeyeDef);
  const [repA, repB] = listRepresentatives(v, kireeyeDef).map((r) => r.id);
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "magac", "Wakiil Guuleed");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "telefoon", "+252 61 9998888");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "aqoonsi", "ID-W1");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 1, "magac", "Wakiil Hodan");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 1, "telefoon", "+252 61 7776666");
  v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 1, "aqoonsi", "ID-W2");
  const names = ["Axmed", "Maxamed", "Xasan", "Faarax", "Yuusuf"];
  names.forEach((n, i) => {
    v = setRepeatableAnswer(v, "kireeyayaal", i, "magac", `${n} Cabdi`);
    v = setRepeatableAnswer(v, "kireeyayaal", i, "telefoon", "+252 61 0000000");
    v = setRepeatableAnswer(v, "kireeyayaal", i, "aqoonsi", `ID-${i}`);
  });
  v = setPartyAttendance(v, "kireeyayaal", 0, "wakiil");
  v = linkPartyRepresentative(v, "kireeyayaal", 0, repA);
  v = setPartyAttendance(v, "kireeyayaal", 1, "wakiil");
  v = linkPartyRepresentative(v, "kireeyayaal", 1, repA);
  v = setPartyAttendance(v, "kireeyayaal", 2, "wakiil");
  v = linkPartyRepresentative(v, "kireeyayaal", 2, repA);
  v = setPartyAttendance(v, "kireeyayaal", 3, "wakiil");
  v = linkPartyRepresentative(v, "kireeyayaal", 3, repB);
  v = setPartyAttendance(v, "kireeyayaal", 4, "jooga");
  v = completeMaragAndKirayste(v);
  return v;
}

/* ------------------------------------------------------------------ */
/* Scenario F — 3 kirayste: 2 → Wakiil A, 1 Jooga                      */
/* ------------------------------------------------------------------ */

function scenarioF(): FormValues {
  let v = baseValues();
  v = setRepeatableCount(v, kiraysteDef, 3);
  v = createRepresentative(v, kiraysteDef);
  const repA = listRepresentatives(v, kiraysteDef)[0].id;
  v = setRepeatableAnswer(v, "wakiilo_kiraystayaal", 0, "magac", "Wakiil Bahdoon");
  v = setRepeatableAnswer(v, "wakiilo_kiraystayaal", 0, "telefoon", "+252 63 1112223");
  v = setRepeatableAnswer(v, "wakiilo_kiraystayaal", 0, "aqoonsi", "ID-KW1");
  v = setupParty(v, "kiraystayaal", 0, "Liibaan Yusuf", "wakiil", repA);
  v = setupParty(v, "kiraystayaal", 1, "Amina Osman", "wakiil", repA);
  v = setupParty(v, "kiraystayaal", 2, "Hodan Abdi", "jooga");
  // kireeye simple
  v = setRepeatableCount(v, kireeyeDef, 1);
  v = setupParty(v, "kireeyayaal", 0, "Cabdi Xasan", "jooga");
  v = setRepeatableCount(v, maragDef, 1);
  v = setRepeatableAnswer(v, "maragyo", 0, "magac", "Asha Omar");
  return v;
}

/* ------------------------------------------------------------------ */
/* Count-first number selector                                         */
/* ------------------------------------------------------------------ */

describe("count-first", () => {
  test("selector creates exactly N rows (3 kireeye)", () => {
    const v = setRepeatableCount(baseValues(), kireeyeDef, 3);
    expect((v.kireeyayaal as PartyRow[]).length).toBe(3);
  });

  test("shrinking keeps the first rows", () => {
    let v = setRepeatableCount(baseValues(), kireeyeDef, 4);
    v = setRepeatableAnswer(v, "kireeyayaal", 0, "magac", "A");
    v = setRepeatableCount(v, kireeyeDef, 2);
    const rows = v.kireeyayaal as PartyRow[];
    expect(rows.length).toBe(2);
    expect(rows[0].values.magac).toBe("A");
  });

  test("respects max bound when set", () => {
    const bounded = { ...kireeyeDef, min: 1, max: 2 };
    let v = setRepeatableCount(baseValues(), bounded, 10);
    expect((v[bounded.id] as PartyRow[]).length).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/* Representative model (share / reuse / no duplicates)                */
/* ------------------------------------------------------------------ */

describe("representative model", () => {
  test("one rep entered once serves many parties (Scenario C)", () => {
    const v = scenarioC();
    const reps = listRepresentatives(v, kireeyeDef);
    expect(reps.length).toBe(1);
    const represented = partiesRepresentedBy(v, kireeyeDef, reps[0].id);
    expect(represented.length).toBe(3);
  });

  test("reuse: existing rep appears in the picker list; no duplicates", () => {
    let v = scenarioB();
    v = createRepresentative(v, kireeyeDef); // "Samee Wakiil Cusub"
    const reps = listRepresentatives(v, kireeyeDef);
    expect(reps.length).toBe(2); // Wakiil A + new empty one (only on demand)
    expect(partiesRepresentedBy(v, kireeyeDef, reps[0].id).length).toBe(2);
    expect(partiesRepresentedBy(v, kireeyeDef, reps[1].id).length).toBe(0);
  });

  test("rep name resolution for a linked party", () => {
    const v = scenarioB();
    const rows = v.kireeyayaal as PartyRow[];
    expect(repNameFor(v, kireeyeDef, rows[0])).toBe("Wakiil Guuleed");
    expect(repNameFor(v, kireeyeDef, rows[2])).toBe(""); // jooga
  });

  test("removing a rep detaches its parties (integrity)", async () => {
    const { deleteRepresentative } = await import("../src/lib/notary/engine");
    let v = scenarioB();
    const repA = listRepresentatives(v, kireeyeDef)[0].id;
    v = deleteRepresentative(v, kireeyeDef, repA);
    const rows = v.kireeyayaal as PartyRow[];
    expect(rows[0].attendance?.status).toBe("wakiil");
    expect(rows[0].attendance?.representativeId).toBeUndefined();
    const errors = validateDocument(config, v);
    // Unlinked wakiil → validation error forces the user to fix it.
    expect(errors["kireeyaha"]).toBeDefined();
  });

  test("shrinking parties below a rep's link clears the link", () => {
    let v = scenarioC(); // 3 linked parties
    v = setRepeatableCount(v, kireeyeDef, 2); // drop row 3
    const rows = v.kireeyayaal as PartyRow[];
    expect(rows.length).toBe(2);
    const repA = listRepresentatives(v, kireeyeDef)[0].id;
    // Remaining links intact; removed row's link gone with the row.
    expect(partiesRepresentedBy(v, kireeyeDef, repA).length).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario validation                                                 */
/* ------------------------------------------------------------------ */

describe("scenario validation", () => {
  test("Scenario A: 3 jooga → complete", () => {
    expect(isInterviewComplete(config, scenarioA())).toBe(true);
  });
  test("Scenario B: 2 wakiil + 1 jooga → complete", () => {
    expect(isInterviewComplete(config, scenarioB())).toBe(true);
  });
  test("Scenario C: 3 wakiil (shared rep) → complete", () => {
    expect(isInterviewComplete(config, scenarioC())).toBe(true);
  });
  test("Scenario D: two reps → complete", () => {
    expect(isInterviewComplete(config, scenarioD())).toBe(true);
  });
  test("Scenario E: 5 kireeye mixed → complete", () => {
    expect(isInterviewComplete(config, scenarioE())).toBe(true);
  });
  test("Scenario F: 3 kirayste (shared rep) → complete", () => {
    expect(isInterviewComplete(config, scenarioF())).toBe(true);
  });

  test("missing attendance status is rejected", () => {
    const v = scenarioA();
    const rows = [...(v.kireeyayaal as PartyRow[])];
    rows[1] = { ...rows[1], attendance: undefined };
    const broken = { ...v, kireeyayaal: rows } as FormValues;
    const errors = validateDocument(config, broken);
    const partyErrors = errors["kireeyaha"]?.partyErrors["kireeyayaal"] ?? [];
    expect(partyErrors.some((e) => e.index === 1)).toBe(true);
  });

  test("wakiil without rep data is rejected", () => {
    let v = scenarioB();
    v = setRepeatableAnswer(v, "wakiilo_kireeyayaal", 0, "magac", "");
    const errors = validateDocument(config, v);
    expect(errors["kireeyaha"]).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* Save / load round-trip                                              */
/* ------------------------------------------------------------------ */

describe("draft round-trip", () => {
  test("attendance + reps survive serialize → deserialize", () => {
    const v = scenarioE();
    const restored = deserializeDraft(config, serializeDraft(v));
    const rows = restored.kireeyayaal as PartyRow[];
    expect(rows.length).toBe(5);
    expect(rows[0].attendance?.status).toBe("wakiil");
    expect(rows[4].attendance?.status).toBe("jooga");
    expect(listRepresentatives(restored, kireeyeDef).length).toBe(2);
    expect(isInterviewComplete(config, restored)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Review & party summary                                              */
/* ------------------------------------------------------------------ */

describe("review & summary", () => {
  test("review shows attendance and Matalaya mapping", () => {
    const review = getReviewData(config, scenarioC());
    const block = review.find((b) => b.sectionId === "kireeyaha");
    const labels = block?.rows.map((r) => `${r.label}: ${r.value}`) ?? [];
    expect(labels.some((l) => l.includes("Jooga") || l.includes("Wakiil"))).toBe(true);
    expect(labels.some((l) => l.includes("Matalaya"))).toBe(true);
  });

  test("party summary carries attendance + representative", () => {
    const summary = buildPartySummary(config, scenarioC());
    const kireeyeRows = summary.filter((p) => p.role === "Kireeye");
    expect(kireeyeRows.length).toBe(3);
    expect(kireeyeRows.every((p) => p.attendance === "wakiil")).toBe(true);
    expect(kireeyeRows.every((p) => p.representative === "Wakiil Guuleed")).toBe(true);
    const wakiilRow = summary.find((p) => p.role === "Wakiil");
    expect(wakiilRow?.representing?.split(", ").length).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/* Document generation + archive                                       */
/* ------------------------------------------------------------------ */

describe("generation & archive", () => {
  test("generated DOCX contains parties and stays structurally valid", async () => {
    const values = scenarioB(); // ONE instance — random row ids
    const out = await generateDocument({
      config,
      values,
      referenceNumber: "DPN/K/100",
      subTypeLabel: "Guri Xaas",
      templateBytes: await Bun.file("public/templates/heshiis_kiro/guri_xaas.docx").arrayBuffer(),
      spec: selectTemplate(config, values)!,
    });
    const zip = await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer()));
    const xml = (await zip.file("word/document.xml")!.async("string")) as string;
    expect(xml).toContain("Axmed Cabdi");
    expect(out.templateValidation?.valid).toBe(true);
    expect(out.outputValidation?.valid).toBe(true);

    // Archive summary reflects the relationships.
    const summary = buildPartySummary(config, values);
    expect(summary.some((p) => p.role === "Wakiil" && p.representing?.includes("Maxamed Ali"))).toBe(true);
  });

  test("office template can render WAKIILO block with MATALAYA token", () => {
    // The Word template is user-owned; when the office adds the optional
    // {{#WAKIILO_*}} block the engine renders each rep ONCE + who they
    // represent — never duplicated per party.
    const values = scenarioC(); // 3 parties → one shared rep
    const { renderXmlForTest } = require("../src/lib/notary/pipeline");
    const xml =
      "<w:document><w:body>" +
      "<w:p><w:r><w:t>{{#WAKIILO_KIREEYAYAAL}}{{NUMBER}}. {{MAGAC}} — Matalaya: {{MATALAYA}}{{/WAKIILO_KIREEYAYAAL}}</w:t></w:r></w:p>" +
      "</w:body></w:document>";
    const out = renderXmlForTest(xml, config, values);
    expect(out).toContain("1. Wakiil Guuleed — Matalaya: Axmed Cabdi, Maxamed Ali, Xasan Ibrahim");
    expect(out).not.toContain("{{MATALAYA}}");
    expect((out.match(/Wakiil Guuleed/g) ?? []).length).toBe(1); // once, not per party
  });
});
