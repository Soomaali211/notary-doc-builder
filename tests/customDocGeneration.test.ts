/**
 * THE FORM BUILDER — end-to-end generation.
 *
 * A type the office builds itself must be able to do the ONE thing the
 * shipped types do: run the REAL pipeline (validation → template →
 * placeholders → DOCX) and print every answer. This test builds a Word
 * template in memory with the type's own {{TOKENS}}, runs the real
 * `generateDocument` on the builder's config, and reads the produced
 * package back from disk — nothing is mocked.
 */
import { describe, expect, test } from "bun:test";
import { Document, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import {
  buildCustomConfig,
  normalizeBuilderForm,
  type BuilderForm,
} from "../src/lib/notary/customDocuments";
import { generateDocument } from "../src/lib/notary/pipeline";
import { selectTemplate } from "../src/lib/notary/registry";
import {
  addRepeatableItem,
  deserializeDraft,
  setAnswer,
  setRepeatableAnswer,
} from "../src/lib/notary/engine";
import { validateDocument } from "../src/lib/notary/validation";
import type { FormValues, TemplateSpec } from "../src/lib/notary/types";

const FORM: BuilderForm = normalizeBuilderForm({
  title: "Heshiis Deyn Gaar",
  description: "Lacag deyn laba qof u dhexeeya.",
  referencePrefix: "DPN-DN",
  acceptSubTypes: true,
  subTypes: ["Gaar"],
  sections: [
    {
      title: "Xisbiga",
      fields: [
        { id: "", label: "Magaca Deynta", type: "text", required: true, options: [] },
        { id: "", label: "Qiimaha", type: "currency", required: true, options: [] },
      ],
    },
    {
      title: "Deynta",
      fields: [
        { id: "", label: "Taariikhda Bilaabidda", type: "date", required: true, options: [] },
      ],
    },
  ],
});

const config = buildCustomConfig(FORM, "heshiis_deyn_gaar");

/** A Word template the office would design themselves, using the tokens the
 *  builder's token list prints. No styling, no tables — just the tokens. */
async function ownTemplateBytes(): Promise<ArrayBuffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "HESHIIS DEYN — {{REFERENCE_NUMBER}}" })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Magaca: {{MAGACA_DEYNTA}} · Qiimaha: {{QIIMAHA}}" })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Bilaabidda: {{TAARIIKHDA_BILAABIDDA}} · Taariikhda: {{TAARIIKHA_HESHIISKA}}" })],
          }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  return await blob.arrayBuffer();
}

async function fillValues(): Promise<FormValues> {
  let values = deserializeDraft(config, "{}");
  values = setAnswer(values, "heshiiska", "reference", "DPN-DN-001");
  values = setAnswer(values, "heshiiska", "taariikhda_heshiiska", "2026-02-10");
  values = setAnswer(values, "xisbiga", "magaca_deynta", "C Cali Gurey");
  values = setAnswer(values, "xisbiga", "qiimaha", "1200");
  values = setAnswer(values, "deynta", "taariikhda_bilaabidda", "2026-01-05");
  return values;
}

/** The spec the interview carries alongside the local template bytes: it
 *  names the office's own template the pipeline validates against. */
function ownSpec(): TemplateSpec {
  return {
    templateId: "USER_test",
    documentType: config.id,
    subtype: "",
    name: "Heshiis Deyn Gaar",
    filePath: "local:test",
    version: 1,
    status: "active",
    createdAt: 0,
    updatedAt: 0,
  } satisfies TemplateSpec;
}

async function docxText(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return (await zip.file("word/document.xml")!.async("string")) ?? "";
}

