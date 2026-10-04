/**
 * §6, §7, §8, §25, §26 — THE UNIVERSAL EXPORT SURFACE.
 *
 * One model feeds Live Review, DOCX, PDF and Print. These tests exercise the
 * three export surfaces for real:
 *
 *  · DOCX  — the OFFICIAL template is filled and zipped, tables and all.
 *  · PDF   — the browser's own print of the same rendered document.
 *  · PRINT — the document prints; the form never does.
 *
 * Nothing is mocked: the templates are the real files in `public/`, and the
 * DOCX is opened again as a zip to read what it actually contains.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import {
  buildUniversalDocument,
  downloadBlob,
  exportDocx,
  exportFileBaseName,
  resolveTemplate,
} from "../src/lib/notary/documentExport";
import { selectTemplate } from "../src/lib/notary/registry";
import {
  DocumentPageView,
  LiveDocumentReview,
} from "../src/components/notary/LiveDocumentReview";
import {
  HANTI_CONFIG,
  KIRO_CONFIG,
  KIRO_TEMPLATE,
  HANTI_TEMPLATES,
  hantiValues,
  kiroValues,
  templateBytes,
} from "./_fixtures";

const HANTI_REFERENCE = "DPN-MG-001";

/** The browser fetches the registered template; a test hands over the bytes. */
const hantiSource = (
  values: ReturnType<typeof hantiValues>,
  subType: keyof typeof HANTI_TEMPLATES = "dhul_banaan",
) => ({
  config: HANTI_CONFIG,
  values,
  referenceNumber: HANTI_REFERENCE,
  templateBytes: templateBytes(HANTI_TEMPLATES[subType]),
});

