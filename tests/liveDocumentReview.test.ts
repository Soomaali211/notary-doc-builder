/**
 * §1–§9, §23–§27 — THE UNIVERSAL LIVE DOCUMENT REVIEW.
 *
 * The rule under test is architectural: there is ONE review path, fed by
 * {documentType, currentDocumentData, template, placeholder rules,
 * conditional rules}. So these tests deliberately use THREE different
 * document types and ONE builder:
 *
 *   · Heshiis Kiro          (locked config, locked template)
 *   · Kala Iibsi Hanti      (6-step flow, attendance + wakiil + conditionals)
 *   · a synthetic future type with its own config AND its own template,
 *     proving the layer is neither Kiro's nor Hanti's.
 *
 * Every assertion reads the REAL resolved document, never a stub.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Document, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import { buildDocumentModel, modelToText } from "../src/lib/notary/documentModel";
import { printDocument } from "../src/lib/notary/documentExport";
import {
  HANTI_CONFIG,
  KIRO_CONFIG,
  KIRO_TEMPLATE,
  HANTI_TEMPLATES,
  hantiValues,
  kiroValues,
  templateBytes,
} from "./_fixtures";
import type { DocumentBlock, DocumentModel } from "../src/lib/notary/documentModel";
import { liveRenderKey } from "../src/components/notary/LiveDocumentReview";
import type { DocumentConfig, FormValues, TemplateSpec } from "../src/lib/notary/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function modelFor(
  config: DocumentConfig,
  values: FormValues,
  filePath: string,
  referenceNumber = "REF-001",
): Promise<DocumentModel> {
  return buildDocumentModel({
    config,
    values,
    templateBytes: templateBytes(filePath),
    referenceNumber,
  });
}

const text = (model: DocumentModel) => modelToText(model).join("\n");

function paragraphs(model: DocumentModel): Extract<DocumentBlock, { kind: "paragraph" }>[] {
  return model.pages.flatMap((p) =>
    p.blocks.filter((b): b is Extract<DocumentBlock, { kind: "paragraph" }> => b.kind === "paragraph"),
  );
}

function tables(model: DocumentModel) {
  return model.pages.flatMap((p) => p.blocks.filter((b) => b.kind === "table"));
}

async function futureTypeTemplate(): Promise<ArrayBuffer> {
  // A template for a document type that does not exist yet. It proves the
  // renderer is template-driven: nothing about it is known to the code under
  // test except the tokens the config maps.
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: "center",
            children: [new TextRun({ text: "NOOC MUSTAQBAL", bold: true })],
          }),
          new Paragraph({ children: [new TextRun({ text: "Qof: {{MAGACA}}" })] }),
          new Paragraph({ children: [new TextRun({ text: "Xogta: {{XOGTA}}" })] }),
          new Paragraph({ children: [new TextRun({ text: "{{IF:TIRO_RO}}" })] }),
          new Paragraph({ children: [new TextRun({ text: "Tirada waa {{TIRADA}}." })] }),
          new Paragraph({ children: [new TextRun({ text: "{{END:TIRO_RO}}" })] }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  return (await blob.arrayBuffer()) as ArrayBuffer;
}

const FUTURE_CONFIG: DocumentConfig = {
  id: "nooc_mustaqbal",
  title: "Nooc Document Mustaqbal",
  description: "Nooc cusub oo aan weli diiwaangelin — siyaasadda renderer-ka u tijaabayo.",
  subTypes: [{ value: "guud", label: "Guud" }],
  fileNamePrefix: "Mustaqbal",
  templatePath: "/templates/mustaqbal.docx",
  referencePrefix: "MST",
  setupSectionId: "dejinta",
  sections: [
    {
      id: "dejinta",
      title: "Dejinta",
      fields: [
        { id: "sub_type", type: "select", label: "Nooca", options: [{ value: "guud", label: "Guud" }] },
        { id: "tirada", type: "number", label: "Tirada", optional: true },
      ],
    },
    {
      id: "qof",
      title: "Qofka",
      fields: [{ id: "magac", type: "text", label: "Magaca" }],
    },
    {
      id: "xogta",
      title: "Xogta",
      fields: [{ id: "faahfaahin", type: "textarea", label: "Faahfaahin", optional: true }],
    },
  ],
  placeholders: [
    { placeholder: "{{MAGACA}}", mapping: { key: "qof.magac" } },
    { placeholder: "{{XOGTA}}", mapping: { key: "xogta.faahfaahin" } },
    { placeholder: "{{TIRADA}}", mapping: { key: "dejinta.tirada" } },
  ],
  clauses: [],
  requiresWitness: false,
  conditionFlags: {
    TIRO_RO: { op: "not_equals", field: "dejinta.tirada", value: "" },
  },
};

const futureValues = (tirada: string): FormValues =>
  ({
    dejinta: { sub_type: "guud", tirada },
    qof: { magac: "SHO AADAN" },
    xogta: { faahfaahin: "Xogta tijaabada." },
  }) as FormValues;

/** Every source file under a directory (used by the "no per-type code" scan). */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 1 — Live review works for every document type                       */
/* ------------------------------------------------------------------ */

