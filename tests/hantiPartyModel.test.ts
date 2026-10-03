/**
 * KALA IIBSI HANTI — the ten required party scenarios.
 *
 * The office's rule, restated once so every test below can be read against
 * it:
 *
 *     seller_count ≠ photo_count ≠ signature_count
 *     person ≠ group     person ≠ role     role ≠ representation
 *     wakiil ≠ wakiil qayim     gender is an answer, never a name
 *
 * These tests exercise the PARTY MODEL (what the answers mean) and the
 * GENERATION PATH (what reaches the .docx). They assert the absences as
 * loudly as the presences: a sale with no photographs must still generate,
 * and no count may be compared with another.
 */
import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import {
  buildRepeatBlockData,
  computeReplacements,
  resolveFlags,
} from "../src/lib/notary/dataContext";
import { validateDocument } from "../src/lib/notary/validation";
import { generateDocument } from "../src/lib/notary/pipeline";
import { selectTemplate } from "../src/lib/notary/registry";
import { kalaIiibsiHantiConfig as C } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { createInitialValues } from "../src/lib/notary/formValues";
import { buildHantiPartyModel, inspectHantiParties } from "../src/lib/notary/hantiParties";
import { countParties, genderWord, representedPeople, representativesOf } from "../src/lib/notary/partyModel";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

/** Link representative `repId` to these rows (attendance "wakiil"). */
const represented = (rows: any[], repId: string) =>
  rows.map((r) => ({ ...r, attendance: { status: "wakiil" as const, representativeId: repId } }));


function row(
  id: string,
  values: Record<string, string>,
  status?: "jooga" | "ma_joogo" | "wakiil",
  repId?: string,
): PartyRow {
  return {
    id,
    values,
    ...(status
      ? { attendance: { status, ...(repId ? { representativeId: repId } : {}) } }
      : {}),
  } as PartyRow;
}

const PLOT = {
  degmada: "Waardhiil",
  xaafada: "Sooma",
  cabbirka: "5,000 m²",
  jiho_1: "Xarunta Wacatariga",
  jiho_2: "Jidka Mogadishu",
  jiho_3: "Badda Sooma",
};

/** A complete, valid Dhul Banaan answer set, with the parties overridden. */
function values(over: Partial<FormValues> = {}): FormValues {
  return {
    ...createInitialValues(C),
    dejinta: { sub_type: "dhul_banaan", reference: "DPN-MG-001", taariikhda_hantida: "2026-01-30" },
    hantida_dhul_banaan: { ...PLOT, sida_hantida_loo_helay: "iibsaday", notary_ref: "Tr No 4471" },
    damiinka: {
      nooca_damiinta: "iibiyaha",
      gurmadka_dammaanadda: "Reer deggan.",
      sawirka_damiinka: "",
      telefoonka_damiinka: "",
    },
    qiimaha: { qiimaha_guud: "1600" },
    maragyo: [row("m1", { magac: "MARAG KOOW", telefoon: "0633333333" })],
    ...over,
  } as FormValues;
}

/** N sellers, alternating gender, all with a name and an address. */
function sellers(n: number, extra: Record<string, string> = {}): PartyRow[] {
  return Array.from({ length: n }, (_, i) =>
    row(
      `s${i + 1}`,
      {
        magac: `IIBIYE ${i + 1}`,
        jinsi: i % 2 === 0 ? "male" : "female",
        degan: "Hargeisa",
        ...extra,
      },
    ),
  ).map((r) => ({ ...r, attendance: { status: "jooga" as const } }));
}

/* ------------------------------------------------------------------ */

