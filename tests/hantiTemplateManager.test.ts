/**
 * KALA IIBSI HANTI — Template Manager starter loop.
 *
 * The promise: the office's OWN .docx files are downloadable as starters,
 * editable in Word, and re-uploadable through Template Manager with every
 * token they carry recognized. That loop is tested against the REAL files
 * the app fetches and the REAL validator the upload path runs — never a mock.
 *
 * Rules held here:
 *   - No legal wording is invented: the starter bytes ARE the office files.
 *   - Hanti Kale has NO scan and NO template (open decision) — it must never
 *     appear in the starter list until its own file arrives.
 *   - §19: subtype fields never merge — a guri template never carries BEER_*
 *     questions, and so on.
 *   - §18: both Damiin branches (qof 3aad / iibiyaha) stay separate tokens.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { getConfig } from "../src/lib/notary/documents";
import { scanTemplateTokens } from "../src/lib/notary/userTemplate";
import { classifyTemplateTokens } from "../src/lib/notary/templateCompatibility";
import {
  HANTI_STARTER_TEMPLATES,
  hantiStarterPath,
  type HantiStarterTemplate,
} from "../src/lib/notary/hantiTemplate";

const CONFIG = getConfig("kala_iibsi_hanti");
if (!CONFIG) throw new Error("kala_iibsi_hanti config missing");

const OFFICE_DIR = resolve(import.meta.dir, "../public/templates/kala_iiibsi_hanti");

/** Real bytes of one office starter, read the way the browser fetch would. */
async function scannedStarter(starter: HantiStarterTemplate) {
  const bytes = readFileSync(resolve(OFFICE_DIR, starter.fileName));
  expect(bytes.length).toBeGreaterThan(0);
  // A real .docx is a zip: PK header, and word/document.xml readable.
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  const zip = await JSZip.loadAsync(bytes);
  expect(zip.file("word/document.xml")).not.toBeNull();

  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return scanTemplateTokens(ab, CONFIG!);
}

describe("Hanti Template Manager — starter inventory", () => {
  test("exactly the three subtypes that have office files", () => {
    expect(HANTI_STARTER_TEMPLATES.map((s) => s.subtype)).toEqual([
      "dhul_banaan",
      "guri",
      "beer",
    ]);
  });

  test("Hanti Kale is NOT offered — no scan, no template (open decision)", () => {
    expect(
      HANTI_STARTER_TEMPLATES.some((s) => s.subtype === "hanti_kale"),
    ).toBe(false);
    expect(existsSync(resolve(OFFICE_DIR, "hanti_kale.docx"))).toBe(false);
  });

  test("every starter path maps to its office file", () => {
    for (const starter of HANTI_STARTER_TEMPLATES) {
      expect(hantiStarterPath(starter)).toBe(
        `/templates/kala_iiibsi_hanti/${starter.fileName}`,
      );
      expect(existsSync(resolve(OFFICE_DIR, starter.fileName))).toBe(true);
    }
  });
});

describe("Hanti Template Manager — download → edit → re-upload loop", () => {
  for (const starter of HANTI_STARTER_TEMPLATES) {
    test(`${starter.subtype}: office file scans with ZERO unknown tokens`, async () => {
      const report = await scannedStarter(starter);
      expect(report.unknown).toEqual([]);
      expect(report.syntaxErrors).toEqual([]);
      expect(report.recognized.length).toBeGreaterThan(50);
    });

    test(`${starter.subtype}: carries the shared canonical skeleton`, async () => {
      const report = await scannedStarter(starter);
      const tokens = new Set(report.tokens);
      for (const required of [
        "REF_NUMBER",
        "TAARIIKH",
        "NOOCA_HANTIDA",
        "#IIBIYEYAAL",
        "#IIBSADAYAAL",
        "QIIMAHA_HANTIDA",
        "LACAGTA_BIXIYAY",
        "LACAGTA_HADHAY",
        "QIIMAHA_QORAAL",
        "#MARAGYO",
      ]) {
        expect(tokens.has(required)).toBe(true);
      }
    });

    test(`${starter.subtype}: §18 — both Damiin branches stay separate`, async () => {
      const report = await scannedStarter(starter);
      const tokens = new Set(report.tokens);
      expect(tokens.has("IF:DAMIIN_QOF_3AAD")).toBe(true);
      expect(tokens.has("END:DAMIIN_QOF_3AAD")).toBe(true);
      expect(tokens.has("IF:DAMIIN_IIBIYAHA")).toBe(true);
      expect(tokens.has("END:DAMIIN_IIBIYAHA")).toBe(true);
    });
  }
});