describe("universal live review — every document type renders", () => {
  test("Heshiis Kiro: live review renders the locked Kiro template", async () => {
    const model = await modelFor(KIRO_CONFIG, kiroValues(), KIRO_TEMPLATE, "HK-001");
    expect(model.error).toBeNull();
    expect(model.documentType).toBe("heshiis_kiro");
    expect(model.pages.length).toBeGreaterThanOrEqual(1);
    const body = text(model);
    expect(body).toContain("HESHIIS KIRO");
    expect(body).toContain("QODOBADA HESHIISKA");
    expect(body).not.toContain("{{");
    expect(model.warnings).toEqual([]);
  });

  test("Kala Iibsi Hanti: live review renders the Hanti template", async () => {
    const model = await modelFor(
      HANTI_CONFIG,
      hantiValues({ subType: "dhul_banaan" }),
      HANTI_TEMPLATES.dhul_banaan,
      "DPN-MG-001",
    );
    expect(model.error).toBeNull();
    const body = text(model);
    expect(body).toContain("KALA IIBSI HANTI");
    expect(body).toContain("IIBIYAYAAL");
    expect(body).toContain("IIBSADAYAAL");
    expect(body).not.toContain("{{");
  });

  test("a brand new document type needs no new review code", async () => {
    const model = await buildDocumentModel({
      config: FUTURE_CONFIG,
      values: futureValues("4"),
      templateBytes: await futureTypeTemplate(),
      referenceNumber: "MST-001",
    });
    expect(model.error).toBeNull();
    expect(model.documentType).toBe("nooc_mustaqbal");
    const body = text(model);
    expect(body).toContain("NOOC MUSTAQBAL");
    expect(body).toContain("Qof: SHO AADAN");
    expect(body).toContain("Xogta: Xogta tijaabada.");
    expect(body).toContain("Tirada waa 4.");
  });
});

/* ------------------------------------------------------------------ */
/* 2 — It is a real document rendering, not plain text                  */
/* ------------------------------------------------------------------ */

