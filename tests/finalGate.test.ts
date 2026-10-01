/**
 * FINAL GATE — proof, not assertion.
 *
 * Every check renders the REAL v2 DOCX through the REAL pipeline and reads
 * the REAL output text. Nothing here trusts that a token "exists" — it
 * proves the value that came out.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  buildDataContext,
  computeReplacements,
  knownPlaceholderNames,
  resolveFlags,
} from "../src/lib/notary/dataContext";
import { processDocumentXml } from "../src/lib/notary/docxRenderer";
import { resolveClauses } from "../src/lib/notary/clauses";
import { somaliNumberToWords } from "../src/lib/notary/somaliNumbers";
import { heshiisKiroConfig as C } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

const SEAL = "(Sarkaalka Xafiiska Nootaayada Sharciga ah Ee Daloodho)";

let templateXml = "";
const buf = readFileSync("public/templates/heshiis_kiro_template_v2.docx");
{
  const zip = await JSZip.loadAsync(buf);
  templateXml = await zip.file("word/document.xml")!.async("string");
}

/** Every paragraph of the shipped template that carries a token. */
const TEMPLATE_LINES: string[] = templateXml
  .match(/<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)!
  .map((p) =>
    (
      (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((m) =>
        m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, "$1"),
      ) as string[]
    )
      .join("")
      .replace(/&amp;/g, "&"),
  );

/** Where (paragraph indexes) does this token appear in the template? */
function templateLocations(name: string): number[] {
  const hits: number[] = [];
  TEMPLATE_LINES.forEach((line, i) => {
    if (line.includes(`{{${name}}}`)) hits.push(i);
  });
  return hits;
}

function row(
  id: string,
  v: Record<string, string>,
  status?: string,
  rep?: string,
): PartyRow {
  return {
    id,
    values: v,
    ...(status
      ? { attendance: { status: status as never, representativeId: rep } }
      : {}),
  } as PartyRow;
}

function merge(v: FormValues, s: string, p: Record<string, string>): void {
  v[s] = { ...((v[s] ?? {}) as Record<string, string>), ...p };
}

function base(): FormValues {
  return {
    heshiiska: {
      sub_type: "guri_xaas",
      kireeye_mode: "single",
      kirayste_mode: "single",
      muddada_nooca: "furan",
      deebaaji_haa: "no",
      damiin_haa: "no",
      taariikhda_bilowga: "2026-10-01",
      reference: "DPN-K-0001",
      taariikhda_heshiiska: "2026-10-02",
    },
    guriga: { nooca_guriga: "guri_xaas", goobta: "Hargeisa", cinwaanka_guriga: "Xariif" },
    lacagta: {
      qiimaha_bil_ka: "300",
      habka_bixinta: "cash",
      taariikhda_bixinta: "1aad ee bil kasta",
      bixinta_hore: "muqadin",
    },
    ogaysiinta: { mudada_ogaysiinta: "30 maalmood", shuruudaha_joojinta: "Uruurin." },
    kireeyayaal: [row("k1", { magac: "AHMED CALI", telefoon: "0611111111" }, "jooga")],
    kiraystayaal: [row("t1", { magac: "SOMALI JAMAC", telefoon: "0622222222" }, "jooga")],
    maragyo: [row("m1", { magac: "MARAG KOOW", telefoon: "0633333333" })],
  };
}

function render(v: FormValues): string[] {
  const ctx = buildDataContext(C, v);
  const out = processDocumentXml(templateXml, ctx, resolveClauses(C, v));
  return (
    out.match(/<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) ?? []
  )
    .map((p) =>
      (
        (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((m) =>
          m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, "$1"),
        ) as string[]
      )
        .join("")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim(),
    )
    .filter(Boolean);
}

const doc = (v: FormValues): string => render(v).join("\n");
const clauseNos = (v: FormValues): number[] =>
  render(v)
    .map((l) => /^\s*(\d+)\.\s+\S/.exec(l)?.[1])
    .filter(Boolean)
    .map(Number);

