/**
 * SPEC §22 — THE SIXTEEN ACCEPTANCE TESTS.
 *
 * One test per numbered case in the office's specification, kept in their
 * numbered order so a failing case names itself. Each drives the REAL engine
 * — config, workflow, validation, data context and party model — rather than
 * re-stating the config back to itself.
 *
 * The rules being proved are the ones the office settled on:
 *   counts never compare · representatives never replace sellers ·
 *   a person is entered once · nothing optional blocks · one question per fact.
 */
import { describe, expect, test } from "bun:test";
import { buildDataContext, computeReplacements, resolveFlags } from "../src/lib/notary/dataContext";
import { buildConditionalWorkflow } from "../src/lib/notary/agreementSetup";
import { validateDocument } from "../src/lib/notary/validation";
import { kalaIiibsiHantiConfig as C } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { heshiisKiroConfig as K } from "../src/lib/notary/documents/heshiisKiro";
import { applyCountedParties, createInitialValues, createValuesFromDraft, getPartyRows } from "../src/lib/notary/formValues";
import { buildHantiPartyModel, inspectHantiParties } from "../src/lib/notary/hantiParties";
import { countParties, genderWord } from "../src/lib/notary/partyModel";
import { buildHantiReview } from "../src/lib/notary/hantiReview";

/** Link representative `repId` to these rows (attendance "wakiil"). */
const represented = (rows: any[], repId: string) =>
  rows.map((r) => ({ ...r, attendance: { status: "wakiil" as const, representativeId: repId } }));


import type { FormValues, PartyRow } from "../src/lib/notary/types";

const row = (id: string, values: Record<string, string>): PartyRow =>
  ({ id, values }) as PartyRow;

/** Sellers now carry presence exactly as Heshiis Kiro's landlords do. */
const sellers = (n: number, status: "jooga" | "wakiil" = "jooga") =>
  Array.from({ length: n }, (_, i) => ({
    ...row(`s${i + 1}`, { magac: `IIBIYE ${i + 1}`, jinsi: "male", degan: "Hargeisa" }),
    attendance: { status } }));

const buyers = (n: number, over: (i: number) => Record<string, string> = () => ({})) =>
  Array.from({ length: n }, (_, i) => ({
    ...row(`b${i + 1}`, {
      magac: `IIBSADE ${i + 1}`,
      jinsi: "female",
      degan: "Hargeisa",
      telefoon: "0622222222",
      ...over(i) }),
    attendance: { status: "jooga" as const } }));

/** A sale that is complete in every respect EXCEPT what a test varies. */
function sale(over: Partial<FormValues> = {}): FormValues {
  return {
    ...createInitialValues(C),
    dejinta: {
      sub_type: "dhul_banaan",
      reference: "DPN-MG-001",
      taariikhda_hantida: "2026-01-30",
      tirada_iibiyayaasha: "1",
      tirada_iibsadayaasha: "1",
      sawirro_ma_jiraan: "no",
      saxeexo_ma_jiraan: "no",
      shaxado_ma_jiraan: "no",
    },
    iibiyeyaal: sellers(1),
    iibsadayaal: buyers(1),
    hantida_dhul_banaan: { sida_hantida_loo_helay: "iibsaday", notary_ref: "Tr No 4471" },
    qiimaha: { qiimaha_guud: "1600" },
    damiinka: { nooca_damiinta: "iibiyaha", gurmadka_dammaanadda: "Reer deggan." },
    maragyo: [row("m1", { magac: "MARAG KOOW" })],
    ...over,
  } as unknown as FormValues;
}

const errs = (v: FormValues) => Object.keys(validateDocument(C, v));

/* ================================================================== */

