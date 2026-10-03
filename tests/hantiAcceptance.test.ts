/**
 * KALA IIBSI HANTI — FINAL ACCEPTANCE.
 *
 * The office's standard: the form is a translation of the REAL document, so
 * it has to carry the real scan through all the way to the .docx without
 * losing anything on the way.
 *
 *   SCAN → DATA MODEL → FLIPPED FORM → VALIDATION → WORD
 *
 * Two scenarios are driven end to end:
 *
 *   A. BEER "DAARA-SALAAM" — group "Ilma Xassan Qaalib", 13 people, several
 *      representatives, wakiil ≠ wakiil qayim, 8 photographs, 6 signatories,
 *      2 witnesses, a run of certificates, price and payment.
 *   B. 10 sellers → 1 representative → 1 photo → 1 signatory.
 *
 * Scenario A is the shape the scans PROVED POSSIBLE. Nothing here may turn
 * it into a requirement: the counts below are what the form must ACCEPT, not
 * what it must ASK for.
 */
import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import {
  buildRepeatBlockData,
  computeReplacements,
  knownPlaceholderNames,
  resolveFlags,
} from "../src/lib/notary/dataContext";
import { validateDocument } from "../src/lib/notary/validation";
import { generateDocument } from "../src/lib/notary/pipeline";
import { selectTemplate } from "../src/lib/notary/registry";
import { kalaIiibsiHantiConfig as C } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { createInitialValues } from "../src/lib/notary/formValues";
import { buildHantiPartyModel, inspectHantiParties } from "../src/lib/notary/hantiParties";
import { countParties, representedPeople } from "../src/lib/notary/partyModel";
import { SCAN_EVIDENCE, SCAN_GAPS } from "../src/lib/notary/scanEvidence";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

function r(id: string, values: Record<string, string>): PartyRow {
  return { id, values } as PartyRow;
}

/* ------------------------------------------------------------------ */
/* Scenario A — the Beer scan, reproduced                              */
/* ------------------------------------------------------------------ */

const PEOPLE = [
  "Ruun Xassan Qaalib",
  "Ibraahin Xassan Qaalib",
  "Farax Axmed Xassan",
  "Maryan Xassan Muuse",
  "Caaqil Daahir Axmed Muuse",
  "Hodan Xassan Muuse",
  "Fadumo Axmed Qaadir",
  "Xasan Aydidhe Qaadir",
  "Sahra Xassan Muuse",
  "Liibaan Faarax Qaadir",
  "Amina Xassan Muuse",
  "Maxamed Faarax Qaadir",
  "Zahra Xassan Muuse",
];

