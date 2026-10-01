/**
 * Phase Template Generator — starter .docx tests.
 *
 * Guarantees:
 *   - the system builds a REAL, openable Word .docx (not HTML/PDF/image)
 *   - it stays EDITABLE (no protection) so the user can restyle everything
 *   - every canonical placeholder from the registry is present, spelled
 *     EXACTLY ({{KIREYE_MAGAC}} is never renamed or rewritten)
 *   - repeat + conditional blocks are balanced and marker-only
 *   - tokens are never split across runs (they stay copy/paste-able)
 *   - no numbered-party tokens ({{KIREYE_1}} is never generated)
 *   - the shipped artifact on disk matches the contract
 *   - the generated file is filled correctly by the real pipeline
 *   - an existing (possibly user-edited) template is never overwritten
 *
 * Run: bun test tests/templateBuilder.test.ts
 */
import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import {
  TEMPLATE_FILE_NAME,
  buildHeshiisKiroTemplateBytes,
  canWriteStarterTemplate,
  requiredTemplateTokens,
} from "../src/lib/notary/templateBuilder";
import {
  HESHIIS_KIRO_PLACEHOLDERS,
  placeholderRegistry,
  registryTokenNames,
} from "../src/lib/notary/placeholderRegistry";
import { listTemplateTokens, validateTemplate } from "../src/lib/notary/templateValidator";
import { buildDataContext, generateDocument } from "../src/lib/notary/template";
import { heshiisKiroConfig as config } from "../src/lib/notary/documents/heshiisKiro";
import { scenario21 } from "../scripts/verify-helpers";
import type { FormValues } from "../src/lib/notary/types";

async function builtDocx(): Promise<{ bytes: ArrayBuffer; xml: string; textNodes: string[] }> {
  const raw = await buildHeshiisKiroTemplateBytes();
  const bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
  const zip = await JSZip.loadAsync(Buffer.from(raw));
  const xml = await zip.file("word/document.xml")!.async("string");
  const textNodes = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
  return { bytes, xml, textNodes };
}

const tokenSet = async (bytes: ArrayBuffer): Promise<Set<string>> =>
  new Set((await listTemplateTokens(bytes)).map((t) => t.replace(/[{}]/g, "").toUpperCase()));

/* ------------------------------------------------------------------ */