describe("SPEC §22 — the sixteen acceptance cases", () => {
  /* --- 1 --- */
  test("TEST 1 — 10 sellers, 0 photos, 0 signatures, 1 representative is VALID", () => {
    const v = sale({
      iibiyeyaal: represented(sellers(10), "r1"),
      // 0 photographs, 0 signature lines, 0 certificates.
      sawirrada: [],
      saxeexayaasha: [],
      shaxadaha: [],
      // One representative of his own — entered ONCE in the standalone list.
      wakiilo_iibiyeyaal: [row("r1", { magac: "RUUN" })],
    } as Partial<FormValues>);
    expect(errs(v)).toEqual([]);
    const m = buildHantiPartyModel(v);
    expect(countParties(m, { sellerIds: sellers(10).map((s) => s.id) }).photos).toBe(0);
  });

  /* --- 2 --- */
  test("TEST 2 — 10 sellers + 1 representative leaves the seller count at 10", () => {
    const v = sale({
      iibiyeyaal: represented(sellers(10), "r1"),
      wakiilo_iibiyeyaal: [row("r1", { magac: "RUUN" })],
    } as Partial<FormValues>);
    const m = buildHantiPartyModel(v);
    const sellerIds = sellers(10).map((s) => s.id);
    expect(countParties(m, { sellerIds })).toMatchObject({ sellers: 10, representatives: 1 });
    // The representative is an extra person on top, never a replacement.
    expect(getPartyRows(v, "iibiyeyaal")).toHaveLength(10);
  });

  /* --- 3 --- */
  test("TEST 3 — a seller who is ALSO a representative is VALID", () => {
    const v = sale({
      iibiyeyaal: [
        // Ruun is BOTH: a seller in his own right AND the representative for
        // Ahmed. One person, two facts — the name match keeps him one person.
        { ...row("s1", { magac: "RUUN XASAN QAALIB", jinsi: "female" }), attendance: { status: "jooga" as const } },
        { ...row("s2", { magac: "AHMED CALI", jinsi: "male" }), attendance: { status: "wakiil" as const, representativeId: "r1" } },
      ],
      wakiilo_iibiyeyaal: [row("r1", { magac: "RUUN XASAN QAALIB" })],
    } as Partial<FormValues>);
    expect(errs(v)).toEqual([]);
    const m = buildHantiPartyModel(v);
    // One person, two facts — not two people.
    expect(m.people.filter((p) => p.name === "RUUN XASAN QAALIB")).toHaveLength(1);
    expect(m.representations[0].representativeId).toBe("s1");
    // §6/§8 — being a representative is a RELATIONSHIP, never a role, and a
    // role is never inferred from it. The two stay independent facts.
    expect(m.representations[0].type).toBe("wakiil");
    expect(m.people.find((p) => p.id === "s1")!.role).toBeUndefined();
  });

  /* --- 4 --- */
  test("TEST 4 — a buyer who is ALSO a representative is VALID", () => {
    const v = sale({
      iibsadayaal: [
        { ...row("b1", { magac: "RUUN", jinsi: "female" }), attendance: { status: "wakiil" as const, representativeId: "r1" } },
        { ...row("b2", { magac: "AHMED", jinsi: "male", telefoon: "0622222222" }), attendance: { status: "jooga" as const } },
      ],
      wakiilo_iibsadayaal: [row("r1", { magac: "RUUN" })],
    } as Partial<FormValues>);
    expect(errs(v)).toEqual([]);
  });

  /* --- 5 --- */
  test("TEST 5 — the SAME person as seller AND buyer is INVALID", () => {
    const v = sale({
      iibiyeyaal: [{ ...row("s1", { magac: "AHMED CALI", jinsi: "male" }), attendance: { status: "jooga" as const } }],
      iibsadayaal: [
        { ...row("b1", { magac: "AHMED CALI", jinsi: "male", telefoon: "0622222222" }), attendance: { status: "jooga" as const } },
      ],
    } as Partial<FormValues>);
    const issues = inspectHantiParties(buildHantiPartyModel(v));
    expect(issues.map((i) => i.code)).toContain("seller_is_buyer");
    expect(issues.find((i) => i.code === "seller_is_buyer")!.message).toContain("AHMED CALI");
    // It keeps the document from being signed, and says why.
    const review = buildHantiReview(C, v);
    expect(review.ready).toBe(false);
    expect(review.missing.some((m) => m.message.includes("AHMED CALI"))).toBe(true);
    // Spelling and spacing are noise; a different person is not a clash.
    const other = sale({
      iibiyeyaal: [{ ...row("s1", { magac: "AHMED CALI", jinsi: "male" }), attendance: { status: "jooga" as const } }],
      iibsadayaal: [
        { ...row("b1", { magac: "AHMED  CALI XAASAN", jinsi: "male", telefoon: "0622222222" }), attendance: { status: "jooga" as const } },
      ],
    } as Partial<FormValues>);
    expect(inspectHantiParties(buildHantiPartyModel(other)).map((i) => i.code)).not.toContain("seller_is_buyer");
  });

  /* --- 6 --- */
  test("TEST 6 — a plain wakiil is NEVER silently turned into a wakiil qayim", () => {
    const wakiil = buildHantiPartyModel(
      sale({ wakiilo_iibiyeyaal: [row("r1", { magac: "RUUN" })] } as Partial<FormValues>),
    );
    expect(wakiil.representations[0].type).toBe("wakiil");
    // The two are different answers, and only the answer given is stored.
    expect(wakiil.representations[0].type).not.toBe("wakiil_qayim");
    // The choice is asked where the representative is entered — one place.
    const repFields = C.sections
      .flatMap((s) => s.parties ?? [])
      .find((p) => p.id === "iibiyeyaal")!.representativeFields!;
    expect(repFields.find((f) => f.id === "nooca_wakiilka")!.options?.map((o) => o.value)).toEqual([
      "wakiil",
      "wakiil_qayim",
    ]);
  });

  /* --- 7 --- */
  test("TEST 7 — a wakiil qayim does not change the seller or buyer count", () => {
    const v = sale({
      iibiyeyaal: represented(sellers(10), "r1"),
      iibsadayaal: buyers(2),
      wakiilo_iibiyeyaal: [row("r1", { magac: "RUUN", nooca_wakiilka: "wakiil_qayim" })],
    } as Partial<FormValues>);
    expect(errs(v)).toEqual([]);
    const m = buildHantiPartyModel(v);
    const counts = countParties(m, { sellerIds: sellers(10).map((s) => s.id) });
    expect(counts.sellers).toBe(10);
    expect(getPartyRows(v, "iibsadayaal")).toHaveLength(2);
    expect(m.representations[0].type).toBe("wakiil_qayim");
  });

  /* --- 8 --- */
  test("TEST 8 — 0 photographs is VALID when photographs are optional", () => {
    const v = sale({ sawirro_ma_jiraan: "no", sawirrada: [] } as Partial<FormValues>);
    expect(errs(v)).toEqual([]);
    expect(buildDataContext(C, v).repeatBlocks.get("SAWIRRADA")!.rows).toHaveLength(0);
  });

  /* --- 9 --- */
  test("TEST 9 — 0 signatures is VALID when signatures are optional", () => {
    const v = sale({ saxeexo_ma_jiraan: "no", saxeexayaasha: [] } as Partial<FormValues>);
    expect(errs(v)).toEqual([]);
    expect(buildDataContext(C, v).repeatBlocks.get("SAXEEXAYAASHA")!.rows).toHaveLength(0);
  });

  /* --- 10 --- */
  test("TEST 10 — no representative means the representative section is hidden", () => {
    const steps = buildConditionalWorkflow(C, sale()).map((s) => s.short);
    expect(steps).not.toContain("Wakiillada");
    expect(steps).not.toContain("Tirada Wakiillo");
    expect(steps).not.toContain("Wakiillo");
  });

  /* --- 11 --- */
  test("TEST 11 — sellers self-guaranteeing creates NO third-party person", () => {
    // A sale is ALWAYS guaranteed: by a third party, or by the sellers. The
    // "sellers guarantee" branch collects no new person at all.
    const self = sale({
      dejinta: { ...(sale().dejinta as Record<string, string>), nooca_damiinta: "iibiyaha" },
      damiinka: { gurmadka_dammaanadda: "Reer deggan." },
    } as Partial<FormValues>);
    expect(Object.keys(validateDocument(C, self))).toEqual([]);
    // The seller's own name stands in the guarantor slot.
    expect(computeReplacements(C, self)["{{DAMIIN_MAGACA}}"]).toBe("IIBIYE 1");
    expect(computeReplacements(C, self)["{{DAMIIN_TELEFOON}}"]).toBe("");
    expect(computeReplacements(C, self)["{{DAMIIN_SAWIR}}"]).toBe("");
    // The person fields are gated on the THIRD PARTY branch only.
    const fields = C.sections.find((x) => x.id === "damiinka")!.fields;
    const gate = { op: "equals", field: "dejinta.nooca_damiinta", value: "qof_3aad" };
    for (const id of ["magaca_damiinka", "telefoonka_damiinka", "degan_damiinka", "sawirka_damiinka"]) {
      expect(fields.find((f) => f.id === id)!.visibleWhen).toEqual(gate);
    }
  });

  test("TEST 11b — a third party IS asked for, and the question is asked ONCE", () => {
    // The decision lives in Step 1 and is never repeated in Step 6.
    const setup = C.sections.find((s) => s.id === "dejinta")!;
    expect(setup.fields.find((f) => f.id === "nooca_damiinta")!.options!.map((o) => o.value)).toEqual([
      "qof_3aad",
      "iibiyaha",
    ]);
    const dam = C.sections.find((s) => s.id === "damiinka")!;
    expect(dam.fields.map((f) => f.id)).not.toContain("nooca_damiinta");
    const third = sale({
      dejinta: { ...(sale().dejinta as Record<string, string>), nooca_damiinta: "qof_3aad" },
      damiinka: { magaca_damiinka: "KHALID NOOR", gurmadka_dammaanadda: "Reer deggan." },
    } as Partial<FormValues>);
    expect(computeReplacements(C, third)["{{DAMIIN_MAGACA}}"]).toBe("KHALID NOOR");
    expect(resolveFlags(C, third).DAMIIN_QOF_3AAD).toBe(true);
  });

  /* --- 12 --- */
  test("TEST 12 — Guri shows Guri questions and NEVER a Kiro question", () => {
    const v = sale({ dejinta: { ...(sale().dejinta as Record<string, string>), sub_type: "guri" } } as Partial<FormValues>);
    // Step 4 is titled once; the sub-type decides what it holds.
    const steps = buildConditionalWorkflow(C, v);
    expect(steps).toHaveLength(6);
    const step4 = steps[3].detail as { kind: "section"; sectionIds: string[] };
    expect(step4.sectionIds).toEqual(["hantida_guri"]);
    for (const rental of [
      "Deebaajiga",
      "Mudada Kirada",
      "Xaladda Kirada",
      "Shuruudaha Joogta",
      "Ogaysiinta",
    ]) {
      expect(steps.some((s) => s.short.includes(rental))).toBe(false);
    }
    // No Kiro field id is reachable from this document at all.
    const guriIds = C.sections.filter((s) => (s.fields ?? []).some((f) => f.id === "goobta" && s.id === "hantida_guri"));
    expect(guriIds.length).toBe(1);
    expect(C.sections.some((s) => s.id === "deebaaji" || s.id === "ogaysiinta")).toBe(false);
  });

  /* --- 13 --- */
  test("TEST 13 — Beer shows Beer questions and nothing unrelated", () => {
    const v = sale({ dejinta: { ...(sale().dejinta as Record<string, string>), sub_type: "beer" } } as Partial<FormValues>);
    const steps = buildConditionalWorkflow(C, v);
    expect(steps).toHaveLength(6);
    const step4 = steps[3].detail as { kind: "section"; sectionIds: string[] };
    expect(step4.sectionIds).toEqual(["hantida_beer"]);
    // The Beer's OWN name is a Beer fact Dhul Banaan does not have.
    const beer = C.sections.find((s) => s.id === "hantida_beer")!.fields.map((f) => f.id);
    expect(beer).toContain("magaca_beerta");
    expect(C.sections.find((s) => s.id === "hantida_dhul_banaan")!.fields.map((f) => f.id)).not.toContain("magaca_beerta");
  });

  /* --- 14 --- */
  test("TEST 14 — the seller count is asked ONCE, nowhere else", () => {
    const steps = buildConditionalWorkflow(C, sale()).map((s) => s.short);
    expect(steps.filter((s) => s.startsWith("Tirada Iibiyayaal"))).toHaveLength(0);
    const party = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibiyeyaal")!;
    expect(party.countFrom).toBe("dejinta.tirada_iibiyayaasha");
    // Asked exactly once: one field, in the setup step.
    expect(C.sections.flatMap((s) => s.fields ?? []).filter((f) => f.label === "Tirada Iibiyayaasha")).toHaveLength(1);
  });

  /* --- 15 --- */
  test("TEST 15 — the buyer count is asked ONCE, nowhere else", () => {
    const steps = buildConditionalWorkflow(C, sale()).map((s) => s.short);
    expect(steps.filter((s) => s.startsWith("Tirada Iibsadayaal"))).toHaveLength(0);
    const party = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibsadayaal")!;
    expect(party.countFrom).toBe("dejinta.tirada_iibsadayaasha");
    expect(C.sections.flatMap((s) => s.fields ?? []).filter((f) => f.label === "Tirada Iibsadayaasha")).toHaveLength(1);
  });

  /* --- 16 --- */
  test("TEST 16 — a person is entered once; photo, signature and representation link by ID", () => {
    const v = sale({
      iibiyeyaal: represented(sellers(3), "r1"),
      sawirro_ma_jiraan: "yes",
      saxeexo_ma_jiraan: "yes",
      sawirrada: [row("p1", { shakhsiga: "s1", sawir: "stor_p1" })],
      saxeexayaasha: [row("x1", { shakhsiga: "s3", prefix: "IIBISO" })],
      wakiilo_iibiyeyaal: [row("r1", { magac: "OMAR FARAH" })],
    } as Partial<FormValues>);
    // The name is TYPED once, in the seller list — never again downstream.
    const blocks = buildDataContext(C, v).repeatBlocks;
    const photo = blocks.get("SAWIRRADA")!.rows[0] as Record<string, string>;
    const sign = blocks.get("SAXEEXAYAASHA")!.rows[0] as Record<string, string>;
    expect(photo.SHAKHSIGA).toBe("IIBIYE 1");
    expect(sign.SHAKHSIGA).toBe("IIBIYE 3");
    // The stored link is the ID; the printed text is the name.
    expect(photo.SHAKHSIGA_ID).toBe("s1");
    // And the representative re-uses the seller he already is, not a copy.
    const m = buildHantiPartyModel(v);
    expect(m.people.filter((p) => p.name === "OMAR FARAH")).toHaveLength(1);
    expect(errs(v)).toEqual([]);
  });
});

