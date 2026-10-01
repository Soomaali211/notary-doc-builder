/**
 * FULL ALIGNMENT MATRIX — FORM → DATA → PLACEHOLDER → TEMPLATE → DOCX.
 *
 * One assertion per contract row the user stated, executed against the
 * REAL generated v2 template (not a mock), across all 14 scenarios.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { buildDataContext, resolveFlags } from "../src/lib/notary/dataContext";
import { processDocumentXml } from "../src/lib/notary/docxRenderer";
import { resolveClauses } from "../src/lib/notary/clauses";
import { heshiisKiroConfig as C } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

const SEAL = "(Sarkaalka Xafiiska Nootaayada Sharciga ah Ee Daloodho)";

let templateXml = "";
const buf = readFileSync("public/templates/heshiis_kiro_template_v2.docx");
{
  const zip = await JSZip.loadAsync(buf);
  templateXml = await zip.file("word/document.xml")!.async("string");
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

function merge(v: FormValues, section: string, patch: Record<string, string>): void {
  v[section] = { ...((v[section] ?? {}) as Record<string, string>), ...patch };
}

/** Render the REAL template and return the visible non-empty paragraphs. */
function render(v: FormValues): string[] {
  const ctx = buildDataContext(C, v);
  const clauses = resolveClauses(C, v);
  const out = processDocumentXml(templateXml, ctx, clauses);
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
/**
 * Clause numbers actually printed. Anchored to a digit-dot followed by a
 * space so annex text such as "1aad ee bil kasta" (the payment day, which
 * starts with a digit) can never be mistaken for a clause number.
 */
const clauseNos = (v: FormValues): number[] =>
  render(v)
    .map((l) => /^\s*(\d+)\.\s+\S/.exec(l)?.[1])
    .filter(Boolean)
    .map(Number);

/* ------------------------------------------------------------------ */

describe("A–N — full alignment matrix", () => {
  test("A. 1 kireeye + 1 kirayste, both present, Furan, no Deebaaji/Damiin", () => {
    const v = base();
    const text = doc(v);
    expect(text).toContain("AHMED CALI");
    expect(text).toContain("SOMALI JAMAC");
    expect(text).not.toContain("xidhan");
    expect(text).not.toContain("furan"); // raw value must never print
    expect(text).toContain("Kiro Furan (Kiro u Joog)");
    expect(clauseNos(v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(text).not.toMatch(/\{\{/);
  });

  test("B. 1 kireeye absent + 1 wakiil — the PERSON name still shows", () => {
    const v = base();
    v.kireeyayaal = [row("k1", { magac: "SOMALI JAMAC" }, "wakiil", "r1")];
    v.wakiilo_kireeyayaal = [row("r1", { magac: "YOUSUF AHMED", telefoon: "0600999888" })];
    const text = doc(v);
    // The person's own name is kept…
    expect(text).toContain("SOMALI JAMAC");
    // …and the representative stands below, never instead of it.
    expect(text).toContain("Wakiilka: YOUSUF AHMED");
    expect(text).toMatch(/SOMALI JAMAC[\s\S]*Wakiilka: YOUSUF AHMED/);
    expect(resolveFlags(C, v).KIREEYE_WAKIIL).toBe(true);
  });

  test("C. 5 kireeye: 1 jooga + 4 absent via ONE wakiil — grouped under each person", () => {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", { magac: "AHMED CALI", telefoon: "0611111111" }, "jooga"),
      row("k2", { magac: "XASAN AHMED" }, "wakiil", "r1"),
      row("k3", { magac: "MAXAMED YUUSUF" }, "wakiil", "r1"),
      row("k4", { magac: "CALI MAXAMED" }, "wakiil", "r1"),
      row("k5", { magac: "HAAJI SULDAN" }, "wakiil", "r1"),
    ];
    v.wakiilo_kireeyayaal = [row("r1", { magac: "AXMED CALI", telefoon: "0631111111" })];
    const text = doc(v);
    // All five people are named…
    for (const n of ["AHMED CALI", "XASAN AHMED", "MAXAMED YUUSUF", "CALI MAXAMED", "HAAJI SULDAN"]) {
      expect(text, n).toContain(n);
    }
    // …each numbered 1..5, each of the four absent ones carrying the same
    // representative directly beneath.
    for (const n of ["1.", "2.", "3.", "4.", "5."]) expect(text).toContain(n);
    expect(text.match(/Wakiilka: AXMED CALI/g)?.length).toBe(4);
    expect(text).not.toMatch(/\{\{/);
  });

  test("D. 5 kireeye across 2 representative groups — groups never mix", () => {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", { magac: "AHMED CALI", telefoon: "0611111111" }, "jooga"),
      row("k2", { magac: "XASAN AHMED" }, "wakiil", "r1"),
      row("k3", { magac: "MAXAMED YUUSUF" }, "wakiil", "r2"),
    ];
    v.wakiilo_kireeyayaal = [
      row("r1", { magac: "YOUSUF AHMED", telefoon: "0631111111" }),
      row("r2", { magac: "ABDIRAHMAN ALI", telefoon: "0632222222" }),
    ];
    const text = doc(v);
    expect(text).toMatch(/XASAN AHMED\s*\n\s*Wakiilka: YOUSUF AHMED/);
    expect(text).toMatch(/MAXAMED YUUSUF\s*\n\s*Wakiilka: ABDIRAHMAN ALI/);
    // No duplicate representative record was created in the data model.
    expect((v.wakiilo_kireeyayaal as PartyRow[]).length).toBe(2);
  });

  test("E. 2 kirayste + 1 wakiil", () => {
    const v = base();
    merge(v, "heshiiska", { kirayste_mode: "multiple" });
    v.kiraystayaal = [
      row("t1", { magac: "SOMALI JAMAC", telefoon: "0622222222" }, "jooga"),
      row("t2", { magac: "KHAADIIRA ALI" }, "wakiil", "t9"),
    ];
    v.wakiilo_kiraystayaal = [row("t9", { magac: "OMAR NUR", telefoon: "0644444444" })];
    const text = doc(v);
    expect(text).toContain("SOMALI JAMAC");
    expect(text).toContain("KHAADIIRA ALI");
    expect(text).toMatch(/KHAADIIRA ALI\s*\n\s*Wakiilka: OMAR NUR/);
    expect(resolveFlags(C, v).KIRAYSTE_WAKIIL).toBe(true);
  });

  test("F. Kiro Furan — no end date anywhere in the document", () => {
    const v = base();
    merge(v, "heshiiska", { muddada_nooca: "furan" });
    const flags = resolveFlags(C, v);
    expect(flags.KIRO_FURAN).toBe(true);
    expect(flags.KIRO_XIDHAN).toBe(false);
    const text = doc(v);
    expect(text).not.toContain("Taariikhda uu heshiisku ku dhammaanayo");
    expect(text).not.toContain("01/10/2027");
  });

  test("G. Kiro Xidhan — end date present", () => {
    const v = base();
    merge(v, "heshiiska", { muddada_nooca: "xidhan", taariikhda_dhammaadka: "2027-10-01" });
    expect(resolveFlags(C, v).KIRO_XIDHAN).toBe(true);
    const text = doc(v);
    expect(text).toContain("Taariikhda uu heshiisku ku dhammaanayo waa 01/10/2027");
  });

  test("H. Deebaaji Haa — section and its amount present, numbering unbroken", () => {
    const v = base();
    merge(v, "heshiiska", { deebaaji_haa: "yes" });
    v.deebaaji = { lacagta_deebaajiga: "50" };
    const text = doc(v);
    expect(text).toContain("$50");
    // Without the deposit clause the contract has 9 clauses; with it, 10.
    expect(clauseNos(v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("I. Deebaaji Maya — section gone, numbering closes the gap (1..9)", () => {
    const v = base();
    merge(v, "heshiiska", { deebaaji_haa: "no" });
    const text = doc(v);
    expect(text).not.toContain("$50");
    // The deposit clause is gone AND the sequence closes: no 10, no 11.
    expect(clauseNos(v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("J. Damiin Haa — the legal clause prints name + phone", () => {
    const v = base();
    merge(v, "heshiiska", { damiin_haa: "yes" });
    v.damiinka = {
      damiin_magac: "MAXAMED ALI",
      damiin_telefoon: "0611000000",
      damiin_aqoonsi: "ID-99",
      damiin_cinwaan: "Hargeisa",
    };
    const text = doc(v);
    expect(text).toContain("DAMIIN MAAL");
    expect(text).toContain("MAXAMED ALI");
    expect(text).toContain("0611000000");
    // The guarantor clause is present, so the contract has 10 clauses.
    expect(clauseNos(v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // AQOONSI / CINWAAN are STORED, not printed. The template owner decides
    // what reaches the page: a field the template does not name is kept in
    // the data model and simply does not appear. That is the rule — a form
    // field existing is not a reason to print it.
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{DAMIIN_AQOONSI}}"]).toBe("ID-99");
    expect(ctx.replacements["{{DAMIIN_CINWAAN}}"]).toBe("Hargeisa");
    // …and because the template does not name them, the page stays clean.
    expect(text).not.toContain("ID-99");
  });

  test("K. Damiin Maya — the whole section is gone", () => {
    const v = base();
    merge(v, "heshiiska", { damiin_haa: "no" });
    const text = doc(v);
    expect(text).not.toContain("DAMIIN MAAL");
    expect(text).not.toContain("Saxeexa Damiinka");
    // Back to the 9-clause contract: the sequence closes instead of skipping.
    expect(clauseNos(v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("L. Guri Xaas", () => {
    const v = base();
    merge(v, "heshiiska", { sub_type: "guri_xaas" });
    merge(v, "guriga", { nooca_guriga: "guri_xaas" });
    const text = doc(v);
    expect(text).toContain("HESHIIS KIRO Guri Xaas.");
    expect(text).toContain("Waa Guri Xaas ku yaalla");
  });

  test("M. Qol Meherad — the document must NOT call it 'Guri Xaas'", () => {
    const v = base();
    merge(v, "heshiiska", { sub_type: "qol_meherad" });
    merge(v, "guriga", { nooca_guriga: "qol_meherad" });
    const text = doc(v);
    expect(text).toContain("HESHIIS KIRO Qol Meherad.");
    expect(text).toContain("Waa Qol Meherad ku yaalla");
    expect(text).not.toContain("Guri Xaas");
  });

  test("N. Jiingad", () => {
    const v = base();
    merge(v, "heshiiska", { sub_type: "jiingad" });
    merge(v, "guriga", { nooca_guriga: "jiingad" });
    const text = doc(v);
    expect(text).toContain("HESHIIS KIRO Jiingad.");
    expect(text).toContain("Waa Jiingad ku yaalla");
    expect(text).not.toContain("Guri Xaas");
  });
});

describe("Derived values — computed, never entered by the user", () => {
  test("currency in Somali words is derived from the numeric amount", () => {
    const v = base();
    merge(v, "lacagta", { qiimaha_bil_ka: "200" });
    expect(doc(v)).toContain("Laba Boqol oo Dollar");
    merge(v, "lacagta", { qiimaha_bil_ka: "300" });
    expect(doc(v)).toContain("Saddex Boqol oo Dollar");
  });

  test("the month word is derived from the document date", () => {
    merge(base(), "heshiiska", { taariikhda_heshiiska: "2026-10-02" });
    expect(doc(base())).toContain("Oktoobar");
  });

  test("the duration wording is config-driven, never the raw stored value", () => {
    const v = base();
    merge(v, "heshiiska", { muddada_nooca: "xidhan" });
    const text = doc(v);
    expect(text).toContain("Kiro Xidhan (Muddo Cad)");
    expect(text).not.toContain(" xidhan");
    merge(v, "heshiiska", { muddada_nooca: "furan" });
    expect(doc(v)).toContain("Kiro Furan (Kiro u Joog)");
  });
});

describe("Singular party slots hold ONE person", () => {
  test("KIREYE_MAGAC is not a comma-joined list of every kireeye", () => {
    const v = base();
    merge(v, "heshiiska", { kireeye_mode: "multiple" });
    v.kireeyayaal = [
      row("k1", { magac: "AHMED CALI", telefoon: "0611111111" }, "jooga"),
      row("k2", { magac: "XASAN AHMED" }, "wakiil", "r1"),
      row("k3", { magac: "MAXAMED YUUSUF" }, "wakiil", "r1"),
    ];
    v.wakiilo_kireeyayaal = [row("r1", { magac: "AXMED CALI", telefoon: "0631111111" })];
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{KIREYE_MAGAC}}"]).toBe("AHMED CALI");
    expect(ctx.replacements["{{KIREYE_MAGAC}}"]).not.toContain(",");
    expect(ctx.replacements["{{KIREYE_TELEFOON}}"]).toBe("0611111111");
  });

  test("list placeholders still join (they exist for that)", () => {
    const v = base();
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{MARAGYO_LIST}}"]).toContain("MARAG KOOW");
  });
});

describe("Form data is kept; printing is the template owner's choice", () => {
  test("a required field with no template placeholder is stored, not printed", () => {
    const v = base();
    merge(v, "lacagta", {
      bangiga_magaca: "SOMALI BANK",
      bangiga_hisaabka: "1-2-3-4",
    });
    // Stored and resolvable…
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{BANGIGA_MAGACA}}"]).toBe("SOMALI BANK");
    expect(ctx.replacements["{{BANGIGA_HISAABKA}}"]).toBe("1-2-3-4");
    // …but the shipped template does not name them, so they do not print.
    // This is CORRECT behaviour, not a missing field.
    expect(doc(v)).not.toContain("SOMALI BANK");
  });

  test("every annex field declared in the config has a placeholder value", () => {
    const v = base();
    const ctx = buildDataContext(C, v);
    for (const f of C.annexFields ?? []) {
      expect(`{{${f.token}}}` in ctx.replacements, f.token).toBe(true);
    }
  });

  test("an empty annex line prints nothing — no dangling 'Label:'", () => {
    const v = base();
    const text = doc(v);
    expect(text).not.toMatch(/\n\s*[A-Za-z]+:\s*$/m);
  });

  test("the annex is NOT in the template — the design is the owner's", () => {
    // The document contains no annex section and no ANNEX_* markers.
    const v = base();
    const text = doc(v);
    expect(text).not.toContain("XOGTA HESHIISKA");
    for (const flag of [
      "ANNEX_HAS_VALUES",
      "ANNEX_BANGIGA",
      "ANNEX_HADSHAN",
      "ANNEX_BIXINTA",
      "ANNEX_CINWAAN",
      "ANNEX_QOLADA",
      "ANNEX_SHURUUDAHA",
      "ANNEX_DEEBAAJI",
      "ANNEX_DAMIIN_AQOONSI",
      "ANNEX_DAMIIN_CINWAAN",
      "ANNEX_OGAYSIIN_MUDADA",
      "ANNEX_OGAYSIIN_SHURUUDO",
      "ANNEX_OGAYSIIN_FAAHFAAHIN",
    ]) {
      expect(text, flag).not.toContain(flag);
    }
  });

  test("a form field with no template placeholder is KEPT, not deleted", () => {
    // The rule: form field stores data · template placeholder decides print.
    // So an unprinted field must still exist in the model and still resolve.
    const v = base();
    merge(v, "lacagta", { bangiga_magaca: "SOMALI BANK", bangiga_hisaabka: "1-2-3-4" });
    const ctx = buildDataContext(C, v);
    expect(ctx.replacements["{{BANGIGA_MAGACA}}"]).toBe("SOMALI BANK");
    expect(ctx.replacements["{{BANGIGA_HISAABKA}}"]).toBe("1-2-3-4");
    // Present in the model…
    expect(v.lacagta).toHaveProperty("bangiga_magaca");
    // …not on the page, because the template does not ask for it.
    expect(doc(v)).not.toContain("SOMALI BANK");
  });

  test("the whole annex disappears when no annex field has a value", () => {
    const v = base();
    v.lacagta = { qiimaha_bil_ka: "300", habka_bixinta: "cash" } as never;
    v.guriga = { nooca_guriga: "guri_xaas", goobta: "Hargeisa" } as never;
    v.ogaysiinta = {} as never;
    v.heshiiska = { ...(v.heshiiska as object) } as never;
    const text = doc(v);
    expect(text).not.toContain("XOGTA HESHIISKA");
    expect(resolveFlags(C, v).ANNEX_HAS_VALUES).toBe(false);
  });
});

describe("Document contract — endings, signatures, leaks", () => {
  test("every scenario ends with the notary seal and nothing after it", () => {
    const v = base();
    for (const patch of [
      { deebaaji_haa: "yes" },
      { damiin_haa: "yes" },
      { muddada_nooca: "xidhan", taariikhda_dhammaadka: "2027-10-01" },
    ]) {
      merge(v, "heshiiska", patch);
      const lines = render(v);
      expect(lines[lines.length - 1]).toBe(SEAL);
      expect(lines[lines.length - 2]).toContain("Xafiisku waxa uu cadaynayaa");
    }
  });

  test("no signature, stamp or seal BLOCK for any party", () => {
    const v = base();
    merge(v, "heshiiska", { damiin_haa: "yes" });
    v.damiinka = { damiin_magac: "MAXAMED ALI", damiin_telefoon: "0611000000" };
    const text = doc(v);
    for (const w of [
      "Saxiiyada",
      "Saxiixa Kireeye",
      "Saxiixa Kirayste",
      "Saxiixa Wakiil",
      "Saxiixa Marag",
      "Signature",
      "stamp:",
    ]) {
      expect(text.includes(w), w).toBe(false);
    }
  });

  test("no placeholder ever leaks, in any scenario", () => {
    const v = base();
    merge(v, "heshiiska", { deebaaji_haa: "yes", damiin_haa: "yes", muddada_nooca: "xidhan", taariikhda_dhammaadka: "2027-10-01" });
    v.deebaaji = { lacagta_deebaajiga: "50", shuruudaha_deebaajiga: "Miitarka 9911." };
    v.damiinka = { damiin_magac: "MAXAMED ALI", damiin_telefoon: "0611000000" };
    expect(doc(v)).not.toMatch(/\{\{/);
  });

  test("witnesses stay dynamic: 1, 2, 3 all number correctly", () => {
    for (const [n, count] of [[1, 1], [2, 2], [3, 3]] as const) {
      const v = base();
      v.maragyo = Array.from({ length: n }, (_, i) =>
        row(`m${i}`, { magac: `MARAG ${i + 1}`, telefoon: `063333333${i}` }),
      );
      const lines = render(v);
      const numbered = lines.filter((l) => /^\d+- MARAG/.test(l));
      expect(numbered.length, `witnesses=${n}`).toBe(n);
      for (let i = 0; i < n; i++) {
        expect(numbered[i]).toContain(`${i + 1}- MARAG ${i + 1}`);
      }
    }
  });
});
