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
  createInitialValues,
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

  test("Dhul Banaan, Guri and Beer are all offered", () => {
    expect(C.subTypes.map((s) => s.value)).toEqual([
      "dhul_banaan",
      "guri",
      "beer",
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
      dejinta: { sub_type: "dhul_banaan", taariikhda_hantida: "2026-01-30" },
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
      "Dejinta Hantida",
      "Iibiyaha",
      "Tirada Iibiyayaal",
      "Iibiyayaal",
      "Kooxa / Qoysku Iibiyaha",
      "Tirada Kooxaha",
      "Kooxaha",
      "Wakiillada",
      "Tirada Wakiillo",
      "Wakiillo",
      "Tirada Iibsadayaal",
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
    ]);
  });

  test("the seller count is asked in its OWN step, before the seller rows", () => {
    const steps = buildConditionalWorkflow(C, {
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", taariikhda_hantida: "2026-01-30" },
    } as FormValues);
    const count = steps.findIndex((s) => s.detail.kind === "party-count" && s.detail.partyDef.id === "iibiyeyaal");
    const data = steps.findIndex((s) => s.detail.kind === "party-data" && s.detail.partyDef.id === "iibiyeyaal");
    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThan(data);
  });

  test("the plot section is Dhul Banaan-only — Guri sees its own section", () => {
    const forSub = (sub: string) =>
      buildConditionalWorkflow(C, {
        ...createInitialValues(C),
        dejinta: { sub_type: sub, taariikhda_hantida: "2026-01-30" },
      } as FormValues).map((s) => s.short);
    expect(forSub("guri")).toContain("Faahfaahinta Guriga");
    expect(forSub("guri")).not.toContain("Faahfaahinta Dhulka");
    expect(forSub("dhul_banaan")).not.toContain("Faahfaahinta Guriga");
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
    expect(ids(plotSection)).toEqual([
      "degmada",
      "xaafada",
      "cabbirka",
      "jiho_1",
      "jiho_2",
      "jiho_3",
      "soohdimaha",
      "sida_hantida_loo_helay",
      "notary_ref",
      "beerta",
    ]);
    expect(plotSection.fields.find((f) => f.id === "soohdimaha")?.optional).toBe(true);
  });

  test("the reference is NOT a form question — the system allocates it", () => {
    const setup = C.sections.find((s) => s.id === "dejinta")!;
    expect(setup.fields.map((f) => f.id)).toEqual(["sub_type", "taariikhda_hantida"]);
  });

  test("degmada / xaafada / cabbirka / jiho_1..3 are required", () => {
    for (const id of ["degmada", "xaafada", "cabbirka", "jiho_1", "jiho_2", "jiho_3"]) {
      expect(plotSection.fields.find((f) => f.id === id)?.validation?.required).toBe(true);
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

  test("DHAXLAY → the beerta is required and the notary ref is not", () => {
    const errs = errorsOf(withProof({ sida_hantida_loo_helay: "dhaxlay" }), "hantida_dhul_banaan");
    expect(errs).toContain("Beerta");
    expect(errs).not.toContain("Notary");
  });

  test("IIBSADAY → the notary ref is required and the beerta is not", () => {
    const errs = errorsOf(
      withProof({ sida_hantida_loo_helay: "iibsaday" }),
      "hantida_dhul_banaan",
    );
    expect(errs).toContain("Notary");
    expect(errs).not.toContain("Beerta");
  });

  test("one proof given → the section validates clean", () => {
    expect(
      errorsOf(
        withProof({ sida_hantida_loo_helay: "dhaxlay", beerta: "Ilmo Hebel 1998" }),
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

describe("E — dammaanadda (always present)", () => {
  const dam = (over: Record<string, string>): FormValues =>
    ({
      ...createInitialValues(C),
      dejinta: { sub_type: "dhul_banaan", reference: "DPN-MG-001", taariikhda_hantida: "2026-01-30" },
      iibiyeyaal: [row("s1", { magac: "AHMED CALI", degan: "Hargeisa", telefoon: "0611111111" })],
      damiinka: { gurmadka_dammaanadda: "Reer deggan oo la dhisay.", ...over },
    }) as FormValues;

  test("the nooca dammaanadda choice is required — there is no 'no guarantor' state", () => {
    const section = C.sections.find((s) => s.id === "damiinka")!;
    expect(section.visibleWhen).toBeUndefined();
    expect(section.fields.find((f) => f.id === "nooca_damiinta")?.validation?.required).toBe(
      true,
    );
    expect(section.fields.find((f) => f.id === "nooca_damiinta")?.options?.map((o) => o.value)).toEqual([
      "qof_3aad",
      "iibiyaha",
    ]);
  });

  test("the gurmad is required in BOTH states — the pledge is always given", () => {
    expect(
      errorsOf(dam({ nooca_damiinta: "qof_3aad", magaca_damiinka: "KHALID NOOR" }), "damiinka"),
    ).toBe("");
    expect(errorsOf(dam({ nooca_damiinta: "iibiyaha" }), "damiinka")).toBe("");
  });

  test("a third-party guarantor must be named — his phone stays optional (S1 has none)", () => {
    const errs = errorsOf(dam({ nooca_damiinta: "qof_3aad" }), "damiinka");
    expect(errs).toContain("Magaca Damiinka");
    const phone = C.sections
      .find((s) => s.id === "damiinka")!
      .fields.find((f) => f.id === "telefoonka_damiinka");
    expect(phone?.optional).toBe(true);
  });

  test("DAMIIN_MAGACA is ONE token with ONE value: the guarantor, or the seller", () => {
    const third = computeReplacements(
      C,
      dam({ nooca_damiinta: "qof_3aad", magaca_damiinka: "KHALID NOOR" }),
    );
    expect(third["{{DAMIIN_MAGACA}}"]).toBe("KHALID NOOR");

    const self = computeReplacements(C, dam({ nooca_damiinta: "iibiyaha" }));
    expect(self["{{DAMIIN_MAGACA}}"]).toBe("AHMED CALI");
  });

  test("the seller self-guarantor branch creates no guarantor photo / phone / signature data", () => {
    const self = computeReplacements(
      C,
      dam({ nooca_damiinta: "iibiyaha", sawirka_damiinka: "", telefoonka_damiinka: "" }),
    );
    expect(self["{{DAMIIN_SAWIR}}"]).toBe("");
    expect(self["{{DAMIIN_TELEFOON}}"]).toBe("");
    expect(resolveFlags(C, dam({ nooca_damiinta: "iibiyaha" })).DAMIIN_IIBIYAHA).toBe(true);
    expect(resolveFlags(C, dam({ nooca_damiinta: "iibiyaha" })).DAMIIN_QOF_3AAD).toBe(false);
  });

  test("the guarantor photo is asked ONLY for a third party", () => {
    const sawir = C.sections
      .find((s) => s.id === "damiinka")!
      .fields.find((f) => f.id === "sawirka_damiinka");
    expect(sawir?.visibleWhen).toEqual({
      op: "equals",
      field: "damiinka.nooca_damiinta",
      value: "qof_3aad",
    });
  });

  test("the stored guarantor type never prints raw", () => {
    const map = computeReplacements(C, dam({ nooca_damiinta: "iibiyaha" }));
    expect(map["{{NOOCA_DAMIINTA}}"]).toBe("Iibiyaha oo is-damiinaya");
  });
});

/* ------------------------------------------------------------------ */
/* F — repeatable parties, never fixed fields                         */
/* ------------------------------------------------------------------ */

describe("F — repeatable parties", () => {
  const party = (id: string) =>
    C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === id)!;

  test("sellers and buyers are repeatable lists, min 1, with no maximum", () => {
    for (const id of ["iibiyeyaal", "iibsadayaal", "maragyo"]) {
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
    expect(party("iibiyeyaal").fields.map((f) => f.id)).toEqual([
      "magac",
      "jinsi",
      "dooro",
      "koox",
      "degan",
      "telefoon",
      "nooca_matalaada",
      "wakiil",
    ]);
    expect(party("iibsadayaal").fields.map((f) => f.id)).toEqual([
      "magac",
      "jinsi",
      "degan",
      "telefoon",
      "nooca_matalaada",
      "wakiil",
    ]);
  });

  test("NO seller/buyer row has a photo field — the photo list is separate", () => {
    for (const id of ["iibiyeyaal", "iibsadayaal"]) {
      expect(party(id).fields.find((f) => f.id === "sawir")).toBeUndefined();
    }
  });

  test("SELLERS carry no attendance — a seller always signs his own sale", () => {
    expect(party("iibiyeyaal").attendance).toBeUndefined();
    expect(party("iibsadayaal").attendance).toBe(true);
  });

  test("a seller's phone carries NO row-status rule — a seller has no attendance to gate on", () => {
    const sellerPhone = party("iibiyeyaal").fields.find((f) => f.id === "telefoon")!;
    expect(sellerPhone.showOnlyWhenRowStatus).toBeUndefined();
    expect(sellerPhone.requiredWhenRowStatus).toBeUndefined();
    // The buyer's ARE gated — an absent buyer is represented by a wakiil.
    expect(party("iibsadayaal").fields.find((f) => f.id === "telefoon")!.showOnlyWhenRowStatus).toBe(
      "jooga",
    );
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
    expect(phone.requiredWhenRowStatus).toBe("jooga");
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
    expect(buyers.representativeFields?.map((f) => f.id)).toEqual(["magac", "sawir"]);
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
  test("at least one witness is required", () => {
    expect(C.requiresWitness).toBe(true);
    expect(
      C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "maragyo")!.min,
    ).toBe(1);
  });

  test("the witness list is not capped at the six the scans happen to show", () => {
    const marag = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "maragyo")!;
    expect(marag.max).toBeUndefined();
  });

  test("a witness is a name and a phone — nothing else", () => {
    const marag = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "maragyo")!;
    expect(marag.fields.map((f) => f.id)).toEqual(["magac", "telefoon"]);
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
      iibiyeyaal: [row("s1", { magac: "AHMED CALI", degan: "Hargeisa" })],
      sawirrada: [row("p1", { magac: "AHMED CALI", sawir: "k7storageIDabc123" })],
    } as FormValues).flatMap((s) => s.rows);
    expect(rows.some((r) => r.value.includes("k7storageIDabc123"))).toBe(false);
    expect(rows.find((r) => r.label === "Sawir 1")?.value).toBe("AHMED CALI — Sawir");
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
      damiinka: {
        nooca_damiinta: "qof_3aad",
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
      "JIHOO_1",
      "JIHOO_2",
      "JIHOO_3",
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
      "WAKIILO_IIBSADAYAAL",
      "KOOXAHA",
      "WAKIILLO",
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
  jiho_1: "Xarunta Wacatariga",
  jiho_2: "Jidka Mogadishu",
  jiho_3: "Badda Sooma",
};

function scanValues(over: Partial<FormValues> = {}): FormValues {
  return {
    ...createInitialValues(C),
    dejinta: {
      sub_type: "dhul_banaan",
      reference: "DPN-MG-001",
      taariikhda_hantida: "2026-01-30",
    },
    hantida_dhul_banaan: { ...PLOT, sida_hantida_loo_helay: "iibsaday", notary_ref: "Tr No 4471" },
    iibiyeyaal: [row("s1", { magac: "AHMED CALI", degan: "Hargeisa", telefoon: "0611111111" })],
    iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa", telefoon: "0622222222" }, "jooga")],
    // Photographs are their OWN list. The Dhul Banaan scan prints three of
    // them on page 1 — for ONE seller, ONE buyer and the guarantor — which is
    // only expressible when the photo count is free of the seller count.
    sawirrada: [
      row("p1", { magac: "AHMED CALI", sawir: "stor_s1" }),
      row("p2", { magac: "SOMALI JAMAC", sawir: "stor_b1" }),
      row("p3", { magac: "KHALID NOOR", sawir: "stor_d" }),
    ],
    damiinka: { nooca_damiinta: "qof_3aad", magaca_damiinka: "KHALID NOOR", gurmadka_dammaanadda: "Reer deggan.", sawirka_damiinka: "stor_d" },
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
    expect(map["{{JIHOO_1}}"]).toBe("Xarunta Wacatariga");
    expect(map["{{JIHOO_2}}"]).toBe("Jidka Mogadishu");
    expect(map["{{JIHOO_3}}"]).toBe("Badda Sooma");
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
        beerta: "Ilmo Hebel 1998",
      },
      iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", degan: "Hargeisa" }, "wakiil", "r1")],
      wakiilo_iibsadayaal: [row("r1", { magac: "ABDI WAKIIL", sawir: "stor_rep" })],
      // The absent buyer's own photograph is NOT used — the wakiil's is —
      // and the self-guarantor has none. Two photographs for one seller.
      sawirrada: [
        row("p1", { magac: "AHMED CALI", sawir: "stor_s1" }),
        row("p2", { magac: "ABDI WAKIIL", sawir: "stor_rep" }),
      ],
      damiinka: {
        nooca_damiinta: "iibiyaha",
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
    expect(map["{{WAKIIL_MAGAC}}"]).toBe("ABDI WAKIIL");
    expect(map["{{WAKIIL_SAWIR}}"]).toBe("stor_rep");

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

    // Inherited plot → beerta, and no notary ref.
    expect(map["{{BEERTA}}"]).toBe("Ilmo Hebel 1998");
    expect(map["{{NOTARY_REF}}"]).toBe("");

    // Six witnesses are numbered 1..6 — the form never capped them.
    const marag = buildRepeatBlockData(C, values).get("MARAGYO")!.rows;
    expect(marag.map((r) => r.NUMBER)).toEqual(["1", "2", "3", "4", "5", "6"]);

    // Page 1 photos: seller + the wakiil who signs for the absent buyer.
    expect(map["{{WAKIIL_SAWIR}}"]).toBe("stor_rep");
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
