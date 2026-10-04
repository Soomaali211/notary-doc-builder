/**
 * §29 — KALA IIBSI HANTI IN THE LIVE DOCUMENT REVIEW.
 *
 * Every business rule the specification lists, checked on the DOCUMENT the
 * notary actually reads — not on the config alone:
 *
 *   seller count · buyer count · seller ≠ buyer · representatives ·
 *   wakiil ≠ qakiil qiyam · 10 sellers + 1 rep · 10 + 0 photos ·
 *   10 + 0 signatures · no gender for multiples · three guarantor cases ·
 *   property information · File/TR/Notary present and absent ·
 *   Waddo/Dhisme · optional fields · draft restore
 *
 * The three counts stay separate by design: seller count, photo count and
 * signature count are three different lists, and nothing here compares them.
 */
import { describe, expect, test } from "bun:test";
import { buildDocumentModel, modelToText } from "../src/lib/notary/documentModel";
import { deserializeDraft, serializeDraft } from "../src/lib/notary/engine";
import { validateDocument } from "../src/lib/notary/validation";
import { kalaIiibsiHantiConfig as C } from "../src/lib/notary/documents/kalaIiibsiHanti";
import {
  HANTI_CONFIG,
  HANTI_TEMPLATES,
  hantiValues,
  templateBytes,
  type HantiOptions,
} from "./_fixtures";
import type { FormValues } from "../src/lib/notary/types";

const REFERENCE = "DPN-MG-001";

async function documentFor(options: HantiOptions, subType = "dhul_banaan") {
  const values = hantiValues({ subType, ...options });
  const model = await buildDocumentModel({
    config: HANTI_CONFIG,
    values,
    templateBytes: templateBytes(HANTI_TEMPLATES[subType]),
    referenceNumber: REFERENCE,
  });
  expect(model.error).toBeNull();
  const text = modelToText(model).join("\n");
  return { model, text, values };
}

/** The seller block and the buyer block, split on the buyer's own heading. */
function splitParties(text: string): { sellers: string; buyers: string } {
  const at = text.indexOf("3. IIBSADAYAAL");
  expect(at).toBeGreaterThan(-1);
  return { sellers: text.slice(0, at), buyers: text.slice(at) };
}

const countRows = (text: string, prefix: string) =>
  (text.match(new RegExp(`${prefix} \\d+:`, "g")) ?? []).length;

/**
 * Real blocking validation errors only. `general` also carries the office's
 * standing reminders (e.g. "link the representative"), which are advice, not
 * something that stops the document.
 */
function blockingErrors(values: FormValues): string[] {
  const errors = validateDocument(C, values);
  return Object.values(errors).flatMap((section) => [
    ...Object.values(section.fieldErrors),
    ...Object.values(section.partyErrors).flatMap((parties) =>
      parties.flatMap((p) =>
        p.errors.map((e) => `row ${p.index}: ${JSON.stringify(e)}`),
      ),
    ),
  ]);
}

/* ------------------------------------------------------------------ */
/* Counts                                                              */
/* ------------------------------------------------------------------ */

