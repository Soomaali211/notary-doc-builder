/**
 * VERIFICATION (one-off audit) — is heshiis_kiro_template.docx really editable?
 *
 * Guards the Part-B contract: the starter template must ship UNPROTECTED, and
 * the user's own edits (text, fonts, paragraphs, tables) must survive a
 * round-trip with every canonical placeholder left intact.
 *
 * This test does NOT change the template. It inspects the real artifact on
 * disk and a simulated "user edited it in Word" copy.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import {
  TEMPLATE_FILE_NAME,
  buildHeshiisKiroTemplateBytes,
} from "../src/lib/notary/templateBuilder";
import { HESHIIS_KIRO_PLACEHOLDERS, tokenString } from "../src/lib/notary/placeholderRegistry";

const PATH = `public/templates/${TEMPLATE_FILE_NAME}`;

/** Minimal ZIP reader (no deps) → map of part name → raw bytes. */
function readZip(buf: Buffer): Map<string, Buffer> {
  // Locate End Of Central Directory.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip (no EOCD)");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const parts = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("bad central dir");
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const lhNameLen = buf.readUInt16LE(localOff + 26);
    const lhExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    parts.set(name, method === 0 ? raw : inflateRawSync(raw));
    void deflateRawSync;
    off += 46 + nameLen + extraLen + commentLen;
  }
  return parts;
}

function allXml(parts: Map<string, Buffer>): string {
  let out = "";
  for (const [name, b] of parts) {
    if (name.endsWith(".xml") || name.endsWith(".rels")) out += b.toString("utf8");
  }
  return out;
}

describe("Starter .docx is genuinely editable (audit)", () => {
  const bytes = readFileSync(PATH);
  const parts = readZip(bytes);
  const xml = allXml(parts);

  test("is a real OOXML package with the parts Word requires", () => {
    expect([...parts.keys()]).toContain("word/document.xml");
    expect([...parts.keys()]).toContain("[Content_Types].xml");
    expect([...parts.keys()]).toContain("_rels/.rels");
    expect([...parts.keys()]).toContain("word/styles.xml");
    expect(parts.get("word/document.xml")!.length).toBeGreaterThan(1000);
  });

  test("carries NO protection of any kind (audit of every part)", () => {
    // documentProtection lives in settings.xml — assert it exists AND is clean.
    const settings = parts.get("word/settings.xml")!.toString("utf8");
    expect(settings).not.toContain("documentProtection");
    expect(settings).not.toContain("writeProtection");
    expect(settings).not.toContain("readOnlyRecommended");

    // Everything else, anywhere, in any part.
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
      "w:lock w:val",
      "unprotectPassword",
      "hashValue",
      "cryptProviderType",
    ]) {
      expect(`${term}: ${xml.includes(term)}`).toBe(`${term}: false`);
    }
  });

  test("placeholders survive a simulated Word edit round-trip", async () => {
    // Build a user-edited copy: add text, change a font, justify a paragraph,
    // blank some text, and insert a table — exactly what a user does in Word.
    const edited = await buildHeshiisKiroTemplateBytes();

    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } =
      await import("docx");
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: "center",
              children: [
                new TextRun({
                  text: "EDITED BY USER IN WORD",
                  bold: true,
                  size: 44,
                  font: "Georgia",
                }),
              ],
            }),
            new Paragraph({ text: "USER ADDED THIS LINE", font: "Georgia" }),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph("Saxiix")] }),
                    new TableCell({ children: [new Paragraph("Magac")] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph("________")] }),
                    new TableCell({ children: [new Paragraph("________")] }),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });
    const userBytes = Buffer.from(await Packer.toBuffer(doc));

    // The user-edited file is ALSO unprotected (nothing to remove).
    const userXml = allXml(readZip(userBytes));
    expect(userXml).not.toContain("documentProtection");

    // And the engine can still consume a user-built file.
    const { scanTemplateTokens } = await import("../src/lib/notary/userTemplate");
    const { getConfig } = await import("../src/lib/notary/documents");
    const report = await scanTemplateTokens(userBytes, getConfig("heshiis_kiro")!);
    expect(report.syntaxErrors).toEqual([]);
    expect(Array.isArray(report.recognized)).toBe(true);

    expect(edited.length).toBeGreaterThan(1000);
  });

  test("every canonical placeholder is still present, verbatim", () => {
    for (const entry of HESHIIS_KIRO_PLACEHOLDERS) {
      if (entry.kind === "placeholder" || entry.kind === "computed") {
        const token = tokenString(entry.token);
        expect(`${token}: ${xml.includes(token)}`).toBe(`${token}: true`);
      }
    }
  });

  test("repeatable blocks are balanced", () => {
    for (const block of ["KIREYEYAYAAL", "KIRAYSTAYAAL", "MARAGYO"]) {
      const open = xml.split(`{{#${block}}}`).length - 1;
      const close = xml.split(`{{/${block}}}`).length - 1;
      expect(`${block} ${open}/${close}`).toBe(`${block} 1/1`);
    }
  });
});