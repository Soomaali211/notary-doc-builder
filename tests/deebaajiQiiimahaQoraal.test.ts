/**
 * {{DEEBAAJI_QIIMAHA_QORAAL}} — DERIVED deposit amount in Somali words.
 *
 * The contract must be able to print the deposit BOTH as a number and in
 * words, exactly as it does for the rent. The user only ever types the
 * NUMBER in the form; the words are computed by the formatter.
 *
 * Chain proved here: FORM → RESOLVER → FORMATTER → TEMPLATE → RENDERED DOCX
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
import { canonicalNameFor, placeholderRegistry } from "../src/lib/notary/placeholderRegistry";
import { heshiisKiroConfig as C } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

let templateXml = "";
{
  const buf = readFileSync("public/templates/heshiis_kiro_template_v2.docx");
  const zip = await JSZip.loadAsync(buf);
  templateXml = await zip.file("word/document.xml")!.async("string");
}

function row(id: string, v: Record<string, string>, status?: string): PartyRow {
  return {
    id,
    values: v,
    ...(status ? { attendance: { status: status as never } } : {}),
  } as PartyRow;
}

function base(deposit: string, deebaajiHa = "yes"): FormValues {
  return {
    heshiiska: {
      sub_type: "guri_xaas",
      kireeye_mode: "single",
      kirayste_mode: "single",
      muddada_nooca: "furan",
      deebaaji_haa: deebaajiHa,
      damiin_haa: "no",
      taariikhda_bilowga: "2026-10-01",
      reference: "DPN-K-0001",
      taariikhda_heshiiska: "2026-10-02",
    },
    guriga: { nooca_guriga: "guri_xaas", goobta: "Hargeisa", cinwaanka_guriga: "Xariif" },
    lacagta: {
      qiimaha_bil_ka: "300",
      habka_bixinta: "cash",
      taariikhda_bixinta: "1aad",
      bixinta_hore: "muqadin",
    },
    deebaaji: { lacagta_deebaajiga: deposit },
    ogaysiinta: { mudada_ogaysiinta: "30 maalmood", shuruudaha_joojinta: "X" },
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
const depositClause = (v: FormValues): string =>
  render(v).find((l) => l.includes("2 Bilood Ogaysiisa")) ?? "";

/* ================================================================== */
describe("FORM — the user is only ever asked for a NUMBER", () => {
  test("the deposit field is a currency field, not free text", () => {
    const field = C.sections
      .flatMap((s) => s.fields)
      .find((f) => f.id === "lacagta_deebaajiga");
    expect(field).toBeDefined();
    expect(field!.type).toBe("currency");
    expect(field!.id).toBe("lacagta_deebaajiga");
  });

  test("there is NO form field for the words value", () => {
    // The words must be impossible to type: no field, no key, nothing.
    const ids = C.sections.flatMap((s) => s.fields.map((f) => f.id));
    expect(ids.some((i) => /qoraal/i.test(i))).toBe(false);
    const mapping = C.placeholders.find(
      (p) => p.placeholder === "{{DEEBAAJI_QIIMAHA_QORAAL}}",
    );
    // It maps to the SAME numeric field — there is no separate source.
    expect(mapping?.mapping.key).toBe("deebaaji.lacagta_deebaajiga");
    expect(mapping?.mapping.format).toBe("currency_words");
  });
});

/* ================================================================== */
describe("RESOLVER — both tokens read the one form field", () => {
  test("{{DEEBAAJI_QIIMAHA}} and {{DEEBAAJI_QIIMAHA_QORAAL}} share one source", () => {
    const numeric = C.placeholders.find((p) => p.placeholder === "{{DEEBAAJI_QIIMAHA}}");
    const words = C.placeholders.find((p) => p.placeholder === "{{DEEBAAJI_QIIMAHA_QORAAL}}");
    expect(numeric?.mapping.key).toBe(words?.mapping.key);
    expect(numeric?.mapping.format).toBe("currency");
    expect(words?.mapping.format).toBe("currency_words");
  });

  test("both resolve from the same form answer", () => {
    const map = computeReplacements(C, base("300"));
    expect(map["{{DEEBAAJI_QIIMAHA}}"]).toBe("$300");
    expect(map["{{DEEBAAJI_QIIMAHA_QORAAL}}"]).toBe("Saddex Boqol oo Dollar");
  });
});

