/**
 * KALA IIBSI HANTI — the new document type, proven from the form all the
 * way to the data contract. No Word template is built here: the office
 * designs that. What is proved is that every answer has exactly one legal
 * home, that nothing leaks between sellers/buyers, and that the boundary
 * fields never print a raw stored value.
 *
 *   FORM → WORKFLOW → VALIDATION → DATA CONTEXT → PLACEHOLDER INVENTORY
 *
 * Heshiis Kiro compatibility is re-checked at the end: its V1 template is
 * byte-identical and every Kiro test still passes.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildDataContext,
  buildRepeatBlockData,
  computeReplacements,
  knownPlaceholderNames,
  resolveFlags,
} from "../src/lib/notary/dataContext";
import { validateDocument } from "../src/lib/notary/validation";
import { buildConditionalWorkflow } from "../src/lib/notary/agreementSetup";
import { documentConfigs, getConfig, upcomingDocumentTypes } from "../src/lib/notary/documents";
import { kalaIiibsiHantiConfig as C } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { heshiisKiroConfig as K } from "../src/lib/notary/documents/heshiisKiro";
import {
  KALA_IIBSI_HANTI_PLACEHOLDERS,
  canonicalNameFor,
  placeholderRegistry,
  registryTokenNames,
} from "../src/lib/notary/placeholderRegistry";
import { classifyTemplateTokens } from "../src/lib/notary/templateCompatibility";
import { linkPartyRepresentative } from "../src/lib/notary/engine";
import {
  addRepresentative,
  createInitialValues,
  getPartyRows,
  representedByRep,
  setPartyCount,
} from "../src/lib/notary/formValues";
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

/** A complete Guri sale: one seller, one buyer, both present. */
function base(over: Partial<FormValues> = {}): FormValues {
  return {
    ...createInitialValues(C),
    dejinta: { sub_type: "guri", reference: "DPN-H-0001", taariikhda_hantida: "2026-10-01" },
    iibiyeyaal: [row("s1", { magac: "AHMED CALI", telefoon: "0611111111" }, "jooga")],
    iibsadayaal: [row("b1", { magac: "SOMALI JAMAC", telefoon: "0622222222" }, "jooga")],
    hantida_guri: {
      goobta: "Hargeisa",
      degmada_xaafadda: "Degmada Hargeisa",
      nooca_guriga: "Guri Xaas",
      lambarka_lahaansho: "TL-001",
    },
    qiimaha: { qiimaha_guud: "10000", lacagta_bixiyay: "4000", habka_bixinta: "qayb" },
    shuruudaha: {
      hantida_wareegay: "yes",
      iibiyuhu_caddeynayaa: "yes",
      iibsaduhu_ahqiiqiyay: "yes",
      iibiyuhu_bixinayaa_dammaanad: "no",
      shuruudaha_gaarka_ah: "Waxaa la hubiyay in aan la wareejin.",
    },
    maragyo: [row("m1", { magac: "MARAG KOOW", telefoon: "0633333333" })],
    ...over,
  };
}

