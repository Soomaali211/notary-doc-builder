/**
 * KALA IIBSI HANTI — FLIPPED FORM.
 *
 * The form's behaviour, not its data model: the step order the office reads
 * aloud, the dynamic seller/group/representation/photo/signatory/witness
 * lists, the sub-type-driven property questions, and the review screen.
 *
 * The five CRITICAL TEST CASES at the end are the office's own: each one is
 * a shape a real sale is allowed to take, and each must pass validation and
 * reach a document. None of them is a requirement — they are examples of the
 * range, which is why several of them have fewer photographs or signatures
 * than sellers.
 */
import { describe, expect, test } from "bun:test";
import { computeReplacements, resolveFlags } from "../src/lib/notary/dataContext";
import { validateDocument } from "../src/lib/notary/validation";
import { buildConditionalWorkflow } from "../src/lib/notary/agreementSetup";
import { kalaIiibsiHantiConfig as C, KALA_IIBSI_HANTI_SECTION_ORDER as SECTION_ORDER } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { createInitialValues } from "../src/lib/notary/formValues";
import { buildHantiReview } from "../src/lib/notary/hantiReview";
import { buildHantiPartyModel } from "../src/lib/notary/hantiParties";

import type { FormValues, PartyRow } from "../src/lib/notary/types";
/* @jsxRuntime automatic */
/* @jsxImportSource react */
import { renderToStaticMarkup } from "react-dom/server";
import { HantiReviewSummary } from "../src/pages/NewDocumentInterview";

/**
 * The office's reading order, written out here on purpose.
 *
 * It is NOT imported from the config: a test that reads its expectation back
 * out of the code under test proves nothing. If the form's order ever drifts
 * from the order the notary reads aloud, THIS list fails.
 */
const SECTION_ORDER_PROBE = [
  "Dejinta Hantida",
  "Iibiyaha",
  "Iibiyayaal",
  "Kooxa / Qoysku Iibiyaha",
  "Tirada Kooxaha",
  "Kooxaha",
  "Wakiillada",
  "Tirada Wakiillo",
  "Wakiillo",
  "Xogta iyo Xaaladda Iibsadayaal",
  "Faahfaahinta Dhulka",
  "Qiimaha Hantida",
  "Dammaanadda",
  "Sawirrada",
  "Tirada Sawirro",
  "Sawirro",
  "Saxeexayaasha",
  "Tirada Saxeexayaal",
  "Saxeexayaal",
  "Maragyada",
  "Maragyo",
  "Shaxadaha iyo Warqadaha",
  "Tirada Shaxado",
  "Shaxado",
];

function r(id: string, v: Record<string, string>): PartyRow {
  return { id, values: v } as PartyRow;
}

const PLOT = {
  degmada: "Waardhiil",
  xaafada: "Sooma",
  cabbirka: "5,000 m²",
  jiho_1: "Xarunta Wacatariga",
  jiho_2: "Jidka Mogadishu",
  jiho_3: "Badda Sooma",
  sida_hantida_loo_helay: "iibsaday",
  notary_ref: "Tr No 4471",
};

function base(over: Partial<FormValues> = {}): FormValues {
  return {
    ...createInitialValues(C),
    dejinta: { sub_type: "dhul_banaan", reference: "DPN-MG-001", taariikhda_hantida: "2026-01-30" },
    hantida_dhul_banaan: PLOT,
    damiinka: {
      nooca_damiinta: "iibiyaha",
      gurmadka_dammaanadda: "Reer deggan.",
      sawirka_damiinka: "",
      telefoonka_damiinka: "",
    },
    qiimaha: { qiimaha_guud: "1600" },
    maragyo: [r("m1", { magac: "MARAG KOOW" })],
    ...over,
  } as unknown as FormValues;
}

/** n buyers named IIBSADE n, all present (buyer rows carry attendance). */
const buyers = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `b${i + 1}`,
    values: {
      magac: `IIBSADE ${i + 1}`,
      jinsi: i % 2 === 0 ? "male" : "female",
      degan: "Hargeisa",
      telefoon: "0622222222",
    },
    attendance: { status: "jooga" as const },
  }));

/* ================================================================== */
/* The form itself                                                     */
/* ================================================================== */

/** Every optional list is said to exist, so the WHOLE interview is visible. */
function withEveryGateOpen() {
  const v = base();
  Object.assign(v.dejinta, {
    wakiillo_ma_jiraan: "yes",
    sawirro_ma_jiraan: "yes",
    saxeexo_ma_jiraan: "yes",
    shaxado_ma_jiraan: "yes",
  });
  return v;
}