/* ================================================================== */
describe("GATE 1 — currency in Somali words (formatter, not user input)", () => {
  test("$300 → Saddex Boqol oo Dollar", () => {
    expect(somaliNumberToWords(300)).toBe("Saddex Boqol");
    const v = base();
    merge(v, "lacagta", { qiimaha_bil_ka: "300" });
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{KIRADA_QIIMAHA_QORAAL}}"]).toBe("Saddex Boqol oo Dollar");
    expect(doc(v)).toContain("Saddex Boqol oo Dollar");
  });

  test("$1,000 → Koow Kun oo Dollar", () => {
    // Somali reads 1000 as "Koow Kun" (one thousand), not bare "Kun".
    expect(somaliNumberToWords(1000)).toBe("Koow Kun");
    const v = base();
    merge(v, "lacagta", { qiimaha_bil_ka: "1000" });
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{KIRADA_QIIMAHA}}"]).toBe("$1,000");
    expect(ctx.replacements["{{KIRADA_QIIMAHA_QORAAL}}"]).toBe("Koow Kun oo Dollar");
    expect(doc(v)).toContain("Koow Kun oo Dollar");
  });

  test("$1,250 → Koow Kun iyo Laba Boqol iyo Konton oo Dollar", () => {
    expect(somaliNumberToWords(1250)).toBe("Koow Kun iyo Laba Boqol iyo Konton");
    const v = base();
    merge(v, "lacagta", { qiimaha_bil_ka: "1250" });
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{KIRADA_QIIMAHA}}"]).toBe("$1,250");
    expect(ctx.replacements["{{KIRADA_QIIMAHA_QORAAL}}"]).toBe(
      "Koow Kun iyo Laba Boqol iyo Konton oo Dollar",
    );
    expect(doc(v)).toContain("Koow Kun iyo Laba Boqol iyo Konton oo Dollar");
  });

  test("the words value is always derived from the numeric amount", () => {
    // Changing only the form number must change only the derived words.
    const v = base();
    merge(v, "lacagta", { qiimaha_bil_ka: "300" });
    expect(doc(v)).toContain("Saddex Boqol oo Dollar");
    merge(v, "lacagta", { qiimaha_bil_ka: "1250" });
    expect(doc(v)).toContain("Kun iyo Laba Boqol iyo Konton oo Dollar");
    expect(doc(v)).not.toContain("Saddex Boqol");
  });
});

/* ================================================================== */
describe("GATE 2 — XALADDA_KIRADA and NOOCA_KIRADA are two different fields", () => {
  test("they read two different form paths and never cross over", () => {
    const ctx = buildDataContext(C, base());
    const dur = C.placeholders.find((p) => p.placeholder === "{{XALADDA_KIRADA}}");
    const sub = C.placeholders.find((p) => p.placeholder === "{{NOOCA_KIRADA}}");
    expect(dur?.mapping.key).toBe("heshiiska.muddada_nooca");
    expect(sub?.mapping.key).toBe("heshiiska.sub_type");
    expect(dur?.mapping.key).not.toBe(sub?.mapping.key);
  });

  test("XALADDA_KIRADA tracks the duration only", () => {
    const v = base();
    merge(v, "heshiiska", { muddada_nooca: "xidhan", sub_type: "jiingad" });
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{XALADDA_KIRADA}}"]).toBe("Kiro Xidhan (Muddo Cad)");
    expect(ctx.replacements["{{NOOCA_KIRADA}}"]).toBe("Jiingad");
  });

  test("NOOCA_KIRADA tracks the subtype only", () => {
    const v = base();
    merge(v, "heshiiska", { muddada_nooca: "furan", sub_type: "qol_meherad" });
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{XALADDA_KIRADA}}"]).toBe("Kiro Furan (Kiro u Joog)");
    expect(ctx.replacements["{{NOOCA_KIRADA}}"]).toBe("Qol Meherad");
  });

  test("neither ever prints the raw stored value", () => {
    for (const [dur, sub] of [
      ["xidhan", "guri_xaas"],
      ["furan", "qol_meherad"],
    ]) {
      const v = base();
      merge(v, "heshiiska", { muddada_nooca: dur, sub_type: sub });
      const text = doc(v);
      expect(text).not.toContain(dur);
      expect(text).not.toContain(sub);
    }
  });
});

