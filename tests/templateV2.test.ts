/**
 * TEMPLATE v2 — the legal-document starter must be a real, editable .docx
 * that carries the registry's exact placeholder names and drives the real
 * pipeline end to end.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { generateDocument } from "../src/lib/notary/pipeline";
import { getConfig } from "../src/lib/notary/documents";
import { scanTemplateTokens } from "../src/lib/notary/userTemplate";
import {
  HESHIIS_KIRO_PLACEHOLDERS,
  tokenString,
} from "../src/lib/notary/placeholderRegistry";
import { scenario21 } from "../scripts/verify-helpers";

const PATH = "public/templates/heshiis_kiro_template_v2.docx";

function readZip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const parts = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const lhName = buf.readUInt16LE(localOff + 26);
    const lhExtra = buf.readUInt16LE(localOff + 28);
    const s = localOff + 30 + lhName + lhExtra;
    const raw = buf.subarray(s, s + compSize);
    parts.set(name, method === 0 ? raw : inflateRawSync(raw));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return parts;
}

describe("Template v2 — legal-document starter", () => {
  const bytes = readFileSync(PATH);
  const parts = readZip(bytes);
  const docXml = parts.get("word/document.xml")!.toString("utf8");
  const allXml = [...parts.values()].map((b) => b.toString("utf8")).join("");

  test("is a real, unprotected, editable .docx", () => {
    expect([...parts.keys()]).toContain("word/document.xml");
    expect([...parts.keys()]).toContain("[Content_Types].xml");
    expect(parts.get("word/settings.xml")!.toString("utf8")).not.toContain(
      "documentProtection",
    );
    for (const term of [
      "documentProtection",
      "permStart",
      "permEnd",
      "writeProtection",
      "readOnlyRecommended",
      "enforcement",
      "editRange",
      "<w:lock",
      "sdtContent",
    ]) {
      expect(`${term}: ${allXml.includes(term)}`).toBe(`${term}: false`);
    }
  });

  test("is a LEGAL DOCUMENT — no data tables anywhere", () => {
    // The whole point of v2: it must not read like a database report.
    expect(docXml.includes("<w:tbl>")).toBe(false);
  });

  test("carries the legal document skeleton from the reference sample", () => {
    const text = docXml;
    for (const part of [
      "HESHIIS KIRO GURI XAAS.",
      "QODOBADA HESHIISKA",
      "Magaca Kireeysada Guriga",
      "Magaca Kiraystaha Guriga",
      "Maragyo Goob Joogayaala.",
      "Cadaynta Xafiiska:",
      "Ref/Dpn/HK/",
    ]) {
      expect(`${part}: ${text.includes(part)}`).toBe(`${part}: true`);
    }
    // Numbered legal clauses 1..11 must all be present as prose.
    for (let n = 1; n <= 11; n++) {
      expect(`clause ${n}: ${text.includes(`>${n}. `)}`).toBe(`clause ${n}: true`);
    }
  });

  test("keeps every reference placeholder name verbatim", () => {
    for (const token of [
      "REF_NUMBER",
      "TAARIIKH",
      "MAALINTA",
      "KIREYE_MAGAC",
      "KIREYE_TELEFOON",
      "KIRAYSTE_MAGAC",
      "KIRAYSTE_TELEFOON",
      "GURI_GOOBTA",
      "GURI_SHARRAXAAD",
      "KIRADA_QIIMAHA",
      "KIRADA_QIIMAHA_QORAAL",
      "HABKA_BIXINTA",
      "TAARIIKH_BILOWGA",
      "TAARIIKH_DHAMMAAD",
      "XALADDA_KIRADA",
      "DEEBAAJI_QIIMAHA",
      "DAMIIN_MAGAC",
      "DAMIIN_TELEFOON",
      "FAAHFAAHIN_LACAGTA",
    ]) {
      expect(
        `${token}: ${docXml.includes(tokenString(token))}`,
      ).toBe(`${token}: true`);
    }
  });

  test("has balanced repeatable blocks and conditionals", () => {
    // A block may legitimately appear more than once (e.g. KIREYEYAYAAL is
    // used once to list the parties and once to collect their signatures);
    // what must hold is that every open has a matching close.
    for (const b of ["KIREYEYAYAAL", "KIRAYSTAYAAL", "MARAGYO"]) {
      const open = docXml.split(`{{#${b}}}`).length - 1;
      const close = docXml.split(`{{/${b}}}`).length - 1;
      expect(`${b} balanced: ${open === close}`).toBe(`${b} balanced: true`);
      expect(`${b} present: ${open > 0}`).toBe(`${b} present: true`);
    }
    for (const f of ["KIRO_XIDHAN", "DEEBAAJI_HAA", "DAMIIN_HAA"]) {
      const open = docXml.split(`{{IF:${f}}}`).length - 1;
      const close = docXml.split(`{{END:${f}}}`).length - 1;
      // Balanced is what matters — each IF has a matching END.
      expect(`${f} balanced: ${open === close}`).toBe(`${f} balanced: true`);
      expect(`${f} present: ${open > 0}`).toBe(`${f} present: true`);
    }
  });

  test("passes template validation with no errors", async () => {
    const report = await scanTemplateTokens(bytes, getConfig("heshiis_kiro")!);
    expect(report.syntaxErrors).toEqual([]);
    // Registry names the template uses must all be recognised.
    const recognized = new Set(report.recognized);
    for (const t of ["REF_NUMBER", "KIREYE_MAGAC", "KIRADA_QIIMAHA", "MAALINTA"]) {
      expect(`${t}: ${recognized.has(t)}`).toBe(`${t}: true`);
    }
  });

  test("drives the real pipeline end to end", async () => {
    const out = await generateDocument({
      config: getConfig("heshiis_kiro")!,
      values: scenario21(),
      referenceNumber: "DPN/HK/000 60/03/026",
      subTypeLabel: "Kiro",
      templateBytes: bytes,
    });
    expect(out.result.fileName).toBe("Heshiis_Kiro_Ref-DPN-HK-000-60-03-026.docx");
    expect(out.outputValidation?.valid).toBe(true);
    expect(out.warnings.filter((w) => !w.includes("PDF"))).toEqual([]);
    const generated = Buffer.from(await (out.result.blob as Blob).arrayBuffer());
    expect(generated.length).toBeGreaterThan(1000);
  });

  test("new registry tokens are declared, not invented ad hoc", () => {
    const names = new Set(HESHIIS_KIRO_PLACEHOLDERS.map((s) => s.token));
    for (const t of ["MAALINTA", "XALADDA_KIRADA", "KIRADA_QIIMAHA_QORAAL"]) {
      expect(`${t}: ${names.has(t)}`).toBe(`${t}: true`);
    }
  });
});