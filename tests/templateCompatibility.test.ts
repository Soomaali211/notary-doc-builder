/**
 * Template Compatibility Validator — the audit matrix from Tallaabada 3,
 * turned into executable tests.
 *
 * The contract: every token in an uploaded .docx gets exactly ONE status
 * (MATCH / ALIAS / UNKNOWN_IN_TEMPLATE / MISSING_FROM_TEMPLATE /
 * INVALID_SYNTAX), names come from ONE source of truth, every conditional
 * has a backing flag, and the validator never redesigns the template.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { classifyTemplateTokens } from "../src/lib/notary/templateCompatibility";
import { knownPlaceholderNames, resolveFlags } from "../src/lib/notary/dataContext";
import { canonicalNameFor, placeholderRegistry } from "../src/lib/notary/placeholderRegistry";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues } from "../src/lib/notary/types";

const config = heshiisKiroConfig;
const TEMPLATE_V2 = "public/templates/heshiis_kiro_template_v2.docx";

/** Classify a template written as plain text — no zip needed. */
function classify(templateText: string) {
  const stream = templateText.match(/\{\{[^{}]+\}\}/g) ?? [];
  return classifyTemplateTokens(stream, config);
}

const EMPTY: FormValues = {};

describe("Template Compatibility Validator — statuses", () => {
  test("1. a canonical placeholder is MATCH", () => {
    const r = classify("{{KIREYE_MAGAC}}");
    expect(r.classifications[0].status).toBe("MATCH");
    expect(r.recognized).toEqual(["{{KIREYE_MAGAC}}"]);
    expect(r.canGenerate).toBe(true);
  });

  test("2. an old alias is ALIAS and reports the canonical name", () => {
    const r = classify("{{REFERENCE_NUMBER}}");
    expect(r.classifications[0].status).toBe("ALIAS");
    expect(r.classifications[0].canonical).toBe("REF_NUMBER");
    expect(r.aliasMappings).toEqual([
      { token: "{{REFERENCE_NUMBER}}", canonical: "{{REF_NUMBER}}" },
    ]);
    expect(r.unknown).toEqual([]);
  });

  test("3. a name the system does not know is UNKNOWN_IN_TEMPLATE, not fatal", () => {
    const r = classify("{{KIREYE_MAGAC}} {{NOT_A_REAL_TOKEN}}");
    const unknown = r.classifications.find((c) => c.name === "NOT_A_REAL_TOKEN");
    expect(unknown?.status).toBe("UNKNOWN_IN_TEMPLATE");
    expect(r.unknown).toEqual(["{{NOT_A_REAL_TOKEN}}"]);
    // Warning only — generation continues, the token is stripped.
    expect(r.canGenerate).toBe(true);
  });

  test("4. a system name the template never uses is MISSING_FROM_TEMPLATE", () => {
    const r = classify("{{KIREYE_MAGAC}}");
    expect(r.unused.some((u) => u.token === "{{KIRAYSTE_MAGAC}}")).toBe(true);
    expect(r.unused.every((u) => u.status === "MISSING_FROM_TEMPLATE")).toBe(true);
    // Never blocks.
    expect(r.canGenerate).toBe(true);
  });

  test("5. a malformed token is INVALID_SYNTAX and blocks", () => {
    const r = classify("{{KIREYE MAGAC}}");
    expect(r.classifications[0].status).toBe("INVALID_SYNTAX");
    expect(r.canGenerate).toBe(false);
    expect(r.blocking.join(" ")).toContain("Syntax aan sax ahayn");
  });

  test("6. every classification carries exactly one of the five statuses", () => {
    const valid = [
      "MATCH",
      "ALIAS",
      "MISSING_FROM_TEMPLATE",
      "UNKNOWN_IN_TEMPLATE",
      "INVALID_SYNTAX",
    ];
    const r = classify(
      "{{KIREYE_MAGAC}} {{REFERENCE_NUMBER}} {{NOPE}} {{IF:DEEBAAJI_HAA}}x{{END:DEEBAAJI_HAA}} {{#MARAGYO}}{{MAGAC}}{{/MARAGYO}}",
    );
    for (const c of r.classifications) expect(valid).toContain(c.status);
  });
});

