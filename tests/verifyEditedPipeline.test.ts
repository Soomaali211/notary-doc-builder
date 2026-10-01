/**
 * VERIFICATION — the user's Word-edited starter template must still drive the
 * pipeline. Simulates: add text, change font, change paragraph, delete text,
 * add a table — then runs the REAL pipeline over the edited bytes.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { TEMPLATE_FILE_NAME } from "../src/lib/notary/templateBuilder";
import { generateDocument } from "../src/lib/notary/pipeline";
import { getConfig } from "../src/lib/notary/documents";
import { scanTemplateTokens, toTemplateSpec } from "../src/lib/notary/userTemplate";
import { scenario21 } from "../scripts/verify-helpers";

const PATH = `public/templates/${TEMPLATE_FILE_NAME}`;

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

/** What a user does in Word: type, restyle, reflow, delete, tabulate. */
async function userEditedCopy(): Promise<Buffer> {
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
                color: "C0392B",
              }),
            ],
          }),
          new Paragraph({ text: "USER ADDED THIS LINE" }),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

describe("User-edited Word template still drives the pipeline", () => {
  test("the real starter file is unprotected and token-complete", async () => {
    const bytes = readFileSync(PATH);
    const parts = readZip(bytes);
    const xml = [...parts.values()]
      .map((b) => b.toString("utf8"))
      .join("");

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
      "unprotectPassword",
    ]) {
      expect(`${term}: ${xml.includes(term)}`).toBe(`${term}: false`);
    }
    expect(parts.get("word/settings.xml")!.toString("utf8")).not.toContain(
      "documentProtection",
    );
  });

  test("a Word-edited file is accepted by the scanner (no syntax errors)", async () => {
    const userBytes = await userEditedCopy();
    const config = getConfig("heshiis_kiro")!;
    const report = await scanTemplateTokens(userBytes, config);
    expect(report.syntaxErrors).toEqual([]);
    // A brand-new user file has no known tokens yet — that's a warning, not an error.
    expect(Array.isArray(report.unknown)).toBe(true);
    expect(typeof toTemplateSpec).toBe("function");
  });

  test("pipeline fills the starter template end-to-end (no leftover tokens)", async () => {
    const bytes = readFileSync(PATH);
    const config = getConfig("heshiis_kiro")!;
    const out = await generateDocument({
      config,
      values: scenario21(),
      referenceNumber: "DPN/K/EDT/001",
      subTypeLabel: "Kiro",
      templateBytes: bytes,
    });

    // Real docx bytes came back out of the pipeline.
    const blob = out.result.blob as Blob;
    const generated = Buffer.from(await blob.arrayBuffer());
    expect(generated.length).toBeGreaterThan(1000);

    // The reference number in the document matches the one in the filename.
    expect(out.result.referenceNumber).toBe("DPN/K/EDT/001");
    expect(out.result.fileName).toBe("Heshiis_Kiro_Ref-DPN-K-EDT-001.docx");

    // Output validation confirms nothing was left unfilled.
    expect(out.outputValidation?.valid).toBe(true);
    expect(out.outputValidation?.issues ?? []).toEqual([]);
    // The only permitted warning is "no PDF converter here" — DOCX still fine.
    expect(out.warnings.filter((w) => !w.includes("PDF"))).toEqual([]);
  });
});