/* ================================================================== */
/* §17 — the gender word engine, word for word                         */
/* ================================================================== */

describe("SPEC §17 — gender words are exactly these, or nothing", () => {
  test("SELLER: iibiye / iibiso / iibiyaha / iibisada / iibiyayaal / iibiyayaasha", () => {
    const w = (gender: "male" | "female" | "unknown", number: "singular" | "plural", definite = false) =>
      genderWord({ role: "seller", gender, number, definite });
    expect(w("male", "singular")).toBe("iibiye");
    expect(w("female", "singular")).toBe("iibiso");
    expect(w("male", "singular", true)).toBe("iibiyaha");
    expect(w("female", "singular", true)).toBe("iibisada");
    expect(w("male", "plural")).toBe("iibiyayaal");
    expect(w("female", "plural")).toBe("iibiyayaal");
    expect(w("male", "plural", true)).toBe("iibiyayaasha");
    expect(w("female", "plural", true)).toBe("iibiyayaasha");
  });

  test("BUYER: iibsade / iibsato / iibsadaha / iibsatada / iibsadayaal / iibsadayaasha", () => {
    const w = (gender: "male" | "female" | "unknown", number: "singular" | "plural", definite = false) =>
      genderWord({ role: "buyer", gender, number, definite });
    expect(w("male", "singular")).toBe("iibsade");
    expect(w("female", "singular")).toBe("iibsato");
    expect(w("male", "singular", true)).toBe("iibsadaha");
    expect(w("female", "singular", true)).toBe("iibsatada");
    expect(w("male", "plural")).toBe("iibsadayaal");
    expect(w("female", "plural")).toBe("iibsadayaal");
    expect(w("male", "plural", true)).toBe("iibsadayaasha");
    expect(w("female", "plural", true)).toBe("iibsadayaasha");
  });

  test("an unconfirmed gender prints NOTHING in the SINGULAR — never a guess", () => {
    // "iibiye" and "iibiso" are gendered words, so an unconfirmed gender
    // must produce no word at all rather than the masculine one.
    for (const role of ["seller", "buyer"] as const) {
      expect(genderWord({ role, gender: "unknown", number: "singular" })).toBeUndefined();
      expect(genderWord({ role, gender: "unknown", number: "singular", definite: true })).toBeUndefined();
    }
  });

  test("the PLURAL carries no gender, so an unknown gender is not a guess", () => {
    // "iibiyayaal" is the same word whoever the sellers are. Printing it is
    // not a guess about anybody — there is no gendered choice to make.
    for (const [role, word] of [
      ["seller", "iibiyayaal"],
      ["buyer", "iibsadayaal"],
    ] as const) {
      expect(genderWord({ role, gender: "unknown", number: "plural" })).toBe(word);
      expect(genderWord({ role, gender: "unknown", number: "plural", definite: true })).toBe(`${word.slice(0, -2)}asha`);
    }
  });

  test("no invented plural: IIBIYOYAAL / IIBIYOYAASHA / IIBIYEYAAL are never produced", () => {
    const produced = new Set<string>();
    for (const role of ["seller", "buyer"] as const) {
      for (const gender of ["male", "female", "unknown"] as const) {
        for (const number of ["singular", "plural"] as const) {
          for (const definite of [false, true]) {
            const w = genderWord({ role, gender, number, definite });
            if (w) produced.add(w);
          }
        }
      }
    }
    for (const forbidden of ["iibiyo", "iibiyo", "iiBIYOYAAL", "IIBIYOYAAL", "IIBIYOYAASHA", "IIBIYEYAAL"]) {
      expect([...produced].map((w) => w.toUpperCase())).not.toContain(forbidden.toUpperCase());
    }
  });
});