describe("Hanti Template Manager — §19 subtype fields never merge", () => {
  test("guri template: GURI_* fields, never BEER_* or the dhul_banaan block", async () => {
    const guri = HANTI_STARTER_TEMPLATES.find((s) => s.subtype === "guri")!;
    const report = await scannedStarter(guri);
    const tokens = new Set(report.tokens);
    expect(tokens.has("GURI_NOOCA")).toBe(true);
    expect(tokens.has("GURI_GOOBTA")).toBe(true);
    expect([...tokens].some((t) => t.startsWith("BEER_"))).toBe(false);
    expect(tokens.has("DEGMADA")).toBe(false);
    expect(tokens.has("SOOHDIMADA")).toBe(false);
  });

  test("beer template: BEER_* fields, never GURI_* or the dhul_banaan block", async () => {
    const beer = HANTI_STARTER_TEMPLATES.find((s) => s.subtype === "beer")!;
    const report = await scannedStarter(beer);
    const tokens = new Set(report.tokens);
    expect(tokens.has("BEER_MAGAC")).toBe(true);
    expect(tokens.has("BEER_GOOBTA")).toBe(true);
    expect([...tokens].some((t) => t.startsWith("GURI_"))).toBe(false);
    expect(tokens.has("DEGMADA")).toBe(false);
    expect(tokens.has("SOOHDIMADA")).toBe(false);
  });

  test("dhul_banaan template: shared property fields + its own §1 extras only", async () => {
    const dhul = HANTI_STARTER_TEMPLATES.find(
      (s) => s.subtype === "dhul_banaan",
    )!;
    const report = await scannedStarter(dhul);
    const tokens = new Set(report.tokens);
    expect(tokens.has("DEGMADA")).toBe(true);
    expect(tokens.has("SOOHDIMADA")).toBe(true);
    expect(tokens.has("SIDA_HANTIDA")).toBe(true);
    expect([...tokens].some((t) => t.startsWith("GURI_"))).toBe(false);
    expect([...tokens].some((t) => t.startsWith("BEER_"))).toBe(false);
  });
});

describe("Hanti Template Manager — wakiilo row tokens", () => {
  test("NOOCA_WAKIILKA inside {{#WAKIILO_IIBIYEYAAL}} is a MATCH (regression)", () => {
    const report = classifyTemplateTokens(
      ["{{#WAKIILO_IIBIYEYAAL}}", "{{NUMBER}}", "{{MAGAC}}", "{{NOOCA_WAKIILKA}}", "{{MATALAYA}}", "{{/WAKIILO_IIBIYEYAAL}}"],
      CONFIG!,
    );
    expect(report.unknown).toEqual([]);
    const nooca = report.classifications.find(
      (c) => c.name === "NOOCA_WAKIILKA",
    );
    expect(nooca?.status).toBe("MATCH");
    expect(nooca?.kind).toBe("row_token");
  });

  test("the same token OUTSIDE a block stays unresolvable — never silently accepted", () => {
    const report = classifyTemplateTokens(["{{NOOCA_WAKIILKA}}"], CONFIG!);
    const nooca = report.classifications.find(
      (c) => c.name === "NOOCA_WAKIILKA",
    );
    expect(nooca?.status).toBe("UNKNOWN_IN_TEMPLATE");
  });
});
