/**
 * Phase 3 — Template Engine & Document Generation tests (#31 matrix).
 *
 * Covers: placeholder replacement (simple / missing / case-insensitive /
 * fallback), conditional {{IF}} blocks (true / false / nested), repeat
 * blocks (1 / 2 / empty / inline), template validation (valid / broken
 * syntax / unclosed blocks / unknown mappings), formatting preservation
 * (bold + tables) and the full generation pipeline (DOCX, paths, archive
 * metadata, PDF stub).
 *
 * Run: bun test tests/generation.test.ts
 */
import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import {
  buildDataContext,
  generateDocument,
  processDocumentXml,
  resolveClauses,
  resolveFlags,
  validateTemplate,
} from "../src/lib/notary/template";
import { buildFileBaseName, buildOutputFolder } from "../src/lib/notary/archiver";
import { selectTemplate } from "../src/lib/notary/registry";
import { heshiisKiroConfig as config } from "../src/lib/notary/documents/heshiisKiro";
import { scenarioA, scenarioB } from "../scripts/verify-helpers";
import type { FormValues } from "../src/lib/notary/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const p = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

function render(xml: string, values: FormValues): string {
  const ctx = buildDataContext(config, values);
  const clauses = resolveClauses(config, values);
  return processDocumentXml(xml, ctx, clauses);
}

async function templateBytes(): Promise<ArrayBuffer> {
  return await Bun.file("public/templates/heshiis_kiro/guri_xaas.docx").arrayBuffer();
}

async function documentText(values: FormValues): Promise<string> {
  const { blob } = (await generateDocument({
    config,
    values,
    referenceNumber: "DPN/K/001",
    subTypeLabel: "Guri Xaas",
    templateBytes: await templateBytes(),
    spec: selectTemplate(config, values),
  })).result && await (async () => {
    const out = await generateDocument({
      config,
      values,
      referenceNumber: "DPN/K/001",
      subTypeLabel: "Guri Xaas",
      templateBytes: await templateBytes(),
      spec: selectTemplate(config, values),
    });
    return out.result;
  })();
  const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
  return await zip.file("word/document.xml")!.async("string");
}