describe("universal live review — real document structure", () => {
  test("headings, bold, alignment, size and spacing come from the template", async () => {
    const model = await modelFor(
      HANTI_CONFIG,
      hantiValues(),
      HANTI_TEMPLATES.dhul_banaan,
      "DPN-MG-001",
    );
    const paras = paragraphs(model);
    const headings = paras.filter((p) => p.style.headingLevel > 0);
    expect(headings.length).toBeGreaterThan(3);
    expect(headings.map((h) => h.text).join(" ")).toContain("XOGTA HESHIISKA");

    const title = paras[0];
    expect(title.style.alignment).toBe("center");
    expect(title.style.bold).toBe(true);
    expect(title.style.fontSizePt).toBe(18);

    const spaced = paras.find((p) => (p.style.spacingAfterPt ?? 0) > 0);
    expect(spaced).toBeDefined();
  });

  test("tables render as real rows and cells", async () => {
    const model = await modelFor(HANTI_CONFIG, hantiValues(), HANTI_TEMPLATES.dhul_banaan);
    const tbl = tables(model);
    expect(tbl.length).toBeGreaterThan(2);
    const first = tbl[0].table.rows;
    expect(first.length).toBeGreaterThan(3);
    expect(first[0].length).toBe(2);
    const cellText = (c: (typeof first)[number]) =>
      c.blocks.map((b) => (b.kind === "paragraph" ? b.text : "")).join(" ");
    expect(cellText(first[0][0])).toContain("Nambarka Tixraaca");
    expect(cellText(first[0][1])).toContain("Ref/Dpn/MG/001/01/26");
  });

  test("page geometry comes from the template's own section properties", async () => {
    const model = await modelFor(HANTI_CONFIG, hantiValues(), HANTI_TEMPLATES.dhul_banaan);
    // A4 from the template (11906 × 16838 twips), not a hard-coded guess.
    expect(model.geometry.widthPt).toBeCloseTo(595.3, 1);
    expect(model.geometry.heightPt).toBeCloseTo(841.9, 1);
    expect(model.geometry.marginTopPt).toBe(72);
  });

  test("a multi-page document is split into numbered pages", async () => {
    const model = await modelFor(
      HANTI_CONFIG,
      hantiValues({ sellerCount: 10, buyerCount: 5 }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    expect(model.pages.length).toBeGreaterThan(1);
    expect(model.pages.map((p) => p.index)).toEqual(model.pages.map((_, i) => i));
    expect(model.pagination).toBe("template-breaks+estimated");
  });
});

/* ------------------------------------------------------------------ */
/* 3 — Document type isolation                                         */
/* ------------------------------------------------------------------ */

describe("universal live review — document type isolation", () => {
  test("Hanti answers never leak a Kiro field, and the reverse", async () => {
    const hanti = await modelFor(
      HANTI_CONFIG,
      hantiValues(),
      HANTI_TEMPLATES.dhul_banaan,
      "DPN-MG-001",
    );
    const kiro = await modelFor(KIRO_CONFIG, kiroValues(), KIRO_TEMPLATE, "HK-001");
    const hantiBody = text(hanti);
    const kiroBody = text(kiro);

    expect(hantiBody).toContain("Nooca Hantida");
    expect(hantiBody).not.toContain("NOOCA_KIRADA");
    expect(hantiBody).not.toContain("Kirayste");
    expect(hantiBody).not.toContain("QODOBADA HESHIISKA");

    expect(kiroBody).not.toContain("Nooca Hantida");
    expect(kiroBody).not.toContain("IIBIYAYAAL");
    expect(kiroBody).not.toContain("Degmada");
  });

  test("switching types swaps the whole document, not a merge", async () => {
    const first = await modelFor(KIRO_CONFIG, kiroValues(), KIRO_TEMPLATE, "HK-001");
    const second = await modelFor(
      HANTI_CONFIG,
      hantiValues(),
      HANTI_TEMPLATES.dhul_banaan,
      "DPN-MG-001",
    );
    expect(first.documentType).not.toBe(second.documentType);
    expect(first.documentTypeTitle).not.toBe(second.documentTypeTitle);
    // Switching back reproduces the first document exactly — no residue.
    const backAgain = await modelFor(KIRO_CONFIG, kiroValues(), KIRO_TEMPLATE, "HK-001");
    expect(text(backAgain)).toBe(text(first));
  });

  test("each type keeps its own template and reference format", async () => {
    const hanti = await modelFor(
      HANTI_CONFIG,
      hantiValues(),
      HANTI_TEMPLATES.dhul_banaan,
      "DPN-MG-001",
    );
    const guri = await modelFor(
      HANTI_CONFIG,
      hantiValues({ subType: "guri" }),
      HANTI_TEMPLATES.guri,
      "DPN-MG-001",
    );
    expect(text(hanti)).toContain("Ref/Dpn/MG/001/01/26");
    expect(text(guri)).not.toContain("Jiho Waqooyi");
    expect(text(guri)).toContain("Goobta Guriga");
  });
});

/* ------------------------------------------------------------------ */
/* 4 — Live update: every keystroke re-renders                         */
/* ------------------------------------------------------------------ */

describe("universal live review — live update", () => {
  test("changing the price re-renders without generating anything", async () => {
    const before = await modelFor(
      HANTI_CONFIG,
      hantiValues({ price: "25000", paid: "10000" }),
      HANTI_TEMPLATES.dhul_banaan,
      "DPN-MG-001",
    );
    const after = await modelFor(
      HANTI_CONFIG,
      hantiValues({ price: "90000", paid: "40000" }),
      HANTI_TEMPLATES.dhul_banaan,
      "DPN-MG-001",
    );
    expect(text(before)).toContain("$25,000");
    expect(text(before)).not.toContain("$90,000");
    expect(text(after)).toContain("$90,000");
    expect(text(after)).not.toContain("$25,000");
  });

  test("raising the seller count adds seller rows immediately", async () => {
    const two = await modelFor(
      HANTI_CONFIG,
      hantiValues({ sellerCount: 2 }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    const ten = await modelFor(
      HANTI_CONFIG,
      hantiValues({ sellerCount: 10 }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    const rows = (m: DocumentModel) =>
      (text(m).match(/Iibiyaha \d+:/g) ?? []).length;
    expect(rows(two)).toBe(2);
    expect(rows(ten)).toBe(10);
    expect(text(ten)).toContain("OMAR DIID"); // the 5th of the fixture names
  });

  test("removing a seller removes the row from the document", async () => {
    const one = await modelFor(
      HANTI_CONFIG,
      hantiValues({ sellerCount: 1 }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    const body = text(one);
    expect(body.match(/Iibiyaha \d+:/g) ?? []).toHaveLength(1);
    expect(body).not.toContain("FARAX XAAD");
  });
});

/* ------------------------------------------------------------------ */
/* 5 — Conditional content in the live document                        */
/* ------------------------------------------------------------------ */

describe("universal live review — conditional sections", () => {
  test("File / TR / Notary reference present → the section appears", async () => {
    const model = await modelFor(
      HANTI_CONFIG,
      hantiValues({ hasReference: true }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    expect(text(model)).toContain("Lambarka / Tixraaca Hantida: Tr No 4471");
  });

  test("File / TR / Notary absent → the section disappears entirely", async () => {
    const model = await modelFor(
      HANTI_CONFIG,
      hantiValues({ hasReference: false }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    expect(text(model)).not.toContain("Lambarka / Tixraaca Hantida");
    expect(text(model)).not.toContain("Tr No 4471");
  });

  test("third-party guarantor → the guarantor's details print", async () => {
    const model = await modelFor(
      HANTI_CONFIG,
      hantiValues({ guarantor: "qof_3aad" }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    expect(text(model)).toContain("OMAR DIID");
  });

  test("sellers guarantee → no third party is invented", async () => {
    const model = await modelFor(
      HANTI_CONFIG,
      hantiValues({ guarantor: "iibiyaha" }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    const body = text(model);
    expect(body).not.toContain("OMAR DIID"); // only ever the guarantor fixture
    expect(body).not.toContain("Magaca Damiinka |");
  });

  test("no guarantor → no guarantor identity is printed", async () => {
    const model = await modelFor(
      HANTI_CONFIG,
      hantiValues({ guarantor: "ma_jiro" }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    expect(text(model)).not.toContain("OMAR DIID");
  });

  test("a representative present → the wakiil block prints once", async () => {
    const withWakiil = await modelFor(
      HANTI_CONFIG,
      hantiValues({
        sellerCount: 2,
        sellerAttendance: [
          { status: "wakiil", representativeId: "r1" },
          { status: "jooga" },
        ],
      }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    const withoutWakiil = await modelFor(
      HANTI_CONFIG,
      hantiValues({ sellerCount: 2, representatives: false }),
      HANTI_TEMPLATES.dhul_banaan,
    );
    expect(text(withWakiil)).toContain("YASMIN AHMED");
    // The whole wakiil section disappears when no representative exists —
    // it is never replaced by an empty heading.
    expect(text(withoutWakiil)).not.toContain("YASMIN AHMED");
    expect(text(withoutWakiil)).not.toContain("Wakiillo Iibiyayaasha");
  });

  test("an empty optional field never leaks a raw {{TOKEN}}", async () => {
    const values = hantiValues();
    (values.damiinka as Record<string, string>).gurmadka_dammaanadda = "";
    (values.qiimaha as Record<string, string>).habka_bixinta = "";
    const model = await modelFor(HANTI_CONFIG, values, HANTI_TEMPLATES.dhul_banaan);
    expect(text(model)).not.toContain("{{");
    expect(model.warnings.filter((w) => w.includes("Calmiyad"))).toEqual([]);
  });

  test("an unfinished form still previews — it never throws", async () => {
    const model = await buildDocumentModel({
      config: HANTI_CONFIG,
      values: {} as FormValues,
      templateBytes: templateBytes(HANTI_TEMPLATES.dhul_banaan),
      referenceNumber: "DPN-MG-001",
    });
    expect(model.error).toBeNull();
    expect(text(model)).toContain("KALA IIBSI HANTI");
    expect(text(model)).not.toContain("{{");
  });
});

/* ------------------------------------------------------------------ */
/* 6 — Preview ≈ DOCX (one model, one template)                        */
/* ------------------------------------------------------------------ */

describe("universal live review — preview and DOCX agree", () => {
  test("the reference printed live is the reference printed in Word", async () => {
    const values = hantiValues();
    const model = await modelFor(
      HANTI_CONFIG,
      values,
      HANTI_TEMPLATES.dhul_banaan,
      "DPN-MG-001",
    );
    const body = text(model);
    expect(body).toContain("Nambarka Tixraaca | Ref/Dpn/MG/001/01/26");
    // The title line carries the same composed reference, never the raw serial.
    expect(body).not.toContain("DPN-MG-001");
  });

  test("a live model and the generated DOCX carry the same text", async () => {
    const values = hantiValues({ sellerCount: 3, buyerCount: 2 });
    const model = await modelFor(
      HANTI_CONFIG,
      values,
      HANTI_TEMPLATES.dhul_banaan,
      "DPN-MG-001",
    );
    const { generateDocx } = await import("../src/lib/notary/docxRenderer");
    const { blob } = await generateDocx(
      templateBytes(HANTI_TEMPLATES.dhul_banaan),
      HANTI_CONFIG,
      values,
      {
        "{{REFERENCE_NUMBER}}": "Ref/Dpn/MG/001/01/26",
        "{{REF_NUMBER}}": "Ref/Dpn/MG/001/01/26",
      },
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = (await zip.file("word/document.xml")!.async("string")) ?? "";
    const docxText = xml
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");

    const probeLines = paragraphs(model)
      .map((p) => p.text.trim())
      .filter((l) => l.length > 12)
      .slice(0, 25);
    expect(probeLines.length).toBeGreaterThan(10);
    for (const line of probeLines) {
      const probe = line.replace(/\s+/g, " ").trim();
      expect(docxText).toContain(probe);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 8 — The interview mounts ONE review pane, for every type            */
/* ------------------------------------------------------------------ */

describe("universal live review — mounted in the interview", () => {
  const source = readFileSync(
    resolve(import.meta.dir, "../src/pages/NewDocumentInterview.tsx"),
    "utf8",
  );

  test("an inline spec does not rebuild the document on every render", () => {
    // The page builds its spec inline, so a new object arrives on every
    // render. The render key must stay the same, or the renderer would run
    // forever.
    const spec = (filePath: string) =>
      ({
        templateId: filePath,
        documentType: HANTI_CONFIG.id,
        subtype: "dhul_banaan",
        name: "Hanti",
        filePath,
        version: 1,
        status: "active" as const,
        createdAt: 0,
        updatedAt: 0,
      }) satisfies TemplateSpec;
    const base = {
      config: HANTI_CONFIG,
      values: hantiValues(),
      referenceNumber: "DPN-MG-001",
      subTypeLabel: "Dhul Banaan",
      templateUrl: "https://example.test/tpl",
      templateBytes: templateBytes(HANTI_TEMPLATES.dhul_banaan),
    };
    expect(liveRenderKey({ ...base, spec: spec("/a.docx") })).toBe(
      liveRenderKey({ ...base, spec: spec("/a.docx") }),
    );
    // A genuinely different template, document type or reference DOES change.
    expect(liveRenderKey({ ...base, spec: spec("/a.docx") })).not.toBe(
      liveRenderKey({ ...base, spec: spec("/b.docx") }),
    );
    expect(liveRenderKey({ ...base, spec: spec("/a.docx") })).not.toBe(
      liveRenderKey({ ...base, spec: spec("/a.docx"), referenceNumber: "DPN-MG-002" }),
    );
    expect(liveRenderKey({ ...base, spec: spec("/a.docx") })).not.toBe(
      liveRenderKey({ ...base, config: KIRO_CONFIG, spec: spec("/a.docx") }),
    );
  });

  test("the two-pane interview renders the shared review component", () => {
    expect(source).toContain('import { LiveDocumentReview } from "@/components/notary/LiveDocumentReview"');
    // The pane is fed the CURRENT document type and the CURRENT answers —
    // which is what makes it live.
    expect(source).toMatch(/<LiveDocumentReview[\s\S]{0,400}config=\{config\}/);
    expect(source).toMatch(/<LiveDocumentReview[\s\S]{0,400}values=\{values\}/);
    // Two panes: form + review.
    expect(source).toMatch(/lg:grid-cols-\[260px_minmax\(0,1fr\)\]/);
  });

  test("the old per-document plain-text preview is gone", () => {
    // Preview used to render bare lines from document.xml, which is not a
    // document. It is now the same universal component in both places.
    expect(source).not.toContain("previewLines");
    expect(source.match(/<LiveDocumentReview/g) ?? []).toHaveLength(2);
  });

  test("no per-document-type preview code exists anywhere", () => {
    const dir = resolve(import.meta.dir, "../src");
    const offenders: string[] = [];
    for (const file of walk(dir)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      // Comments may NAME the duplicates the architecture forbids; CODE may
      // not define one.
      const code = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join("\n");
      if (/(Kiro|Hanti|Cilaaj)(Preview|Pdf|PDF|DOCX|Docx)\b/.test(code)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("universal live review — print isolation", () => {
  test("printDocument flags the document as the print target and calls print", () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
    };
    const originalWindow = g.window;
    const originalDocument = g.document;
    let printed = 0;
    const attributes = new Map<string, string>();
    const fakeDocument = {
      title: "Notary",
      documentElement: {
        setAttribute: (k: string, v: string) => attributes.set(k, v),
        removeAttribute: (k: string) => attributes.delete(k),
        getAttribute: (k: string) => attributes.get(k) ?? null,
      },
    };
    g.document = fakeDocument;
    g.window = {
      print: () => {
        printed++;
      },
      addEventListener: () => undefined,
    };

    const ok = printDocument({ fileName: "Ref-Test_001.pdf" });
    expect(ok).toBe(true);
    expect(printed).toBe(1);
    expect(attributes.get("data-printing")).toBe("document");
    expect(fakeDocument.title).toBe("Ref-Test_001");

    g.window = originalWindow;
    g.document = originalDocument;
  });

  test("printing outside a browser is a no-op, not a crash", () => {
    const g = globalThis as unknown as { window?: Window };
    const originalWindow = g.window;
    delete g.window;
    expect(printDocument()).toBe(false);
    g.window = originalWindow;
  });
});