/* ================================================================== */
/* §7 — title is part of the name, never a category of its own         */
/* ================================================================== */

describe("SPEC §7 — title is part of the name, not a field", () => {
  test("no title / honorific field exists anywhere in this document", () => {
    const ids = C.sections.flatMap((s) => (s.fields ?? []).map((f) => f.id));
    for (const party of C.sections.flatMap((s) => s.parties ?? [])) {
      ids.push(...party.fields.map((f) => f.id));
    }
    for (const forbidden of ["title", "honorific", "magac_buuxa", "sara_kul", "xigasho"]) {
      expect(ids).not.toContain(forbidden);
    }
    // "Caaqil Suldaan" is simply what the notary typed in the name.
    const m = buildHantiPartyModel(
      sale({ iibiyeyaal: [{ ...row("s1", { magac: "Caaqil Suldaan", jinsi: "male" }), attendance: { status: "jooga" as const } }] } as Partial<FormValues>),
    );
    expect(m.people[0].name).toBe("Caaqil Suldaan");
  });
});

/* ================================================================== */
/* §8 — the count builds the rows, from one number                     */
/* ================================================================== */

describe("SPEC §1/§3 — one number, one list, asked once", () => {
  test("10 and 2 build exactly ten sellers and two buyers", () => {
    const v = applyCountedParties(C, {
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", tirada_iibiyayaasha: "10", tirada_iibsadayaasha: "2" },
    } as unknown as FormValues);
    expect(getPartyRows(v, "iibiyeyaal")).toHaveLength(10);
    expect(getPartyRows(v, "iibsadayaal")).toHaveLength(2);
  });

  test("Kiro declares no countFrom, so its steps are untouched", () => {
    expect(K.sections.flatMap((s) => s.parties ?? []).some((p) => p.countFrom)).toBe(false);
    const kiroSteps = buildConditionalWorkflow(K, {
      ...createInitialValues(K),
      heshiiska: { sub_type: "kiro", taariikhda_heshiiska: "2026-01-30" },
    } as unknown as FormValues).map((s) => s.short);
    expect(kiroSteps.length).toBeGreaterThan(0);
  });

  test("a RESTORED DRAFT rebuilds its rows from its own saved count", () => {
    // Saved with the answer "10" but only three rows written so far: coming
    // back must show the ten the notary gave, never the three that happen to
    // have been stored.
    const draft = JSON.stringify({
      dejinta: { sub_type: "dhul_banaan", tirada_iibiyayaasha: "10", tirada_iibsadayaasha: "4" },
      iibiyeyaal: [{ ...row("s1", { magac: "A" }), attendance: { status: "jooga" as const } }, { ...row("s2", { magac: "B" }), attendance: { status: "jooga" as const } }, { ...row("s3", { magac: "C" }), attendance: { status: "jooga" as const } }] });
    const restored = createValuesFromDraft(C, draft);
    expect(getPartyRows(restored, "iibiyeyaal")).toHaveLength(10);
    expect(getPartyRows(restored, "iibsadayaal")).toHaveLength(4);
    // The names already entered survive the resize — restoring a draft never
    // throws away what the notary typed.
    expect(getPartyRows(restored, "iibiyeyaal")[0].values?.magac).toBe("A");
  });

  test("a draft with NO count keeps its own rows — nothing is invented", () => {
    // An unanswered count is not the number zero. Typing nothing must never
    // delete sellers the notary already entered.
    const draft = JSON.stringify({
      dejinta: { sub_type: "dhul_banaan" },
      iibiyeyaal: [{ ...row("s1", { magac: "A" }), attendance: { status: "jooga" as const } }, { ...row("s2", { magac: "B" }), attendance: { status: "jooga" as const } }, { ...row("s3", { magac: "C" }), attendance: { status: "jooga" as const } }] });
    const restored = createValuesFromDraft(C, draft);
    expect(getPartyRows(restored, "iibiyeyaal")).toHaveLength(3);
    expect(getPartyRows(restored, "iibiyeyaal").map((r) => r.values?.magac)).toEqual(["A", "B", "C"]);
  });
});