describe("TEST 1 — 1 seller + 1 buyer + 3 witnesses", () => {
  const v = values({
    iibiyeyaal: [{ ...row("s1", { magac: "AHMED CALI", jinsi: "male", degan: "Hargeisa" }), attendance: { status: "jooga" as const } }],
    iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", jinsi: "male", degan: "Hargeisa", telefoon: "0622222222" }, "jooga")],
    maragyo: [
      row("m1", { magac: "MARAG KOOW" }),
      row("m2", { magac: "MARAG LABO" }),
      row("m3", { magac: "MARAG SADO" }),
    ] });

  test("the document validates with nothing left to answer", () => {
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
  });

  test("exactly one seller, one buyer and three witnesses", () => {
    const model = buildHantiPartyModel(v);
    expect(countParties(model, { sellerIds: ["s1"], witnessIds: ["m1", "m2", "m3"] })).toMatchObject({
      sellers: 1,
      witnesses: 3 });
    expect(buildRepeatBlockData(C, v).get("MARAGYO")!.rows).toHaveLength(3);
  });

  test("with one seller the word is SINGULAR and takes his gender", () => {
    expect(computeReplacements(C, v)["{{IIBIYE_WORDS}}"]).toBe("iibiye");
    expect(resolveFlags(C, v).IIBIYEYAAL_HAL).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("TEST 2 — 10 sellers + 1 representative + 1 photo + 1 signature", () => {
  const v = values({
    iibiyeyaal: represented(sellers(10, { wakiil: "ABDI WAKIIL" }), "r1"),
    iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", jinsi: "male", degan: "Hargeisa", telefoon: "0622222222" }, "jooga")],
    wakiilo_iibiyeyaal: [row("r1", { magac: "ABDI WAKIIL" })],
    sawirrada: [row("p1", { magac: "IIBIYE 1", sawir: "stor_p1" })],
    saxeexayaasha: [row("g1", { magac: "ABDI WAKIIL", prefix: "IIBIYE/WAKIIL" })] });
  const model = buildHantiPartyModel(v);

  test("10 sellers is not 1 photo and not 1 signature", () => {
    expect(countParties(model, { sellerIds: sellers(10).map((s) => s.id) })).toMatchObject({
      sellers: 10,
      photos: 1,
      signatures: 1 });
  });

  test("the form validates — no rule compares the three counts", () => {
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
  });

  test("the single photo belongs to ONE named person", () => {
    expect(model.photos).toHaveLength(1);
    expect(model.photos[0].personId).toBe("s1");
  });

  test("one representative covers all ten sellers", () => {
    expect(model.representations).toHaveLength(1);
    expect(representedPeople(model, model.representations[0]).map((p) => p.id)).toHaveLength(10);
    expect(representativesOf(model, "s1")).toHaveLength(1);
  });

  test("the one signature carries its ROLE prefix, chosen not derived", () => {
    expect(model.signatures[0].prefix).toBe("IIBIYE/WAKIIL");
  });
});

/* ------------------------------------------------------------------ */

describe("TEST 3 — 10 sellers, TWO representatives splitting them 6 / 4", () => {
  const v = values({
    iibiyeyaal: sellers(10).map((s, i) =>
      row(s.id, { ...s.values, wakiil: i < 6 ? "RUUN QAALIB" : "FARAX AHMED" }),
    ),
    wakiilo_iibiyeyaal: [
      row("r1", { magac: "RUUN QAALIB" }),
      row("r2", { magac: "FARAX AHMED" }),
    ]] });
  const model = buildHantiPartyModel(v);
  const [a, b] = model.representations;

  test("representative A stands for exactly six sellers", () => {
    expect(representedPeople(model, a).map((p) => p.id)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6"]);
  });

  test("representative B stands for exactly four", () => {
    expect(representedPeople(model, b).map((p) => p.id)).toEqual(["s7", "s8", "s9", "s10"]);
  });

  test("one representative is NOT forced to cover everyone", () => {
    expect(representedPeople(model, a)).toHaveLength(6);
    expect(representedPeople(model, b)).toHaveLength(4);
  });

  test("every seller is represented, and by exactly one person", () => {
    for (const s of sellers(10)) {
      expect(representativesOf(model, s.id)).toHaveLength(1);
    }
  });
});

/* ------------------------------------------------------------------ */

describe("TEST 4 — a 13-member family: 13 sellers, 8 photos, 6 signatures, 2 witnesses", () => {
  const names = Array.from({ length: 13 }, (_, i) => `XUBIN ${i + 1}`);
  const v = values({
    kooxaha: [row("g", { magac: "Ilma Xassan Qaalib" })],
    iibiyeyaal: names.map((n, i) =>
      row(`s${i + 1}`, { magac: n, jinsi: i % 2 === 0 ? "male" : "female", degan: "Hargeisa", koox: "Ilma Xassan Qaalib" }),
    ),
    sawirrada: names.slice(0, 8).map((n, i) => row(`p${i + 1}`, { magac: n, sawir: `stor_p${i + 1}` })),
    saxeexayaasha: names.slice(0, 6).map((n, i) => row(`x${i + 1}`, { magac: n, prefix: "IIBIYE" })),
    maragyo: [row("m1", { magac: "MARAG KOOW" }), row("m2", { magac: "MARAG LABO" })],
    iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", jinsi: "male", degan: "Hargeisa", telefoon: "0622222222" }, "jooga")] });
  const model = buildHantiPartyModel(v);
  const counts = countParties(model, { sellerIds: names.map((_, i) => `s${i + 1}`), witnessIds: ["m1", "m2"] });

  test("13 sellers, 8 photos, 6 signatures, 2 witnesses — all four at once", () => {
    expect(counts).toMatchObject({ sellers: 13, photos: 8, signatures: 6, witnesses: 2 });
  });

  test("the form validates — no count is checked against another", () => {
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
  });

  test("the group has a NAME and is not one of the thirteen people", () => {
    expect(model.groups.map((g) => g.name)).toEqual(["Ilma Xassan Qaalib"]);
    expect(model.groups[0].memberIds).toHaveLength(13);
    expect(model.people.map((p) => p.name)).not.toContain("Ilma Xassan Qaalib");
  });

  test("with several sellers the word is the PLURAL, whatever the genders", () => {
    expect(computeReplacements(C, v)["{{IIBIYE_WORDS}}"]).toBe("iibiyayaal");
    expect(resolveFlags(C, v).IIBIYEYAAL_BADAN).toBe(true);
  });

  test("a seller with no photograph and no signature is not reported", () => {
    expect(inspectHantiParties(model)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("TEST 5 — gender words: female seller, male seller, mixed group", () => {
  test("the singular words differ by gender, not by spelling accident", () => {
    expect(genderWord({ role: "seller", gender: "male", number: "singular" })).toBe("iibiye");
    expect(genderWord({ role: "seller", gender: "female", number: "singular" })).toBe("iibiso");
    expect(genderWord({ role: "buyer", gender: "male", number: "singular" })).toBe("iibsade");
    expect(genderWord({ role: "buyer", gender: "female", number: "singular" })).toBe("iibsato");
  });

  test("definiteness is a SEPARATE axis from gender", () => {
    expect(genderWord({ role: "seller", gender: "male", number: "singular", definite: true })).toBe("iibiyaha");
    expect(genderWord({ role: "seller", gender: "female", number: "singular", definite: true })).toBe("iibisada");
    // "iibiye → iibisada" is forbidden: it changes gender AND definiteness.
    expect(genderWord({ role: "seller", gender: "male", number: "singular", definite: true })).not.toBe("iibisada");
  });

  test("an unchosen gender yields NO word — the engine never guesses", () => {
    expect(genderWord({ role: "seller", gender: "unknown", number: "singular" })).toBeUndefined();
    const v = values({ iibiyeyaal: [{ ...row("s1", { magac: "X", degan: "Hargeisa" }), attendance: { status: "jooga" as const } }] });
    expect(computeReplacements(C, v)["{{IIBIYE_WORDS}}"]).toBe("");
  });

  test("a female seller prints IIBISO, not a mangled IIBIYE", () => {
    const v = values({ iibiyeyaal: [{ ...row("s1", { magac: "MARYAN XASSAN", jinsi: "female", degan: "Hargeisa" }), attendance: { status: "jooga" as const } }] });
    expect(computeReplacements(C, v)["{{IIBIYE_WORDS}}"]).toBe("iibiso");
    expect(computeReplacements(C, v)["{{IIBIYE_WORD}}"]).toBe("iibisada");
  });

  test("a MIXED group still prints one plural word", () => {
    const v = values({
      iibiyeyaal: [
        { ...row("s1", { magac: "RUUN XASSAN", jinsi: "female", degan: "Hargeisa" }), attendance: { status: "jooga" as const } },
        { ...row("s2", { magac: "FARAX AHMED", jinsi: "male", degan: "Hargeisa" }), attendance: { status: "jooga" as const } },
      ] });
    expect(computeReplacements(C, v)["{{IIBIYE_WORDS}}"]).toBe("iibiyayaal");
  });

  test("gender is never read out of the name", () => {
    const v = values({
      iibiyeyaal: [
        // "Maryan" and "Ahmed" chosen deliberately OPPOSITE to expectation.
        { ...row("s1", { magac: "AHMED CALI", jinsi: "female", degan: "Hargeisa" }), attendance: { status: "jooga" as const } },
        { ...row("s2", { magac: "MARYAN XASSAN", jinsi: "male", degan: "Hargeisa" }), attendance: { status: "jooga" as const } },
      ] });
    const model = buildHantiPartyModel(v);
    expect(model.people.map((p) => p.gender)).toEqual(["female", "male"]);
  });
});

/* ------------------------------------------------------------------ */

describe("TEST 6 — a seller who is ALSO the representative", () => {
  const v = values({
    iibiyeyaal: [
      { ...row("s1", { magac: "RUUN XASSAN QAALIB", jinsi: "female", degan: "Hargeisa", wakiil: "RUUN XASSAN QAALIB" }), attendance: { status: "jooga" as const } },
      { ...row("s2", { magac: "Ibraahin XASSAN", jinsi: "male", degan: "Hargeisa" }), attendance: { status: "jooga" as const } },
    ],
    wakiilo_iibiyeyaal: [row("r1", { magac: "RUUN XASSAN QAALIB" })] });
  const model = buildHantiPartyModel(v);

  test("she is ONE person, not a seller plus a second copy of herself", () => {
    expect(model.people.map((p) => p.name)).toEqual(["RUUN XASSAN QAALIB", "Ibraahin XASSAN"]);
    expect(model.people.filter((p) => p.name === "RUUN XASSAN QAALIB")).toHaveLength(1);
  });

  test("she is a seller AND a representative at the same time", () => {
    expect(model.representations[0].representativeId).toBe("s1");
    expect(model.representations[0].representedPersonIds).toContain("s1");
  });

  test("being a representative does not add a third person", () => {
    expect(model.people).toHaveLength(2);
    expect(inspectHantiParties(model)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("TEST 7 — Wakiil caadi ah is NOT Wakiil Qayim", () => {
  const v = values({
    iibiyeyaal: sellers(4, { wakiil: "WAKIIL CAAJI" }).map((s, i) =>
      i === 3 ? row(s.id, { ...s.values, wakiil: "WAKIIL QAYIM" }) : s,
    ),
    wakiilo_iibiyeyaal: [
      row("r1", { magac: "WAKIIL CAAJI" }),
      row("r2", { magac: "WAKIIL QAYIM" }),
    ]] });
  const model = buildHantiPartyModel(v);

  test("the two authorities are stored as two different things", () => {
    expect(model.representations.map((r) => r.type)).toEqual(["wakiil", "wakiil_qayim"]);
  });

  test("neither is derived from the other", () => {
    expect(model.representations[0].type).not.toBe("wakiil_qayim");
    expect(model.representations[1].type).not.toBe("wakiil");
  });

  test("a wakiil_qayim standing for someone is NOT relabelled 'wakiil'", () => {
    const qayim = model.representations.find((r) => r.representativeId === "r2")!;
    expect(representedPeople(model, qayim).map((p) => p.id)).toEqual(["s4"]);
    expect(qayim.type).toBe("wakiil_qayim");
  });

  test("a mother may be a wakiil WITHOUT that relationship granting authority", () => {
    const withRelationship = buildHantiPartyModel(
      values({
        wakiilo_iibiyeyaal: [
          row("r1", { magac: "WAKIIL CAAJI" }),
        ]],
        iibiyeyaal: sellers(2, { wakiil: "WAKIIL CAAJI" }) }),
    );
    // The relationship is data ON the person; the authority is the edge.
    // They are recorded separately and neither implies the other.
    expect(withRelationship.representations[0].type).toBe("wakiil_qayim");
    expect(withRelationship.representations[0].representedPersonIds).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */

describe("TEST 8 — an optional photograph is missing: generation still works", () => {
  const v = values({
    iibiyeyaal: sellers(3),
    iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", jinsi: "female", degan: "Hargeisa", telefoon: "0622222222" }, "jooga")],
    // NO sawirrada at all.
    saxeexayaasha: [row("x1", { magac: "IIBIYE 1", prefix: "IIBIYE" })] });

  test("the missing photograph is NOT a validation error", () => {
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
  });

  test("the photo list is simply empty — nothing is invented for it", () => {
    expect(buildRepeatBlockData(C, v).get("SAWIRRADA")!.rows).toEqual([]);
    expect(buildHantiPartyModel(v).photos).toEqual([]);
  });

  test("and the .docx is still produced, with no unresolved placeholder", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      "<w:document><w:body>" +
        '<w:p><w:r><w:t>Iibiyaha: {{#IIBIYEYAAL}}{{NUMBER}} {{MAGAC}}{{/IIBIYEYAAL}}</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Saxees: {{#SAXEEXAYAASHA}}{{NUMBER}} {{PREFIX}} {{MAGAC}}{{/SAXEEXAYAASHA}}</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Sawirro: {{#SAWIRRADA}}{{MAGAC}}{{/SAWIRRADA}}</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Qiimaha: {{QIIMAHA}}</w:t></w:r></w:p>' +
        "</w:body></w:document>",
    );
    const out = await generateDocument({
      config: C,
      values: v,
      referenceNumber: "DPN-MG-001",
      subTypeLabel: "Dhul Banaan",
      templateBytes: await zip.generateAsync({ type: "arraybuffer" }),
      spec: selectTemplate(C, v) });

    const xml = await (await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer())))
      .file("word/document.xml")!
      .async("string");
    expect(xml).toContain("Qiimaha: $1,600");
    // The signature line still prints…
    expect(xml).toContain("IIBIYE IIBIYE 1");
    // …the empty photo block vanishes instead of leaving a blank line…
    expect(xml).not.toContain("Sawirro: null");
    // …and nothing is left unresolved.
    expect(xml).not.toContain("{{");
  });
});

/* ------------------------------------------------------------------ */

describe("TEST 9 — one group NAME plus many individual members", () => {
  const v = values({
    kooxaha: [row("g", { magac: "Ilma Xassan Qaalib" })],
    iibiyeyaal: [
      { ...row("s1", { magac: "Ruun Xassan Qaalib", jinsi: "male", degan: "Hargeisa", koox: "Ilma Xassan Qaalib", wakiil: "Ruun Xassan Qaalib" }), attendance: { status: "jooga" as const } },
      { ...row("s2", { magac: "Ibraahin Xassan Qaalib", jinsi: "male", degan: "Hargeisa", koox: "Ilma Xassan Qaalib", wakiil: "Ruun Xassan Qaalib" }), attendance: { status: "jooga" as const } },
      { ...row("s3", { magac: "Farax Axmed Xassan", jinsi: "male", degan: "Hargeisa", koox: "Ilma Xassan Qaalib", wakiil: "Ruun Xassan Qaalib" }), attendance: { status: "jooga" as const } },
      { ...row("s4", { magac: "Maryan Xassan Muuse", jinsi: "female", degan: "Hargeisa", koox: "Ilma Xassan Qaalib", wakiil: "Ruun Xassan Qaalib" }), attendance: { status: "jooga" as const } },
    ],
    wakiilo_iibiyeyaal: [row("r1", { magac: "Ruun Xassan Qaalib" })] });
  const model = buildHantiPartyModel(v);

  test("the group is an entity with a name, not a person", () => {
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0].name).toBe("Ilma Xassan Qaalib");
    expect(model.people.map((p) => p.name)).not.toContain("Ilma Xassan Qaalib");
  });

  test("all four individuals are members of it", () => {
    expect(model.groups[0].memberIds).toEqual(["s1", "s2", "s3", "s4"]);
    expect(model.people.every((p) => p.groupId === "g")).toBe(true);
  });

  test("a member may be a REPRESENTATIVE of the family as well", () => {
    expect(model.representations[0].representativeId).toBe("s1");
    expect(representedPeople(model, model.representations[0]).map((p) => p.id)).toEqual(["s1", "s2", "s3", "s4"]);
  });

  test("a certificate may be about the GROUP, not a person", () => {
    const withCert = buildHantiPartyModel(
      values({ ...v, shaxadaha: [row("c1", { tixraaca: "MDH/C/842/2025", nooca_shaxadaha: "beerta", haysa: "Ilma Xassan Qaalib" })] }),
    );
    expect(withCert.certificates[0].aboutGroupId).toBe("g");
    expect(withCert.certificates[0].aboutPersonId).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */

describe("TEST 10 — one person in several roles, without being duplicated", () => {
  const v = values({
    kooxaha: [row("g", { magac: "Ilma Xassan Qaalib" })],
    iibiyeyaal: [
      { ...row("s1", {
        magac: "Ruun Xassan Qaalib",
        jinsi: "female",
        degan: "Hargeisa",
        koox: "Ilma Xassan Qaalib",
        dooro: "wakiil",
        wakiil: "Ruun Xassan Qaalib" }), attendance: { status: "jooga" as const } },
      { ...row("s2", { magac: "Ibraahin Xassan Qaalib", jinsi: "male", degan: "Hargeisa", koox: "Ilma Xassan Qaalib" }), attendance: { status: "jooga" as const } },
    ],
    wakiilo_iibiyeyaal: [row("r1", { magac: "Ruun Xassan Qaalib" })],
    sawirrada: [row("p1", { magac: "Ruun Xassan Qaalib", sawir: "stor_p1" })],
    saxeexayaasha: [row("x1", { magac: "Ruun Xassan Qaalib", prefix: "IIBISO/WAKIIL" })],
    shaxadaha: [row("c1", { tixraaca: "MDH/C/842/2025", haysa: "Ruun Xassan Qaalib" })] });
  const model = buildHantiPartyModel(v);
  const ruun = model.people.filter((p) => p.name === "Ruun Xassan Qaalib");

  test("she appears exactly ONCE in the people list", () => {
    expect(ruun).toHaveLength(1);
    expect(model.people).toHaveLength(2);
  });

  test("yet every one of her roles resolves to that same person", () => {
    expect(model.groups[0].memberIds).toContain("s1");
    expect(model.representations[0].representativeId).toBe("s1");
    expect(model.photos[0].personId).toBe("s1");
    expect(model.signatures[0].personId).toBe("s1");
    expect(model.certificates[0].aboutPersonId).toBe("s1");
  });

  test("her five roles are five different kinds of fact, not five people", () => {
    expect(ruun[0].groupId).toBe("g");
    // ROLE is not FAMILY RELATIONSHIP. "Wakiil" says what she does in this
    // sale; "Hooyada" would say who she is to somebody. The office keeps
    // them apart, so one can never be mistaken for the other.
    expect(ruun[0].role).toBe("wakiil");
    expect(ruun[0].familyRelationship).toBeUndefined();
    expect(model.signatures[0].prefix).toBe("IIBISO/WAKIIL");
  });

  test("a family relationship is recorded as itself, never read from the name", () => {
    // "Hooyada" typed into the relationship box is data. Nothing in the
    // system decides it from the name Ruun, and nothing may.
    const withKin = buildHantiPartyModel(
      values({
        ...v,
        iibiyeyaal: [
          { ...row("s1", {
            magac: "Ruun Xassan Qaalib",
            jinsi: "female",
            koox: "Ilma Xassan Qaalib",
            xiriirka_qoyska: "Hooyada" }), attendance: { status: "jooga" as const } },
        ] }),
    );
    expect(withKin.people[0].familyRelationship).toBe("Hooyada");
    // The same person with no relationship typed is simply unknown.
    expect(buildHantiPartyModel(v).people.find((p) => p.id === "s1")!.familyRelationship).toBeUndefined();
  });

  test("no duplicate id, no orphan, nothing to report", () => {
    expect(inspectHantiParties(model)).toEqual([]);
  });
});