/* ================================================================== */
describe("FORMATTER — amount in Somali words", () => {
  const cases: [string, string][] = [
    ["50", "Konton oo Dollar"],
    ["200", "Laba Boqol oo Dollar"],
    ["300", "Saddex Boqol oo Dollar"],
    ["1000", "Koow Kun oo Dollar"],
    ["1250", "Koow Kun iyo Laba Boqol iyo Konton oo Dollar"],
  ];

  for (const [input, words] of cases) {
    test(`$${input} → ${words}`, () => {
      const map = computeReplacements(C, base(input));
      expect(map["{{DEEBAAJI_QIIMAHA_QORAAL}}"]).toBe(words);
    });
  }

  test("the words always carry the configured currency unit", () => {
    for (const [input] of cases) {
      const map = computeReplacements(C, base(input));
      expect(map["{{DEEBAAJI_QIIMAHA_QORAAL}}"]).toContain("oo Dollar");
    }
  });

  test("the deposit and the rent are formatted independently", () => {
    // Rent 300, deposit 1250 — each token follows its OWN field.
    const map = computeReplacements(C, base("1250"));
    expect(map["{{KIRADA_QIIMAHA_QORAAL}}"]).toBe("Saddex Boqol oo Dollar");
    expect(map["{{DEEBAAJI_QIIMAHA_QORAAL}}"]).toBe(
      "Koow Kun iyo Laba Boqol iyo Konton oo Dollar",
    );
  });
});

/* ================================================================== */
describe("TEMPLATE — the token is present in the shipped DOCX", () => {
  test("{{DEEBAAJI_QIIMAHA_QORAAL}} appears in the template", () => {
    expect(templateXml).toContain("{{DEEBAAJI_QIIMAHA_QORAAL}}");
  });

  test("it sits in the deposit clause, next to the numeric amount", () => {
    const line = templateXml
      .match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)!
      .map((p) =>
        (
          (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((m) =>
            m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, "$1"),
          ) as string[]
        ).join(""),
      )
      .find((t) => t.includes("{{DEEBAAJI_QIIMAHA_QORAAL}}"));
    expect(line).toBeDefined();
    expect(line).toContain("{{DEEBAAJI_QIIMAHA}}");
    expect(line).toContain("{{CLAUSE_NO}}");
    expect(line).toContain("2 Bilood Ogaysiisa");
  });

  test("it is a known name to the validator (no orphan)", () => {
    expect(knownPlaceholderNames(C).has("DEEBAAJI_QIIMAHA_QORAAL")).toBe(true);
    expect(canonicalNameFor(placeholderRegistry(C.id), "DEEBAAJI_QIIMAHA_QORAAL")).toBe(
      "DEEBAAJI_QIIMAHA_QORAAL",
    );
  });
});

/* ================================================================== */
describe("RENDERED DOCX — the words actually reach the document", () => {
  const cases: [string, string, string][] = [
    ["50", "$50", "Konton oo Dollar"],
    ["200", "$200", "Laba Boqol oo Dollar"],
    ["300", "$300", "Saddex Boqol oo Dollar"],
    ["1000", "$1,000", "Koow Kun oo Dollar"],
    ["1250", "$1,250", "Koow Kun iyo Laba Boqol iyo Konton oo Dollar"],
  ];

  for (const [input, num, words] of cases) {
    test(`deposit ${input} → clause prints "${num} ${words}"`, () => {
      const clause = depositClause(base(input));
      expect(clause).toContain(num);
      expect(clause).toContain(words);
      // Both together, in that order, on the same clause line.
      expect(clause).toContain(`${num} ${words}`);
    });
  }

  test("no placeholder leaks in any deposit scenario", () => {
    for (const [input] of cases) {
      expect(doc(base(input)), input).not.toMatch(/\{\{/);
    }
  });

  test("the words value is never printed when there is no deposit", () => {
    const off = base("50", "no");
    const text = doc(off);
    expect(text).not.toContain("2 Bilood Ogaysiisa");
    expect(text).not.toContain("$50");
    expect(text).not.toContain("Konton oo Dollar");
    expect(resolveFlags(C, off).DEEBAAJI_HAA).toBe(false);
  });

  test("an empty deposit prints neither amount nor words", () => {
    const v = base("50");
    v.deebaaji = { lacagta_deebaajiga: "" };
    const text = doc(v);
    // The clause still exists (Deebaaji = Haa) but carries no amount.
    expect(text).toContain("2 Bilood Ogaysiasa".replace("Ogaysiasa", "Ogaysiisa"));
    expect(text).not.toContain("Konton oo Dollar");
  });

  test("clause numbering still closes when the deposit clause is present", () => {
    const withDep = render(base("300")).map(
      (l) => /^\s*(\d+)\.\s+\S/.exec(l)?.[1],
    ).filter(Boolean).map(Number);
    expect(withDep).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const without = render(base("300", "no")).map(
      (l) => /^\s*(\d+)\.\s+\S/.exec(l)?.[1],
    ).filter(Boolean).map(Number);
    expect(without).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("the document still ends with the notary seal", () => {
    const lines = render(base("300"));
    expect(lines[lines.length - 1]).toBe(
      "(Sarkaalka Xafiiska Nootaayada Sharciga ah Ee Daloodho)",
    );
  });

  test("no signature block is introduced by the new token", () => {
    const text = doc(base("300"));
    for (const w of ["Saxiiyada", "Signature", "Stamp:"]) {
      expect(text.includes(w), w).toBe(false);
    }
  });
});