describe("a builder type generates a REAL document", () => {
  test("the office's own template + the final form state → one .docx", async () => {
    const bytes = await ownTemplateBytes();
    const values = await fillValues();

    const out = await generateDocument({
      config,
      values,
      referenceNumber: "DPN-DN-001",
      subTypeLabel: "Gaar",
      templateBytes: bytes,
      spec: ownSpec(),
    });

    expect(out.result.blob.size).toBeGreaterThan(0);
    expect(out.result.fileName).toContain("Heshiis_Deyn_Gaar");
    expect(out.result.fileName).toMatch(/\.docx$/);

    const text = await docxText(out.result.blob);
    // The answers print — every token the template carried received the
    // value the notary entered, and no raw {{TOKEN}} leaks into the paper.
    expect(text).toContain("C Cali Gurey");
    // Currency format: the engine prints money as the office reads money.
    expect(text).toContain("1,200 USD");
    expect(text).toContain("DPN-DN-001");
    expect(text).not.toContain("{{");
  });

  test("a repeat block prints EVERY row exactly the way the built-ins do", async () => {
    // A second type whose Xisbiga section carries a repeatable list of
    // maragyada — the shape the office asks for iibiyayaal / witnesses.
    const listConfig = buildCustomConfig(
      normalizeBuilderForm({
        title: "Cadayn Marag",
        description: "",
        referencePrefix: "DPN-MR",
        acceptSubTypes: false,
        subTypes: [],
        sections: [
          {
            title: "Dhaxal",
            fields: [],
            list: {
              label: "Maragyada",
              min: 1,
              fields: [
                { id: "", label: "Magaca Maraga", type: "text", required: true, options: [] },
              ],
            },
          },
        ],
      }),
      "cadayn_marag",
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "MARAGYADA: {{#MARAGYADA}}{{NUMBER}}. {{MAGACA_MARAGA}} {{/MARAGYADA}}" }),
              ],
            }),
          ],
        },
      ],
    });
    const bytes = await (await Packer.toBlob(doc)).arrayBuffer();

    const party = listConfig.sections.find((s) => s.id === "dhaxal")!.parties![0];
    let values = deserializeDraft(listConfig, "{}");
    values = setAnswer(values, "heshiiska", "reference", "DPN-MR-002");
    values = setAnswer(values, "heshiiska", "taariikhda_heshiiska", "2026-02-10");
    // Two rows, written exactly the way the interview writes them: the
    // draft is seeded with `min` empty rows — fill row 0 first, THEN add.
    values = setRepeatableAnswer(values, party.id, 0, "magaca_maraga", "Xasan");
    values = addRepeatableItem(values, party);
    values = setRepeatableAnswer(values, party.id, 1, "magaca_maraga", "Ali");

    const out = await generateDocument({
      config: listConfig,
      values,
      referenceNumber: "DPN-MR-002",
      templateBytes: bytes,
      spec: {
        templateId: "USER_test2",
        documentType: listConfig.id,
        subtype: "",
        name: "Cadayn Marag",
        filePath: "local:test2",
        version: 1,
        status: "active",
        createdAt: 0,
        updatedAt: 0,
      },
    });

    // Honest completeness: the interview would never reach Generate with a
    // validation gap, so the test state must be CLEAN, checked directly.
    expect(validateDocument(listConfig, values)).toEqual({});
    const text = await docxText(out.result.blob);
    expect(text).toContain("1. Xasan");
    expect(text).toContain("2. Ali");
    expect(text).not.toContain("{{");
  });

  test("without a template the failure is honest, not a silent sample", async () => {
    const values = await fillValues();
    // No templateBytes, no spec, and the custom type registers no registry
    // template: the pipeline MUST refuse instead of inventing a design.
    let message = "";
    try {
      await generateDocument({
        config,
        values,
        referenceNumber: "DPN-DN-001",
        subTypeLabel: "Gaar",
      });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).not.toBe("");
    expect(message).toMatch(/Template looma helin/);
    // And the registry path agrees with what selectTemplate would offer for
    // this type: nothing — so "nothing" is the honest state everywhere.
    expect(selectTemplate(config, values)).toBeUndefined();
  });
});