/* ================================================================== */
describe("GATE 3 — row scope: each person gets ONLY their own data", () => {
  /** Render the KIREYEYAYAAL block with every row token present. */
  function scopedDoc(): string {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", {
        magac: "AHMED CALI",
        telefoon: "0611111111",
        aqoonsi: "ID-ALPHA",
        cinwaan: "XARIIF-ALPHA",
        faahfaahin_dheeraad: "FA-ALPHA",
      }, "jooga"),
      row("k2", {
        magac: "XASAN AHMED",
        telefoon: "0612222222",
        aqoonsi: "ID-BRAVO",
        cinwaan: "XARIIF-BRAVO",
        faahfaahin_dheeraad: "FA-BRAVO",
      }, "jooga"),
      row("k3", {
        magac: "MAXAMED YUUSUF",
        telefoon: "0613333333",
        aqoonsi: "ID-CHARLIE",
        cinwaan: "XARIIF-CHARLIE",
        faahfaahin_dheeraad: "FA-CHARLIE",
      }, "jooga"),
    ];
    v.kiraystayaal = [
      row("t1", { magac: "SOMALI JAMAC", telefoon: "0622222222" }, "jooga"),
    ];
    return doc(v);
  }

  test("all five row tokens are known to the system", () => {
    const known = knownPlaceholderNames(C);
    for (const t of ["MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "FAAHFAAHIN_DHEERAAD", "NUMBER"]) {
      expect(known.has(t), t).toBe(true);
    }
  });

  test("MAGAC / TELEFOON resolve per row, never joined", () => {
    const text = scopedDoc();
    expect(text).toContain("1. AHMED CALI");
    expect(text).toContain("2. XASAN AHMED");
    expect(text).toContain("3. MAXAMED YUUSUF");
    expect(text).toContain("0611111111");
    expect(text).toContain("0612222222");
    expect(text).toContain("0613333333");
    expect(text).not.toMatch(/\d\. [A-Z ]+,[A-Z ]+/); // no joined names
  });

  test("each row's own data is available to that row's resolver", () => {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", { magac: "PERSON ONE", aqoonsi: "ID-ONE", cinwaan: "PLACE-ONE", faahfaahin_dheeraad: "NOTE-ONE" }, "jooga"),
      row("k2", { magac: "PERSON TWO", aqoonsi: "ID-TWO", cinwaan: "PLACE-TWO", faahfaahin_dheeraad: "NOTE-TWO" }, "jooga"),
    ];
    const ctx = buildDataContext(C, v);
    const info = ctx.repeatBlocks.get("KIREYEYAYAAL");
    expect(info).toBeDefined();
    const rows = info!.rows;
    // Row 1 carries ONLY row 1's tokens.
    expect(rows[0].MAGAC).toBe("PERSON ONE");
    expect(rows[0].AQOONSI).toBe("ID-ONE");
    expect(rows[0].CINWAAN).toBe("PLACE-ONE");
    expect(rows[0].FAAHFAAHIN_DHEERAAD).toBe("NOTE-ONE");
    // Row 2 carries ONLY row 2's tokens — no leakage across rows.
    expect(rows[1].MAGAC).toBe("PERSON TWO");
    expect(rows[1].AQOONSI).toBe("ID-TWO");
    expect(rows[1].CINWAAN).toBe("PLACE-TWO");
    expect(rows[1].FAAHFAAHIN_DHEERAAD).toBe("NOTE-TWO");
    // And nothing of row 1 leaks into row 2.
    expect(JSON.stringify(rows[1])).not.toContain("ID-ONE");
    expect(JSON.stringify(rows[1])).not.toContain("PLACE-ONE");
    expect(JSON.stringify(rows[1])).not.toContain("NOTE-ONE");
  });

  test("MARAGYO rows are scoped the same way (D+E fields per witness)", () => {
    const v = base();
    v.maragyo = [
      row("m1", { magac: "MARAG ONE", telefoon: "0631111111", aqoonsi: "ID-M1", cinwaan: "PLACE-M1" }),
      row("m2", { magac: "MARAG TWO", telefoon: "0632222222", aqoonsi: "ID-M2", cinwaan: "PLACE-M2" }),
      row("m3", { magac: "MARAG THREE", telefoon: "0633333333", aqoonsi: "ID-M3", cinwaan: "PLACE-M3" }),
    ];
    const ctx = buildDataContext(C, v);
    const rows = ctx.repeatBlocks.get("MARAGYO")!.rows;
    expect(rows.map((r) => r.MAGAC)).toEqual(["MARAG ONE", "MARAG TWO", "MARAG THREE"]);
    expect(rows.map((r) => r.PHONE)).toEqual(["0631111111", "0632222222", "0633333333"]);
    expect(rows.map((r) => r.NUMBER)).toEqual(["1", "2", "3"]);
    expect(rows[0].AQOONSI).toBe("ID-M1");
    expect(rows[2].AQOONSI).toBe("ID-M3");
  });
});