function beerScenario(): FormValues {
  // Ruun stands for the first branch (4 people), Farax for the second (4).
  const repOf = (i: number) => (i < 4 ? "RUUN QAALIB" : i < 8 ? "FARAX AHMED" : "");
  return {
    ...createInitialValues(C),
    dejinta: {
      sub_type: "beer",
      reference: "DPN-MG-001",
      taariikhda_hantida: "2025-05-30",
    },
    kooxaha: [r("g", { magac: "Ilma Xassan Qaalib" })],
    iibiyeyaal: PEOPLE.map((name, i) =>
      r(`s${i + 1}`, {
        magac: name,
        jinsi: i % 2 === 0 ? "male" : "female",
        degan: "Waardhiil",
        koox: "Ilma Xassan Qaalib",
        ...(repOf(i) ? { wakiil: repOf(i) } : {}),
      }),
    ),
    wakiillo: [
      r("r1", {
        magac: "RUUN QAALIB",
        nooca_wakiilka: "wakiil",
        xiriirka_qoyska: "Hooyada",
        tixraaca_wakiilnimo: "Ref:APN/096/2025",
      }),
      r("r2", { magac: "FARAX AHMED", nooca_wakiilka: "wakiil_qayim" }),
    ],
    iibsadayaal: [
      {
        id: "b1",
        values: {
          magac: "SOMALI JAMAC",
          jinsi: "male",
          degan: "Hargeisa",
          telefoon: "0622222222",
        },
        attendance: { status: "jooga" },
      } as PartyRow,
    ],
    // 6 seller photos + 1 buyer photo + 1 guarantor-of-the-property photo.
    sawirrada: [
      ...PEOPLE.slice(0, 6).map((n, i) => r(`p${i + 1}`, { magac: n, sawir: `stor_s${i + 1}`, caption: n })),
      r("pb", { magac: "SOMALI JAMAC", sawir: "stor_b" }),
      r("pd", { magac: "D/MAAL WACFIQ", sawir: "stor_d" }),
    ],
    // 13 sellers, 6 of whom sign.
    saxeexayaasha: PEOPLE.slice(0, 6).map((n, i) =>
      r(`x${i + 1}`, { magac: n, prefix: i === 0 ? "IIBISO/WAKIIL" : "IIBISO" }),
    ),
    shaxadaha: [
      ...["839", "840", "841", "842"].map((n, i) =>
        r(`c${i + 1}`, {
          tixraaca: `MDH/C/${n}/2025`,
          nooca_shaxadaha: "beerta",
          haysa: "Ilma Xassan Qaalib",
        }),
      ),
      r("c5", { tixraaca: "Ref:APN/096/2025", nooca_shaxadaha: "poa", haysa: "RUUN QAALIB" }),
    ],
    hantida_beer: {
      magaca_beerta: "Beer Daara-Salaam",
      goobta: "Daara-Salaam",
      degmada_xaafadda: "Degmada Waardhiil",
      cabbirka: "2,000 m²",
      jiho_1: "Xarunta Wacatariga",
      jiho_2: "Badda Sooma",
      nooca_beeraha: "Beer Dhab ah",
      xuduudaha: "Bandhig, kalkaaliye",
      lambarka_lahaansho: "TR-4471",
      faahfaahin_dheeraad: "Beer wuxuu leeyahay 6 qodob.",
      ceel: "yes",
      shayada_ceelka: "Ceel 3m, Xaafadda Degmada Waardhiil",
    },
    damiinka: {
      nooca_damiinta: "qof_3aad",
      magaca_damiinka: "KHALID NOOR",
      telefoonka_damiinka: "0633333333",
      gurmadka_dammaanadda: "Reer deggan.",
      sawirka_damiinka: "stor_dm",
    },
    qiimaha: { qiimaha_guud: "1600", lacagta_bixiyay: "600" },
    maragyo: [r("m1", { magac: "MARAG KOOW" }), r("m2", { magac: "MARAG LABO" })],
  } as unknown as FormValues;
}