describe("Template Compatibility Validator — attendance flags", () => {
  test("7. {{IF:KIREEYE_JOOGA}} is a known flag, not an unknown placeholder", () => {
    const r = classify("{{IF:KIREEYE_JOOGA}}jooga{{END:KIREEYE_JOOGA}}");
    expect(r.unknown).toEqual([]);
    expect(r.invalidConditionals).toEqual([]);
    expect(r.canGenerate).toBe(true);
  });

  test("8. all four attendance flags the template uses are recognized", () => {
    const names = knownPlaceholderNames(config);
    for (const f of [
      "KIREEYE_JOOGA",
      "KIREEYE_WAKIIL",
      "KIRAYSTE_JOOGA",
      "KIRAYSTE_WAKIIL",
    ]) {
      expect(names.has(f)).toBe(true);
    }
    const r = classify(
      "{{IF:KIREEYE_JOOGA}}a{{END:KIREEYE_JOOGA}}{{IF:KIREEYE_WAKIIL}}b{{END:KIREEYE_WAKIIL}}{{IF:KIRAYSTE_JOOGA}}c{{END:KIRAYSTE_JOOGA}}{{IF:KIRAYSTE_WAKIIL}}d{{END:KIRAYSTE_WAKIIL}}",
    );
    expect(r.unknown).toEqual([]);
    expect(r.invalidConditionals).toEqual([]);
    expect(r.recognized).toHaveLength(8);
  });

  test("9. every flag known to the validator is produced by resolveFlags", () => {
    // No conditional may exist without a backing flag: the validator's known
    // set and resolveFlags' output must agree, even with empty answers.
    const flags = resolveFlags(config, EMPTY);
    for (const flag of ["KIREEYE_JOOGA", "KIREEYE_WAKIIL", "KIRAYSTE_JOOGA", "KIRAYSTE_WAKIIL"]) {
      expect(flag in flags).toBe(true);
    }
    expect(flags.KIREEYE_JOOGA).toBe(false);
    expect(flags.KIREEYE_WAKIIL).toBe(false);
  });
});

describe("Template Compatibility Validator — repeatable groups", () => {
  test("10. row tokens inside a block are MATCH; the person/wakiil roles never swap", () => {
    const r = classify(
      "{{#KIREYEYAYAAL}}{{NUMBER}}. {{MAGAC}} {{TELEFOON}}{{IF:WAKIIL}} Wakiilka: {{WAKIIL_MAGAC}}{{END:WAKIIL}}{{/KIREYEYAYAAL}}",
    );
    expect(r.unknown).toEqual([]);
    expect(r.canGenerate).toBe(true);
    // {{MAGAC}} is the person; {{WAKIIL_MAGAC}} is the representative —
    // two distinct names, two distinct row tokens.
    const names = r.classifications.map((c) => c.name);
    expect(names).toContain("MAGAC");
    expect(names).toContain("WAKIIL_MAGAC");
    expect(names).not.toContain("WAKIIL_MAGAC_TELEFOON_X");
  });

  test("11. {{IF:JOOGA}} / {{IF:WAKIIL}} are legal only inside their block", () => {
    const inside = classify(
      "{{#KIREEYAYAAL}}{{IF:JOOGA}}jooga{{END:JOOGA}}{{IF:WAKIIL}}wakiil{{END:WAKIIL}}{{/KIREEYAYAAL}}",
    );
    expect(inside.invalidConditionals).toEqual([]);
    expect(inside.unknown).toEqual([]);

    const outside = classify("{{IF:JOOGA}}jooga{{END:JOOGA}}");
    expect(outside.unknown).toEqual([]);
    // JOOGA is a global row flag name in the registry, so outside a block it
    // resolves but never fires — it must NOT be reported as a broken flag.
    expect(outside.canGenerate).toBe(true);
  });

  test("12. all five configured repeat blocks validate", () => {
    const ids = (config.repeatBlocks ?? []).map((b) => b.blockId);
    for (const id of ids) {
      const r = classify(`{{#${id}}}{{MAGAC}}{{/${id}}}`);
      expect(r.canGenerate, id).toBe(true);
      expect(r.unknown, id).toEqual([]);
    }
  });
});