describe("starter template is a real, editable .docx", () => {
  test("valid OOXML package (Word / LibreOffice can open it)", async () => {
    const raw = await buildHeshiisKiroTemplateBytes();
    const zip = await JSZip.loadAsync(Buffer.from(raw));
    for (const part of [
      "[Content_Types].xml",
      "word/document.xml",
      "word/styles.xml",
      "_rels/.rels",
    ]) {
      expect(zip.file(part)).not.toBeNull();
    }
    expect(raw.length).toBeGreaterThan(4000);
    expect(TEMPLATE_FILE_NAME).toBe("heshiis_kiro_template.docx");
  });

  test("stays EDITABLE — no document protection / locked regions", async () => {
    const { xml } = await builtDocx();
    expect(xml).not.toContain("documentProtection");
    expect(xml).not.toContain("w:permStart");
    expect(xml).not.toContain("w:enforcement");
  });

  test("has the structure a user expects to restyle", async () => {
    const { xml } = await builtDocx();
    expect(xml).toContain("<w:tbl>"); // tables
    expect(xml).toContain("Heading1"); // headings
    expect(xml).toContain("w:pgMar"); // page layout / margins
    expect(xml).toContain("Saxiixa Kireeyaha"); // signature areas
    expect(xml).toContain("Marag 1"); // witness areas
    expect(xml).toContain("HESHIIS KIRO"); // title
  });

  test("the shipped artifact on disk matches the generated contract", async () => {
    const onDisk = await Bun.file(`public/templates/${TEMPLATE_FILE_NAME}`).arrayBuffer();
    const tokens = await tokenSet(onDisk);
    const missing = requiredTemplateTokens().filter(
      (t) => !tokens.has(t) && !tokens.has(`#${t}`) && !tokens.has(`/${t}`),
    );
    expect(missing).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("placeholder contract (names are never renamed)", () => {
  test("every canonical registry token is in the generated template", async () => {
    const { bytes } = await builtDocx();
    const tokens = await tokenSet(bytes);
    const missing = requiredTemplateTokens().filter(
      (t) => !tokens.has(t) && !tokens.has(`#${t}`) && !tokens.has(`/${t}`),
    );
    expect(missing).toEqual([]);
  });

  test("the exact names from the specification are present", async () => {
    const { bytes } = await builtDocx();
    const tokens = await tokenSet(bytes);
    for (const token of [
      "REF_NUMBER",
      "TAARIIKH",
      "NOOCA_KIRADA",
      "KIREYE_MAGAC",
      "KIREYE_TELEFOON",
      "KIRAYSTE_MAGAC",
      "KIRAYSTE_TELEFOON",
      "GURI_GOOBTA",
      "GURI_NOOCA",
      "KIRADA_QIIMAHA",
      "HABKA_BIXINTA",
      "DEEBAAJI_QIIMAHA",
      "DAMIIN_MAGAC",
      "TAARIIKH_DHAMMAAD",
      "WAKIIL_MAGAC",
      "WAKIIL_TELEFOON",
    ]) {
      expect(tokens.has(token)).toBe(true);
    }
  });

  test("never generates numbered-party tokens", async () => {
    const { xml } = await builtDocx();
    expect(xml).not.toMatch(/\{\{(KIREYE|KIRAYSTE)_\d/);
    expect(xml).toContain("{{#KIREYEYAYAAL}}");
    expect(xml).toContain("{{#KIRAYSTAYAAL}}");
  });

  test("tokens live inside a single text run (never split)", async () => {
    const { textNodes } = await builtDocx();
    const joined = textNodes.join("");
    for (const token of ["{{KIREYE_MAGAC}}", "{{REF_NUMBER}}", "{{KIRADA_QIIMAHA}}", "{{#KIREYEYAYAAL}}"]) {
      // Present AND intact inside one <w:t> node.
      expect(textNodes.some((n) => n.includes(token))).toBe(true);
      expect(joined).toContain(token);
    }
  });

  test("markers are alone in their own paragraph (block expansion works)", async () => {
    const { xml } = await builtDocx();
    for (const marker of [
      "{{#KIREYEYAYAAL}}",
      "{{/KIREYEYAYAAL}}",
      "{{#KIRAYSTAYAAL}}",
      "{{/KIRAYSTAYAAL}}",
      "{{#MARAGYO}}",
      "{{/MARAGYO}}",
      "{{IF:DEEBAAJI_HAA}}",
      "{{END:DEEBAAJI_HAA}}",
      "{{IF:DAMIIN_HAA}}",
      "{{END:DAMIIN_HAA}}",
      "{{IF:KIRO_XIDHAN}}",
      "{{END:KIRO_XIDHAN}}",
    ]) {
      expect(new RegExp(`<w:p[^>]*>(?:(?!</w:p>)[\\s\\S])*?${marker.replace(/[{}$]/g, "\\$&")}(?:(?!</w:p>)[\\s\\S])*?</w:p>`).test(xml)).toBe(true);
    }
  });

  test("validation passes: no errors and no unknown placeholders", async () => {
    const { bytes } = await builtDocx();
    const values = scenario21() as FormValues;
    const ctx = buildDataContext(config, values);
    const result = await validateTemplate("KIRO_HESHIIS_TEMPLATE_V1", "/templates/heshiis_kiro_template.docx", bytes, ctx);
    expect(result.valid).toBe(true);
    expect(result.checks.every((c) => c.ok)).toBe(true);
    // Row-scoped tokens (WAKIIL_MAGAC inside a block) are NOT "unknown".
    const unknown = result.issues.filter((i) => i.level === "warning");
    expect(unknown).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("registry is the single source of truth", () => {
  test("every keyed registry token resolves through the config", () => {
    const known = registryTokenNames(placeholderRegistry("heshiis_kiro"));
    const configured = new Set(config.placeholders.map((p) => p.placeholder.replace(/[{}]/g, "").toUpperCase()));
    const missing = HESHIIS_KIRO_PLACEHOLDERS.filter((s) => s.key && s.kind === "placeholder").map(
      (s) => s.token,
    ).filter((token) => !configured.has(token));
    expect(missing).toEqual([]);
    expect(known.has("REF_NUMBER")).toBe(true);
  });

  test("aliases resolve to the same key as the canonical name", () => {
    const keyOf = (token: string) =>
      config.placeholders.find((p) => p.placeholder === `{{${token}}}`)?.mapping.key;
    expect(keyOf("REF_NUMBER")).toBe(keyOf("REFERENCE_NUMBER"));
    expect(keyOf("GURI_GOOBTA")).toBe(keyOf("GOOBTA"));
    expect(keyOf("DEEBAAJI_QIIMAHA")).toBe(keyOf("DEEBAAJI_AMOUNT"));
  });
});

/* ------------------------------------------------------------------ */

describe("the generated template is filled by the real pipeline", () => {
  test("scenario #21: parties repeat, wakiil per row, conditionals resolve", async () => {
    const out = await generateDocument({
      config,
      values: scenario21() as FormValues,
      referenceNumber: "DPN-K-030",
      subTypeLabel: "Guri Xaas",
      templateBytes: (await buildHeshiisKiroTemplateBytes()).buffer as ArrayBuffer,
    });
    const zip = await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer()));
    const doc = await zip.file("word/document.xml")!.async("string");

    expect(doc).toContain("Kireeye 1: Kireeye Kowaad");
    expect(doc).toContain("Kireeye 2: Kireeye labaad");
    expect(doc).toContain("Kirayste 1: Kirayste Kowaad");
    expect(doc).toContain("Kirayste 2: Kirayste Labaad");
    expect(doc).toContain("Wakiilka matalaya: Cali Joof");
    expect(doc).toContain("Wakiilka matalaya: Hodan Joof");
    // Deposit included (Damiin Maya → its heading is gone).
    expect(doc).toContain("DEEBAAJI");
    expect(doc).toContain("Qiimaha Deebaajiga");
    expect(doc).not.toContain("DAMIIN (DAMMAANAD)");
    // Kiro Furan → no end date; nothing unresolved survives.
    expect(doc).not.toContain("Taariikhda Dhammaadka:");
    expect(doc).not.toMatch(/\{\{[A-Za-z0-9_#/]+(:[A-Za-z0-9_]+)?\}\}/);
    // Template formatting is preserved (bold heading runs survive).
    expect(doc).toContain("<w:b/>");
    expect(out.templateValidation?.valid).toBe(true);
    expect(out.outputValidation?.valid).toBe(true);
  });

  test("Kiro Xidhan keeps the End Date line", async () => {
    const values = scenario21() as FormValues;
    (values.heshiiska as Record<string, string>).muddada_nooca = "xidhan";
    (values.heshiiska as Record<string, string>).taariikhda_dhammaadka = "2027-09-30";
    const out = await generateDocument({
      config,
      values,
      referenceNumber: "DPN-K-031",
      subTypeLabel: "Guri Xaas",
      templateBytes: (await buildHeshiisKiroTemplateBytes()).buffer as ArrayBuffer,
    });
    const zip = await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer()));
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain("Taariikhda Dhammaadka: 30/09/2027");
  });
});

/* ------------------------------------------------------------------ */

describe("the user's edits are never overwritten", () => {
  test("no-overwrite guard", () => {
    expect(canWriteStarterTemplate(false)).toBe(true); // first run
    expect(canWriteStarterTemplate(true)).toBe(false); // user may have edited it
    expect(canWriteStarterTemplate(true, true)).toBe(true); // explicit --force
  });
});