describe("ACCEPTANCE A — the Beer scan, reproduced end to end", () => {
  const v = beerScenario();
  const model = buildHantiPartyModel(v);
  const map = computeReplacements(C, v);
  const blocks = buildRepeatBlockData(C, v);
  const flags = resolveFlags(C, v);

  test("the flipped form ACCEPTS the whole scan — nothing is left unanswered", () => {
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
  });

  test("Beer asks for its OWN fields: the Beer's name, not Dhul Banaan's", () => {
    const beer = C.sections.find((s) => s.id === "hantida_beer")!;
    const ids = beer.fields.map((f) => f.id);
    expect(ids).toContain("magaca_beerta");
    expect(ids).toContain("nooca_beeraha");
    expect(ids).toContain("ceel");
    expect(ids).toContain("jiho_1");
    // Dhul Banaan's own fields must NOT leak into Beer.
    expect(ids).not.toContain("sida_hantida_loo_helay");
    expect(ids).not.toContain("beerta");
    // ...and Beer's must not leak into Dhul Banaan.
    const dhul = C.sections.find((s) => s.id === "hantida_dhul_banaan")!;
    expect(dhul.fields.map((f) => f.id)).not.toContain("magaca_beerta");
  });

  test("the Beer's name and the property details reach the document", () => {
    expect(map["{{BEER_MAGAC}}"]).toBe("Beer Daara-Salaam");
    expect(map["{{BEER_NOOCA}}"]).toBe("Beer Dhab ah");
    expect(map["{{BEER_CABBIRKA}}"]).toBe("2,000 m²");
    expect(map["{{BEER_JIHO_1}}"]).toBe("Xarunta Wacatariga");
    expect(map["{{BEER_CEEL}}"]).toBe("yes");
    expect(map["{{BEER_SHAYADA_CEELKA}}"]).toBe("Ceel 3m, Xaafadda Degmada Waardhiil");
  });

  test("the group is one NAME; the thirteen people stay thirteen people", () => {
    expect(model.groups.map((g) => g.name)).toEqual(["Ilma Xassan Qaalib"]);
    expect(model.groups[0].memberIds).toHaveLength(13);
    expect(model.people.map((p) => p.name)).not.toContain("Ilma Xassan Qaalib");
    expect(model.people.filter((p) => p.groupId === "g")).toHaveLength(13);
  });

  test("13 sellers, 8 photos, 6 signatories, 2 witnesses — none of them compared", () => {
    expect(countParties(model, { sellerIds: PEOPLE.map((_, i) => `s${i + 1}`), witnessIds: ["m1", "m2"] }))
      .toMatchObject({ sellers: 13, photos: 8, signatures: 6, witnesses: 2 });
  });

  test("every photograph is attached to the right person", () => {
    expect(model.photos).toHaveLength(8);
    expect(model.photos.filter((p) => p.personId.startsWith("s"))).toHaveLength(6);
    expect(model.photos.filter((p) => p.personId === "b1")).toHaveLength(1);
    // The D/MAALKA photograph belongs to someone who is in the room and on
    // the paper but is NOT a seller — so the model adds him as a person
    // rather than dropping a real face off a real document.
    const propertyHolder = model.people.find((p) => p.name === "D/MAAL WACFIQ");
    expect(propertyHolder).toBeDefined();
    expect(model.photos.some((p) => p.personId === propertyHolder!.id)).toBe(true);
    expect(inspectHantiParties(model).filter((i) => i.code === "photo_orphan")).toHaveLength(0);
  });

  test("only six of thirteen sign, and each line carries its own role prefix", () => {
    expect(model.signatures).toHaveLength(6);
    expect(model.signatures[0].prefix).toBe("IIBISO/WAKIIL");
    expect(new Set(model.signatures.map((s) => s.prefix))).toEqual(new Set(["IIBISO/WAKIIL", "IIBISO"]));
  });

  test("wakiil and wakiil qayim both appear, and stay different", () => {
    expect(model.representations.map((x) => x.type).sort()).toEqual(["wakiil", "wakiil_qayim"]);
    const [ruun, farax] = model.representations;
    expect(representedPeople(model, ruun)).toHaveLength(4);
    expect(representedPeople(model, farax)).toHaveLength(4);
    expect(ruun.reference).toBe("Ref:APN/096/2025");
  });

  test("five certificates print — not the single certificate slot of before", () => {
    expect(model.certificates.map((c) => c.reference)).toEqual([
      "MDH/C/839/2025",
      "MDH/C/840/2025",
      "MDH/C/841/2025",
      "MDH/C/842/2025",
      "Ref:APN/096/2025",
    ]);
    expect(blocks.get("SHAXADAHA")!.rows).toHaveLength(5);
  });

  test("price and payment both survive", () => {
    expect(map["{{QIIMAHA}}"]).toBe("$1,600");
    expect(map["{{LACAGTA_BIXIYAY}}"]).toBe("$600");
  });

  test("gender words follow the people, and a group of 13 is plural", () => {
    expect(map["{{IIBIYE_WORDS}}"]).toBe("iibiyayaal");
    expect(flags.IIBIYEYAAL_BADAN).toBe(true);
    // The thirteen SELLERS each chose a gender. The two representatives and
    // the photographed property-holder did not, so theirs stays "unknown" —
    // never guessed, which is what makes {{IIBIYE_WORD}} print nothing
    // rather than a wrong legal word.
    const sellers = model.people.filter((p) => p.groupId === "g");
    expect(sellers.every((p) => p.gender === "male" || p.gender === "female")).toBe(true);
    expect(model.people.filter((p) => p.gender === "unknown").length).toBeGreaterThan(0);
  });

  test("no duplicate person, no orphan edge, nothing to report", () => {
    expect(inspectHantiParties(model)).toEqual([]);
  });

  test("END TO END — the .docx carries the scan's structure, nothing unresolved", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      "<w:document><w:body>" +
        '<w:p><w:r><w:t>Beer: {{BEER_MAGAC}} — {{BEER_NOOCA}}</w:t></w:r></w:p>' +
        "<w:p><w:r><w:t>Koox: {{#KOOXAHA}}{{MAGAC}}{{/KOOXAHA}}</w:t></w:r></w:p>" +
        "<w:p><w:r><w:t>Iibiyayaasha:{{#IIBIYEYAAL}} {{NUMBER}}. {{MAGAC}} ({{JINSI}}){{/IIBIYEYAAL}}</w:t></w:r></w:p>" +
        "<w:p><w:r><w:t>Sawirro:{{#SAWIRRADA}} {{NUMBER}}. {{MAGAC}} — {{SAWIR}}{{/SAWIRRADA}}</w:t></w:r></w:p>" +
        "<w:p><w:r><w:t>Saxees:{{#SAXEEXAYAASHA}} {{NUMBER}}. {{PREFIX}} {{MAGAC}}{{/SAXEEXAYAASHA}}</w:t></w:r></w:p>" +
        "<w:p><w:r><w:t>Shaxado:{{#SHAXADAHA}} {{NUMBER}}. {{TIXRAACA}}{{/SHAXADAHA}}</w:t></w:r></w:p>" +
        "<w:p><w:r><w:t>Wakiil:{{#WAKIILLO}} {{NUMBER}}. {{MAGAC}} [{{NOOCA_WAKIILKA}}]{{/WAKIILLO}}</w:t></w:r></w:p>" +
        '<w:p><w:r><w:t>Qiimaha: {{QIIMAHA}} · La bixiyay: {{LACAGTA_BIXIYAY}}</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Maragyo: {{MARAGYO_LIST}}</w:t></w:r></w:p>' +
        "</w:body></w:document>",
    );
    const out = await generateDocument({
      config: C,
      values: v,
      referenceNumber: "DPN-MG-001",
      subTypeLabel: "Beer",
      templateBytes: await zip.generateAsync({ type: "arraybuffer" }),
      spec: selectTemplate(C, v),
    });
    const xml = await (await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer())))
      .file("word/document.xml")!
      .async("string");

    expect(xml).toContain("Beer: Beer Daara-Salaam — Beer Dhab ah");
    expect(xml).toContain("Ilma Xassan Qaalib");
    // 13 sellers, each numbered, each carrying their own gender.
    // "Zahra" prints (male) because THAT is what she chose — the engine never
    // reads a gender out of a name, which is the whole point of the field.
    expect(xml).toContain("13. Zahra Xassan Muuse (male)");
    // 8 photographs — a count no seller-list could have produced.
    expect(xml).toContain("8. D/MAAL WACFIQ");
    // 6 signature lines.
    expect(xml).toContain("1. IIBISO/WAKIIL Ruun Xassan Qaalib");
    expect(xml).toContain("6. IIBISO Hodan Xassan Muuse");
    // 5 certificates, including both the MDH run and the POA.
    expect(xml).toContain("MDH/C/839/2025");
    expect(xml).toContain("Ref:APN/096/2025");
    // Both authorities, spelled differently.
    expect(xml).toContain("1. RUUN QAALIB [wakiil]");
    expect(xml).toContain("2. FARAX AHMED [wakiil_qayim]");
    expect(xml).toContain("Qiimaha: $1,600 · La bixiyay: $600");
    expect(xml).toContain("MARAG KOOW\nMARAG LABO");
    expect(xml).not.toContain("{{");
  });
});

