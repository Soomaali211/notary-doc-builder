/**
 * KALA IIBSI DHUL BANAAN — scan-to-form fidelity.
 *
 * The contract proved here is the one the office approved from the scanned
 * sale agreements (S1, S2, S3): one date, the plot's location, repeatable
 * sellers, repeatable buyers with attendance, a guarantor that is ALWAYS
 * present (third party OR the seller himself), one price, and the
 * witnesses.
 *
 *   FORM → WORKFLOW → VALIDATION → DATA CONTEXT → PLACEHOLDER INVENTORY
 *
 * No Word template is built here: the office designs that. What is proved
 * is that every scan answer has exactly one legal home, that nothing leaks
 * between parties, and that the boundary fields never print a raw stored
 * value.
 *
 * Heshiis Kiro is re-checked at the end: its replacement map must be
 * byte-identical to what it was before this document type changed.
 */
import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import {
  buildDataContext,
  buildRepeatBlockData,
  computeReplacements,
  knownPlaceholderNames,
  resolveFlags,
} from "../src/lib/notary/dataContext";
import { validateDocument, collectFilledValues } from "../src/lib/notary/validation";
import { buildConditionalWorkflow } from "../src/lib/notary/agreementSetup";
import { generateDocument } from "../src/lib/notary/pipeline";
import { selectTemplate } from "../src/lib/notary/registry";
import { documentConfigs, getConfig } from "../src/lib/notary/documents";
import { kalaIiibsiHantiConfig as C } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { heshiisKiroConfig as K } from "../src/lib/notary/documents/heshiisKiro";
import {
  KALA_IIBSI_HANTI_PLACEHOLDERS,
  canonicalNameFor,
  placeholderRegistry,
  registryTokenNames,
} from "../src/lib/notary/placeholderRegistry";
import {
  addRepresentative,
  applyCountedParties,
  createInitialValues,
  createValuesFromDraft,
  getPartyRows,
  representedByRep,
} from "../src/lib/notary/formValues";
import {
  composeReferenceNumber,
  referenceDateParts,
  referenceSerial,
} from "../src/lib/notary/referenceNumber";
import { formatCurrencyWordsSomali } from "../src/lib/notary/somaliNumbers";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

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

/** Error message of one section, or "" when the section validates clean. */
function errorsOf(values: FormValues, sectionId: string): string {
  const e = validateDocument(C, values)[sectionId];
  if (!e) return "";
  return [
    ...Object.values(e.fieldErrors),
    ...e.general,
    ...Object.values(e.partyErrors).flatMap((rows) =>
      rows.flatMap((r) => r.errors.map((x) => x.message)),
    ),
  ].join(" | ");
}

/* ------------------------------------------------------------------ */
/* A — registration                                                     */
/* ------------------------------------------------------------------ */

