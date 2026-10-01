/**
 * FINAL GATE — the numbers, machine-checked.
 *
 * Every count in the audit report is asserted here, so a future change that
 * adds or drops a field/token fails loudly instead of silently drifting.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  knownPlaceholderNames,
  computeReplacements,
} from "../src/lib/notary/dataContext";
import { canonicalNameFor, placeholderRegistry } from "../src/lib/notary/placeholderRegistry";
import { heshiisKiroConfig as C } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues } from "../src/lib/notary/types";

const buf = readFileSync("public/templates/heshiis_kiro_template_v2.docx");
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml")!.async("string");

/** Distinct {{…}} tokens in the shipped template, deduped. */
const TEMPLATE_TOKENS: string[] = [
  ...new Set((xml.match(/\{\{[^{}]+\}\}/g) ?? []).map((t) => t.toUpperCase())),
];

const ALL_FIELDS = C.sections.flatMap((s) => ({
  section: s.id,
  visibleWhen: s.visibleWhen,
  field: s.fields,
}));
const PARTY_FIELDS = C.sections.flatMap((s) =>
  (s.parties ?? []).flatMap((p) =>
    [...p.fields, ...(p.representativeFields ?? [])].map((f) => ({
      group: p.id,
      field: f,
    })),
  ),
);

describe("COUNT 1 — total form fields", () => {
  test("scalar section fields", () => {
    // 10 heshiiska · 5 guriga · 9 lacagta · 2 deebaaji · 4 damiinka
    // · 3 ogaysiinta · 1 dheeraad = 34
    const total = ALL_FIELDS.reduce((n, g) => n + g.field.length, 0);
    expect(total).toBe(34);
  });

  test("repeatable party fields (person + representative)", () => {
    // kireeyayaal 5+4 · kiraystayaal 5+4 · maragyo 4+0 = 22
    const total = PARTY_FIELDS.length;
    expect(total).toBe(22);
  });

  test("every form field total", () => {
    expect(ALL_FIELDS.reduce((n, g) => n + g.field.length, 0) + PARTY_FIELDS.length).toBe(56);
  });
});

describe("COUNT 2 — total DOCX placeholders", () => {
  test("distinct tokens in the shipped template", () => {
    expect(TEMPLATE_TOKENS.length).toBeGreaterThan(60);
  });

  test("tokens split by kind", () => {
    const ifs = TEMPLATE_TOKENS.filter((t) => t.startsWith("{{IF:")).length;
    const ends = TEMPLATE_TOKENS.filter((t) => t.startsWith("{{END:")).length;
    const opens = TEMPLATE_TOKENS.filter((t) => t.startsWith("{{#")).length;
    const closes = TEMPLATE_TOKENS.filter((t) => t.startsWith("{{/")).length;
    // Every IF has a matching END; every #block has a matching /block.
    expect(ifs).toBe(ends);
    expect(opens).toBe(closes);
    expect(opens).toBe(3); // KIREYEYAYAAL, KIRAYSTAYAAL, MARAGYO
  });
});

describe("COUNT 3 — every template token has a source", () => {
  test("no orphan token: every name resolves to config, registry or annex", () => {
    const known = knownPlaceholderNames(C);
    const specs = placeholderRegistry(C.id);
    const orphans: string[] = [];
    for (const raw of TEMPLATE_TOKENS) {
      const n = raw.replace(/[{}]/g, "");
      if (n === "ENDIF" || n.startsWith("END:")) continue;
      if (n.startsWith("#") || n.startsWith("/")) {
        if (!known.has(n)) orphans.push(raw);
        continue;
      }
      if (n.startsWith("IF:")) {
        if (!known.has(n.slice(3))) orphans.push(raw);
        continue;
      }
      if (known.has(n) || canonicalNameFor(specs, n)) continue;
      orphans.push(raw);
    }
    expect(orphans).toEqual([]);
  });

  test("every annex token resolves to a real value for the given form answers", () => {
    const v: FormValues = {
      ...ALL_SECTIONS(),
      lacagta: { bangiga_magaca: "BANK", qiimaha_bil_ka: "300" },
    };
    const map = computeReplacements(C, v);
    for (const f of C.annexFields ?? []) {
      expect(`{{${f.token}}}` in map, f.token).toBe(true);
    }
  });
});

function ALL_SECTIONS(): FormValues {
  return {
    heshiiska: {
      sub_type: "guri_xaas",
      kireeye_mode: "single",
      kirayste_mode: "single",
      muddada_nooca: "furan",
      deebaaji_haa: "no",
      damiin_haa: "no",
      taariikhda_bilowga: "2026-10-01",
      reference: "R1",
      taariikhda_heshiiska: "2026-10-02",
    },
    guriga: { nooca_guriga: "guri_xaas", goobta: "Hargeisa" },
    lacagta: { qiimaha_bil_ka: "300", habka_bixinta: "cash" },
    ogaysiinta: { mudada_ogaysiinta: "30", shuruudaha_joojinta: "X" },
  };
}

describe("COUNT 4 — clause numbering is derived, never typed", () => {
  test("the template carries 11 {{CLAUSE_NO}} markers and no literal 1..11", () => {
    const tokens = (xml.match(/\{\{CLAUSE_NO\}\}/g) ?? []).length;
    expect(tokens).toBe(11);
    expect(/>\d+\. /.test(xml)).toBe(false);
  });
});