/* ------------------------------------------------------------------ */
/* Scenario B — 10 sellers, one representative, one photo, one signatory */
/* ------------------------------------------------------------------ */

describe("ACCEPTANCE B — 10 sellers → 1 representative → 1 photo → 1 signatory", () => {
  const names = Array.from({ length: 10 }, (_, i) => `IIBIYE ${i + 1}`);
  const v = {
    ...createInitialValues(C),
    dejinta: { sub_type: "dhul_banaan", reference: "DPN-MG-001", taariikhda_hantida: "2026-01-30" },
    hantida_dhul_banaan: {
      degmada: "Waardhiil",
      xaafada: "Sooma",
      cabbirka: "5,000 m²",
      jiho_1: "Xarunta Wacatariga",
      jiho_2: "Jidka Mogadishu",
      jiho_3: "Badda Sooma",
      soohdimaha: "Soohdimo: Degmada Waardhiil xaafadda Kale",
      sida_hantida_loo_helay: "iibsaday",
      notary_ref: "Tr No 4471",
    },
    iibiyeyaal: names.map((n, i) =>
      r(`s${i + 1}`, { magac: n, jinsi: i === 0 ? "male" : "female", degan: "Hargeisa", wakiil: "ABDI WAKIIL" }),
    ),
    wakiillo: [r("r1", { magac: "ABDI WAKIIL", nooca_wakiilka: "wakiil" })],
    iibsadayaal: [
      {
        id: "b1",
        values: { magac: "SOMALI JAMAC", jinsi: "male", degan: "Hargeisa", telefoon: "0622222222" },
        attendance: { status: "jooga" },
      } as PartyRow,
    ],
    sawirrada: [r("p1", { magac: "ABDI WAKIIL", sawir: "stor_rep" })],
    saxeexayaasha: [r("x1", { magac: "ABDI WAKIIL", prefix: "IIBIYE/WAKIIL" })],
    damiinka: {
      nooca_damiinta: "iibiyaha",
      gurmadka_dammaanadda: "Reer deggan.",
      sawirka_damiinka: "",
      telefoonka_damiinka: "",
    },
    qiimaha: { qiimaha_guud: "1600" },
    maragyo: [r("m1", { magac: "MARAG KOOW" })],
  } as unknown as FormValues;

  test("it validates exactly as the 13-person Beer does", () => {
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
  });

  test("10 sellers, one photo, one signatory — no rule objects", () => {
    const model = buildHantiPartyModel(v);
    expect(countParties(model, { sellerIds: names.map((_, i) => `s${i + 1}`) })).toMatchObject({
      sellers: 10,
      photos: 1,
      signatures: 1,
    });
  });

  test("the ONE photo belongs to the representative, who is not a seller", () => {
    const model = buildHantiPartyModel(v);
    expect(model.photos).toHaveLength(1);
    expect(model.photos[0].personId).toBe("r1");
    expect(inspectHantiParties(model)).toEqual([]);
  });

  test("Dhul Banaan's own fields reach the document", () => {
    const map = computeReplacements(C, v);
    expect(map["{{DEGMADA}}"]).toBe("Waardhiil");
    expect(map["{{SOOHDIMADA}}"]).toContain("Soohdimo");
    expect(map["{{IIBIYE_WORDS}}"]).toBe("iibiyayaal");
  });
});