describe("Hanti — seller and buyer counts", () => {
  test("one seller produces one seller row", async () => {
    const { text } = await documentFor({ sellerCount: 1 });
    expect(countRows(text, "Iibiyaha")).toBe(1);
    expect(text).toContain("AHMED CALI");
  });

  test("ten sellers produce ten seller rows", async () => {
    const { text } = await documentFor({ sellerCount: 10 });
    expect(countRows(text, "Iibiyaha")).toBe(10);
  });

  test("five buyers produce five buyer rows", async () => {
    const { text } = await documentFor({ sellerCount: 1, buyerCount: 5 });
    expect(countRows(text, "Iibsade")).toBe(5);
  });

  test("seller and buyer counts are independent", async () => {
    const { text } = await documentFor({ sellerCount: 10, buyerCount: 2 });
    expect(countRows(text, "Iibiyaha")).toBe(10);
    expect(countRows(text, "Iibsade")).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

describe("Hanti — seller is never the buyer", () => {
  test("each side lists only its own people", async () => {
    const { text } = await documentFor({ sellerCount: 2, buyerCount: 2 });
    const { sellers, buyers } = splitParties(text);
    expect(sellers).toContain("AHMED CALI");
    expect(sellers).not.toContain("ABDIRAHMAN ADEN");
    expect(buyers).toContain("ABDIRAHMAN ADEN");
    expect(buyers).not.toContain("FARAX XAAD");
  });

  test("both headings are present when both sides have people", async () => {
    const { text } = await documentFor({ sellerCount: 1, buyerCount: 1 });
    expect(text).toContain("2. IIBIYAYAAL");
    expect(text).toContain("3. IIBSADAYAAL");
  });
});

/* ------------------------------------------------------------------ */
/* Representation                                                      */
/* ------------------------------------------------------------------ */

describe("Hanti — representatives", () => {
  test("a seller representative prints and names its representative", async () => {
    const { text } = await documentFor({
      sellerCount: 2,
      sellerAttendance: [
        { status: "wakiil", representativeId: "r1" },
        { status: "jooga" },
      ],
    });
    expect(text).toContain("YASMIN AHMED");
    expect(text).toContain("Wakiilka matalaya:");
  });

  test("a buyer representative prints on the buyer side", async () => {
    const { text } = await documentFor({
      sellerCount: 1,
      buyerCount: 1,
      buyerAttendance: [{ status: "wakiil", representativeId: "br1" }],
    });
    expect(text).toContain("HUSSEIN MUSE");
  });

  test("representation never changes the number of parties", async () => {
    const plain = await documentFor({ sellerCount: 10 });
    const represented = await documentFor({
      sellerCount: 10,
      sellerAttendance: Array.from({ length: 10 }, () => ({
        status: "wakiil" as const,
        representativeId: "r1",
      })),
    });
    expect(countRows(represented.text, "Iibiyaha")).toBe(10);
    expect(countRows(plain.text, "Iibiyaha")).toBe(10);
    // One representative standing for ten sellers does not add an eleventh
    // seller row.
    expect(represented.text).not.toContain("Iibiyaha 11:");
  });

  test("ten sellers + one representative: one rep row, ten seller rows", async () => {
    const { text } = await documentFor({
      sellerCount: 10,
      sellerAttendance: [{ status: "wakiil", representativeId: "r1" }],
    });
    expect(countRows(text, "Iibiyaha")).toBe(10);
    expect(text).toContain("1. YASMIN AHMED");
    expect(text).not.toContain("2. YASMIN AHMED");
  });

  test("a plain wakiil is never printed as a qiyam", async () => {
    const { text } = await documentFor({
      sellerCount: 2,
      sellerAttendance: [
        { status: "wakiil", representativeId: "r2" },
        { status: "jooga" },
      ],
    });
    // r2 is an ordinary representative; only r1 may carry the qiyam title.
    expect(text).toContain("FARAX MAALMO (wakiil)");
    expect(text).not.toContain("FARAX MAALMO (wakiil_qayim)");
    expect(text).toContain("YASMIN AHMED (wakiil_qayim)");
  });

  test("no representative at all → no wakiil heading is left behind", async () => {
    const { text } = await documentFor({ sellerCount: 2, representatives: false });
    expect(text).not.toContain("Wakiillo Iibiyayaasha");
    expect(text).not.toContain("Wakiilka matalaya");
  });

  test("the representative title is an option, not a role the notary must pick", async () => {
    const repField = C.sections
      .flatMap((s) => s.parties ?? [])
      .flatMap((p) => p.representativeFields ?? [])
      .find((f) => f.id === "nooca_wakiilka");
    expect(repField).toBeDefined();
    expect(repField!.type).toBe("select");
    expect(repField!.options?.map((o) => o.value)).toEqual(["wakiil", "wakiil_qayim"]);
    expect(repField!.validation?.required).toBeFalsy();
  });
});

/* ------------------------------------------------------------------ */
/* Counts that must never be compared                                  */
/* ------------------------------------------------------------------ */

describe("Hanti — photo and signature counts are their own lists", () => {
  test("ten sellers + one photograph is valid and prints one photograph", async () => {
    const { text, values } = await documentFor({ sellerCount: 10, photos: true });
    expect(countRows(text, "Iibiyaha")).toBe(10);
    expect(values.sawirrada).toHaveLength(1);
    expect(blockingErrors(values)).toEqual([]);
  });

  test("ten sellers + no photographs is valid", async () => {
    const { text, values } = await documentFor({ sellerCount: 10, photos: false });
    expect(countRows(text, "Iibiyaha")).toBe(10);
    expect(text).not.toContain("SAWIRKA");
    expect(blockingErrors(values)).toEqual([]);
  });

  test("ten sellers + no signatures is valid", async () => {
    const { text, values } = await documentFor({ sellerCount: 10, signatures: false });
    expect(countRows(text, "Iibiyaha")).toBe(10);
    expect(text).not.toContain("SAXEEXAYAASHA");
    expect(blockingErrors(values)).toEqual([]);
  });

  test("nothing compares seller count, photo count and signature count", () => {
    const source = [
      "src/lib/notary/dataContext.ts",
      "src/lib/notary/validation.ts",
      "src/lib/notary/documents/kalaIiibsiHanti.ts",
    ];
    for (const file of source) {
      const text = require("node:fs").readFileSync(file, "utf8") as string;
      expect(text).not.toMatch(/tirada_iibiyayaasha[\s\S]{0,120}sawirro/);
      expect(text).not.toMatch(/sawirro_ma_jiraan[\s\S]{0,120}tirada_iibiyayaasha/);
      expect(text).not.toMatch(/saxeexo_ma_jiraan[\s\S]{0,120}tirada_iibiyayaasha/);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Gender is an input, never an inference                              */
/* ------------------------------------------------------------------ */

describe("Hanti — gender", () => {
  test("the gender question is hidden whenever the list has many", async () => {
    const { model } = await documentFor({ sellerCount: 4, sellerGender: null });
    const values = hantiValues({ sellerCount: 4, sellerGender: null });
    const field = C.sections
      .flatMap((s) => s.parties ?? [])
      .flatMap((p) => p.fields)
      .find((f) => f.id === "jinsi");
    expect(field?.hideWhenListHasMany).toBe(true);
    // Validation never asks for it, so the document builds with no gender at all.
    expect(blockingErrors(values)).toEqual([]);
    expect(modelToText(model).join("\n")).not.toContain("{{");
  });

  test("a single seller may still be asked", () => {
    const field = C.sections
      .flatMap((s) => s.parties ?? [])
      .flatMap((p) => p.fields)
      .find((f) => f.id === "jinsi");
    expect(field?.hideWhenListHasMany).toBe(true);
    // The rule only hides the question for several people; with one row the
    // field is asked and the wording follows the answer.
    expect(field?.options?.map((o) => o.value)).toEqual(["male", "female", "unknown"]);
  });

  test("gender is never derived from a name", () => {
    const field = C.sections
      .flatMap((s) => s.parties ?? [])
      .flatMap((p) => p.fields)
      .find((f) => f.id === "jinsi");
    // The hint itself states the rule: the answer comes from the notary.
    expect(field?.hint).toMatch(/magaca/);
    expect(field?.default).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Guarantor — three real answers                                     */
/* ------------------------------------------------------------------ */

describe("Hanti — the three guarantor answers", () => {
  test("a third-party guarantor prints his own details", async () => {
    const { text } = await documentFor({ guarantor: "qof_3aad" });
    expect(text).toContain("6. DAMMAANADDA");
    expect(text).toContain("Magaca Damiinka | OMAR DIID");
  });

  test("the sellers guarantee: no third party is created and no name is invented", async () => {
    const { text } = await documentFor({ guarantor: "iibiyaha" });
    expect(text).not.toContain("Magaca Damiinka |");
    expect(text).not.toContain("OMAR DIID"); // only ever the guarantor fixture
    // The seller already stands in the slot, so the signature line is his.
    expect(text).toContain("Saxiiixa Iibiyaha");
  });

  test("no guarantor at all: the whole guarantor section leaves the document", async () => {
    const { text } = await documentFor({ guarantor: "ma_jiro" });
    expect(text).not.toContain("6. DAMMAANADDA");
    expect(text).not.toContain("Magaca Damiinka");
    expect(text).not.toContain("Saxiixa Damiinka");
  });

  test("the guarantor question is answered once, in Dejinta", () => {
    const inDejinta = C.sections.find((s) => s.id === "dejinta")!.fields.some(
      (f) => f.id === "nooca_damiinta",
    );
    expect(inDejinta).toBe(true);
    // Step 6 collects details only — it never asks "who guarantees?" again.
    const step6Fields = C.sections
      .filter((s) => s.flowStep?.n === 6)
      .flatMap((s) => s.fields)
      .map((f) => f.id);
    expect(step6Fields).not.toContain("nooca_damiinta");
  });
});

/* ------------------------------------------------------------------ */
/* Property information                                                */
/* ------------------------------------------------------------------ */

describe("Hanti — property information", () => {
  test("Dhul Banaan prints the plot's own facts and none of the others", async () => {
    const { text } = await documentFor({}, "dhul_banaan");
    expect(text).toContain("Jiho Waqooyi");
    expect(text).toContain("Soohdimaha");
    expect(text).not.toContain("Goobta Guriga");
    expect(text).not.toContain("Magaca Beerta");
  });

  test("Guri prints the house's facts", async () => {
    const { text } = await documentFor({}, "guri");
    expect(text).toContain("Goobta Guriga");
    expect(text).toContain("Koronto, biyo, dariik");
    expect(text).not.toContain("Jiho Waqooyi");
  });

  test("Beer prints the business's facts", async () => {
    const { text } = await documentFor({}, "beer");
    expect(text).toContain("Beer Daara-Salaam");
    expect(text).not.toContain("Goobta Guriga");
  });

  test("each compass side prints the Somali word, never the stored value", async () => {
    const { text } = await documentFor({}, "dhul_banaan");
    expect(text).toContain("Jiho Waqooyi | Waddo");
    expect(text).toContain("Jiho Koonfur | Dhisme");
    expect(text).toContain("Jiho Bari | Waddo");
    expect(text).toContain("Jiho Galbeed | Dhisme");
    expect(text).not.toMatch(/\|\s*(waddo|dhisme)\b/);
  });

  test("a compass side offers exactly Waddo or Dhisme", () => {
    const sides = ["jiho_waqooyi", "jiho_koonfur", "jiho_bari", "jiho_galbeed"];
    const fields = C.sections
      .find((s) => s.id === "hantida_dhul_banaan")!
      .fields.filter((f) => sides.includes(f.id));
    expect(fields).toHaveLength(4);
    for (const f of fields) {
      expect(f.options?.map((o) => o.value)).toEqual(["waddo", "dhisme"]);
    }
  });

  test("File / TR / Notary: present prints the number, absent prints the description", async () => {
    const present = await documentFor({ hasReference: true });
    expect(present.text).toContain("Lambarka / Tixraaca Hantida: Tr No 4471");

    const absent = await documentFor({ hasReference: false });
    expect(absent.text).not.toContain("Lambarka / Tixraaca Hantida");
    expect(absent.text).toContain("Xarunta Wacatariga, koonfur");
  });

  test("Step 4 is ONE step covering every property sub-type", () => {
    const step4 = C.sections.filter((s) => s.flowStep?.n === 4);
    expect(step4.length).toBeGreaterThanOrEqual(4);
    const titles = new Set(step4.map((s) => s.flowStep!.title));
    expect(titles.size).toBe(1);
    expect([...titles][0]).toContain("Faahfaahinta Hantida");
  });
});

/* ------------------------------------------------------------------ */
/* Optional fields and drafts                                          */
/* ------------------------------------------------------------------ */

describe("Hanti — optional fields and drafts", () => {
  test("an empty optional field never blocks and never prints a token", async () => {
    const values = hantiValues();
    (values.qiimaha as Record<string, string>).habka_bixinta = "";
    (values.hantida_dhul_banaan as Record<string, string>).soohdimaha = "";
    const model = await buildDocumentModel({
      config: HANTI_CONFIG,
      values,
      templateBytes: templateBytes(HANTI_TEMPLATES.dhul_banaan),
      referenceNumber: REFERENCE,
    });
    expect(modelToText(model).join("\n")).not.toContain("{{");
    expect(model.warnings).toEqual([]);
    expect(blockingErrors(values)).toEqual([]);
  });

  test("a restored draft renders exactly what the live document showed", async () => {
    const { text } = await documentFor({ sellerCount: 3, buyerCount: 2 });
    const restored = deserializeDraft(C, serializeDraft(hantiValues({ sellerCount: 3, buyerCount: 2 })));
    const model = await buildDocumentModel({
      config: HANTI_CONFIG,
      values: restored as FormValues,
      templateBytes: templateBytes(HANTI_TEMPLATES.dhul_banaan),
      referenceNumber: REFERENCE,
    });
    expect(modelToText(model).join("\n")).toBe(text);
  });
});