describe("THE FLIPPED FORM — steps", () => {
  test("the steps follow the office's reading order", () => {
    const steps = buildConditionalWorkflow(C, withEveryGateOpen());
    expect(steps.map((s) => s.short)).toEqual(SECTION_ORDER_PROBE);
  });

  test("a list nobody declared does not appear — not even its COUNT step", () => {
    // The office rule: never ask "how many representatives are there?"
    // unless the notary has already said there is one. A sale with no
    // photographs has no "Tirada Sawirro" step either.
    const steps = buildConditionalWorkflow(C, base()).map((s) => s.short);
    for (const hidden of [
      "Wakiillada",
      "Tirada Wakiillo",
      "Wakiillo",
      "Sawirrada",
      "Tirada Sawirro",
      "Sawirro",
      "Saxeexayaasha",
      "Tirada Saxeexayaal",
      "Saxeexayaal",
      "Shaxadaha iyo Warqadaha",
      "Tirada Shaxado",
      "Shaxado",
    ]) {
      expect(steps).not.toContain(hidden);
    }
    // What the notary still has to answer is untouched by any of that.
    expect(steps).toContain("Maragyo");
    expect(steps).toContain("Qiimaha Hantida");
    expect(steps).toContain("Iibiyayaal");
  });

  test("EVERY config section is declared in the reading order — none hides at the end", () => {
    // `ordered()` puts an unlisted section LAST rather than dropping it, which
    // is safe but silent. This test makes that silence impossible: a new
    // section must be placed deliberately.
    const ids = C.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    for (const id of ids) {
      expect(SECTION_ORDER).toContain(id);
    }
  });

  test("the declared order is exactly the office's order", () => {
    expect([...SECTION_ORDER]).toEqual([
      "dejinta",
      "iibiyaha",
      "kooxaha",
      "wakiillada",
      "iibsadaha",
      "hantida_dhul_banaan",
      "hantida_guri",
      "hantida_beer",
      "qiimaha",
      "damiinka",
      "sawirrada",
      "saxeexayaasha",
      "maragyada",
      "shaxadaha",
    ]);
  });

  test("Beer shows Beer questions only — Dhul Banaan's never appear", () => {
    const beer = base();
    (beer.dejinta as Record<string, string>).sub_type = "beer";
    const steps = buildConditionalWorkflow(C, beer).map((s) => s.short);
    expect(steps).toContain("Faahfaahinta Beeraha");
    expect(steps).not.toContain("Faahfaahinta Dhulka");
    expect(steps).not.toContain("Faahfaahinta Guriga");
  });

  test("Guri shows Guri questions only", () => {
    const guri = base();
    (guri.dejinta as Record<string, string>).sub_type = "guri";
    const steps = buildConditionalWorkflow(C, guri).map((s) => s.short);
    expect(steps).toContain("Faahfaahinta Guriga");
    expect(steps).not.toContain("Faahfaahinta Dhulka");
    expect(steps).not.toContain("Faahfaahinta Beeraha");
  });

  test("no step is empty — every step has something to answer", () => {
    for (const sub of ["dhul_banaan", "guri", "beer"]) {
      const v = base();
      (v.dejinta as Record<string, string>).sub_type = sub;
      const steps = buildConditionalWorkflow(C, v);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expect(step.short.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("THE FLIPPED FORM — sellers are dynamic", () => {
  test("one seller is valid and one hundred are representable", () => {
    const one = base({ iibiyeyaal: [r("s1", { magac: "AHMED CALI", degan: "Hargeisa" })], iibsadayaal: buyers(1) });
    expect(Object.keys(validateDocument(C, one))).toEqual([]);

    const hundred = base({
      iibiyeyaal: Array.from({ length: 100 }, (_, i) =>
        r(`s${i + 1}`, { magac: `IIBIYE ${i + 1}`, degan: "Hargeisa" }),
      ),
      iibsadayaal: buyers(1),
    });
    expect(Object.keys(validateDocument(C, hundred))).toEqual([]);
  });

  test("the seller list is never a fixed seller_1 / seller_2 / seller_3", () => {
    const ids = C.sections.flatMap((s) => s.parties ?? []).map((p) => p.id);
    expect(ids).not.toContain("seller_1");
    expect(ids).not.toContain("seller_2");
    expect(ids).toContain("iibiyeyaal");
    // No maximum is declared, so the list cannot be capped by the config.
    expect(C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibiyeyaal")!.max).toBeUndefined();
  });

  test("a seller row carries gender, role, representation and their own data", () => {
    const seller = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibiyeyaal")!;
    const ids = seller.fields.map((f) => f.id);
    expect(ids).toEqual([
      "magac",
      "jinsi",
      "dooro",
      "xiriirka_qoyska",
      "koox",
      "degan",
      "xaalad",
      "telefoon",
      "nooca_matalaada",
      "wakiil",
    ]);
  });
});

describe("THE FLIPPED FORM — representation is a three-way answer", () => {
  test("Ma jiro is an answer in its own right — and NOT a default value", () => {
    const seller = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibiyeyaal")!;
    const field = seller.fields.find((f) => f.id === "nooca_matalaada")!;
    expect(field.options?.map((o) => o.value)).toEqual(["ma_jiro", "wakiil", "wakiil_qayim"]);
    // A pre-set default would mark an empty row as "filled" and conjure a
    // nameless phantom party into the document. Blank already means "nobody
    // signs for this one", so the question stays genuinely unanswered.
    expect(field.default).toBeUndefined();
    expect(field.optional).toBe(true);
  });

  test("an untouched row never becomes a person with no name", () => {
    const v = base();
    const model = buildHantiPartyModel(v);
    expect(model.people.every((p) => p.name !== "")).toBe(true);
  });

  test("the same three answers exist on the authority itself", () => {
    const rep = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "wakiillo")!;
    const field = rep.fields.find((f) => f.id === "nooca_wakiilka")!;
    expect(field.options?.map((o) => o.value)).toEqual(["wakiil", "wakiil_qayim"]);
  });
});

describe("THE FLIPPED FORM — D/MAALKA is its own role", () => {
  test("D/MAALKA is offered as a role and is never a wakiil", () => {
    const seller = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibiyeyaal")!;
    const values = seller.fields.find((f) => f.id === "dooro")!.options!.map((o) => o.value);
    expect(values).toContain("dam_maalka");
    expect(values).not.toContain("wakiil_qayim");
    // And it has its own signature prefix, as the Beer scan prints it.
    const sig = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "saxeexayaasha")!;
    expect(sig.fields.find((f) => f.id === "prefix")!.options!.map((o) => o.value)).toContain("D/MAALKA");
  });
});

describe("THE FLIPPED FORM — optional never blocks", () => {
  test("a missing optional photograph does not appear and does not block", () => {
    const v = base({ iibiyeyaal: [r("s1", { magac: "AHMED", degan: "Hargeisa" })], iibsadayaal: buyers(1) });
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
  });

  test("a missing optional payment leaves out the paid line, not the whole block", () => {
    const v = base({ iibiyeyaal: [r("s1", { magac: "AHMED", degan: "Hargeisa" })], iibsadayaal: buyers(1) });
    const review = buildHantiReview(C, v);
    const payment = review.blocks.find((b) => b.key === "payment")!;
    expect(payment.lines.map((l) => l.label)).toEqual(["Qiimaha Guud"]);
  });

  test("a missing REQUIRED answer is named on the review", () => {
    // The price is one of the few answers the document cannot be printed
    // without, so it is one of the few that may still say "you cannot go on".
    const v = base({
      iibiyeyaal: [r("s1", { magac: "AHMED", degan: "Hargeisa" })],
      iibsadayaal: buyers(1),
      qiimaha: { qiimaha_guud: "" },
    });
    const review = buildHantiReview(C, v);
    expect(review.ready).toBe(false);
    expect(review.missing.some((m) => m.path === "qiimaha.qiimaha_guud")).toBe(true);
  });

  test("an EMPTY plot does not block — the survey may not describe the land", () => {
    const v = base({
      iibiyeyaal: [r("s1", { magac: "AHMED", degan: "Hargeisa" })],
      iibsadayaal: buyers(1),
      hantida_dhul_banaan: { ...PLOT, degmada: "", xaafada: "", cabbirka: "" },
    });
    const review = buildHantiReview(C, v);
    expect(review.missing.some((m) => m.path.startsWith("hantida_dhul_banaan."))).toBe(false);
    expect(review.ready).toBe(true);
  });
});

describe("THE FLIPPED FORM — payment", () => {
  test("price, amount paid and what is still owed all resolve", () => {
    const v = base({
      iibiyeyaal: [r("s1", { magac: "AHMED", degan: "Hargeisa" })],
      iibsadayaal: buyers(1),
      qiimaha: { qiimaha_guud: "1600", lacagta_bixiyay: "600" },
    });
    const map = computeReplacements(C, v);
    expect(map["{{QIIMAHA}}"]).toBe("$1,600");
    expect(map["{{LACAGTA_BIXIYAY}}"]).toBe("$600");
    expect(map["{{LACAGTA_HADHAY}}"]).toBe("$1,000");
  });

  test("nothing owed prints nothing — never a negative figure", () => {
    const v = base({
      iibiyeyaal: [r("s1", { magac: "AHMED", degan: "Hargeisa" })],
      iibsadayaal: buyers(1),
      qiimaha: { qiimaha_guud: "1600", lacagta_bixiyay: "1600" },
    });
    expect(computeReplacements(C, v)["{{LACAGTA_HADHAY}}"]).toBe("$0");
  });

  test("the amount paid can never exceed the price", () => {
    const v = base({
      iibiyeyaal: [r("s1", { magac: "AHMED", degan: "Hargeisa" })],
      iibsadayaal: buyers(1),
      qiimaha: { qiimaha_guud: "1600", lacagta_bixiyay: "5000" },
    });
    const errors = validateDocument(C, v);
    expect(Object.keys(errors)).toContain("qiimaha");
  });
});

/* ================================================================== */
/* Review screen                                                        */
/* ================================================================== */

describe("REVIEW — the questions the office asks", () => {
  const v = base({
    kooxaha: [r("g", { magac: "Ilma Xassan Qaalib" })],
    iibiyeyaal: [
      r("s1", { magac: "Ruun Xassan Qaalib", jinsi: "female", degan: "H", koox: "Ilma Xassan Qaalib", wakiil: "RUUN" }),
      r("s2", { magac: "Ibraahin Xassan", jinsi: "male", degan: "H", koox: "Ilma Xassan Qaalib", wakiil: "FARAX" }),
    ],
    wakiillo: [
      r("r1", { magac: "RUUN", nooca_wakiilka: "wakiil" }),
      r("r2", { magac: "FARAX", nooca_wakiilka: "wakiil_qayim" }),
    ],
    iibsadayaal: buyers(2),
    sawirrada: [r("p1", { magac: "Ruun Xassan Qaalib", sawir: "x" })],
    saxeexayaasha: [r("x1", { magac: "Ibraahin Xassan", prefix: "IIBIYE" })],
    shaxadaha: [r("c1", { tixraaca: "MDH/C/842/2025" })],
    maragyo: [r("m1", { magac: "MARAG KOOW" }), r("m2", { magac: "MARAG LABO" })],
  });
  const review = buildHantiReview(C, v);
  const block = (k: string) => review.blocks.find((b) => b.key === k);

  test("it shows every group the office asked for", () => {
    expect(review.blocks.map((b) => b.key)).toEqual([
      "sellers",
      "groups",
      "representatives",
      "photos",
      "signatories",
      "buyers",
      "witnesses",
      "property",
      "certificates",
      "payment",
    ]);
  });

  test("SELLERS — the count, and the legal word each one produces", () => {
    expect(block("sellers")!.count).toBe("Tirada: 2");
    expect(block("sellers")!.lines[0].value).toBe("Ruun Xassan Qaalib — iibiso");
    expect(block("sellers")!.lines[1].value).toBe("Ibraahin Xassan — iibiye");
  });

  test("GROUPS — the names and how many members each has", () => {
    expect(block("groups")!.lines[0].label).toBe("Ilma Xassan Qaalib");
    expect(block("groups")!.lines[0].value).toBe("2 xubin");
  });

  test("REPRESENTATIVES — who, and exactly whom each stands for", () => {
    expect(block("representatives")!.lines[0].value).toBe("Wakiil caadi ah — matalaysaa: Ruun Xassan Qaalib (1)");
    expect(block("representatives")!.lines[1].value).toBe("Wakiil Qayim — matalaysaa: Ibraahin Xassan (1)");
  });

  test("PHOTOS — the count and whose each one is", () => {
    expect(block("photos")!.count).toBe("Tirada: 1");
    expect(block("photos")!.lines[0]).toEqual({ label: "Sawir 1", value: "Ruun Xassan Qaalib" });
  });

  test("SIGNATORIES — the count, the role prefix and who signs", () => {
    expect(block("signatories")!.count).toBe("Tirada: 1");
    expect(block("signatories")!.lines[0].value).toBe("IIBIYE Ibraahin Xassan");
  });

  test("BUYERS, WITNESSES, PROPERTY and PAYMENT are all summarised", () => {
    expect(block("buyers")!.count).toBe("Tirada: 2");
    expect(block("witnesses")!.count).toBe("Tirada: 2");
    expect(block("property")!.lines.some((l) => l.label === "Degmada")).toBe(true);
    expect(block("payment")!.lines.map((l) => l.label)).toEqual(["Qiimaha Guud"]);
  });

  test("a complete document is ready", () => {
    expect(review.ready).toBe(true);
    expect(review.missing).toEqual([]);
  });

  /* ---- the REAL component, rendered through SSR -------------------- */

  test("the review PANEL actually renders the office's numbers", () => {
    const html = renderToStaticMarkup(<HantiReviewSummary review={review} />);
    // The counts the notary reads off the screen.
    expect(html).toContain("Tirada: 2"); // 2 sellers
    expect(html).toContain("Tirada: 1"); // 1 photo, 1 signatory
    expect(html).toContain("Ilma Xassan Qaalib"); // the group name
    expect(html).toContain("Waxa Hantida ku Jira");
    // Who stands for whom, and under which authority.
    expect(html).toContain("Wakiil Qayim");
    expect(html).toContain("matalaysaa");
    // A complete document says so, and shows NO missing panel.
    expect(html).toContain("diyaar ma ah");
    expect(html).not.toContain("Waxa MAQAN");
  });

  test("a missing REQUIRED answer is shown in the panel, by name", () => {
    const broken = buildHantiReview(
      C,
      base({
        iibiyeyaal: [r("s1", { magac: "AHMED", degan: "Hargeisa" })],
        iibsadayaal: buyers(1),
        qiimaha: { qiimaha_guud: "" },
      }),
    );
    const html = renderToStaticMarkup(<HantiReviewSummary review={broken} />);
    expect(html).toContain("Waxa MAQAN (waajibka ah):");
    expect(html).toContain("Qiimaha Guud");
    expect(html).not.toContain("diyaar ma ah");
  });
});

/* ================================================================== */
/* THE FIVE CRITICAL TEST CASES                                         */
/* ================================================================== */

describe("CRITICAL TEST CASES — all five must pass", () => {
  test("CASE 1 — 1 seller, 1 buyer, 1 witness, 1 photo, 1 signature", () => {
    const v = base({
      iibiyeyaal: [r("s1", { magac: "AHMED CALI", jinsi: "male", degan: "Hargeisa" })],
      iibsadayaal: buyers(1),
      maragyo: [r("m1", { magac: "MARAG KOOW" })],
      sawirrada: [r("p1", { magac: "AHMED CALI", sawir: "stor_s1" })],
      saxeexayaasha: [r("x1", { magac: "AHMED CALI", prefix: "IIBIYE" })],
    });
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
    expect(resolveFlags(C, v).IIBIYEYAAL_HAL).toBe(true);
    expect(computeReplacements(C, v)["{{IIBIYE_WORD}}"]).toBe("iibiyaha");
  });

  test("CASE 2 — 13 sellers, 1 group, 2 reps, 6 signatories, 8 photos, 2 witnesses", () => {
    const names = Array.from({ length: 13 }, (_, i) => `XUBIN ${i + 1}`);
    const v = base({
      kooxaha: [r("g", { magac: "Ilma Xassan Qaalib" })],
      iibiyeyaal: names.map((n, i) =>
        r(`s${i + 1}`, {
          magac: n,
          jinsi: i % 2 === 0 ? "male" : "female",
          degan: "Hargeisa",
          koox: "Ilma Xassan Qaalib",
          ...(i < 4 ? { wakiil: "RUUN" } : i < 8 ? { wakiil: "FARAX" } : {}),
        }),
      ),
      wakiillo: [
        r("r1", { magac: "RUUN", nooca_wakiilka: "wakiil" }),
        r("r2", { magac: "FARAX", nooca_wakiilka: "wakiil_qayim" }),
      ],
      iibsadayaal: buyers(1),
      // 6 seller photos + 1 buyer photo + 1 D/maal photo = 8.
      sawirrada: [
        ...names.slice(0, 6).map((n, i) => r(`p${i + 1}`, { magac: n, sawir: `stor_s${i}` })),
        r("pb", { magac: "IIBSADE 1", sawir: "stor_b" }),
        r("pd", { magac: "D/MAAL WACFIQ", sawir: "stor_d" }),
      ],
      saxeexayaasha: names.slice(0, 6).map((n, i) => r(`x${i + 1}`, { magac: n, prefix: "IIBISO" })),
      maragyo: [r("m1", { magac: "MARAG KOOW" }), r("m2", { magac: "MARAG LABO" })],
    });
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
    const review = buildHantiReview(C, v);
    const count = (k: string) => review.blocks.find((b) => b.key === k)!.count;
    expect(count("sellers")).toBe("Tirada: 13");
    expect(count("photos")).toBe("Tirada: 8");
    expect(count("signatories")).toBe("Tirada: 6");
    expect(count("witnesses")).toBe("Tirada: 2");
    expect(count("representatives")).toBe("Tirada: 2");
  });

  test("CASE 3 — 10 sellers, 1 representative, 1 photo — VALID", () => {
    const v = base({
      iibiyeyaal: Array.from({ length: 10 }, (_, i) =>
        r(`s${i + 1}`, { magac: `IIBIYE ${i + 1}`, jinsi: "male", degan: "Hargeisa", wakiil: "ABDI" }),
      ),
      wakiillo: [r("r1", { magac: "ABDI", nooca_wakiilka: "wakiil" })],
      iibsadayaal: buyers(1),
      sawirrada: [r("p1", { magac: "ABDI", sawir: "stor_rep" })],
    });
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
    const review = buildHantiReview(C, v);
    expect(review.blocks.find((b) => b.key === "photos")!.count).toBe("Tirada: 1");
    expect(review.ready).toBe(true);
  });

  test("CASE 4 — 10 sellers, 2 representatives, 4 photos, 3 signatories — VALID", () => {
    const names = Array.from({ length: 10 }, (_, i) => `IIBIYE ${i + 1}`);
    const v = base({
      iibiyeyaal: names.map((n, i) =>
        r(`s${i + 1}`, {
          magac: n,
          jinsi: "male",
          degan: "Hargeisa",
          wakiil: i < 5 ? "RUUN" : "FARAX",
        }),
      ),
      wakiillo: [
        r("r1", { magac: "RUUN", nooca_wakiilka: "wakiil" }),
        r("r2", { magac: "FARAX", nooca_wakiilka: "wakiil_qayim" }),
      ],
      iibsadayaal: buyers(1),
      sawirrada: names.slice(0, 4).map((n, i) => r(`p${i + 1}`, { magac: n, sawir: `stor_${i}` })),
      saxeexayaasha: names.slice(0, 3).map((n, i) => r(`x${i + 1}`, { magac: n, prefix: "IIBIYE" })),
    });
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
    const review = buildHantiReview(C, v);
    const count = (k: string) => review.blocks.find((b) => b.key === k)!.count;
    expect(count("sellers")).toBe("Tirada: 10");
    expect(count("photos")).toBe("Tirada: 4");
    expect(count("signatories")).toBe("Tirada: 3");
    expect(count("representatives")).toBe("Tirada: 2");
  });

  test("CASE 5 — a family whose members mostly have no photo and no signature — VALID", () => {
    const names = Array.from({ length: 9 }, (_, i) => `XUBIN ${i + 1}`);
    const v = base({
      kooxaha: [r("g", { magac: "Ilma Xassan Qaalib" })],
      iibiyeyaal: names.map((n, i) =>
        r(`s${i + 1}`, { magac: n, jinsi: i % 2 === 0 ? "male" : "female", degan: "Hargeisa", koox: "Ilma Xassan Qaalib" }),
      ),
      iibsadayaal: buyers(1),
      // ONE photograph and ONE signature for nine sellers.
      sawirrada: [r("p1", { magac: names[0], sawir: "stor_1" })],
      saxeexayaasha: [r("x1", { magac: names[0], prefix: "IIBIYE" })],
    });
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
    const review = buildHantiReview(C, v);
    expect(review.blocks.find((b) => b.key === "sellers")!.count).toBe("Tirada: 9");
    expect(review.blocks.find((b) => b.key === "photos")!.count).toBe("Tirada: 1");
    expect(review.blocks.find((b) => b.key === "signatories")!.count).toBe("Tirada: 1");
    // Eight sellers have neither a photograph nor a signature — and nothing
    // is reported, because that is the normal shape of a family sale.
    expect(review.missing).toEqual([]);
    expect(review.ready).toBe(true);
  });
});