/* ------------------------------------------------------------------ */

describe("SCAN EVIDENCE — nothing the paper shows is dropped", () => {
  test("every reading-list point is recorded with an explicit status", () => {
    expect(SCAN_EVIDENCE.map((p) => p.point)).toEqual([...Array(19).keys()].map((n) => n + 1));
    for (const p of SCAN_EVIDENCE) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(["scan_confirmed", "spec_only", "gap", "not_form_data"]).toContain(p.dhul_banaan);
      expect(["scan_confirmed", "spec_only", "gap", "not_form_data"]).toContain(p.beer);
      expect(p.livesIn.length).toBeGreaterThan(0);
    }
  });

  test("every registered SCAN GAP names the fix that closed it", () => {
    expect(SCAN_GAPS.length).toBeGreaterThan(0);
    for (const gap of SCAN_GAPS) {
      expect(SCAN_EVIDENCE.some((p) => p.point === gap.point)).toBe(true);
      expect(gap.found.length).toBeGreaterThan(0);
      expect(gap.fix).toMatch(/ADDED/);
    }
  });

  test("a gap only counts as closed if the FIELD IT NAMES REALLY EXISTS", () => {
    // The register is a claim; this is the check on the claim. Without it a
    // gap could say "ADDED" forever while the form never collected the data
    // — which is exactly the information loss the office forbids.
    const fieldIdsOf = (sectionId: string) =>
      C.sections.filter((s) => s.id === sectionId).flatMap((s) => s.fields.map((f) => f.id));

    for (const gap of SCAN_GAPS) {
      // Each fix names its fields as `section.field`.
      const named = [...gap.fix.matchAll(/([a-z_]+)\.([a-z_0-9]+)/g)];
      expect(named.length).toBeGreaterThan(0);
      for (const [, sectionId, fieldId] of named) {
        expect(fieldIdsOf(sectionId)).toContain(fieldId);
      }
    }
  });

  test("every gap-closing field actually resolves to a real placeholder", () => {
    const names = knownPlaceholderNames(C);
    for (const token of ["BEER_MAGAC", "BEER_JIHO_1", "BEER_JIHO_2", "SOOHDIMADA"]) {
      expect(names.has(token)).toBe(true);
    }
    const beer = computeReplacements(C, beerScenario());
    expect(beer["{{BEER_MAGAC}}"]).toBe("Beer Daara-Salaam");
    expect(beer["{{BEER_JIHO_1}}"]).toBe("Xarunta Wacatariga");
    expect(beer["{{BEER_JIHO_2}}"]).toBe("Badda Sooma");
  });

  test("legal clauses are deliberately NOT form questions", () => {
    const clauses = SCAN_EVIDENCE.find((p) => p.point === 16)!;
    expect(clauses.livesIn).toContain("not_form_data");
    expect(C.clauses).toEqual([]);
  });

  test("a scan's counts are recorded as possible cases, never as requirements", () => {
    // 13 sellers + 8 photos must never appear as a minimum anywhere.
    const sellerMin = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibiyeyaal")!;
    const photoMin = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "sawirrada")!;
    expect(sellerMin.min).toBe(1);
    expect(photoMin.min).toBe(0);
    expect(photoMin.optionalList).toBe(true);
  });
});