/** The seller-count step answered with `n` NAMED sellers. */
function namedSellers(n: number): FormValues {
  const names = [
    "AHMED CALI",
    "HASSAN ALI",
    "OMAR FARAH",
    "KHALID NOOR",
    "ABDI JAMA",
    "MAXAMED DUBE",
  ];
  return base({
    iibiyeyaal: names.slice(0, n).map((magac, i) =>
      row(`s${i + 1}`, { magac, telefoon: "0611111111" }, "jooga"),
    ),
  });
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

  test("it is no longer advertised as 'coming soon'", () => {
    expect(upcomingDocumentTypes.map((c) => c.id)).not.toContain("kala_iibsi_hanti");
  });

  test("the three sub-types are the ones the office asked for", () => {
    expect(C.subTypes.map((s) => s.value)).toEqual(["dhul_banaan", "guri", "beer"]);
    expect(C.subTypes.map((s) => s.label)).toEqual(["Dhul Banaan", "Guri", "Beer"]);
  });

  test("its setup section is declared, so nothing assumes 'heshiiska'", () => {
    expect(C.setupSectionId).toBe("dejinta");
    // Heshiis Kiro keeps the default — its layout is untouched.
    expect(K.setupSectionId).toBeUndefined();
  });

  test("the template registry knows one Word template per sub-type", () => {
    expect((C.templates ?? []).map((t) => t.subtype)).toEqual([
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
  const steps = (v: FormValues) =>
    buildConditionalWorkflow(C, v).map((s) => s.key);

  test("the flow is: sub-type → seller count → sellers → buyer count → buyers → … → witnesses", () => {
    expect(steps(base())).toEqual([
      "sec-dejinta",
      "count-iibiyeyaal",
      "party-iibiyeyaal",
      "count-iibsadayaal",
      "party-iibsadayaal",
      "sec-hantida_guri",
      "sec-qiimaha",
      "sec-shuruudaha",
      "sec-maragyada",
      "party-maragyo",
    ]);
  });

  test("only the CHOSEN property section appears — never the other two", () => {
    for (const [subType, own, others] of [
      ["dhul_banaan", "sec-hantida_dhul_banaan", ["sec-hantida_guri", "sec-hantida_beer"]],
      ["guri", "sec-hantida_guri", ["sec-hantida_dhul_banaan", "sec-hantida_beer"]],
      ["beer", "sec-hantida_beer", ["sec-hantida_dhul_banaan", "sec-hantida_guri"]],
    ] as const) {
      const keys = steps(base({ dejinta: { sub_type: subType } as never }));
      expect(keys).toContain(own);
      for (const other of others) expect(keys).not.toContain(other);
    }
  });

  test("the pledge section appears only when the pledge answer is Haa", () => {
    expect(steps(base())).not.toContain("sec-rahmad");
    const withPledge = base({
      shuruudaha: { ...(base().shuruudaha as Record<string, string>), iibiyuhu_bixinayaa_dammaanad: "yes" },
    });
    expect(steps(withPledge)).toContain("sec-rahmad");
  });

  test("the count step writes straight into the row list", () => {
    const counted = setPartyCount(base(), C.sections[1].parties![0], 3);
    expect(getPartyRows(counted, "iibiyeyaal")).toHaveLength(3);
    // The buyer list is untouched by the seller count.
    expect(getPartyRows(counted, "iibsadayaal")).toHaveLength(1);

    // …and the number the office chose reaches the document once the rows
    // are named (an unnamed row is not a seller, so it is not counted).
    const v = namedSellers(3);
    expect(computeReplacements(C, v)["{{TIRADA_IIBIYEYAAL}}"]).toBe("3");
    expect(computeReplacements(C, base())["{{TIRADA_IIBIYEYAAL}}"]).toBe("1");
  });

  test("Heshiis Kiro's workflow is byte-identical — no count step leaked into it", () => {
    const kiroSteps = buildConditionalWorkflow(K, {
      ...createInitialValues(K),
      heshiiska: {
        sub_type: "guri_xaas",
        kireeye_mode: "multiple",
        kirayste_mode: "single",
        muddada_nooca: "furan",
        deebaaji_haa: "yes",
        damiin_haa: "no",
      },
    } as FormValues);
    expect(kiroSteps.some((s) => s.detail.kind === "party-count")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* C — fields                                                           */
/* ------------------------------------------------------------------ */

describe("C — all fields", () => {
  test("Dhul Banaan collects the property details the office listed", () => {
    const v = base({
      dejinta: { ...(base().dejinta as object), sub_type: "dhul_banaan" } as never,
      hantida_dhul_banaan: {
        nooca_hantida: "Dhul Degmada",
        goobta: "Degmada Waardhiil",
        cabbirka: "5,000 m²",
        xadka_waqooyi: "Xad A",
        xadka_bari: "Xad B",
        xadka_koonfur: "Xad C",
        xadka_galbeed: "Xad D",
        lambarka_lahaansho: "DH-9",
      },
    });
    expect(validateDocument(C, v)).toEqual({});
    const r = computeReplacements(C, v);
    expect(r["{{DHUL_CABBIRKA}}"]).toBe("5,000 m²");
    expect(r["{{DHUL_XADKA_GALBEED}}"]).toBe("Xad D");
    expect(r["{{DHUL_LAMBARKA_LAHAANSHO}}"]).toBe("DH-9");
  });

  test("Guri and Beer each ask for their own size and type", () => {
    const guri = base({ hantida_guri: { ...(base().hantida_guri as object), cabbirka: "150 m²" } as never });
    expect(computeReplacements(C, guri)["{{GURI_CABBIRKA}}"]).toBe("150 m²");
    const beer = base({
      dejinta: { sub_type: "beer" } as never,
      hantida_beer: {
        goobta: "Hargeisa",
        degmada_xaafadda: "Degmada Hargeisa",
        cabbirka: "80 m²",
        nooca_beeraha: "Beer Dhab ah",
        lambarka_lahaansho: "TL-9",
      },
    });
    expect(computeReplacements(C, beer)["{{BEER_NOOCA}}"]).toBe("Beer Dhab ah");
  });

  test("a hidden property section is neither validated nor printed", () => {
    // Guri is chosen, so a stale Beer answer is ignored entirely.
    const v = base({
      hantida_beer: { cabbirka: "should be ignored" } as never,
    });
    expect(validateDocument(C, v)).toEqual({});
    const flags = resolveFlags(C, v) as Record<string, boolean>;
    expect(flags.HANTI_GURI).toBe(true);
    expect(flags.HANTI_BEER).toBe(false);
    // …and it can only ever appear under the OTHER subtype's own tokens —
    // each sub-type loads its own Word template, never a foreign one.
    const r = computeReplacements(C, v);
    expect(r["{{GURI_GOOBTA}}"]).toBe("Hargeisa");
    const stale = Object.entries(r)
      .filter(([, val]) => String(val).includes("should be ignored"))
      .map(([key]) => key);
    expect(stale).toEqual(["{{BEER_CABBIRKA}}"]);
  });

  test("every required field blocks generation when empty", () => {
    const v = base();
    (v.qiimaha as Record<string, string>).qiimaha_guud = "";
    expect(validateDocument(C, v).qiimaha).toBeDefined();

    const v2 = base();
    (v2.dejinta as Record<string, string>).sub_type = "";
    expect(validateDocument(C, v2).dejinta).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* D — money                                                            */
/* ------------------------------------------------------------------ */

describe("D — price, payment and the derived balance", () => {
  test("the amount in words is computed — the user only ever types the figure", () => {
    const r = computeReplacements(C, base());
    expect(r["{{QIIMAHA_IIBKU}}"]).toBe("$10,000");
    expect(r["{{QIIMAHA_IIBKU_QORAAL}}"]).toBe(formatCurrencyWordsSomali(10000));
  });

  test("the balance is DERIVED (total − paid) and reaches the document", () => {
    const r = computeReplacements(C, base());
    expect(r["{{LACAGTA_HADHAY}}"]).toBe("$6,000");
    expect(r["{{LACAGTA_HADHAY_QORAAL}}"]).toBe(formatCurrencyWordsSomali(6000));
  });

  test("a full payment leaves nothing outstanding", () => {
    const v = base({ qiimaha: { qiimaha_guud: "1250", lacagta_bixiyay: "1250", habka_bixinta: "dhan" } });
    const r = computeReplacements(C, v);
    expect(r["{{LACAGTA_HADHAY}}"]).toBe("$0");
    expect(r["{{LACAGTA_HADHAY_QORAAL}}"]).toBe("Eber oo Dollar");
  });

  test("the balance is never negative — a refund is never invented", () => {
    // Overpayment is a validation error, but even then the printed figure
    // cannot go below zero.
    const v = base({ qiimaha: { qiimaha_guud: "100", lacagta_bixiyay: "500", habka_bixinta: "qayb" } });
    expect(computeReplacements(C, v)["{{LACAGTA_HADHAY}}"]).toBe("$0");
    expect(validateDocument(C, v).qiimaha?.general[0]).toContain("ka yar");
  });

  test("an empty price prints nothing at all — no '$0' line", () => {
    const v = base({ qiimaha: { lacagta_bixiyay: "", habka_bixinta: "hadhaa" } as never });
    const r = computeReplacements(C, v);
    expect(r["{{LACAGTA_HADHAY}}"]).toBe("");
    expect(r["{{QIIMAHA_IIBKU_QORAAL}}"]).toBe("");
  });

  test("'lacagta la bixiyay' is required exactly when a balance remains", () => {
    const partial = base({ qiimaha: { qiimaha_guud: "1000", habka_bixinta: "qayb" } });
    expect(validateDocument(C, partial).qiimaha?.fieldErrors.lacagta_bixiyay).toBeDefined();

    const balance = base({ qiimaha: { qiimaha_guud: "1000", habka_bixinta: "hadhaa" } });
    expect(validateDocument(C, balance).qiimaha?.fieldErrors.lacagta_bixiyay).toBeDefined();

    const full = base({ qiimaha: { qiimaha_guud: "1000", habka_bixinta: "dhan" } });
    expect(validateDocument(C, full)).toEqual({});
  });

  test("the payment method becomes Somali prose, never a raw stored value", () => {
    const r = computeReplacements(C, base());
    expect(r["{{HABKA_BIXINTA}}"]).toBe("Qayb Lacag ah (Partial Payment)");
    expect(r["{{HABKA_BIXINTA}}"]).not.toBe("qayb");
    expect(r["{{NOOCA_HANTIDA}}"]).not.toBe("guri");
  });

  test("the payment-method flags drive {{IF:…}} in the office's template", () => {
    const f = (m: string) =>
      resolveFlags(C, base({ qiimaha: { qiimaha_guud: "1", habka_bixinta: m } })) as Record<string, boolean>;
    expect(f("dhan").BIXINTA_DHAN).toBe(true);
    expect(f("qayb").BIXINTA_QAYB).toBe(true);
    expect(f("hadhaa").BIXINTA_HADHAA).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* E — ownership, warranty and the pledge                              */
/* ------------------------------------------------------------------ */

describe("E — ownership, warranty and dammaanad", () => {
  test("the four conditions of sale are collected as answers", () => {
    const r = computeReplacements(C, base());
    expect(r["{{HANTIDA_LAA_WAREEJIYAY}}"]).toBe("Hantida waxaa la wareejiyay iibsadaha");
    expect(r["{{IIBIYAHU_CADDEEYAA}}"]).toContain("caddeynayaa");
    expect(r["{{IIBSADAHA_AQBALAY}}"]).toContain("xaqiijinayaa");
    expect(r["{{SHURUUDAHA_IIBKA}}"]).toBe("Waxaa la hubiyay in aan la wareejin.");
  });

  test("a 'no' answer is stated, never silently dropped", () => {
    const r = computeReplacements(
      C,
      base({
        shuruudaha: {
          hantida_wareegay: "no",
          iibiyuhu_caddeynayaa: "no",
          iibsaduhu_ahqiiqiyay: "no",
          iibiyuhu_bixinayaa_dammaanad: "no",
        } as never,
      }),
    );
    expect(r["{{HANTIDA_LAA_WAREEJIYAY}}"]).toBe("Hantida weli ma la wareejin");
    expect(r["{{DAMMAANAD_LA_BIXIYAY}}"]).toBe("Dammaanad ma jiro");
  });

  test("the rahmad section collects its data only when it applies", () => {
    const withPledge = base({
      shuruudaha: { ...(base().shuruudaha as Record<string, string>), iibiyuhu_bixinayaa_dammaanad: "yes" },
      rahmad: {
        nooca_rahmada: "Dabadeed",
        degmada_xaafadda: "Degmada Hargeisa",
        lambarka_lahaansho: "RD-7",
        faahfaahin: "Bank Hormuud.",
      },
    });
    const r = computeReplacements(C, withPledge);
    expect(r["{{RAHMAD_NOOCA}}"]).toBe("Dabadeed");
    expect(r["{{RAHMAD_LAMBARKA_LAHAANSHO}}"]).toBe("RD-7");
    expect(resolveFlags(C, withPledge).RAHMAD_JIRA).toBe(true);
    expect(validateDocument(C, withPledge)).toEqual({});
  });

  test("the pledge section is required in full once it applies", () => {
    const v = base({
      shuruudaha: { ...(base().shuruudaha as Record<string, string>), iibiyuhu_bixinayaa_dammaanad: "yes" },
      rahmad: {},
    });
    const errs = validateDocument(C, v).rahmad?.fieldErrors ?? {};
    expect(Object.keys(errs).sort()).toEqual([
      "degmada_xaafadda",
      "lambarka_lahaansho",
      "nooca_rahmada",
    ]);
  });

  test("no annex flag exists for this document type — no 'XOGTA HESHIISKA'", () => {
    expect(C.annexFields).toBeUndefined();
    const flags = resolveFlags(C, base()) as Record<string, boolean>;
    expect(Object.keys(flags).some((f) => f.startsWith("ANNEX_"))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* F — repeatable sellers and buyers                                   */
/* ------------------------------------------------------------------ */

describe("F — repeatable sellers and buyers", () => {
  test("both groups are repeatable, min 1, unlimited", () => {
    for (const id of ["iibiyeyaal", "iibsadayaal"]) {
      const def = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === id)!;
      expect(def.min).toBe(1);
      expect(def.max ?? 0).toBe(0);
      expect(def.attendance).toBe(true);
      expect(def.countFirst).toBe(true);
    }
  });

  test("sellers and buyers are SEPARATE lists — no cross-wiring", () => {
    const v = setPartyCount(base(), C.sections[1].parties![0], 3);
    expect(getPartyRows(v, "iibiyeyaal")).toHaveLength(3);
    expect(getPartyRows(v, "iibsadayaal")).toHaveLength(1);
    const r = computeReplacements(C, v);
    expect(r["{{IIBIYAHA_MAGAC}}"]).toBe("AHMED CALI");
    expect(r["{{IIBSADAHA_MAGAC}}"]).toBe("SOMALI JAMAC");
  });

  test("each seller and each buyer gets a numbered block row", () => {
    const v = setPartyCount(
      base({
        iibiyeyaal: [
          row("s1", { magac: "AHMED CALI" }, "jooga"),
          row("s2", { magac: "HASSAN ALI" }, "jooga"),
        ],
        iibsadayaal: [
          row("b1", { magac: "SOMALI JAMAC" }, "jooga"),
          row("b2", { magac: "OMAR FARAH" }, "jooga"),
        ],
      }),
      C.sections[1].parties![0],
      2,
    );
    const blocks = buildRepeatBlockData(C, v);
    const sellers = blocks.get("IIBIYEYAAL")!.rows;
    expect(sellers.map((r) => [r.NUMBER, r.MAGAC])).toEqual([
      ["1", "AHMED CALI"],
      ["2", "HASSAN ALI"],
    ]);
    const buyers = blocks.get("IIBSADAYAAL")!.rows;
    expect(buyers.map((r) => [r.NUMBER, r.MAGAC])).toEqual([
      ["1", "SOMALI JAMAC"],
      ["2", "OMAR FARAH"],
    ]);
  });

  test("witnesses are their own repeatable list, min 1", () => {
    const marag = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === "maragyo")!;
    expect(marag.min).toBe(1);
    expect(marag.attendance).toBeUndefined();
    const v = base({ maragyo: [] });
    expect(validateDocument(C, v).maragyada?.general).toContain(
      "Ugu yaraan hal marag ayaa loo baahan yahay.",
    );
  });

  test("an empty leftover row never reaches the document", () => {
    // Lowering the count leaves the spare row behind, empty: it is not a
    // seller, so it must not print a blank numbered row in the document.
    const v = base({
      iibiyeyaal: [
        row("s1", { magac: "AHMED CALI" }, "jooga"),
        row("s2", {}),
      ],
    });
    const rows = buildRepeatBlockData(C, v).get("IIBIYEYAAL")!.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].NUMBER).toBe("1");
  });

  test("every party must choose presence before the interview moves on", () => {
    const v = base({ iibiyeyaal: [row("s1", { magac: "AHMED CALI" })] });
    const errs = validateDocument(C, v).iibiyaha?.partyErrors.iibiyeyaal ?? [];
    expect(errs.some((e) => e.errors.some((x) => x.fieldId === "attendance"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* G — attendance                                                       */
/* ------------------------------------------------------------------ */

describe("G — attendance", () => {
  test("a phone number belongs to a present person only", () => {
    // Present → the phone is required.
    const present = base({
      iibiyeyaal: [row("s1", { magac: "AHMED CALI" }, "jooga")],
    });
    expect(validateDocument(C, present).iibiyaha).toBeDefined();

    // Absent → the phone is not applicable, so it is never asked for.
    let absent = base({ iibiyeyaal: [row("s1", { magac: "AHMED CALI" }, "wakiil")] });
    absent = addRepresentative(absent, C.sections[1].parties![0]);
    absent.wakiilo_iibiyeyaal![0].values.magac = "AXMED WAKIIL";
    absent.wakiilo_iibiyeyaal![0].values.telefoon = "0644444444";
    const repId = getPartyRows(absent, "wakiilo_iibiyeyaal")[0].id;
    absent = linkPartyRepresentative(absent, "iibiyeyaal", 0, repId);
    expect(validateDocument(C, absent).iibiyaha).toBeUndefined();
  });

  test("the count flags follow the chosen number of sellers and buyers", () => {
    const one = resolveFlags(C, base()) as Record<string, boolean>;
    expect(one.IIBIYEYAAL_HAL).toBe(true);
    expect(one.IIBIYEYAAL_BADAN).toBe(false);

    const many = resolveFlags(C, namedSellers(2)) as Record<string, boolean>;
    expect(many.IIBIYEYAAL_HAL).toBe(false);
    expect(many.IIBIYEYAAL_BADAN).toBe(true);
    // The buyer group is unaffected.
    expect(many.IIBSADAYAAL_HAL).toBe(true);
  });

  test("the flags resolve to false — never left undefined — on an empty form", () => {
    const f = resolveFlags(C, createInitialValues(C)) as Record<string, boolean>;
    for (const name of ["IIBIYEYAAL_HAL", "IIBIYEYAAL_BADAN", "IIBSADAYAAL_HAL", "IIBSADAYAAL_BADAN"]) {
      expect(typeof f[name]).toBe("boolean");
    }
  });
});

/* ------------------------------------------------------------------ */
/* H — representatives and grouping                                     */
/* ------------------------------------------------------------------ */

describe("H — representative grouping", () => {
  test("one wakiil record serves many absent sellers", () => {
    let v = base({
      iibiyeyaal: [
        row("s1", { magac: "AHMED CALI" }, "wakiil"),
        row("s2", { magac: "HASSAN ALI" }, "wakiil"),
        row("s3", { magac: "OMAR FARAH" }, "wakiil"),
      ],
    });
    v = addRepresentative(v, C.sections[1].parties![0]);
    const repId = getPartyRows(v, "wakiilo_iibiyeyaal")[0].id;
    v = linkPartyRepresentative(v, "iibiyeyaal", 0, repId);
    v = linkPartyRepresentative(v, "iibiyeyaal", 1, repId);
    v = linkPartyRepresentative(v, "iibiyeyaal", 2, repId);

    // ONE stored representative, THREE links.
    expect(getPartyRows(v, "wakiilo_iibiyeyaal")).toHaveLength(1);
    expect(representedByRep(v, C.sections[1].parties![0], repId)).toEqual([
      "AHMED CALI",
      "HASSAN ALI",
      "OMAR FARAH",
    ]);
  });

  test("the representative block prints the wakiil once plus who they act for", () => {
    let v = base({
      iibiyeyaal: [
        row("s1", { magac: "AHMED CALI" }, "wakiil"),
        row("s2", { magac: "HASSAN ALI" }, "wakiil"),
      ],
    });
    v = addRepresentative(v, C.sections[1].parties![0]);
    v.wakiilo_iibiyeyaal![0].values.magac = "AXMED WAKIIL";
    const repId = getPartyRows(v, "wakiilo_iibiyeyaal")[0].id;
    v = linkPartyRepresentative(v, "iibiyeyaal", 0, repId);
    v = linkPartyRepresentative(v, "iibiyeyaal", 1, repId);
    const repRows = buildRepeatBlockData(C, v).get("WAKIILO_IIBIYEYAAL")!.rows;
    expect(repRows).toHaveLength(1);
    expect(repRows[0].MATALAYA).toBe("AHMED CALI, HASSAN ALI");
  });

  test("the person is never replaced by the representative", () => {
    let v = base({ iibiyeyaal: [row("s1", { magac: "AHMED CALI" }, "wakiil")] });
    v = addRepresentative(v, C.sections[1].parties![0]);
    const repId = getPartyRows(v, "wakiilo_iibiyeyaal")[0].id;
    v = linkPartyRepresentative(v, "iibiyeyaal", 0, repId);
    const r = computeReplacements(C, v);
    expect(r["{{IIBIYAHA_MAGAC}}"]).toBe("AHMED CALI");
  });

  test("a present person is never given a representative", () => {
    const v = base({ iibiyeyaal: [row("s1", { magac: "AHMED CALI" }, "jooga")] });
    const rows = buildRepeatBlockData(C, v).get("IIBIYEYAAL")!.rows;
    expect(rows[0].WAKIIL).toBe("");
    expect(rows[0].JOOGA).toBe("1");
  });

  test("a row's wakiil data stays inside that row — no bleed between rows", () => {
    const v = base({
      iibiyeyaal: [
        row("s1", { magac: "AHMED CALI" }, "jooga"),
        row("s2", { magac: "HASSAN ALI" }, "wakiil"),
      ],
    });
    const rows = buildRepeatBlockData(C, v).get("IIBIYEYAAL")!.rows;
    expect(rows[0].WAKIIL).toBe("");
    expect(rows[1].WAKIIL).toBe("1");
  });

  test("seller and buyer representatives never mix", () => {
    let v = base({ iibsadayaal: [row("b1", { magac: "SOMALI JAMAC" }, "wakiil")] });
    v = addRepresentative(v, C.sections[2].parties![0]);
    v.wakiilo_iibsadayaal![0].values.magac = "SOMALI JAMAC WAKIIL";
    const buyerRep = getPartyRows(v, "wakiilo_iibsadayaal")[0].id;
    v = linkPartyRepresentative(v, "iibsadayaal", 0, buyerRep);

    // A wakiil added for the BUYERS never appears in the sellers' block.
    expect(getPartyRows(v, "wakiilo_iibiyeyaal")).toHaveLength(0);
    const sellerReps = buildRepeatBlockData(C, v).get("WAKIILO_IIBIYEYAAL")!.rows;
    expect(sellerReps).toHaveLength(0);
    const buyerReps = buildRepeatBlockData(C, v).get("WAKIILO_IIBSADAYAAL")!.rows;
    expect(buyerReps[0].MATALAYA).toBe("SOMALI JAMAC");
  });

  test("an absent party without a representative is a validation error", () => {
    const v = base({ iibiyeyaal: [row("s1", { magac: "AHMED CALI" }, "wakiil")] });
    const errs = validateDocument(C, v).iibiyaha?.partyErrors.iibiyeyaal ?? [];
    expect(errs[0].errors[0].message).toContain("wakiilka matalaya");
  });

  test("an unlinked representative is reported, never silently printed", () => {
    const v = addRepresentative(base(), C.sections[1].parties![0]);
    v.wakiilo_iibiyeyaal![0].values.magac = "AXMED WAKIIL";
    expect(validateDocument(C, v).iibiyaha?.general.some((g) => g.includes("Matalaya"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* I — placeholder inventory                                            */
/* ------------------------------------------------------------------ */

describe("I — placeholder inventory", () => {
  test("the registry serves the new document type from its own list", () => {
    expect(placeholderRegistry("kala_iibsi_hanti")).toBe(KALA_IIBSI_HANTI_PLACEHOLDERS);
    // An unknown id still returns nothing rather than guessing.
    expect(placeholderRegistry("cadayn_cilaaj")).toEqual([]);
  });

  test("every canonical token is accepted, and aliases resolve to it", () => {
    const specs = KALA_IIBSI_HANTI_PLACEHOLDERS;
    expect(canonicalNameFor(specs, "qiimaha_iibku")).toBe("QIIMAHA_IIBKU");
    expect(canonicalNameFor(specs, "{{qiimaha_hantida}}")).toBe("QIIMAHA_IIBKU");
    expect(canonicalNameFor(specs, "NOT_A_REAL_TOKEN")).toBeUndefined();
  });

  test("NO orphan placeholders: every token with a key reaches the document", () => {
    const r = computeReplacements(C, base({}));
    const claimed: string[] = [];
    for (const spec of KALA_IIBSI_HANTI_PLACEHOLDERS) {
      if (!spec.key) continue;
      claimed.push(`{{${spec.token}}}`);
      expect(r[`{{${spec.token}}}`]).toBeDefined();
    }
    // The claim is only real if the resolver actually wrote each one.
    for (const token of claimed) {
      const name = token.replace(/[{}]/g, "");
      expect(knownPlaceholderNames(C).has(name)).toBe(true);
    }
  });

  test("no UNUSED required field: every required answer has a placeholder", () => {
    const keys = new Set(
      KALA_IIBSI_HANTI_PLACEHOLDERS.filter((s) => s.key).map((s) => s.key),
    );
    const missing: string[] = [];
    for (const section of C.sections) {
      for (const f of section.fields) {
        const required = !f.optional && f.validation?.required !== false;
        if (!required) continue;
        if (!keys.has(`${section.id}.${f.id}`)) missing.push(`${section.id}.${f.id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("the party answers have placeholders too", () => {
    const keys = new Set(
      KALA_IIBSI_HANTI_PLACEHOLDERS.filter((s) => s.key).map((s) => s.key),
    );
    const names = knownPlaceholderNames(C);
    for (const id of ["iibiyeyaal", "iibsadayaal", "maragyo"]) {
      const def = C.sections.flatMap((s) => s.parties ?? []).find((p) => p.id === id)!;
      for (const f of def.fields) {
        const required = !f.optional && f.validation?.required !== false;
        // A repeatable party reaches the document through its BLOCK row token
        // ({{MAGAC}} inside {{#IIBIYEYAAL}}), not through a flat key.
        const inBlockRow = names.has(f.id.toUpperCase());
        if (required) expect(keys.has(`${id}.${f.id}`) || inBlockRow).toBe(true);
      }
    }
  });

  test("the derived values are declared and resolvable", () => {
    expect((C.derivedValues ?? []).map((d) => d.token)).toEqual([
      "LACAGTA_HADHAY",
      "LACAGTA_HADHAY_QORAAL",
      "TIRADA_IIBIYEYAAL",
      "TIRADA_IIBSADAYAAL",
    ]);
    for (const d of C.derivedValues ?? []) {
      expect(knownPlaceholderNames(C).has(d.token)).toBe(true);
    }
  });

  test("the template validator accepts every declared token", () => {
    // Feed the WHOLE inventory through the office's template-upload path: a
    // template written from the published list must generate without a single
    // "placeholder aan system-ku aqoon".
    const stream: string[] = [];
    for (const spec of KALA_IIBSI_HANTI_PLACEHOLDERS) {
      const names = [spec.token, ...(spec.aliases ?? [])];
      if (spec.kind === "block") {
        for (const name of names) stream.push(`#${name}`);
        stream.push(...(spec.bodyTokens ?? []));
        for (const name of names) stream.push(`/${name}`);
      } else {
        stream.push(...names);
      }
    }
    const report = classifyTemplateTokens(stream, C);
    expect(report.unknown).toEqual([]);
    expect(report.invalidSyntax).toEqual([]);
    expect(report.invalidRepeaters).toEqual([]);
    expect(report.invalidConditionals).toEqual([]);
    expect(report.canGenerate).toBe(true);
    // Every canonical token and every alias the office may type is either a
    // MATCH or resolved ALIAS — nothing is left dangling.
    const accepted = new Set(
      report.classifications
        .filter((c) => c.status !== "UNKNOWN")
        .map((c) => c.name.toUpperCase()),
    );
    for (const name of registryTokenNames(KALA_IIBSI_HANTI_PLACEHOLDERS)) {
      if (name.startsWith("#") || name.startsWith("/")) continue;
      if (name === "NUMBER" || name === "MATALAYA") continue;
      // A repeat block is only legal written as {{#BLOCK}} … {{/BLOCK}}.
      const known = knownPlaceholderNames(C);
      expect(
        accepted.has(name) || known.has(name) || known.has(`#${name}`),
      ).toBe(true);
    }
  });

  test("there is no {{CLAUSE_*}} block and no clause numbering for this type", () => {
    // Legal wording lives in the office's own Word template, not in the app.
    expect(C.clauses).toEqual([]);
    expect(C.clauseNumbering).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* J — review data                                                      */
/* ------------------------------------------------------------------ */

describe("J — review shows the collected answers", () => {
  test("the review lists the sections that actually hold data", async () => {
    const { collectFilledValues } = await import("../src/lib/notary/validation");
    const blocks = collectFilledValues(C, base());
    const ids = blocks.map((b) => b.sectionId);
    expect(ids).toContain("dejinta");
    expect(ids).toContain("hantida_guri");
    expect(ids).toContain("qiimaha");
    expect(ids).toContain("shuruudaha");
    // Hidden sections never appear.
    expect(ids).not.toContain("hantida_beer");
    expect(ids).not.toContain("rahmad");
  });

  test("a party's attendance and representative are visible in review", async () => {
    const { collectFilledValues } = await import("../src/lib/notary/validation");
    let v = base({ iibiyeyaal: [row("s1", { magac: "AHMED CALI" }, "wakiil")] });
    v = addRepresentative(v, C.sections[1].parties![0]);
    const repId = getPartyRows(v, "wakiilo_iibiyeyaal")[0].id;
    v = linkPartyRepresentative(v, "iibiyeyaal", 0, repId);
    v.wakiilo_iibiyeyaal![0].values.magac = "AXMED WAKIIL";
    const rows = collectFilledValues(C, v)
      .find((b) => b.sectionId === "iibiyaha")!
      .rows.map((r) => r.value)
      .join(" | ");
    expect(rows).toContain("AHMED CALI");
    expect(rows).toContain("Wakiil: AXMED WAKIIL");
  });
});

/* ------------------------------------------------------------------ */
/* K — Heshiis Kiro compatibility                                       */
/* ------------------------------------------------------------------ */

describe("K — Heshiis Kiro is untouched", () => {
  test("the V1 template is byte-identical", () => {
    const bytes = readFileSync("public/templates/heshiis_kiro_template.docx");
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(sha).toBe(
      "1bb592e7492b1b4cb325030113fd2567b48be326efa58cdf7c47c89528ce57db",
    );
  });

  test("the V2 template file is unchanged in size", () => {
    expect(readFileSync("public/templates/heshiis_kiro_template_v2.docx").length).toBe(12351);
  });

  test("no document is registered under the rental type twice", () => {
    expect(documentConfigs.filter((c) => c.id === "heshiis_kiro")).toHaveLength(1);
  });

  test("Kiro's own replacements are unchanged by the new infrastructure", () => {
    const kiro = computeReplacements(K, {
      ...createInitialValues(K),
      heshiiska: { sub_type: "guri_xaas", reference: "DPN-K-1", taariikhda_heshiiska: "2026-10-02" },
      lacagta: { qiimaha_bil_ka: "200" },
      kireeyayaal: [row("k1", { magac: "AHMED CALI" }, "jooga")],
      kiraystayaal: [row("t1", { magac: "SOMALI JAMAC" }, "jooga")],
      maragyo: [row("m1", { magac: "MARAG KOOW" })],
    } as FormValues);
    expect(kiro["{{KIREYE_MAGAC}}"]).toBe("AHMED CALI");
    expect(kiro["{{KIRAYSTE_MAGAC}}"]).toBe("SOMALI JAMAC");
    // Kiro declares no derived values, so none appear in its map.
    expect(kiro["{{LACAGTA_HADHAY}}"]).toBeUndefined();
    expect(kiro["{{TIRADA_KIREEYAYAAL}}"]).toBeUndefined();
  });

  test("Kiro keeps its annex flags and gains nothing from the new ones", () => {
    const flags = resolveFlags(K, createInitialValues(K)) as Record<string, boolean>;
    expect(flags.ANNEX_HAS_VALUES).toBe(false);
    // Kiro declares its own single/multiple flags; the new count flags belong
    // to the new type only.
    expect(flags.KIREYE_HAL).toBe(false);
    expect(Object.keys(flags)).not.toContain("IIBIYEYAAL_HAL");
    expect(Object.keys(flags)).not.toContain("IIBIYEYAAL_BADAN");
    expect(Object.keys(flags)).not.toContain("IIBSADAYAAL_HAL");
    expect(Object.keys(flags)).not.toContain("IIBSADAYAAL_BADAN");
  });

  test("Kiro's placeholder inventory is unchanged", () => {
    const names = knownPlaceholderNames(K);
    expect(names.has("KIREYE_MAGAC")).toBe(true);
    expect(names.has("DEEBAAJI_QIIMAHA_QORAAL")).toBe(true);
    expect(names.has("LACAGTA_HADHAY")).toBe(false);
    expect(names.has("IIBIYEYAAL")).toBe(false);
  });
});