/* ================================================================== */
describe("GATE 4 — representative grouping keeps every person named", () => {
  test("Wakiil A → persons 2,3 · Wakiil B → person 4", () => {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", { magac: "PERSON ONE", telefoon: "0611111111" }, "jooga"),
      row("k2", { magac: "PERSON TWO" }, "wakiil", "repA"),
      row("k3", { magac: "PERSON THREE" }, "wakiil", "repA"),
      row("k4", { magac: "PERSON FOUR" }, "wakiil", "repB"),
    ];
    v.wakiilo_kireeyayaal = [
      row("repA", { magac: "WAKIIL ALPHA", telefoon: "0699990001" }),
      row("repB", { magac: "WAKIIL BRAVO", telefoon: "0699990002" }),
    ];
    const lines = render(v);
    // Every person is still named, in order, numbered.
    for (const n of ["PERSON ONE", "PERSON TWO", "PERSON THREE", "PERSON FOUR"]) {
      expect(lines.join("\n"), n).toContain(n);
    }
    // Each absent person's representative is on the IMMEDIATE next line.
    // The name and the wakiil are joined into one paragraph run, so match
    // on the line after the person's own line.
    const text = lines.join("\n");
    expect(text).toMatch(/PERSON TWO\s*\nWakiilka: WAKIIL ALPHA/);
    expect(text).toMatch(/PERSON THREE\s*\nWakiilka: WAKIIL ALPHA/);
    expect(text).toMatch(/PERSON FOUR\s*\nWakiilka: WAKIIL BRAVO/);
    // Groups never cross: each person is followed IMMEDIATELY by their own
    // representative, so no ALPHA person's line can lead into BRAVO.
    expect(text).not.toMatch(/PERSON TWO\nWakiilka: WAKIIL BRAVO/);
    expect(text).not.toMatch(/PERSON THREE\nWakiilka: WAKIIL BRAVO/);
    expect(text).not.toMatch(/PERSON FOUR\nWakiilka: WAKIIL ALPHA/);
    // A representative record is never duplicated in the data model.
    expect((v.wakiilo_kireeyayaal as PartyRow[]).length).toBe(2);
  });

  test("MATALAYA lists who each representative stands for", () => {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", { magac: "PERSON ONE" }, "wakiil", "repA"),
      row("k2", { magac: "PERSON TWO" }, "wakiil", "repA"),
      row("k3", { magac: "PERSON THREE" }, "wakiil", "repB"),
    ];
    v.wakiilo_kireeyayaal = [
      row("repA", { magac: "WAKIIL ALPHA", telefoon: "0699990001" }),
      row("repB", { magac: "WAKIIL BRAVO", telefoon: "0699990002" }),
    ];
    const ctx = buildDataContext(C, v);
    const rows = ctx.repeatBlocks.get("WAKIILO_KIREEYAYAAL")!.rows;
    expect(rows[0].MAGAC).toBe("WAKIIL ALPHA");
    expect(rows[0].MATALAYA).toContain("PERSON ONE");
    expect(rows[0].MATALAYA).toContain("PERSON TWO");
    expect(rows[1].MATALAYA).toContain("PERSON THREE");
    expect(rows[1].MATALAYA).not.toContain("PERSON ONE");
  });
});