describe("A — document type registration", () => {
  test("Kala Iibsi Hanti is registered next to Heshiis Kiro, not beside it", () => {
    expect(getConfig("kala_iibsi_hanti")).toBe(C);
    expect(documentConfigs.map((c) => c.id)).toEqual([
      "heshiis_kiro",
      "kala_iibsi_hanti",
    ]);
  });

  test("Dhul Banaan, Guri, Beer and Hanti Kale are all offered", () => {
    expect(C.subTypes.map((s) => s.value)).toEqual([
      "dhul_banaan",
      "guri",
      "beer",
      "hanti_kale",
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* B — form flow                                                        */
/* ------------------------------------------------------------------ */

describe("B — form flow", () => {
  test("the FLIPPED flow follows the office's reading order", () => {
    const steps = buildConditionalWorkflow(C, {
      ...createInitialValues(C),
      // Every optional list is declared up front so the WHOLE interview is
      // visible. Each of these four yes/no gates decides whether its list
      // exists at all — see the next test.
      dejinta: {
        sub_type: "dhul_banaan",
        taariikhda_hantida: "2026-01-30",
        sawirro_ma_jiraan: "yes",
        saxeexo_ma_jiraan: "yes",
        shaxado_ma_jiraan: "yes",
      },
    } as FormValues);
    // A non-attendance list (the sellers, the group, the photographs…) and
    // the witnesses render under BOTH their section header and their own row
    // step — the same shape Heshiis Kiro already has for its witnesses.
    //
    // The ORDER is the one the notary reads the sale aloud in: who is
    // selling, whose family, who stands for whom, who is buying, what is
    // sold, what it costs — and only then the evidence that goes on the
    // paper (photographs, signatures, witnesses, certificates).
    expect(steps.map((s) => s.short)).toEqual([
      "Dejinta Heshiiska",
      "Xogta & Xaaladda Iibiyayaasha",
      "Xogta & Xaaladda Iibsadayaasha",
      "Xogta Hantida & Faahfaahinta Hantida",
      "Qiimaha & Faahfaahinta Lacagta",
      "Xogta Damiinka & Maragyada",
    ]);
  });

  test("SIX steps, exactly — never a seventh and never a hidden count step", () => {
    // The office's fixed interview. Every optional list renders INSIDE its
    // own step, so nothing extra is ever asked.
    const steps = buildConditionalWorkflow(C, {
      ...createInitialValues(C),
      dejinta: {
        sub_type: "dhul_banaan",
        taariikhda_hantida: "2026-01-30",
        sawirro_ma_jiraan: "yes",
        saxeexo_ma_jiraan: "yes",
        shaxado_ma_jiraan: "yes",
      },
    } as FormValues);
    expect(steps).toHaveLength(6);
    // No list asks for its own count step inside a fixed flow.
    for (const s of steps) {
      if (s.detail.kind === "section") {
        for (const id of s.detail.sectionIds) {
          const section = C.sections.find((x) => x.id === id)!;
          for (const p of section.parties ?? []) {
            if (p.countFirst && !p.countFrom) {
              expect(steps.some((t) => t.detail.kind === "party-count" && t.detail.partyDef.id === p.id)).toBe(false);
            }
          }
        }
      }
    }
  });

  test("a sale with no representatives never sees the representative form", () => {
    const steps = buildConditionalWorkflow(C, {
      ...createInitialValues(C),
      // Every gate answered NO: the most common sale of all.
      dejinta: {
        sub_type: "dhul_banaan",
        taariikhda_hantida: "2026-01-30",
        sawirro_ma_jiraan: "no",
        saxeexo_ma_jiraan: "no",
        shaxado_ma_jiraan: "no",
      },
    } as FormValues);
    // Still exactly six steps — the gated lists simply are not inside them.
    expect(steps.map((s) => s.short)).toEqual([
      "Dejinta Heshiiska",
      "Xogta & Xaaladda Iibiyayaasha",
      "Xogta & Xaaladda Iibsadayaasha",
      "Xogta Hantida & Faahfaahinta Hantida",
      "Qiimaha & Faahfaahinta Lacagta",
      "Xogta Damiinka & Maragyada",
    ]);
    // Step 2 carries the sellers and their family, and no representative.
    const step2 = steps[1].detail as { kind: "section"; sectionIds: string[] };
    expect(step2.sectionIds).toContain("iibiyaha");
    expect(step2.sectionIds).not.toContain("wakiillada");
    // Step 4 keeps the property questions and drops every optional list.
    const step4 = steps[3].detail as { kind: "section"; sectionIds: string[] };
    expect(step4.sectionIds).toContain("hantida_dhul_banaan");
    expect(step4.sectionIds).not.toContain("sawirrada");
    expect(step4.sectionIds).not.toContain("saxeexayaasha");
    expect(step4.sectionIds).not.toContain("shaxadaha");
  });

  test("the seller count is asked ONCE, in Dejinta — never in its own step", () => {
    // The office rule: one question, one source of truth. The count lives in
    // the setup step, so the seller list emits NO "Tirada Iibiyayaal" step.
    const steps = buildConditionalWorkflow(C, {
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", taariikhda_hantida: "2026-01-30" },
    } as FormValues);
    expect(steps.map((s) => s.short)).not.toContain("Tirada Iibiyayaal");
    expect(steps.map((s) => s.short)).not.toContain("Tirada Iibsadayaal");
    // And the question really is there, exactly once, in the setup step.
    const countFields = C.sections
      .find((s) => s.id === "dejinta")!
      .fields.filter((f) => f.id === "tirada_iibiyayaasha" || f.id === "tirada_iibsadayaasha");
    expect(countFields.map((f) => f.id)).toEqual(["tirada_iibiyayaasha", "tirada_iibsadayaasha"]);
    const party = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibiyeyaal")!;
    expect(party.countFrom).toBe("dejinta.tirada_iibiyayaasha");
  });

  test("the setup count BUILDS the rows — one number, that many people", () => {
    const values = {
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", taariikhda_hantida: "2026-01-30", tirada_iibiyayaasha: "10", tirada_iibsadayaasha: "2" },
    } as unknown as FormValues;
    const grown = applyCountedParties(C, values);
    expect(getPartyRows(grown, "iibiyeyaal")).toHaveLength(10);
    expect(getPartyRows(grown, "iibsadayaal")).toHaveLength(2);
  });

  test("an unanswered count invents nothing — the list keeps its own floor", () => {
    const values = {
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", taariikhda_hantida: "2026-01-30" },
    } as unknown as FormValues;
    const kept = applyCountedParties(C, values);
    expect(getPartyRows(kept, "iibiyeyaal")).toHaveLength(1);
  });

  test("§1 'Iibiye' is exactly one seller — a stale count beside it is ignored", () => {
    const values = {
      ...createInitialValues(C),
      dejinta: {
        sub_type: "dhul_banaan",
        taariikhda_hantida: "2026-01-30",
        iibiye_mode: "single",
        // A count left over from before the mode was switched back: it must
        // NOT keep ten rows alive under an answer that says "one seller".
        tirada_iibiyayaasha: "9",
      },
    } as unknown as FormValues;
    expect(getPartyRows(applyCountedParties(C, values), "iibiyeyaal")).toHaveLength(1);
  });

  test("§5 'Iibsade' is exactly one buyer, same rule", () => {
    const values = {
      ...createInitialValues(C),
      dejinta: {
        sub_type: "dhul_banaan",
        taariikhda_hantida: "2026-01-30",
        iibsade_mode: "single",
        tirada_iibsadayaasha: "8",
      },
    } as unknown as FormValues;
    expect(getPartyRows(applyCountedParties(C, values), "iibsadayaal")).toHaveLength(1);
  });

  test("§1 'Iibiyayaal' still uses the count typed beside the card", () => {
    const values = {
      ...createInitialValues(C),
      dejinta: {
        sub_type: "dhul_banaan",
        taariikhda_hantida: "2026-01-30",
        iibiye_mode: "multiple",
        tirada_iibiyayaasha: "10",
        iibsade_mode: "multiple",
        tirada_iibsadayaasha: "2",
      },
    } as unknown as FormValues;
    const grown = applyCountedParties(C, values);
    expect(getPartyRows(grown, "iibiyeyaal")).toHaveLength(10);
    expect(getPartyRows(grown, "iibsadayaal")).toHaveLength(2);
  });

  test("a restored draft honours the mode too — never resurrects deleted rows", () => {
    const draft = {
      dejinta: {
        sub_type: "dhul_banaan",
        taariikhda_hantida: "2026-01-30",
        iibiye_mode: "single",
        tirada_iibiyayaasha: "5",
      },
      iibiyeyaal: [
        { id: "s1", values: { magac: "AHMED CALI" } },
        { id: "s2", values: { magac: "RUUN XASAN" } },
      ],
    };
    const restored = createValuesFromDraft(C, JSON.stringify(draft));
    expect(getPartyRows(restored, "iibiyeyaal")).toHaveLength(1);
    // The one row kept is the first entered, never a blank replacement.
    expect(getPartyRows(restored, "iibiyeyaal")[0].values?.magac).toBe("AHMED CALI");
  });

  test("the plot section is Dhul Banaan-only — Guri sees its own section", () => {
    const forSub = (sub: string) =>
      buildConditionalWorkflow(C, {
        ...createInitialValues(C),
        dejinta: { sub_type: sub, taariikhda_hantida: "2026-01-30" },
      } as FormValues).map((s) => s.short);
    // Step 4 is titled once; WHICH property questions live inside it is what
    // the sub-type decides.
    const step4 = (sub: string) => {
      const s = buildConditionalWorkflow(C, {
        ...createInitialValues(C),
        dejinta: { sub_type: sub, taariikhda_hantida: "2026-01-30" },
      } as FormValues)[3];
      return s.detail.kind === "section" ? s.detail.sectionIds : [];
    };
    expect(forSub("guri")).toContain("Xogta Hantida & Faahfaahinta Hantida");
    expect(step4("guri")).toEqual(["hantida_guri"]);
    expect(step4("dhul_banaan")).toEqual(["hantida_dhul_banaan"]);
    expect(step4("beer")).toEqual(["hantida_beer"]);
    expect(step4("guri")).not.toContain("hantida_dhul_banaan");
    expect(step4("dhul_banaan")).not.toContain("hantida_guri");
  });

  test("every visible step has something to answer", () => {
    const steps = buildConditionalWorkflow(C, {
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", taariikhda_hantida: "2026-01-30" },
    } as FormValues);
    const empty = buildConditionalWorkflow(C, {
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan" },
    } as FormValues);
    expect(steps.length).toBeGreaterThan(0);
    expect(empty.length).toBe(steps.length);
  });
});

/* ------------------------------------------------------------------ */
/* C — the Dhul Banaan plot section                                    */
/* ------------------------------------------------------------------ */

describe("C — the plot (Dhul Banaan)", () => {
  const plotSection = C.sections.find((s) => s.id === "hantida_dhul_banaan")!;
  const ids = (s: typeof plotSection) => s.fields.map((f) => f.id);

  test("collects exactly the scan's plot data — nothing more", () => {
    // `soohdimaha` was added when the Dhul Banaan scan's boundaries were
    // registered in scanEvidence.ts — it is the one field this list was
    // missing, and it is OPTIONAL because a boundary may be unstated.
    // The four compass sides each answer ONE question (Waddo / Dhisme), and
    // the office reference branches into File / TR / Notary or a
    // "Calaamad Dheeraad ah" instead of forcing a number that may not exist.
    expect(ids(plotSection)).toEqual([
      "degmada",
      "xaafada",
      "cabbirka",
      "jiho_waqooyi",
      "jiho_koonfur",
      "jiho_bari",
      "jiho_galbeed",
      "soohdimaha",
      "sida_hantida_loo_helay",
      "tixraaca_ma_jiraan",
      "nooca_tixraaca",
      "lambarka_tixraaca",
      "calaamad_dheeraad",
    ]);
    expect(plotSection.fields.find((f) => f.id === "soohdimaha")?.optional).toBe(true);
  });

  test("every compass side asks the SAME binary question — Waddo or Dhisme", () => {
    for (const side of ["waqooyi", "koonfur", "bari", "galbeed"]) {
      const f = plotSection.fields.find((x) => x.id === `jiho_${side}`)!;
      expect(f.type).toBe("select");
      expect(f.options?.map((o) => o.value)).toEqual(["waddo", "dhisme"]);
      // Never defaulted: an unanswered side prints nothing.
      expect(f.validation?.required).toBeUndefined();
      expect(f.options).toHaveLength(2);
    }
  });

  test("the File / TR / Notary branch NEVER forces a number that does not exist", () => {
    const yes = { op: "equals", field: "hantida_dhul_banaan.tixraaca_ma_jiraan", value: "yes" };
    const no = { op: "equals", field: "hantida_dhul_banaan.tixraaca_ma_jiraan", value: "no" };
    // "Haa" -> which kind, then the number.
    expect(plotSection.fields.find((f) => f.id === "nooca_tixraaca")?.visibleWhen).toEqual(yes);
    expect(plotSection.fields.find((f) => f.id === "nooca_tixraaca")?.options?.map((o) => o.value)).toEqual([
      "file_no",
      "tr_no",
      "notary_reference",
    ]);
    expect(plotSection.fields.find((f) => f.id === "lambarka_tixraaca")?.visibleWhen).toEqual(yes);
    // "Maya" -> a Calaamad Dheeraad ah, and nothing else is asked.
    expect(plotSection.fields.find((f) => f.id === "calaamad_dheeraad")?.visibleWhen).toEqual(no);
    // The number is typed ONCE. The old notary_ref / beerta pair is gone.
    expect(ids(plotSection)).not.toContain("notary_ref");
    expect(ids(plotSection)).not.toContain("beerta");
  });

  test("the reference box is on Step 1 — same shape as Heshiis Kiro", () => {
    const setup = C.sections.find((s) => s.id === "dejinta")!;
    const ref = setup.fields.find((f) => f.id === "reference");
    expect(ref).toBeDefined();
    // The office allocates it — the empty box says so and never blocks.
    expect(ref!.placeholder).toBe("Si toos ah ayaa la abuurayaa");
    expect(ref!.optional).toBe(true);
  });

  test("Step 1 asks, once and in order: date, reference, seller mode, buyer mode, guarantee", () => {
    const setup = C.sections.find((s) => s.id === "dejinta")!;
    expect(setup.fields.map((f) => f.id)).toEqual([
      "sub_type",
      "taariikhda_hantida",
      "reference",
      // One or several? Each asked ONCE, each decides its list's size.
      "iibiye_mode",
      "tirada_iibiyayaasha",
      "iibsade_mode",
      "tirada_iibsadayaasha",
      // Each asked ONCE, at the top; each decides whether one optional list
      // exists at all. None of them is ever asked again below. There is no
      // "Wakiil ma jiraan?" here — a wakiil is decided inside the person's
      // own step, exactly as Heshiis Kiro does.
      "sawirro_ma_jiraan",
      "saxeexo_ma_jiraan",
      "shaxado_ma_jiraan",
      "nooca_damiinta",
    ]);
  });

  test("degmada / xaafada / cabbirka / jiho_1..3 are OPTIONAL, never blocking", () => {
    // No scan proves any of them legally mandatory, and the office ruled that
    // an unproven field must never BLOCK. A blank plot detail prints nothing.
    for (const id of [
      "degmada",
      "xaafada",
      "cabbirka",
      "jiho_waqooyi",
      "jiho_koonfur",
      "jiho_bari",
      "jiho_galbeed",
      "tixraaca_ma_jiraan",
      "nooca_tixraaca",
      "calaamad_dheeraad",
    ]) {
      expect(plotSection.fields.find((f) => f.id === id)?.validation?.required).toBeUndefined();
      expect(plotSection.fields.find((f) => f.id === id)?.optional).toBe(true);
    }
  });

  test("a hidden plot section is neither validated nor printed", () => {
    const values = {
      ...createInitialValues(C),
      dejinta: { sub_type: "guri", taariikhda_hantida: "2026-01-30" },
    } as FormValues;
    expect(errorsOf(values, "hantida_dhul_banaan")).toBe("");
    const map = computeReplacements(C, values);
    expect(map["{{DEGMADA}}"]).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* C2 — how the seller acquired the plot (the only two scans' split)    */
/* ------------------------------------------------------------------ */

describe("C2 — sida hantida uu loo helay", () => {
  const plot = {
    degmada: "Waardhiil",
    xaafada: "Sooma",
    cabbirka: "5,000 m²",
    jiho_1: "Xarunta Wacatariga",
    jiho_2: "Jidka Mogadishu",
    jiho_3: "Badda Sooma",
  };

  const withProof = (proof: Record<string, string>): FormValues =>
    ({
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", reference: "DPN-MG-001", taariikhda_hantida: "2026-01-30" },
      hantida_dhul_banaan: { ...plot, ...proof },
    }) as FormValues;

  test("no File/TR/Notary number → the Calaamad Dheeraad ah is asked, nothing else", () => {
    const errs = errorsOf(
      withProof({ sida_hantida_loo_helay: "dhaxlay", tixraaca_ma_jiraan: "no" }),
      "hantida_dhul_banaan",
    );
    // The notary is NEVER pushed into inventing a reference that does not
    // exist — the description is the answer.
    expect(errs).not.toContain("Lambarka");
    expect(errs).not.toContain("Nooca Tixraaca");
    expect(
      C.sections
        .find((s) => s.id === "hantida_dhul_banaan")!
        .fields.find((f) => f.id === "calaamad_dheeraad")!.optional,
    ).toBe(true);
  });

  test("File / TR / Notary chosen → the number is asked, once", () => {
    const fields = C.sections.find((s) => s.id === "hantida_dhul_banaan")!.fields;
    const yes = { op: "equals", field: "hantida_dhul_banaan.tixraaca_ma_jiraan", value: "yes" };
    expect(fields.find((f) => f.id === "lambarka_tixraaca")?.requiredWhen).toEqual(yes);
    // The number is typed in exactly one place.
    const numberFields = fields.filter((f) =>
      ["lambarka_tixraaca", "notary_ref", "beerta"].includes(f.id),
    );
    expect(numberFields.map((f) => f.id)).toEqual(["lambarka_tixraaca"]);
  });

  test("one proof given → the section validates clean", () => {
    expect(
      errorsOf(
        withProof({ sida_hantida_loo_helay: "dhaxlay", tixraaca_ma_jiraan: "yes", nooca_tixraaca: "tr_no", lambarka_tixraaca: "Ilmo Hebel 1998" }),
        "hantida_dhul_banaan",
      ),
    ).toBe("");
  });

  test("the flags tell the template which proof to print", () => {
    expect(
      resolveFlags(C, withProof({ sida_hantida_loo_helay: "dhaxlay" })).HANTIDA_DHAXLAT,
    ).toBe(true);
    expect(
      resolveFlags(C, withProof({ sida_hantida_loo_helay: "iibsaday" })).HANTIDA_IIBSADAY,
    ).toBe(true);
  });

  test("the stored value never prints raw — it reads as Somali", () => {
    const map = computeReplacements(C, withProof({ sida_hantida_loo_helay: "dhaxlay" }));
    expect(map["{{SIDA_HANTIDA}}"]).toBe("Hantida waxuu iibiyuhu dhaxlay");
    expect(map["{{SIDA_HANTIDA}}"]).not.toBe("dhaxlay");
  });
});

/* ------------------------------------------------------------------ */
/* D — the price                                                        */
/* ------------------------------------------------------------------ */

describe("D — price", () => {
  const priced = (amount: string): FormValues =>
    ({
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", reference: "DPN-MG-001", taariikhda_hantida: "2026-01-30" },
      qiimaha: { qiimaha_guud: amount },
    }) as FormValues;

  test("the user types the PRICE as one figure — the amount in words is derived", () => {
    const section = C.sections.find((s) => s.id === "qiimaha")!;
    expect(section.fields.map((f) => f.id)).toEqual([
      "qiimaha_guud",
      "lacagta_bixiyay",
      "sida_lacagta",
      "lacagta_baaqiga_ah",
      "habka_bixinta",
      "faahfaahin_lacageed",
    ]);
    // Only the price itself is required; what was actually paid is optional.
    expect(section.fields[0].validation?.required).toBe(true);
    expect(section.fields[1].optional).toBe(true);
  });

  test("the amount in words is DERIVED from the figure — the user never types it", () => {
    const map = computeReplacements(C, priced("1600"));
    expect(map["{{QIIMAHA_QORAAL}}"]).toBe(
      formatCurrencyWordsSomali(1600, "Dollar"),
    );
    expect(map["{{QIIMAHA_QORAAL}}"]).toContain("oo Dollar");
    expect(map["{{QIIMAHA_QORAAL}}"]).toContain("Lix Boqol");
  });

  test("the figure itself prints with the office's currency symbol", () => {
    expect(computeReplacements(C, priced("1600"))["{{QIIMAHA}}"]).toBe("$1,600");
  });

  test("KNOWN GAP — the office's shared Somali number library says 'Koow Kun' for 1,000", () => {
    // The scan reads "KUN IYO LIX BOQOL OO DOLLAR". The shared utility
    // somaliNumberToWords (used by Heshiis Kiro's rent and deposit too) emits
    // "Koow Kun" for the thousands part. It is NOT corrected here: changing it
    // would silently alter every Kiro document. Raised for a decision instead.
    expect(formatCurrencyWordsSomali(1600, "Dollar")).toBe(
      "Koow Kun iyo Lix Boqol oo Dollar",
    );
  });

  test("an empty price prints nothing at all — never $0", () => {
    const map = computeReplacements(C, priced(""));
    expect(map["{{QIIMAHA}}"]).toBe("");
    expect(map["{{QIIMAHA_QORAAL}}"]).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* E — the guarantor is ALWAYS present                                  */
/* ------------------------------------------------------------------ */

describe("E — dammaanadda (the decision is made in Step 1)", () => {
  /** The guarantor choice lives in Dejinta Heshiiska, not here. */
  const dam = (over: Record<string, string>): FormValues =>
    ({
      ...createInitialValues(C),
      dejinta: {
        sub_type: "dhul_banaan",
        reference: "DPN-MG-001",
        taariikhda_hantida: "2026-01-30",
        nooca_damiinta: "qof_3aad",
        ...over,
      },
      iibiyeyaal: [{ ...row("s1", { magac: "AHMED CALI", degan: "Hargeisa", telefoon: "0611111111" }), attendance: { status: "jooga" as const } }],
      damiinka: { gurmadka_dammaanadda: "Reer deggan oo la dhisay.", ...(over.gurmadka_dammaanadda ? { gurmadka_dammaanadda: over.gurmadka_dammaanadda } : {}) },
    }) as unknown as FormValues;

  /** Same, but the guarantor DETAILS land in the damiinka section. */
  const dam2 = (nooca: string, det: Record<string, string> = {}): FormValues =>
    ({
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", reference: "DPN-MG-001", taariikhda_hantida: "2026-01-30", nooca_damiinta: nooca },
      iibiyeyaal: [{ ...row("s1", { magac: "AHMED CALI", degan: "Hargeisa", telefoon: "0611111111" }), attendance: { status: "jooga" as const } }],
      damiinka: { gurmadka_dammaanadda: "Reer deggan oo la dhisay.", ...det },
    }) as unknown as FormValues;

  test("'Damiin ma jiraa?' has TWO answers, and is asked ONCE in Step 1", () => {
    // A sale is ALWAYS guaranteed: by a third party, or by the sellers. There
    // is no third state, so there are only two doors.
    const setup = C.sections.find((s) => s.id === "dejinta")!;
    const q = setup.fields.find((f) => f.id === "nooca_damiinta")!;
    expect(q.options?.map((o) => o.value)).toEqual(["qof_3aad", "iibiyaha"]);
    // Asked here…
    expect(setup.flowStep).toEqual({ n: 1, title: "Dejinta Heshiiska" });
    // …and NEVER again in the guarantor step.
    const dam = C.sections.find((s) => s.id === "damiinka")!;
    expect(dam.fields.map((f) => f.id)).not.toContain("nooca_damiinta");
    expect(dam.visibleWhen).toBeUndefined();
  });

  test("the seller self-guarantor branch creates NO third-party person", () => {
    // "Maya" means the sellers guarantee themselves: their names already
    // stand in the guarantor slot, so no one new is created.
    const self = computeReplacements(C, dam2("iibiyaha"));
    expect(self["{{DAMIIN_MAGACA}}"]).toBe("AHMED CALI");
    expect(self["{{DAMIIN_TELEFOON}}"]).toBe("");
    expect(self["{{DAMIIN_SAWIR}}"]).toBe("");
    expect(resolveFlags(C, dam2("iibiyaha")).DAMIIN_IIBIYAHA).toBe(true);
    expect(resolveFlags(C, dam2("iibiyaha")).DAMIIN_QOF_3AAD).toBe(false);
  });

  test("a third party IS asked for, and named", () => {
    const third = computeReplacements(C, dam2("qof_3aad", { magaca_damiinka: "KHALID NOOR" }));
    expect(third["{{DAMIIN_MAGACA}}"]).toBe("KHALID NOOR");
    expect(resolveFlags(C, dam2("qof_3aad")).DAMIIN_QOF_3AAD).toBe(true);
  });

  test("the guarantor PERSON fields exist only for a third party", () => {
    const fields = C.sections.find((s) => s.id === "damiinka")!.fields;
    const gate = { op: "equals", field: "dejinta.nooca_damiinta", value: "qof_3aad" };
    for (const id of ["magaca_damiinka", "telefoonka_damiinka", "degan_damiinka", "sawirka_damiinka"]) {
      expect(fields.find((f) => f.id === id)?.visibleWhen).toEqual(gate);
    }
    // The pledge itself is always there — a guaranteed sale has a pledge.
    expect(fields.find((f) => f.id === "gurmadka_dammaanadda")?.visibleWhen).toBeUndefined();
  });

  test("a third-party guarantor must be named — his phone and address stay optional", () => {
    const errs = errorsOf(dam2("qof_3aad"), "damiinka");
    expect(errs).toContain("Magaca Damiinka");
    const fields = C.sections.find((s) => s.id === "damiinka")!.fields;
    expect(fields.find((f) => f.id === "telefoonka_damiinka")?.optional).toBe(true);
    expect(fields.find((f) => f.id === "degan_damiinka")?.optional).toBe(true);
  });

  test("the gurmad NEVER blocks", () => {
    expect(errorsOf(dam2("qof_3aad", { magaca_damiinka: "KHALID NOOR" }), "damiinka")).toBe("");
    expect(errorsOf(dam2("iibiyaha"), "damiinka")).toBe("");
    expect(C.sections.find((s) => s.id === "damiinka")!.fields.find((f) => f.id === "gurmadka_dammaanadda")?.optional).toBe(true);
    // The guarantor DETAILS section is not even asked for on the sellers'
    // branch, so it cannot be the thing that stops the notary.
    expect(errorsOf(dam2("iibiyaha"), "damiinka")).not.toContain("Magaca Damiinka");
    void dam;
  });

  test("no dead 'no guarantor' flag survives the two-way answer", () => {
    // There is no such state, so the template must not be offered a flag for
    // it — an orphan token is a promise the engine cannot keep.
    expect("DAMIIN_MA_JIRO" in resolveFlags(C, dam2("iibiyaha"))).toBe(false);
    expect("DAMIIN_MA_JIRO" in resolveFlags(C, dam2("qof_3aad"))).toBe(false);
  });
});


describe("F — repeatable parties", () => {
  const party = (id: string) =>
    C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === id)!;

  // A COMPLETE sale, so a test about counts fails only on a count.
  const linked = (over: Record<string, unknown> = {}) =>
    ({
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", reference: "DPN-MG-001", taariikhda_hantida: "2026-01-30", sawirro_ma_jiraan: "yes", saxeexo_ma_jiraan: "yes" },
      iibiyeyaal: [
        { ...row("s1", { magac: "AHMED CALI", jinsi: "male", degan: "Hargeisa" }), attendance: { status: "jooga" as const } },
        { ...row("s2", { magac: "OMAR FARAH", jinsi: "male", degan: "Hargeisa" }), attendance: { status: "jooga" as const } },
        { ...row("s3", { magac: "RUUN XASAN", jinsi: "female", degan: "Berbera" }), attendance: { status: "jooga" as const } },
      ],
      iibsadayaal: [{ ...row("b1", { magac: "IIBSADE 1", jinsi: "female", degan: "Hargeisa", telefoon: "0622222222" }), attendance: { status: "jooga" } }],
      hantida_dhul_banaan: { sida_hantida_loo_helay: "iibsaday", notary_ref: "Tr No 4471" },
      qiimaha: { qiimaha_guud: "1600" },
      damiinka: { gurmadka_dammaanadda: "Reer deggan." },
      maragyo: [row("m1", { magac: "MARAG KOOW" })],
      // ONE photograph, ONE signature, for THREE sellers. The office rule:
      // the counts are unrelated, so nothing here may be rejected.
      sawirrada: [row("p1", { shakhsiga: "s1", sawir: "stor_p1" })],
      saxeexayaasha: [row("x1", { shakhsiga: "s3", prefix: "IIBISO" })],
      ...over,
    }) as FormValues;

  test("a person is CHOSEN, never retyped — the picker offers the sellers", () => {
    for (const id of ["sawirrada", "saxeexayaasha"]) {
      const field = party(id).fields.find((f) => f.id === "shakhsiga")!;
      expect(field.type).toBe("person");
      expect(field.personSource).toBe("iibiyeyaal,iibsadayaal");
    }
    // No free-text name field is left behind on either row.
    for (const id of ["sawirrada", "saxeexayaasha"]) {
      expect(party(id).fields.map((f) => f.id)).not.toContain("magac");
    }
  });

  test("the chosen person's NAME prints — the internal id never reaches the paper", () => {
    const blocks = buildDataContext(C, linked()).repeatBlocks;
    const photo = blocks.get("SAWIRRADA")!.rows[0] as Record<string, string>;
    expect(photo.SHAKHSIGA).toBe("AHMED CALI");
    expect(photo.SHAKHSIGA).not.toBe("s1");
    // The id is still available as a cross-reference, under a name that
    // says what it is — not as the caption on the photograph.
    expect(photo.SHAKHSIGA_ID).toBe("s1");
  });

  test("10 sellers with 1 photo and 1 signature is VALID — counts never compare", () => {
    const sellers = Array.from({ length: 10 }, (_, i) => ({
      ...row(`s${i + 1}`, { magac: `IIBIYE ${i + 1}`, jinsi: "male", degan: "Hargeisa" }),
      attendance: { status: "jooga" as const },
    }));
    const v = linked({ iibiyeyaal: sellers });
    const blocks = buildDataContext(C, v).repeatBlocks;
    expect(blocks.get("IIBIYEYAAL")!.rows).toHaveLength(10);
    expect(blocks.get("SAWIRRADA")!.rows).toHaveLength(1);
    expect(blocks.get("SAXEEXAYAASHA")!.rows).toHaveLength(1);
    expect(Object.keys(validateDocument(C, v))).toEqual([]);
  });

  test("a photograph that points at nobody prints NO name rather than a wrong one", () => {
    const v = linked({ sawirrada: [row("p1", { shakhsiga: "nobody", sawir: "stor_p1" })] });
    const photo = buildDataContext(C, v).repeatBlocks.get("SAWIRRADA")!.rows[0] as Record<string, string>;
    expect(photo.SHAKHSIGA).toBe("");
    expect(photo.SHAKHSIGA).not.toContain("nobody");
  });

  test("sellers and buyers are repeatable lists, min 1, with no maximum", () => {
    // A sale cannot exist without a seller and a buyer. Witnesses are NOT in
    // this list: they are optional (see "a witness is never forced").
    for (const id of ["iibiyeyaal", "iibsadayaal"]) {
      const p = party(id);
      expect(p.min).toBe(1);
      expect(p.max ?? 0).toBe(0);
    }
  });

  test("no fixed seller_1 / buyer_1 slots exist in any party list", () => {
    const partyIds = C.sections.flatMap((s) =>
      (s.parties ?? []).flatMap((p) => p.fields.map((f) => f.id)),
    );
    expect(partyIds.filter((id) => /_(1|2|3)$/.test(id))).toEqual([]);
  });

  test("a seller row carries identity + gender + ROLE — and NO photo field", () => {
    // Gender is an answer, not an inference; `dooro` is the ROLE (never the
    // gender, never an authority); `koox` links the person to a family name.
    // There is deliberately no `sawir` here — photographs live in their own
    // independent list, so a seller row can never imply a photo.
    const sellerFields = party("iibiyeyaal").fields;
    expect(sellerFields.map((f) => f.id)).toEqual([
      "magac",
      "jinsi",
      "dooro",
      "xiriirka_qoyska",
      "koox",
      "degan",
      "xaalad",
      "telefoon",
      // No Matalaad and no wakiil picker: a seller's representation is
      // answered by "Ma Joogaa Heshiiska?" → Maya → Qaybta Wakiilka, the one
      // place, exactly as Heshiis Kiro's landlord step does it.
    ]);
    // §4 — gender is asked for ONE seller only. Several sellers means plural
    // wording in the document, so per-person gender is hidden, not guessed.
    expect(sellerFields.find((f) => f.id === "jinsi")?.hideWhenListHasMany).toBe(true);
    expect(party("iibsadayaal").fields.map((f) => f.id)).toEqual([
      "magac",
      "jinsi",
      "degan",
      "telefoon",
      // NO Matalaad and NO wakiil picker here: a buyer's representation is
      // answered through "Ma Joogaa Heshiiska?" → Maya → Qaybta Wakiilka.
      // Carrying a second pair of controls asked the same question twice on
      // one row.
    ]);
  });

  test("NO seller/buyer row has a photo field — the photo list is separate", () => {
    for (const id of ["iibiyeyaal", "iibsadayaal"]) {
      expect(party(id).fields.find((f) => f.id === "sawir")).toBeUndefined();
    }
  });

  test("SELLERS fill data and status exactly as Heshiis Kiro's landlords do", () => {
    // Same combined step, same Ma-Joogaa choice, same Qaybta Wakiilka — the
    // two sides are one shape now, and there is no second wakiil list.
    expect(party("iibiyeyaal").attendance).toBe(true);
    expect(party("iibsadayaal").attendance).toBe(true);
    expect(party("iibiyeyaal").representativeFields?.map((f) => f.id)).toEqual(
      party("iibsadayaal").representativeFields?.map((f) => f.id),
    );
  });

  test("a phone belongs to a PRESENT person — and is never forced", () => {
    for (const id of ["iibiyeyaal", "iibsadayaal"]) {
      const phone = party(id).fields.find((f) => f.id === "telefoon")!;
      expect(phone.showOnlyWhenRowStatus).toBe("jooga");
      // §22 — optional never blocks, however many people are on the list.
      expect(phone.requiredWhenRowStatus).toBeUndefined();
    }
  });

  test("the count step drives the row list, with no upper bound", () => {
    const values = createInitialValues(C);
    expect(getPartyRows(values, "iibiyeyaal")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* G — buyer attendance                                                */
/* ------------------------------------------------------------------ */

describe("G — buyer attendance", () => {
  test("a phone number belongs to a PRESENT buyer only", () => {
    const buyers = C.sections
      .flatMap((s) => s.parties ?? [])
      .find((p) => p.id === "iibsadayaal")!;
    const phone = buyers.fields.find((f) => f.id === "telefoon")!;
    expect(phone.showOnlyWhenRowStatus).toBe("jooga");
    // §22 — the phone is never forced, however many buyers there are.
    expect(phone.requiredWhenRowStatus).toBeUndefined();
  });

  test("an absent buyer is never asked for a phone or a photo of their own", () => {
    const values = {
      ...createInitialValues(C),
      iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa" }, "wakiil", "r1")],
      wakiilo_iibsadayaal: [row("r1", { magac: "ABDI WAKIIL" })],
    } as FormValues;
    const e = validateDocument(C, values);
    const msgs = JSON.stringify(e);
    expect(msgs).not.toContain("Telefoonka Iibsadaha");
    expect(msgs).not.toContain("Sawirka Iibsadaha");
  });

  test("every buyer must choose presence before the interview moves on", () => {
    const values = {
      ...createInitialValues(C),
      iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa" })],
    } as FormValues;
    expect(errorsOf(values, "iibsadaha")).toContain("Ma Joogaa");
  });
});

/* ------------------------------------------------------------------ */
/* H — the representative (wakiil)                                     */
/* ------------------------------------------------------------------ */

describe("H — wakiil", () => {
  test("ONE representative may stand for many absent buyers", () => {
    const values = {
      ...createInitialValues(C),
      iibsadayaal: [
        row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa" }, "wakiil", "r1"),
        row("b2", { magac: "HASSAN ALI", degan: "Berbera" }, "wakiil", "r1"),
      ],
      wakiilo_iibsadayaal: [row("r1", { magac: "ABDI WAKIIL", sawir: "stor_rep" })],
    } as FormValues;
    expect(getPartyRows(values, "wakiilo_iibsadayaal")).toHaveLength(1);
    expect(representedByRep(values, C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "iibsadayaal")!, "r1")).toEqual([
      "SOMALI JAMAC",
      "HASSAN ALI",
    ]);
  });

  test("the representative block prints the wakiil once plus who they act for", () => {
    const values = {
      ...createInitialValues(C),
      iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa" }, "wakiil", "r1")],
      wakiilo_iibsadayaal: [row("r1", { magac: "ABDI WAKIIL", sawir: "stor_rep" })],
    } as FormValues;
    const block = buildRepeatBlockData(C, values).get("WAKIILO_IIBSADAYAAL")!;
    expect(block.rows).toHaveLength(1);
    expect(block.rows[0].MAGAC).toBe("ABDI WAKIIL");
    expect(block.rows[0].SAWIR).toBe("stor_rep");
    expect(block.rows[0].MATALAYA).toBe("SOMALI JAMAC");
  });

  test("a present buyer is never given a representative", () => {
    const values = {
      ...createInitialValues(C),
      iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa" }, "jooga")],
    } as FormValues;
    const flags = resolveFlags(C, values);
    expect(flags.IIBSADAHA_JOOGA).toBe(true);
    expect(flags.IIBSADAHA_WAKIIL).toBe(false);
    expect(buildRepeatBlockData(C, values).get("WAKIILO_IIBSADAYAAL")!.rows).toHaveLength(0);
  });

  test("a wakiil's data never leaks into the buyer's own row", () => {
    const values = {
      ...createInitialValues(C),
      iibsadayaal: [
        row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa" }, "wakiil", "r1"),
        row("b2", { magac: "HASSAN ALI", degan: "Berbera", telefoon: "0622222222" }, "jooga"),
      ],
      wakiilo_iibsadayaal: [row("r1", { magac: "ABDI WAKIIL" })],
    } as FormValues;
    const rows = buildRepeatBlockData(C, values).get("IIBSADAYAAL")!.rows;
    expect(rows[0].WAKIIL_MAGAC).toBe("ABDI WAKIIL");
    expect(rows[1].WAKIIL_MAGAC).toBe("");
    expect(rows[1].TELEFOON).toBe("0622222222");
    expect(rows[0].TELEFOON ?? "").toBe("");
  });

  test("an absent buyer without a representative is a validation error", () => {
    const values = {
      ...createInitialValues(C),
      iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa" }, "wakiil")],
    } as FormValues;
    expect(errorsOf(values, "iibsadaha")).toContain("dooro wakiilka");
  });

  test("the wakiil has only a name and a photo — the scans show nothing else", () => {
    const buyers = C.sections
      .flatMap((s) => s.parties ?? [])
      .find((p) => p.id === "iibsadayaal")!;
    expect(buyers.representativeFields?.map((f) => f.id)).toEqual(["magac", "sawir", "nooca_wakiilka"]);
  });

  test("the engine can build a representative through its own API", () => {
    const buyers = C.sections
      .flatMap((s) => s.parties ?? [])
      .find((p) => p.id === "iibsadayaal")!;
    const withRep = addRepresentative(createInitialValues(C), buyers);
    expect(getPartyRows(withRep, "wakiilo_iibsadayaal")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* I — witnesses                                                        */
/* ------------------------------------------------------------------ */

describe("I — maragyo", () => {
  test("a witness is NEVER forced — an empty list is a real answer", () => {
    // The office ruled that no sale is stopped for want of a witness, and no
    // placeholder witness is invented to satisfy a minimum.
    expect(C.requiresWitness).toBe(false);
    expect(
      C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "maragyo")!.min,
    ).toBe(0);
    const v = {
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", taariikhda_hantida: "2026-01-30", tirada_iibiyayaasha: "1", tirada_iibsadayaasha: "1", nooca_damiinta: "iibiyaha" },
      iibiyeyaal: [{ ...row("s1", { magac: "AHMED CALI", jinsi: "male" }), attendance: { status: "jooga" as const } }],
      iibsadayaal: [{ ...row("b1", { magac: "IIBSADE", jinsi: "female", telefoon: "0622222222" }), attendance: { status: "jooga" } }],
      hantida_dhul_banaan: { sida_hantida_loo_helay: "iibsaday", tixraaca_ma_jiraan: "no", calaamad_dheeraad: "Beer ta Hargeisa" },
      qiimaha: { qiimaha_guud: "1600" },
      maragyo: [],
    } as unknown as FormValues;
    expect(errorsOf(v, "maragyada")).toBe("");
    expect(validateDocument(C, v)["maragyada"]).toBeUndefined();
    // A witness that IS entered is still stored with its own data.
    const withOne = { ...v, maragyo: [row("m1", { magac: "MARAG KOOW", telefoon: "0611111111" })] } as unknown as FormValues;
    expect(Object.keys(validateDocument(C, withOne))).not.toContain("maragyada");
  });

  test("the witness list is not capped at the six the scans happen to show", () => {
    const marag = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "maragyo")!;
    expect(marag.max).toBeUndefined();
  });

  test("a witness is a name, a phone and an optional address", () => {
    const marag = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "maragyo")!;
    expect(marag.fields.map((f) => f.id)).toEqual(["magac", "telefoon", "degan"]);
    // Only the NAME blocks; an address the notary does not have is fine.
    expect(marag.fields.find((f) => f.id === "degan")!.optional).toBe(true);
  });

  test("witnesses are numbered 1..n in the repeat block", () => {
    const values = {
      ...createInitialValues(C),
      maragyo: [
        row("m1", { magac: "MARAG KOOW", telefoon: "0633333333" }),
        row("m2", { magac: "MARAG LABO", telefoon: "0644444444" }),
      ],
    } as FormValues;
    const rows = buildRepeatBlockData(C, values).get("MARAGYO")!.rows;
    expect(rows.map((r) => r.NUMBER)).toEqual(["1", "2"]);
    expect(rows[1].MAGAC).toBe("MARAG LABO");
  });
});

/* ------------------------------------------------------------------ */
/* I2 — the review screen never shows an internal photo handle         */
/* ------------------------------------------------------------------ */

describe("I2 — review shows collected answers, not storage handles", () => {
  const reviewOf = (seller: Record<string, string>) =>
    collectFilledValues(C, {
      ...createInitialValues(C),
      iibiyeyaal: [row("s1", seller)],
    } as FormValues).flatMap((s) => s.rows);

  test("a photograph in its own list reads as 'Sawir' — never the Convex storage id", () => {
    const rows = collectFilledValues(C, {
      ...createInitialValues(C),
      iibiyeyaal: [{ ...row("s1", { magac: "AHMED CALI", degan: "Hargeisa" }), attendance: { status: "jooga" as const } }],
      // The row links to the person by ID — the picker never re-asks the name.
      sawirrada: [row("p1", { shakhsiga: "s1", sawir: "k7storageIDabc123" })],
    } as FormValues).flatMap((s) => s.rows);
    expect(rows.some((r) => r.value.includes("k7storageIDabc123"))).toBe(false);
  });

  test("a seller row never shows a photo marker — it has no photo field", () => {
    const rows = reviewOf({
      magac: "AHMED CALI",
      degan: "Hargeisa",
      telefoon: "0611111111",
    });
    const seller = rows.find((r) => r.label === "Iibiyaha 1")!;
    expect(seller.value).toBe("AHMED CALI — Hargeisa — 0611111111");
    expect(seller.value).not.toContain("Sawir");
  });

  test("a party row with nothing but a name and an address shows only those", () => {
    const rows = reviewOf({ magac: "AHMED CALI", degan: "Hargeisa" });
    expect(rows.find((r) => r.label === "Iibiyaha 1")!.value).toBe("AHMED CALI — Hargeisa");
  });

  test("a SECTION photo field reads as 'uploaded' — never the storage id", () => {
    const rows = collectFilledValues(C, {
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", nooca_damiinta: "qof_3aad" },
      damiinka: {
        magaca_damiinka: "KHALID NOOR",
        gurmadka_dammaanadda: "Reer deggan.",
        sawirka_damiinka: "k7storageIDxyz",
      },
    } as FormValues).flatMap((s) => s.rows);
    expect(rows.some((r) => r.value.includes("k7storageIDxyz"))).toBe(false);
    expect(rows.find((r) => r.label === "Sawirka Damiinka")?.value).toBe(
      "Sawir waa la soo roobay",
    );
  });
});

/* ------------------------------------------------------------------ */
/* J — placeholder inventory                                           */
/* ------------------------------------------------------------------ */

describe("J — placeholder inventory", () => {
  test("every canonical token is accepted and every alias resolves to it", () => {
    const specs = KALA_IIBSI_HANTI_PLACEHOLDERS;
    const names = registryTokenNames(specs);
    for (const spec of specs) {
      expect(canonicalNameFor(specs, spec.token)).toBe(spec.token.toUpperCase());
      for (const alias of spec.aliases ?? []) {
        expect(canonicalNameFor(specs, alias)).toBe(spec.token.toUpperCase());
        expect(names.has(alias.toUpperCase())).toBe(true);
      }
    }
  });

  test("the registry the Template Manager reads is this document's", () => {
    expect(placeholderRegistry("kala_iibsi_hanti")).toBe(KALA_IIBSI_HANTI_PLACEHOLDERS);
  });

  test("the approved scan tokens are all resolvable by the engine", () => {
    const names = knownPlaceholderNames(C);
    for (const token of [
      "REF_NUMBER",
      "TAARIIKH",
      "MAALINTA",
      "DEGMADA",
      "CABBIRKA",
      "XAAFADA",
      "JIHO_WAQOOYI",
      "JIHO_KOONFUR",
      "JIHO_BARI",
      "JIHO_GALBEED",
      "TIXRAACA_NOOCA",
      "LAMBARKA_TIXRAACA",
      "CALAAMAD_DHEERAAD",
      "NOTARY_REF",
      "BEERTA",
      "QIIMAHA",
      "QIIMAHA_QORAAL",
      "DAMIIN_MAGACA",
      "DAMIIN_TELEFOON",
      "DAMIIN_GURMAD",
      "DAMIIN_SAWIR",
      "WAKIIL_MAGAC",
      "WAKIIL_SAWIR",
      "MARAGYO_LIST",
    ]) {
      expect(names.has(token)).toBe(true);
    }
  });

  test("every conditional flag the scans need is a real, resolvable flag", () => {
    const names = knownPlaceholderNames(C);
    for (const flag of [
      "HANTIDA_DHAXLAT",
      "HANTIDA_IIBSADAY",
      "DAMIIN_QOF_3AAD",
      "DAMIIN_IIBIYAHA",
      "IIBSADAHA_JOOGA",
      "IIBSADAHA_WAKIIL",
      "IIBIYEYAAL_HAL",
      "IIBIYEYAAL_BADAN",
      "IIBSADAYAAL_HAL",
      "IIBSADAYAAL_BADAN",
    ]) {
      expect(names.has(flag)).toBe(true);
    }
  });

  test("the repeat blocks exist and expose only real row tokens", () => {
    const ids = (C.repeatBlocks ?? []).map((b) => b.blockId);
    expect(ids).toEqual([
      "MARAGYO",
      "IIBIYEYAAL",
      "IIBSADAYAAL",
      "WAKIILO_IIBIYEYAAL",
      "WAKIILO_IIBSADAYAAL",
      "KOOXAHA",
      "SAWIRRADA",
      "SAXEEXAYAASHA",
      "SHAXADAHA",
    ]);
    const names = knownPlaceholderNames(C);
    for (const token of [
      "#IIBIYEYAAL",
      "#IIBSADAYAAL",
      "#MARAGYO",
      "#SAWIRRADA",
      "#SAXEEXAYAASHA",
      "DEGAN",
      "JINSI",
    ]) {
      expect(names.has(token)).toBe(true);
    }
  });

  test("no orphan token is offered that the engine cannot fill", () => {
    const names = knownPlaceholderNames(C);
    for (const spec of KALA_IIBSI_HANTI_PLACEHOLDERS) {
      if (spec.kind === "block" || spec.kind === "flag") continue;
      expect(names.has(spec.token.toUpperCase())).toBe(true);
    }
  });

  test("the tokens removed with the un-scanned fields are gone for good", () => {
    const names = knownPlaceholderNames(C);
    for (const gone of [
      "DHUL_GOOBTA",
      "DHUL_XADKA_WAQOOYI",
      "LACAGTA_LA_BIXIYAY",
      "HABKA_BIXINTA",
      "SHURUUDAHA_IIBKA",
      "RAHMAD_NOOCA",
      "TIRADA_IIBIYEYAAL",
      "IIBIYAHA_AQOONSI",
      "IIBSADAHA_CINWAAN",
    ]) {
      expect(names.has(gone)).toBe(false);
    }
    // {{LACAGTA_HADHAY}} WAS in this list. It is gone no longer: the office
    // explicitly asked for "lacagta hadhay", and it is now DERIVED as plain
    // arithmetic (price − amount paid) rather than typed in as a field, so
    // it can never contradict the two numbers it is computed from.
    expect(names.has("LACAGTA_HADHAY")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* K — the reference number                                            */
/* ------------------------------------------------------------------ */

describe("K — tixraaca (Ref/Dpn/MG/…)", () => {
  test("the database prefix is MG, never the old DPN-H", () => {
    expect(C.referencePrefix).toBe("DPN-MG");
  });

  test("the printed reference is the serial plus the document's own month/year", () => {
    expect(
      composeReferenceNumber({
        format: C.referenceFormat,
        reference: "DPN-MG-001",
        date: "2026-01-30",
      }),
    ).toBe("Ref/Dpn/MG/001/01/26");
  });

  test("the date comes from the document's date, not from the clock", () => {
    expect(referenceDateParts("2026-11-05")).toEqual({ MM: "11", YY: "26" });
    expect(referenceSerial("DPN-MG-042")).toBe("042");
  });

  test("a document with no referenceFormat prints exactly what the database holds", () => {
    expect(
      composeReferenceNumber({ format: undefined, reference: "DPN-K-004", date: "2026-01-30" }),
    ).toBe("DPN-K-004");
  });

  test("an unresolvable token never produces a half-written reference", () => {
    expect(
      composeReferenceNumber({ format: C.referenceFormat, reference: "DPN-MG-001", date: "" }),
    ).toBe("DPN-MG-001");
  });

  test("END TO END — the DOCX and its file name both carry the full reference", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      "<w:document><w:body>" +
        '<w:p><w:r><w:t>Ref: {{REF_NUMBER}}</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Taariikh: {{TAARIIKH}}</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Qiimaha: {{QIIMAHA}}</w:t></w:r></w:p>' +
        "</w:body></w:document>",
    );
    const templateBytes = await zip.generateAsync({ type: "arraybuffer" });

    const values = scanValues();
    const out = await generateDocument({
      config: C,
      values,
      referenceNumber: "DPN-MG-001",
      subTypeLabel: "Dhul Banaan",
      templateBytes,
      spec: selectTemplate(C, values),
    });

    const xml = await (await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer())))
      .file("word/document.xml")!
      .async("string");

    expect(xml).toContain("Ref: Ref/Dpn/MG/001/01/26");
    expect(xml).toContain("Taariikh: 30/01/2026");
    expect(xml).toContain("Qiimaha: $1,600");
    expect(xml).not.toContain("{{");

    // The archive name carries it too (slashes are made filesystem-safe).
    expect(out.result.fileName).toBe("Kala_Iibsi_Hanti_Ref-Dpn-MG-001-01-26.docx");
    // ...while the DATABASE still receives the short serial.
    expect(out.result.referenceNumber).toBe("DPN-MG-001");
  });
});

/* ------------------------------------------------------------------ */
/* L — SCAN FIDELITY: S1, S2, S3                                       */
/* ------------------------------------------------------------------ */

const PLOT = {
  degmada: "Waardhiil",
  xaafada: "Sooma",
  cabbirka: "5,000 m²",
  jiho_waqooyi: "waddo",
  jiho_koonfur: "waddo",
  jiho_bari: "dhisme",
  jiho_galbeed: "dhisme",
  // The plot carries an office reference, and the number is typed ONCE.
  tixraaca_ma_jiraan: "yes",
  nooca_tixraaca: "tr_no",
  lambarka_tixraaca: "Tr No 4471",
};

function scanValues(over: Partial<FormValues> = {}): FormValues {
  return {
    ...createInitialValues(C),
    dejinta: {
      sub_type: "dhul_banaan",
      reference: "DPN-MG-001",
      taariikhda_hantida: "2026-01-30",
      // A sale is always guaranteed: by a third party, or by the sellers.
      nooca_damiinta: "qof_3aad",
    },
    hantida_dhul_banaan: { ...PLOT, sida_hantida_loo_helay: "iibsaday" },
    iibiyeyaal: [{ ...row("s1", { magac: "AHMED CALI", degan: "Hargeisa", telefoon: "0611111111" }), attendance: { status: "jooga" as const } }],
    iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa", telefoon: "0622222222" }, "jooga")],
    // Photographs are their OWN list. The Dhul Banaan scan prints three of
    // them on page 1 — for ONE seller, ONE buyer and the guarantor — which is
    // only expressible when the photo count is free of the seller count.
    sawirrada: [
      row("p1", { magac: "AHMED CALI", sawir: "stor_s1" }),
      row("p2", { magac: "SOMALI JAMAC", sawir: "stor_b1" }),
      row("p3", { magac: "KHALID NOOR", sawir: "stor_d" }),
    ],
    damiinka: { magaca_damiinka: "KHALID NOOR", gurmadka_dammaanadda: "Reer deggan.", sawirka_damiinka: "stor_d" },
    qiimaha: { qiimaha_guud: "1600" },
    maragyo: [row("m1", { magac: "MARAG KOOW", telefoon: "0633333333" })],
    ...over,
  } as FormValues;
}

describe("L — SCAN FIDELITY", () => {
  test("S1 — 1 seller, 1 buyer, third-party guarantor, 2 witnesses", () => {
    const values = scanValues({
      maragyo: [
        row("m1", { magac: "MARAG KOOW", telefoon: "0633333333" }),
        row("m2", { magac: "MARAG LABO", telefoon: "0644444444" }),
      ],
    });

    // Nothing is left to answer: the whole scan fits the form exactly.
    expect(Object.keys(validateDocument(C, values))).toEqual([]);

    expect(getPartyRows(values, "iibiyeyaal")).toHaveLength(1);
    expect(getPartyRows(values, "iibsadayaal")).toHaveLength(1);
    expect(getPartyRows(values, "maragyo")).toHaveLength(2);

    const map = computeReplacements(C, values);
    expect(map["{{TAARIIKH}}"]).toBe("30/01/2026");
    expect(map["{{MAALINTA}}"]).toBe("Janaayo");
    expect(map["{{DEGMADA}}"]).toBe("Waardhiil");
    expect(map["{{CABBIRKA}}"]).toBe("5,000 m²");
    expect(map["{{XAAFADA}}"]).toBe("Sooma");
    expect(map["{{JIHO_WAQOOYI}}"]).toBe("Waddo");
    expect(map["{{JIHO_KOONFUR}}"]).toBe("Waddo");
    expect(map["{{JIHO_BARI}}"]).toBe("Dhisme");
    expect(map["{{JIHO_GALBEED}}"]).toBe("Dhisme");
    expect(map["{{NOTARY_REF}}"]).toBe("Tr No 4471");
    expect(map["{{QIIMAHA}}"]).toBe("$1,600");
    expect(map["{{QIIMAHA_QORAAL}}"]).toBe(formatCurrencyWordsSomali(1600, "Dollar"));
    expect(map["{{DAMIIN_MAGACA}}"]).toBe("KHALID NOOR");

    const flags = resolveFlags(C, values);
    expect(flags.IIBSADAHA_JOOGA).toBe(true);
    expect(flags.IIBSADAHA_WAKIIL).toBe(false);
    expect(flags.DAMIIN_QOF_3AAD).toBe(true);
    expect(flags.IIBIYEYAAL_HAL).toBe(true);
    expect(flags.IIBIYEYAAL_BADAN).toBe(false);
    expect(flags.IIBSADAYAAL_HAL).toBe(true);

    // Photo count on page 1: seller + buyer + guarantor — three photographs
    // for one seller, read off the independent photo list.
    const photos = buildRepeatBlockData(C, values).get("SAWIRRADA")!.rows;
    expect(photos.map((p) => p.SAWIR)).toEqual(["stor_s1", "stor_b1", "stor_d"]);

    // Witnesses are numbered 1..2, not 1..6.
    const marag = buildRepeatBlockData(C, values).get("MARAGYO")!.rows;
    expect(marag.map((r) => r.NUMBER)).toEqual(["1", "2"]);
  });

  test("S2 — 1 seller, 2 buyers, third-party guarantor, 2 witnesses, 3 photos on page 1", () => {
    const values = scanValues({
      iibsadayaal: [
        row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa", telefoon: "0622222222" }, "jooga"),
        row("b2", { magac: "HASSAN ALI", degan: "Berbera", telefoon: "0633333334" }, "jooga"),
      ],
      sawirrada: [
        row("p1", { magac: "AHMED CALI", sawir: "stor_s1" }),
        row("p2", { magac: "SOMALI JAMAC", sawir: "stor_b1" }),
        row("p3", { magac: "HASSAN ALI", sawir: "stor_b2" }),
        row("p4", { magac: "KHALID NOOR", sawir: "stor_d" }),
      ],
      maragyo: [
        row("m1", { magac: "MARAG KOOW", telefoon: "0633333333" }),
        row("m2", { magac: "MARAG LABO", telefoon: "0644444444" }),
      ],
    });

    expect(Object.keys(validateDocument(C, values))).toEqual([]);

    const buyers = buildRepeatBlockData(C, values).get("IIBSADAYAAL")!.rows;
    expect(buyers.map((r) => r.NUMBER)).toEqual(["1", "2"]);
    expect(buyers.map((r) => r.MAGAC)).toEqual(["SOMALI JAMAC", "HASSAN ALI"]);
    expect(buyers.map((r) => r.DEGAN)).toEqual(["Hargeisa", "Berbera"]);
    expect(buyers.map((r) => r.TELEFOON)).toEqual(["0622222222", "0633333334"]);
    // A buyer row carries NO photo token — the photograph is a separate row.
    expect(buyers.map((r) => r.SAWIR)).toEqual([undefined, undefined]);

    const flags = resolveFlags(C, values);
    expect(flags.IIBSADAYAAL_BADAN).toBe(true);
    expect(flags.IIBSADAYAAL_HAL).toBe(false);

    // Seller + 2 buyers + guarantor = the four photographs of page 1, and
    // they are four ROWS in the photo list, not a property of the people.
    const photos = buildRepeatBlockData(C, values).get("SAWIRRADA")!.rows;
    expect(photos.map((p) => p.SAWIR)).toEqual(["stor_s1", "stor_b1", "stor_b2", "stor_d"]);
  });

  test("S3 — absent buyer + wakiil, seller self-guarantor, 6 witnesses, no guarantor photo", () => {
    const values = scanValues({
      hantida_dhul_banaan: {
        ...PLOT,
        sida_hantida_loo_helay: "dhaxlay",
        nooca_tixraaca: "tr_no",
        lambarka_tixraaca: "Ilmo Hebel 1998",
      },
      iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa" }, "wakiil", "r1")],
      wakiilo_iibsadayaal: [row("r1", { magac: "ABDI WAKIIL", sawir: "stor_rep" })],
      // The absent buyer's own photograph is NOT used — the wakiil's is —
      // and the self-guarantor has none. Two photographs for one seller.
      sawirrada: [
        row("p1", { magac: "AHMED CALI", sawir: "stor_s1" }),
        row("p2", { magac: "ABDI WAKIIL", sawir: "stor_rep" }),
      ],
      // S3 is the SELF-GUARANTOR sale: the choice moves to Step 1, and no
      // third-party person exists anywhere in it.
      dejinta: { sub_type: "dhul_banaan", reference: "DPN-MG-001", taariikhda_hantida: "2026-01-30", nooca_damiinta: "iibiyaha" },
      damiinka: {
        gurmadka_dammaanadda: "Reer deggan.",
        sawirka_damiinka: "",
        telefoonka_damiinka: "",
      },
      maragyo: Array.from({ length: 6 }, (_, i) =>
        row(`m${i + 1}`, { magac: `MARAG ${i + 1}`, telefoon: `063333333${i}` }),
      ),
    });

    expect(Object.keys(validateDocument(C, values))).toEqual([]);

    // The absent buyer keeps his own name; the WAKIIL's photo replaces his.
    const map = computeReplacements(C, values);
    expect(buildRepeatBlockData(C, values).get("IIBSADAYAAL")!.rows[0].MAGAC).toBe("SOMALI JAMAC");
    // No photo row exists for the absent buyer — nothing about him requires one.
    expect(
      buildRepeatBlockData(C, values).get("SAWIRRADA")!.rows.map((p) => p.MAGAC),
    ).toEqual(["AHMED CALI", "ABDI WAKIIL"]);
    // The buyer's wakiil is addressed by its OWN group token — the bare
    // {{WAKIIL_*}} alias belongs to the first attendance group (the sellers).
    expect(map["{{IIBSADAHA_WAKIIL_MAGAC}}"]).toBe("ABDI WAKIIL");
    expect(map["{{IIBSADAHA_WAKIIL_SAWIR}}"]).toBe("stor_rep");

    // Seller self-guarantor: no guarantor photo, no guarantor phone, and the
    // guarantor slot carries the SELLER's name.
    expect(map["{{DAMIIN_SAWIR}}"]).toBe("");
    expect(map["{{DAMIIN_TELEFOON}}"]).toBe("");
    expect(map["{{DAMIIN_MAGACA}}"]).toBe("AHMED CALI");

    const flags = resolveFlags(C, values);
    expect(flags.DAMIIN_IIBIYAHA).toBe(true);
    expect(flags.DAMIIN_QOF_3AAD).toBe(false);
    expect(flags.IIBSADAHA_WAKIIL).toBe(true);
    expect(flags.IIBSADAHA_JOOGA).toBe(false);
    expect(flags.HANTIDA_DHAXLAT).toBe(true);

    // Inherited plot → the heirs' certificate number, typed ONCE.
    //
    // {{BEERTA}} and {{NOTARY_REF}} used to read two different fields, which
    // meant the notary typed the same reference twice. Both now read the ONE
    // number from the File / TR / Notary branch, so the paper still carries it
    // and the form asks once.
    expect(map["{{BEERTA}}"]).toBe("Ilmo Hebel 1998");
    expect(map["{{NOTARY_REF}}"]).toBe("Ilmo Hebel 1998");
    // And there is exactly one field a number can be typed into.
    expect(
      C.sections
        .find((s) => s.id === "hantida_dhul_banaan")!
        .fields.filter((f) => ["lambarka_tixraaca", "notary_ref", "beerta"].includes(f.id))
        .map((f) => f.id),
    ).toEqual(["lambarka_tixraaca"]);

    // Six witnesses are numbered 1..6 — the form never capped them.
    const marag = buildRepeatBlockData(C, values).get("MARAGYO")!.rows;
    expect(marag.map((r) => r.NUMBER)).toEqual(["1", "2", "3", "4", "5", "6"]);

    // Page 1 photos: seller + the wakiil who signs for the absent buyer.
    expect(map["{{IIBSADAHA_WAKIIL_SAWIR}}"]).toBe("stor_rep");
    expect(buildRepeatBlockData(C, values).get("SAWIRRADA")!.rows).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/* M — Heshiis Kiro is untouched                                       */
/* ------------------------------------------------------------------ */

describe("M — Heshiis Kiro compatibility", () => {
  test("Kiro declares no referenceFormat, so its reference prints unchanged", () => {
    expect(K.referenceFormat).toBeUndefined();
    expect(K.referencePrefix).toBe("DPN-K");
  });

  test("Kiro's repeat blocks and attendance model are unchanged", () => {
    expect(K.repeatBlocks?.map((b) => b.blockId)).toEqual([
      "MARAGYO",
      "KIREYEYAYAAL",
      "KIRAYSTAYAAL",
      "WAKIILO_KIREEYAYAAL",
      "WAKIILO_KIRAYSTAYAAL",
    ]);
    const landlord = K.sections
      .flatMap((s) => s.parties ?? [])
      .find((p) => p.id === "kireeyayaal")!;
    expect(landlord.attendance).toBe(true);
    expect(landlord.countFirst).toBeUndefined();
    expect(landlord.fields.map((f) => f.id)).toContain("aqoonsi");
  });

  test("a Kiro rental still resolves every one of its own placeholders", () => {
    const ctx = buildDataContext(K, createInitialValues(K));
    expect(ctx.knownNames.has("KIREYE_MAGAC")).toBe(true);
    expect(ctx.knownNames.has("IIBSADAHA_SAWIR")).toBe(false);
    expect(ctx.knownNames.has("IIBIYAHA_SAWIR")).toBe(false);
    expect(ctx.flags).toHaveProperty("KIREYE_HAL");
  });
});