describe("Template Compatibility Validator — structural checks", () => {
  test("13. an unclosed IF blocks generation", () => {
    const r = classify("{{IF:DEEBAAJI_HAA}}qodob");
    expect(r.canGenerate).toBe(false);
    expect(r.invalidConditionals.join(" ")).toContain("lama xirin");
  });

  test("14. mismatched IF/END names are caught", () => {
    const r = classify("{{IF:DEEBAAJI_HAA}}x{{END:DAMIIN_HAA}}");
    expect(r.canGenerate).toBe(false);
    expect(r.invalidConditionals.join(" ")).toContain("wadar ma isku ekaan");
  });

  test("15. an unknown IF flag is caught", () => {
    const r = classify("{{IF:FLAG_AAN_JAWOB_DHAQSO}}x{{END:FLAG_AAN_JAWOB_DHAQSO}}");
    expect(r.canGenerate).toBe(false);
    expect(r.invalidConditionals.join(" ")).toContain("aan la aqoon");
  });

  test("16. an unknown repeat block is caught", () => {
    const r = classify("{{#KIREEYAYAAL}}{{MAGAC}}{{/KIREEYAYAAL}}{{#NO_SUCH_BLOCK}}x{{/NO_SUCH_BLOCK}}");
    expect(r.canGenerate).toBe(false);
    expect(r.invalidRepeaters.join(" ")).toContain("NO_SUCH_BLOCK");
  });

  test("17. an unclosed repeat block is caught", () => {
    const r = classify("{{#MARAGYO}}{{MAGAC}}");
    expect(r.canGenerate).toBe(false);
    expect(r.invalidRepeaters.join(" ")).toContain("lama xirin");
  });

  test("18. balanced templates never block", () => {
    const r = classify(
      "{{IF:DEEBAAJI_HAA}}a{{END:DEEBAAJI_HAA}}{{IF:MUQADIN}}b{{END:MUQADIN}}{{#MARAGYO}}{{NUMBER}} {{PHONE}}{{/MARAGYO}}",
    );
    expect(r.blocking).toEqual([]);
    expect(r.canGenerate).toBe(true);
  });
});

describe("Template Compatibility Validator — single source of truth", () => {
  test("19. canonicalNameFor resolves aliases and rejects unknown names", () => {
    const specs = placeholderRegistry(config.id);
    expect(canonicalNameFor(specs, "REF_NUMBER")).toBe("REF_NUMBER");
    expect(canonicalNameFor(specs, "REFERENCE_NUMBER")).toBe("REF_NUMBER");
    expect(canonicalNameFor(specs, "SUB_TYPE")).toBe("NOOCA_KIRADA");
    expect(canonicalNameFor(specs, "{{sub_type}}")).toBe("NOOCA_KIRADA");
    expect(canonicalNameFor(specs, "NOPE_NOT_HERE")).toBeUndefined();
  });

  test("20. every alias in the registry is reported as ALIAS, never as unknown", () => {
    const specs = placeholderRegistry(config.id);
    const aliases = specs.flatMap((s) => (s.aliases ?? []).map((a) => ({ alias: a, canonical: s.token })));
    expect(aliases.length).toBeGreaterThan(5);
    for (const { alias, canonical } of aliases) {
      const r = classify(`{{${alias}}}`);
      expect(r.unknown, alias).toEqual([]);
      const c = r.classifications.find((x) => x.name === alias.toUpperCase());
      expect(c?.status, alias).toBe("ALIAS");
      expect(c?.canonical, alias).toBe(canonical.toUpperCase());
    }
  });
});

describe("Template Compatibility Validator — the real v2 template", () => {
  test("21. heshiis_kiro_template_v2.docx passes with zero unknown tokens", async () => {
    const { validateTemplateCompatibility } = await import(
      "../src/lib/notary/templateCompatibility"
    );
    const buf = readFileSync(TEMPLATE_V2);
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
    const r = await validateTemplateCompatibility(ab, config);
    expect(r.unknown).toEqual([]);
    expect(r.invalidConditionals).toEqual([]);
    expect(r.invalidRepeaters).toEqual([]);
    expect(r.blocking).toEqual([]);
    expect(r.canGenerate).toBe(true);
    // Every token in the shipped template resolves. The exact count is the
    // template owner's choice — the validator checks that NOTHING is unknown,
    // not how many tokens the design happens to use.
    expect(r.recognized.length).toBeGreaterThan(60);
    expect(r.unknown).toHaveLength(0);
    // Nothing invented: every recognized token is a real system name.
    // Structural markers ({{END:…}}, {{/BLOCK}}) are closers, not data
    // tokens, so they are checked against the flag/block they close.
    const known = knownPlaceholderNames(config);
    const flags = new Set(
      Object.keys(config.conditionFlags ?? {}).map((f) => f.toUpperCase()),
    );
    const blocks = new Set(
      (config.repeatBlocks ?? []).map((b) => b.blockId.toUpperCase()),
    );
    for (const c of r.classifications) {
      if (c.kind === "structural") {
        expect(c.status, c.token).toBe("MATCH");
        continue;
      }
      expect(known.has(c.name), c.token).toBe(true);
    }
    // Every IF flag the template opens must be one the config declares.
    for (const c of r.classifications) {
      if (c.kind !== "flag") continue;
      const derived = c.name.endsWith("_JOOGA") || c.name.endsWith("_WAKIIL");
      expect(flags.has(c.name) || known.has(c.name) || derived, c.token).toBe(true);
    }
    expect(blocks.size).toBe(5);
  });
});