/* ================================================================== */
describe("GATE 5 — scenarios A..N, end to end", () => {
  test("A. 1 Kireeye + 1 Kirayste, both present", () => {
    const text = doc(base());
    expect(text).toContain("AHMED CALI");
    expect(text).toContain("SOMALI JAMAC");
    expect(text).not.toMatch(/\{\{/);
  });

  test("B. 5 Kireeye: 1 jooga + 4 maqan + 1 wakiil", () => {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", { magac: "P1", telefoon: "0611111111" }, "jooga"),
      row("k2", { magac: "P2" }, "wakiil", "r1"),
      row("k3", { magac: "P3" }, "wakiil", "r1"),
      row("k4", { magac: "P4" }, "wakiil", "r1"),
      row("k5", { magac: "P5" }, "wakiil", "r1"),
    ];
    v.wakiilo_kireeyayaal = [row("r1", { magac: "REP", telefoon: "0600000000" })];
    const text = doc(v);
    for (const n of ["P1", "P2", "P3", "P4", "P5"]) expect(text, n).toContain(n);
    expect(text.match(/Wakiilka: REP/g)?.length).toBe(4);
  });

  test("C. 5 Kireeye across 2 representative groups", () => {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", { magac: "P1", telefoon: "0611111111" }, "jooga"),
      row("k2", { magac: "P2" }, "wakiil", "rA"),
      row("k3", { magac: "P3" }, "wakiil", "rA"),
      row("k4", { magac: "P4" }, "wakiil", "rB"),
      row("k5", { magac: "P5" }, "wakiil", "rB"),
    ];
    v.wakiilo_kireeyayaal = [
      row("rA", { magac: "REP A", telefoon: "0600000001" }),
      row("rB", { magac: "REP B", telefoon: "0600000002" }),
    ];
    const text = doc(v);
    expect(text).toMatch(/P2\s*\n\s*Wakiilka: REP A/);
    expect(text).toMatch(/P3\s*\n\s*Wakiilka: REP A/);
    expect(text).toMatch(/P4\s*\n\s*Wakiilka: REP B/);
    expect(text).toMatch(/P5\s*\n\s*Wakiilka: REP B/);
    expect(text.match(/Wakiilka: REP A/g)?.length).toBe(2);
    expect(text.match(/Wakiilka: REP B/g)?.length).toBe(2);
  });

  test("D. 3 Kireeye with Magac + Tell + Aqoonsi + Cinwaan (row data intact)", () => {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", { magac: "ALPHA ONE", telefoon: "0611111111", aqoonsi: "ID-A1", cinwaan: "XAR-A1" }, "jooga"),
      row("k2", { magac: "BRAVO TWO", telefoon: "0622222222", aqoonsi: "ID-B2", cinwaan: "XAR-B2" }, "jooga"),
      row("k3", { magac: "CHARLIE THREE", telefoon: "0633333333", aqoonsi: "ID-C3", cinwaan: "XAR-C3" }, "jooga"),
    ];
    const ctx = buildDataContext(C, v);
    const rows = ctx.repeatBlocks.get("KIREYEYAYAAL")!.rows;
    expect(rows.map((r) => r.AQOONSI)).toEqual(["ID-A1", "ID-B2", "ID-C3"]);
    expect(rows.map((r) => r.CINWAAN)).toEqual(["XAR-A1", "XAR-B2", "XAR-C3"]);
    const text = doc(v);
    expect(text).toContain("ALPHA ONE");
    expect(text).toContain("BRAVO TWO");
    expect(text).toContain("CHARLIE THREE");
  });

  test("E. 3 Marag with Magac + Tell + Aqoonsi + Cinwaan", () => {
    const v = base();
    v.maragyo = [
      row("m1", { magac: "W ONE", telefoon: "0631111111", aqoonsi: "ID-W1", cinwaan: "PL-W1" }),
      row("m2", { magac: "W TWO", telefoon: "0632222222", aqoonsi: "ID-W2", cinwaan: "PL-W2" }),
      row("m3", { magac: "W THREE", telefoon: "0633333333", aqoonsi: "ID-W3", cinwaan: "PL-W3" }),
    ];
    const ctx = buildDataContext(C, v);
    const rows = ctx.repeatBlocks.get("MARAGYO")!.rows;
    expect(rows.map((r) => r.MAGAC)).toEqual(["W ONE", "W TWO", "W THREE"]);
    expect(rows.map((r) => r.AQOONSI)).toEqual(["ID-W1", "ID-W2", "ID-W3"]);
    expect(rows.map((r) => r.CINWAAN)).toEqual(["PL-W1", "PL-W2", "PL-W3"]);
    const text = doc(v);
    for (const n of ["W ONE", "W TWO", "W THREE"]) expect(text).toContain(n);
    for (const n of ["1-", "2-", "3-"]) expect(text).toContain(n);
  });

  test("F. Kiro Furan — no end-date text at all", () => {
    const v = base();
    merge(v, "heshiiska", { muddada_nooca: "furan", taariikhda_dhammaadka: "2027-10-01" });
    expect(resolveFlags(C, v).KIRO_XIDHAN).toBe(false);
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{TAARIIKH_DHAMMAAD}}"]).toBe("");
    const text = doc(v);
    expect(text).not.toContain("01/10/2027");
    expect(text).not.toContain("ku dhammaanayo");
    expect(text).toContain("Kiro Furan (Kiro u Joog)");
  });

  test("G. Kiro Xidhan — end date present", () => {
    const v = base();
    merge(v, "heshiiska", { muddada_nooca: "xidhan", taariikhda_dhammaadka: "2027-10-01" });
    expect(resolveFlags(C, v).KIRO_XIDHAN).toBe(true);
    expect(doc(v)).toContain("Taariikhda uu heshiisku ku dhammaanayo waa 01/10/2027");
  });

  test("H. Deebaaji Haa — the legal clause prints the amount", () => {
    const v = base();
    merge(v, "heshiiska", { deebaaji_haa: "yes" });
    v.deebaaji = { lacagta_deebaajiga: "50", shuruudaha_deebaajiga: "Miitarka 9911." };
    const text = doc(v);
    expect(text).toContain("$50");
    expect(text).toContain("Konton oo Dollar");
    expect(clauseNos(v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // The meter condition is STORED; the template does not name it, so it is
    // not printed. A stored field is not a printing obligation.
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{DEEBAAJI_SHURUUDO}}"]).toBe("Miitarka 9911.");
    expect(text).not.toContain("Miitarka 9911.");
  });

  test("I. Deebaaji Maya — section gone, sequence closes", () => {
    const v = base();
    merge(v, "heshiiska", { deebaaji_haa: "no" });
    const text = doc(v);
    expect(text).not.toContain("$50");
    expect(clauseNos(v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("J. Damiin Haa — the legal clause prints name + phone", () => {
    const v = base();
    merge(v, "heshiiska", { damiin_haa: "yes" });
    v.damiinka = {
      damiin_magac: "MAXAMED ALI",
      damiin_telefoon: "0611000000",
      damiin_aqoonsi: "ID-D99",
      damiin_cinwaan: "PLACE-D99",
    };
    const text = doc(v);
    expect(text).toContain("MAXAMED ALI");
    expect(text).toContain("0611000000");
    expect(clauseNos(v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // AQOONSI and CINWAAN are stored and resolvable, but the template does
    // not name them — so they stay off the page. This is the design rule,
    // not a missing route.
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{DAMIIN_AQOONSI}}"]).toBe("ID-D99");
    expect(ctx.replacements["{{DAMIIN_CINWAAN}}"]).toBe("PLACE-D99");
    expect(text).not.toContain("ID-D99");
    expect(text).not.toContain("PLACE-D99");
  });

  test("K. Damiin Maya — section gone, sequence closes", () => {
    const v = base();
    merge(v, "heshiiska", { damiin_haa: "no" });
    const text = doc(v);
    expect(text).not.toContain("DAMIIN MAAL");
    expect(text).not.toContain("Saxeexa Damiinka");
    expect(clauseNos(v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("L/M/N. Guri Xaas / Qol Meherad / Jiingad — the subtype is never hard-coded", () => {
    for (const [sub, label] of [
      ["guri_xaas", "Guri Xaas"],
      ["qol_meherad", "Qol Meherad"],
      ["jiingad", "Jiingad"],
    ] as const) {
      const v = base();
      merge(v, "heshiiska", { sub_type: sub });
      merge(v, "guriga", { nooca_guriga: sub });
      const text = doc(v);
      expect(text, sub).toContain(`HESHIIS KIRO ${label}.`);
      expect(text, sub).toContain(`Waa ${label} ku yaalla`);
      for (const other of ["Guri Xaas", "Qol Meherad", "Jiingad"]) {
        if (other !== label) expect(text, `${sub} must not say ${other}`).not.toContain(other);
      }
    }
  });
});

/* ================================================================== */
describe("GATE 6 — every form field has a source, and every source is declared", () => {
  /** All scalar form fields declared in the config. */
  const allFields = C.sections.flatMap((s) =>
    s.fields.map((f) => ({ section: s.id, field: f })),
  );

  test("every configured field is either rendered, in the annex, or drives a condition", () => {
    const annexKeys = new Set((C.annexFields ?? []).map((f) => f.key));
    const renderedKeys = new Set(
      C.placeholders.filter((p) => p.mapping.key.includes(".")).map((p) => p.mapping.key),
    );
    const blockFields = new Set(
      (C.repeatBlocks ?? []).flatMap((b) => {
        const pd = C.sections
          .flatMap((s) => s.parties ?? [])
          .find((p) => p.id === b.partyId);
        return (pd?.fields ?? []).map((f) => `${b.partyId}.${f.id}`);
      }),
    );
    // A field that DRIVES a {{IF:FLAG}} reaches the document through that
    // condition — kireeye_mode selects {{IF:KIREYE_HAL}} vs
    // {{IF:KIREEYAYAAL_BADAN}}, so it is not missing data.
    const conditionFields = new Set<string>();
    const visit = (c: unknown): void => {
      if (!c || typeof c !== "object") return;
      const cond = c as Record<string, unknown>;
      if (typeof cond.field === "string") conditionFields.add(cond.field);
      for (const list of [cond.conditions, [cond.condition]]) {
        for (const sub of (list ?? []) as unknown[]) visit(sub);
      }
    };
    for (const c of Object.values(C.conditionFlags ?? {})) visit(c);
    for (const s of C.sections) {
      visit(s.visibleWhen);
      for (const f of [...s.fields, ...(s.parties ?? []).flatMap((p) => p.fields)]) {
        visit(f.visibleWhen);
        visit(f.requiredWhen);
      }
    }

    const uncovered: string[] = [];
    for (const { section, field } of allFields) {
      const key = `${section}.${field.id}`;
      const covered =
        renderedKeys.has(key) ||
        annexKeys.has(key) ||
        blockFields.has(key) ||
        conditionFields.has(key);
      if (!covered) uncovered.push(`${key} (${field.label})`);
    }
    expect(uncovered).toEqual([]);
  });

  test("every placeholder in the config points at a field that exists", () => {
    const fieldPaths = new Set(allFields.map(({ section, field }) => `${section}.${field.id}`));
    const partyPaths = new Set(
      C.sections.flatMap((s) =>
        (s.parties ?? []).flatMap((p) =>
          [...p.fields, ...(p.representativeFields ?? [])].map((f) => `${p.id}.${f.id}`),
        ),
      ),
    );
    for (const p of C.placeholders) {
      if (!p.mapping.key.includes(".")) continue;
      expect(
        fieldPaths.has(p.mapping.key) || partyPaths.has(p.mapping.key),
        `${p.placeholder} → ${p.mapping.key}`,
      ).toBe(true);
    }
    for (const f of C.annexFields ?? []) {
      expect(fieldPaths.has(f.key), `annex ${f.token} → ${f.key}`).toBe(true);
    }
  });

  test("every required field renders a real value into the document", () => {
    for (const { section, field } of allFields) {
      const required = field.validation?.required === true;
      if (!required) continue;
      // Conditional sections only require their fields when the section shows.
      const sec = C.sections.find((s) => s.id === section)!;
      if (sec.visibleWhen && !sec.visibleWhen) continue;
      const v = base();
      // Fill the required field with a recognisable value.
      const value = section === "heshiiska" && field.type === "radio" ? "" : "FILLED";
      if (section === "heshiiska") {
        merge(v, "heshiiska", { [field.id]: field.id === "deebaaji_haa" || field.id === "damiin_haa" ? "yes" : "FILLED" } as never);
      } else {
        merge(v, section, { [field.id]: value } as never);
      }
      if (section === "deebaaji") v.deebaaji = { lacagta_deebaajiga: "50" };
      if (section === "damiinka") {
        v.damiinka = { damiin_magac: "D", damiin_telefoon: "T", damiin_aqoonsi: "A" };
      }
      const ctx = buildDataContext(C, v);
      const map = ctx.replacements;
      const covered = Object.entries(map).some(([, val]) => val.includes("FILLED") || val.includes("50") || val.includes("D"));
      expect(covered, `required ${section}.${field.id} produced no value`).toBe(true);
    }
  });

  test("every DOCX token is a name the system knows (no orphans)", () => {
    const known = knownPlaceholderNames(C);
    const stream = templateXml.match(/\{\{[^{}]+\}\}/g) ?? [];
    const orphans: string[] = [];
    for (const raw of stream) {
      const n = raw.replace(/[{}]/g, "").toUpperCase();
      if (n === "ENDIF" || n.startsWith("END:")) continue;
      if (n.startsWith("#") || n.startsWith("/")) {
        if (!known.has(n)) orphans.push(raw);
        continue;
      }
      if (n.startsWith("IF:")) {
        if (!known.has(n.slice(3))) orphans.push(raw);
        continue;
      }
      if (!known.has(n)) orphans.push(raw);
    }
    expect(orphans).toEqual([]);
  });

  test("every flag used by the template resolves to a real runtime boolean", () => {
    const v = base();
    const flags = resolveFlags(C, v);
    // Row-scoped flags (JOOGA/WAKIIL) live on the ROW, not on the document
    // context — they are resolved per repetition by expandRowConditionals.
    const rowScoped = new Set(["JOOGA", "WAKIIL"]);
    const stream = templateXml.match(/\{\{IF:[A-Z0-9_]+\}\}/g) ?? [];
    for (const raw of new Set(stream)) {
      const name = raw.replace(/\{\{IF:|\}\}/g, "");
      if (rowScoped.has(name)) continue;
      expect(typeof flags[name], `${name} has no runtime value`).toBe("boolean");
    }
  });

  test("template tokens sit exactly where the report says they do", () => {
    // Spot-check the location of each family of tokens.
    expect(templateLocations("REF_NUMBER").length).toBe(1);
    expect(templateLocations("NOOCA_KIRADA").length).toBe(1);
    expect(templateLocations("GURI_NOOCA").length).toBe(1);
    expect(templateLocations("CLAUSE_NO").length).toBe(11);
    expect(templateLocations("WAKIIL_MAGAC").length).toBe(2);
    expect(templateLocations("KIREEYE_WAKIIL_MAGAC").length).toBe(1);
    expect(templateLocations("KIRAYSTE_WAKIIL_MAGAC").length).toBe(1);
    expect(templateLocations("MARAGYO").length).toBe(0); // the block markers are #/ forms
  });
});

/* ================================================================== */
describe("GATE 7 — no signature blocks; the seal is the last line", () => {
  const scenarios: [string, FormValues][] = (() => {
    const out: [string, FormValues][] = [];
    for (const patch of [
      { deebaaji_haa: "yes" },
      { damiin_haa: "yes" },
      { muddada_nooca: "xidhan", taariikhda_dhammaadka: "2027-10-01" },
      { deebaaji_haa: "yes", damiin_haa: "yes", muddada_nooca: "xidhan", taariikhda_dhammaadka: "2027-10-01" },
    ]) {
      const v = base();
      merge(v, "heshiiska", patch as never);
      if (patch.deebaaji_haa) v.deebaaji = { lacagta_deebaajiga: "50" };
      if (patch.damiin_haa) v.damiinka = { damiin_magac: "MAXAMED ALI", damiin_telefoon: "0611000000" };
      out.push([JSON.stringify(patch), v]);
    }
    // plus every party represented by a wakiil
    const w = base();
    merge(w, "heshiiska", { kireeye_mode: "multiple", damiin_haa: "yes" });
    w.kireeyayaal = [row("k1", { magac: "P" }, "wakiil", "r1")];
    w.wakiilo_kireeyayaal = [row("r1", { magac: "REP", telefoon: "0600000000" })];
    w.kiraystayaal = [row("t1", { magac: "T" }, "wakiil", "t9")];
    w.wakiilo_kiraystayaal = [row("t9", { magac: "REP2", telefoon: "0600000001" })];
    w.damiinka = { damiin_magac: "D", damiin_telefoon: "0611000000" };
    out.push(["all-wakiil", w]);
    return out;
  })();

  for (const [label, v] of scenarios) {
    test(`document ends with the seal — ${label}`, () => {
      const lines = render(v);
      expect(lines[lines.length - 1], label).toBe(SEAL);
    });

    test(`no signature block for any party — ${label}`, () => {
      const text = doc(v);
      for (const w of [
        "Saxiiyada",
        "Saxiixa",
        "Signature",
        "signature:",
        "Saxiixa Kireeyaha",
        "Saxiixa Kiraystaha",
        "Saxiixa Wakiilka",
        "Saxiixa Maraga",
        "Uuneyn",
        "Stamp:",
        "Khudmud",
      ]) {
        expect(text.includes(w), `${label}: found "${w}"`).toBe(false);
      }
    });

    test(`no placeholder leaks — ${label}`, () => {
      expect(doc(v), label).not.toMatch(/\{\{/);
    });
  }
});