/** Build a minimal in-memory docx with the given body paragraphs. */
async function miniDocx(paragraphs: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<w:document><w:body>${paragraphs.map(p).join("")}</w:body></w:document>`,
  );
  return await zip.generateAsync({ type: "arraybuffer" });
}

/* ------------------------------------------------------------------ */
/* Placeholders                                                        */
/* ------------------------------------------------------------------ */

describe("placeholders", () => {
  test("simple replacement", () => {
    const out = render(p("Nambarka: {{REFERENCE_NUMBER}}"), scenarioA());
    expect(out).toContain("Nambarka: DPN/K/001");
    expect(out).not.toContain("{{REFERENCE_NUMBER}}");
  });

  test("case-insensitive token names", () => {
    const out = render(p("Taariikhda: {{reference_number}}"), scenarioA());
    expect(out).toContain("Taariikhda: DPN/K/001");
  });

  test("unknown token is left untouched", () => {
    const out = render(p("X: {{NOT_A_REAL_TOKEN}}"), scenarioA());
    expect(out).toContain("X: {{NOT_A_REAL_TOKEN}}");
  });

  test("fallback used for empty optional value", () => {
    const values = scenarioA();
    (values.dheeraad as Record<string, string>).shuruudo_dheeraad = "";
    const out = render(p("Dheeraad: {{SHURUUDO_DHEERAAD}}"), values);
    expect(out).toContain("Dheeraad: —");
  });

  test("currency formatting uses config symbol mode", () => {
    const out = render(p("Qiimaha: {{QIIMAHA_KIRADA}}"), scenarioA());
    expect(out).toContain("Qiimaha: $500");
  });

  test("date formatting uses config DD/MM/YYYY", () => {
    const out = render(p("Bilowga: {{TAARIIKHDA_BILOWGA}}"), scenarioA());
    expect(out).toContain("Bilowga: 01/10/2026");
  });
});

/* ------------------------------------------------------------------ */
/* Conditionals                                                        */
/* ------------------------------------------------------------------ */

describe("conditionals", () => {
  const wrapped = (inner: string) =>
    p("{{IF:DEEBAAJI_HAA}}") + p("5. DEEBAAJI") + p(inner) + p("{{ENDIF}}");

  test("flag true keeps the body and drops the markers", () => {
    const out = render(wrapped("DEEQAJIGA"), scenarioA());
    expect(out).toContain("5. DEEBAAJI");
    expect(out).toContain("DEEQAJIGA");
    expect(out).not.toContain("{{IF:DEEBAAJI_HAA}}");
    expect(out).not.toContain("{{ENDIF}}");
  });

  test("flag false removes the whole section including its heading", () => {
    const out = render(wrapped("DEEQAJIGA"), scenarioB());
    expect(out).not.toContain("5. DEEBAAJI");
    expect(out).not.toContain("DEEQAJIGA");
    expect(out).not.toContain("{{IF:DEEBAAJI_HAA}}");
  });

  test("nested IF blocks resolve correctly", () => {
    const xml =
      p("{{IF:DEEBAAJI_HAA}}") +
      p("A") +
      p("{{IF:MUQADIN}}") +
      p("B-MUQADIN") +
      p("{{ENDIF}}") +
      p("{{ENDIF}}");
    expect(render(xml, scenarioA())).toContain("B-MUQADIN");
    expect(render(xml, scenarioB())).not.toContain("A");
  });

  test("condition flags resolve from the answers", () => {
    const flagsA = resolveFlags(config, scenarioA());
    expect(flagsA.DEEBAAJI_HAA).toBe(true);
    expect(flagsA.DAMIIN_HAA).toBe(true);
    expect(flagsA.MUQADIN).toBe(true);
    expect(flagsA.MUAKHIR).toBe(false);
    const flagsB = resolveFlags(config, scenarioB());
    expect(flagsB.DEEBAAJI_HAA).toBe(false);
    expect(flagsB.DAMIIN_HAA).toBe(false);
    expect(flagsB.MUQADIN).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Repeat blocks                                                       */
/* ------------------------------------------------------------------ */

describe("repeat blocks", () => {
  test("one row produces one numbered entry", () => {
    const values = scenarioA();
    (values.maragyo as FormValues[keyof FormValues]) = [
      { id: "w1", values: { magac: "Asha Omar", telefoon: "", aqoonsi: "", cinwaan: "" } },
    ];
    const xml = p("{{#MARAGYO}}") + p("{{NUMBER}}. {{MAGAC}}") + p("{{/MARAGYO}}");
    const out = render(xml, values);
    expect(out).toContain("1. Asha Omar");
    expect(out).not.toContain("2.");
  });

  test("multiple rows number sequentially", () => {
    const xml = p("{{#MARAGYO}}") + p("{{NUMBER}}. {{MAGAC}}") + p("{{/MARAGYO}}");
    const out = render(xml, scenarioA());
    expect(out).toContain("1. Asha Omar");
    expect(out).toContain("2. Yuusuf Abdi");
    expect(out).toContain("3. Halimo Yusuf");
    expect(out).toContain("4. Xasan Idle");
  });

  test("aliases map template tokens to party fields", () => {
    const xml = p("{{#MARAGYO}}") + p("{{NUMBER}}. {{MAGAC}} — {{PHONE}}") + p("{{/MARAGYO}}");
    const out = render(xml, scenarioA());
    expect(out).toContain("1. Asha Omar — +252 61 7778889");
  });

  test("empty list removes the whole block", () => {
    const values = scenarioA();
    (values.maragyo as FormValues[keyof FormValues]) = [];
    const xml = p("{{#MARAGYO}}") + p("{{NUMBER}}. {{MAGAC}}") + p("{{/MARAGYO}}");
    const out = render(xml, values);
    expect(out).not.toContain("{{NUMBER}}");
    expect(out).not.toContain("{{MAGAC}}");
    expect(out).not.toContain("1. ");
  });

  test("inline block joins rows on a single line with ' · '", () => {
    const xml = p("Maragyada: {{#MARAGYO}}{{NUMBER}}. {{MAGAC}}{{/MARAGYO}}");
    const out = render(xml, scenarioA());
    expect(out).toContain(
      "Maragyada: 1. Asha Omar · 2. Yuusuf Abdi · 3. Halimo Yusuf · 4. Xasan Idle",
    );
  });
});

/* ------------------------------------------------------------------ */
/* Clauses                                                             */
/* ------------------------------------------------------------------ */

describe("clauses", () => {
  test("marker removed when its condition is false", () => {
    const values = scenarioA();
    (values.dheeraad as Record<string, string>).shuruudo_dheeraad = "";
    const out = render(p("{{CLAUSE_DHEERAAD}}"), values);
    expect(out).not.toContain("CLAUSE_DHEERAAD");
  });

  test("MUQADIN clause included when bixinta_hore = muqadin", () => {
    const out = render(p("{{CLAUSE_MUQADIN}}"), scenarioA());
    expect(out).not.toContain("{{CLAUSE_MUQADIN}}");
    expect(out.length).toBeGreaterThan(p("{{CLAUSE_MUQADIN}}").length);
  });
});

/* ------------------------------------------------------------------ */
/* Template validation                                                 */
/* ------------------------------------------------------------------ */

describe("template validation", () => {
  test("registered sample template validates clean", async () => {
    const spec = selectTemplate(config, scenarioA())!;
    const ctx = buildDataContext(config, scenarioA());
    const result = await validateTemplate(
      spec.templateId,
      spec.filePath,
      await templateBytes(),
      ctx,
    );
    expect(result.valid).toBe(true);
    expect(result.checks.every((c) => c.ok)).toBe(true);
  });

  test("unreadable file is invalid", async () => {
    const ctx = buildDataContext(config, scenarioA());
    const result = await validateTemplate("T", "/templates/x.docx", new ArrayBuffer(0), ctx);
    expect(result.valid).toBe(false);
  });

  test("unknown mapping is reported with the token name", async () => {
    const bytes = await miniDocx([p("Qalad: {{NOT_A_REAL_TOKEN}}")]);
    const ctx = buildDataContext(config, scenarioA());
    const result = await validateTemplate("T", "/templates/x.docx", bytes, ctx);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("NOT_A_REAL_TOKEN"))).toBe(true);
  });

  test("unclosed IF block is flagged", async () => {
    const bytes = await miniDocx([p("{{IF:DEEBAAJI_HAA}}"), p("jir")]);
    const ctx = buildDataContext(config, scenarioA());
    const result = await validateTemplate("T", "/templates/x.docx", bytes, ctx);
    expect(result.valid).toBe(false);
    const balance = result.checks.find((c) => c.label === "Conditional blocks balanced");
    expect(balance?.ok).toBe(false);
  });

  test("unclosed repeat block is flagged", async () => {
    const bytes = await miniDocx([p("{{#MARAGYO}}"), p("{{MAGAC}}")]);
    const ctx = buildDataContext(config, scenarioA());
    const result = await validateTemplate("T", "/templates/x.docx", bytes, ctx);
    expect(result.valid).toBe(false);
    const balance = result.checks.find((c) => c.label === "Repeat blocks balanced");
    expect(balance?.ok).toBe(false);
  });

  test("unknown IF flag is reported", async () => {
    const bytes = await miniDocx([p("{{IF:MA_JIRO_FLAG}}"), p("x"), p("{{ENDIF}}")]);
    const ctx = buildDataContext(config, scenarioA());
    const result = await validateTemplate("T", "/templates/x.docx", bytes, ctx);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("MA_JIRO_FLAG"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Formatting preservation                                             */
/* ------------------------------------------------------------------ */

describe("formatting preservation", () => {
  test("bold heading survives generation", async () => {
    const xml = await documentText(scenarioA());
    expect(xml).toContain("HESHIIS KIRO");
    expect(xml).toContain("<w:b/>");
  });

  test("party table survives generation with values filled in", async () => {
    const xml = await documentText(scenarioA());
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("Cabdi Xasan");
    expect(xml).toContain("+252 61 5551234");
  });

  test("generated output keeps valid DOCX structure", async () => {
    const out = await generateDocument({
      config,
      values: scenarioA(),
      referenceNumber: "DPN/K/001",
      subTypeLabel: "Guri Xaas",
      templateBytes: await templateBytes(),
      spec: selectTemplate(config, scenarioA()),
    });
    const zip = await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer()));
    expect(zip.file("word/document.xml")).not.toBeNull();
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("</w:document>");
  });
});

/* ------------------------------------------------------------------ */
/* Archive naming + full generation                                    */
/* ------------------------------------------------------------------ */

describe("archive naming", () => {
  test("buildFileBaseName sanitizes and prefixes references", () => {
    expect(buildFileBaseName(config, "DPN/K/001", "Guri Xaas")).toBe(
      "Ref-DPN-K-001_Heshiis-Kiro_Guri-Xaas",
    );
  });

  test("existing Ref prefix is never doubled", () => {
    expect(buildFileBaseName(config, "Ref/DPN/K/001", "Guri Xaas")).toBe(
      "Ref-DPN-K-001_Heshiis-Kiro_Guri-Xaas",
    );
  });

  test("output folder uses config.outputFolder and sub-type label", () => {
    expect(buildOutputFolder(config, "guri_xaas")).toBe("output/Kiro/Guri_Xaas");
    expect(buildOutputFolder(config, "Guri Xaas")).toBe("output/Kiro/Guri_Xaas");
  });
});

describe("full generation pipeline", () => {
  test("generates DOCX with metadata, warnings and PDF stub", async () => {
    const values = scenarioA(); // one instance — random row ids must match the snapshot
    const out = await generateDocument({
      config,
      values,
      referenceNumber: "DPN/K/001",
      subTypeLabel: "Guri Xaas",
      templateBytes: await templateBytes(),
      spec: selectTemplate(config, scenarioA()),
    });

    // Template bound to the registry version.
    expect(out.result.templateId).toBe("KIRO_GURI_XAAS_V1");
    expect(out.result.templateVersion).toBe(1);

    // Immutable archive naming + paths.
    expect(out.result.fileName).toBe("Ref-DPN-K-001_Heshiis-Kiro_Guri-Xaas.docx");
    expect(out.result.outputDocxPath).toBe(
      "output/Kiro/Guri_Xaas/Ref-DPN-K-001_Heshiis-Kiro_Guri-Xaas.docx",
    );
    expect(out.result.metadata.outputDocxPath).toBe(out.result.outputDocxPath);
    expect(out.result.metadata.templateId).toBe("KIRO_GURI_XAAS_V1");

    // PDF stub: unavailable → warning, DOCX still produced.
    expect(out.result.pdfAvailable).toBe(false);
    expect(out.warnings.length).toBeGreaterThan(0);
    expect(out.result.blob.size).toBeGreaterThan(0);

    // The form-data snapshot is bound to the generation.
    expect(out.result.valuesSnapshot).toEqual(values);

    // Both validations pass.
    expect(out.templateValidation?.valid).toBe(true);
    expect(out.outputValidation?.valid).toBe(true);
  });

  test("missing reference is rejected before generation", async () => {
    let threw = "";
    try {
      await generateDocument({
        config,
        values: scenarioA(),
        referenceNumber: "   ",
        subTypeLabel: "Guri Xaas",
        templateBytes: await templateBytes(),
        spec: selectTemplate(config, scenarioA()),
      });
    } catch (e) {
      threw = (e as Error).message;
    }
    expect(threw).toContain("tixraaca");
  });

  test("document text contains the generated data end-to-end", async () => {
    const xml = await documentText(scenarioA());
    expect(xml).toContain("DPN/K/001");
    expect(xml).toContain("29/09/2026");
    expect(xml).toContain("$500");
    expect(xml).not.toMatch(/\{\{[A-Za-z0-9_#/]+(:[A-Za-z0-9_]+)?\}\}/);
  });
});