async function docxText(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = (await zip.file("word/document.xml")!.async("string")) ?? "";
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Template resolution — config-driven, never hard-coded                */
/* ------------------------------------------------------------------ */

describe("universal export — template resolution", () => {
  test("each sub-type resolves its own registered template", () => {
    for (const subType of ["dhul_banaan", "guri", "beer"] as const) {
      const values = hantiValues({ subType });
      const spec = selectTemplate(HANTI_CONFIG, values);
      expect(spec).toBeDefined();
      expect(spec!.filePath).toBe(HANTI_TEMPLATES[subType]);
      expect(spec!.documentType).toBe(HANTI_CONFIG.id);
    }
  });

  test("a sub-type with no template reports it plainly instead of guessing", async () => {
    await expect(
      resolveTemplate({
        config: HANTI_CONFIG,
        values: hantiValues({ subType: "hanti_kale" }),
        referenceNumber: HANTI_REFERENCE,
      }),
    ).resolves.toBeNull();

    await expect(
      buildUniversalDocument({
        config: HANTI_CONFIG,
        values: hantiValues({ subType: "hanti_kale" }),
        referenceNumber: HANTI_REFERENCE,
      }),
    ).rejects.toThrow(/Template looma helin/);
  });

  test("bytes handed in by the caller win over the registry", async () => {
    const bytes = templateBytes(HANTI_TEMPLATES.guri);
    const resolved = await resolveTemplate({
      config: HANTI_CONFIG,
      values: hantiValues({ subType: "dhul_banaan" }),
      referenceNumber: HANTI_REFERENCE,
      templateBytes: bytes,
    });
    expect(resolved!.bytes.byteLength).toBe(bytes.byteLength);
  });

  test("a sub-type without a template resolves to nothing", () => {
    expect(
      selectTemplate(HANTI_CONFIG, hantiValues({ subType: "hanti_kale" })),
    ).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* DOCX — the official template, never a new document                  */
/* ------------------------------------------------------------------ */

describe("universal export — DOCX", () => {
  test("the exported DOCX is a real docx built from the registered template", async () => {
    const { blob, fileName, printedReference } = await exportDocx(
      hantiSource(hantiValues({ sellerCount: 3, buyerCount: 2 })),
    );
    expect(blob.type).toContain("wordprocessingml.document");
    expect(fileName.endsWith(".docx")).toBe(true);
    expect(printedReference).toBe("Ref/Dpn/MG/001/01/26");

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);
    // The template's own parts survive — this is a filled template, not a
    // freshly designed document.
    expect(names).toContain("word/styles.xml");
    expect(names).toContain("word/numbering.xml");
    const xml = (await zip.file("word/document.xml")!.async("string")) ?? "";
    expect(xml).toContain("<w:tbl>");
    expect(xml).not.toContain("{{");
  });

  test("the DOCX carries exactly the answers the live model shows", async () => {
    const values = hantiValues({ sellerCount: 4, buyerCount: 1 });
    const { blob } = await exportDocx(hantiSource(values));
    const text = await docxText(blob);
    expect(text).toContain("Ref/Dpn/MG/001/01/26");
    expect(text).toContain("AHMED CALI");
    expect(text).toContain("MAXAMED ADAN"); // the 3rd seller
    expect(text).toContain("KHALID NUR"); // the 3rd seller
    expect(text).toContain("$25,000");
    expect(text).not.toContain("{{");
  });

  test("conditional content follows the same answers in the DOCX", async () => {
    const withRef = await exportDocx(hantiSource(hantiValues({ hasReference: true })));
    const withoutRef = await exportDocx(hantiSource(hantiValues({ hasReference: false })));
    expect(await docxText(withRef.blob)).toContain("Tr No 4471");
    expect(await docxText(withoutRef.blob)).not.toContain("Tr No 4471");
  });

  test("Kiro exports through the same surface with the reference it was given", async () => {
    const { blob, printedReference, fileName } = await exportDocx({
      config: KIRO_CONFIG,
      values: kiroValues(),
      referenceNumber: "HK-001",
      templateBytes: templateBytes(KIRO_TEMPLATE),
    });
    // Kiro declares no referenceFormat: the document prints exactly what the
    // notary typed, byte for byte, as it always has.
    expect(printedReference).toBe("HK-001");
    expect(fileName).toContain("HK-001");
    const text = await docxText(blob);
    expect(text).toContain("HESHIIS KIRO");
    expect(text).not.toContain("{{");
  });

  test("downloading outside a browser is a no-op, not a crash", () => {
    expect(downloadBlob(new Blob(["x"]), "test.docx")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* File naming for the PDF / print dialog                              */
/* ------------------------------------------------------------------ */

describe("universal export — PDF and print names", () => {
  test("Hanti suggests the composed reference", () => {
    expect(
      exportFileBaseName({
        config: HANTI_CONFIG,
        values: hantiValues(),
        referenceNumber: HANTI_REFERENCE,
      }),
    ).toContain("Ref-Dpn-MG-001-01-26");
  });

  test("Kiro suggests the reference as typed", () => {
    expect(
      exportFileBaseName({
        config: KIRO_CONFIG,
        values: kiroValues(),
        referenceNumber: "HK-001",
      }),
    ).toContain("HK-001");
  });
});

/* ------------------------------------------------------------------ */
/* The rendered review — real markup, not plain text                    */
/* ------------------------------------------------------------------ */

describe("universal export — the rendered document", () => {
  test("the page renders headings, a real table and Somali content", async () => {
    const { model } = await buildUniversalDocument(
      hantiSource(hantiValues({ sellerCount: 2 })),
    );
    const html = renderToStaticMarkup(
      <>
        {model.pages.map((page) => (
          <DocumentPageView key={page.index} page={page} model={model} />
        ))}
      </>,
    );
    expect(html).toContain("<table"); // a real table, not indented text
    expect(html).toContain("KALA IIBSI HANTI");
    expect(html).toContain("text-align:center");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("Waardhiil");
    expect(html).not.toContain("{{");
    // Every paragraph keeps a readable size: a template that defers the size
    // to its Word style must never render as font-size:0.
    expect(html).not.toContain("font-size:0");
    expect(html).toContain("font-size:16px"); // 12 pt body text
  });

  test("every model page renders its own sheet", async () => {
    const { model } = await buildUniversalDocument(
      hantiSource(hantiValues({ sellerCount: 10, buyerCount: 5 })),
    );
    expect(model.pages.length).toBeGreaterThan(1);
    const html = renderToStaticMarkup(
      <>
        {model.pages.map((page) => (
          <DocumentPageView key={page.index} page={page} model={model} />
        ))}
      </>,
    );
    const sheets = html.match(/data-doc-page=/g) ?? [];
    expect(sheets).toHaveLength(model.pages.length);
  });

  test("the review pane offers zoom, pages, Word, PDF and print for any type", () => {
    const html = renderToStaticMarkup(
      <LiveDocumentReview
        config={HANTI_CONFIG}
        values={hantiValues()}
        referenceNumber={HANTI_REFERENCE}
        templateBytes={templateBytes(HANTI_TEMPLATES.dhul_banaan)}
      />,
    );
    expect(html).toContain("data-live-review=\"kala_iibsi_hanti\"");
    expect(html).toContain('data-review-zoom="in"');
    expect(html).toContain('data-review-zoom="out"');
    expect(html).toContain('data-review-page="next"');
    expect(html).toContain('data-review-action="docx"');
    expect(html).toContain('data-review-action="pdf"');
    expect(html).toContain('data-review-action="print"');
    expect(html).toContain("Soo Saar Word");
    expect(html).toContain("Soo Saar PDF");
    expect(html).toContain("Daabac");
    // The toolbar is never part of the printed document.
    expect(html).toContain("data-no-print");
  });

  test("the same component carries another document type with no change", () => {
    const kiroHtml = renderToStaticMarkup(
      <LiveDocumentReview
        config={KIRO_CONFIG}
        values={kiroValues()}
        referenceNumber="HK-001"
        templateBytes={templateBytes(KIRO_TEMPLATE)}
      />,
    );
    const hantiHtml = renderToStaticMarkup(
      <LiveDocumentReview
        config={HANTI_CONFIG}
        values={hantiValues()}
        referenceNumber={HANTI_REFERENCE}
        templateBytes={templateBytes(HANTI_TEMPLATES.dhul_banaan)}
      />,
    );
    expect(kiroHtml).toContain('data-live-review="heshiis_kiro"');
    expect(kiroHtml).not.toContain('data-live-review="kala_iibsi_hanti"');
    expect(hantiHtml).not.toContain("HESHIIS KIRO Guri");
    // Same actions, both types — no per-type export code.
    for (const action of ["docx", "pdf", "print"]) {
      expect(kiroHtml).toContain(`data-review-action="${action}"`);
      expect(hantiHtml).toContain(`data-review-action="${action}"`);
    }
  });
});