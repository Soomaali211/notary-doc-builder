/**
 * Phase — Document Generation & User-Created Word Template.
 *
 * Covers the user-owned-template contract:
 *   - scenario #21 (2 kireeyayaal + 2 kiraystayaal, K2/T2 via wakiil,
 *     deebaaji Haa, damiin Maya, Kiro Furan)
 *   - placeholder aliases the office names its own way ({{REF_NUMBER}},
 *     {{GURI_GOOBTA}}, {{KIRADA_QIIMAHA}} …)
 *   - repeatable parties (never {{KIREYE_1}})
 *   - wakiil data per party + row-scoped conditionals
 *   - {{END:NAME}} alias + Kiro Xidhan/Furan end-date rule
 *   - clean empty values (no {{TOKEN}} survives)
 *   - no-overwrite unique file names (Heshiis_Kiro_[REF].docx)
 *   - user template flows end-to-end (uploaded bytes → filled DOCX)
 */
import { describe, expect, test } from "bun:test";
import JSZip from "jszip";
import {
  buildDataContext,
  generateDocument,
  knownPlaceholderNames,
  processDocumentXml,
  resolveClauses,
} from "../src/lib/notary/template";
import { listTemplateTokens } from "../src/lib/notary/templateValidator";
import { heshiisKiroConfig as config } from "../src/lib/notary/documents/heshiisKiro";
import { scanTemplateTokens, toTemplateSpec } from "../src/lib/notary/userTemplate";
import { scenarioA } from "../scripts/verify-helpers";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

const p = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

function render(xml: string, values: FormValues): string {
  const ctx = buildDataContext(config, values);
  return processDocumentXml(xml, ctx, resolveClauses(config, values));
}

async function miniDocx(paragraphs: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("word/document.xml", `<w:document><w:body>${paragraphs.join("")}</w:body></w:document>`);
  return await zip.generateAsync({ type: "arraybuffer" });
}

async function registryBytes(): Promise<ArrayBuffer> {
  return await Bun.file("public/templates/heshiis_kiro/guri_xaas.docx").arrayBuffer();
}

const att = (
  id: string,
  values: Record<string, string>,
  status: "jooga" | "wakiil",
  representativeId?: string,
): PartyRow => ({
  id,
  values: {
    magac: "",
    telefoon: "",
    aqoonsi: "",
    cinwaan: "",
    faahfaahin_dheeraad: "",
    ...values,
  },
  attendance: status === "wakiil" ? { status, representativeId } : { status },
});

/* ------------------------------------------------------------------ */
/* Scenario #21                                                        */
/* ------------------------------------------------------------------ */

const KIREYE_REP = {
  id: "krep-1",
  values: { magac: "Cali Joof", telefoon: "+252 61 7770001", aqoonsi: "", cinwaan: "" },
};
const KIRAYSTE_REP = {
  id: "trep-1",
  values: { magac: "Hodan Joof", telefoon: "+252 61 7770002", aqoonsi: "", cinwaan: "" },
};

/**
 * #21 — Kireeyayaal = 2 (K1 jooga, K2 maqan + wakiil)
 *       Kiraystayaal = 2 (T1 jooga, T2 maqan + wakiil)
 *       Deebaaji = Haa · Damiin = Maya · Kiro = Furan
 */
function scenario21(): FormValues {
  return {
    heshiiska: {
      reference: "DPN/K/021",
      taariikhda_heshiiska: "2026-09-29",
      sub_type: "guri_xaas",
      kireeye_mode: "multiple",
      kirayste_mode: "multiple",
      muddada_nooca: "furan",
      deebaaji_haa: "yes",
      damiin_haa: "no",
      taariikhda_bilowga: "2026-10-01",
      taariikhda_dhammaadka: "",
      shuruudaha_gaarka_ah: "",
    },
    kireeyayaal: [
      att("k1", { magac: "Kireeye Kowaad", telefoon: "+252 61 1110001", aqoonsi: "ID-1" }, "jooga"),
      att("k2", { magac: "Kireeye labaad" }, "wakiil", KIREYE_REP.id),
    ],
    kiraystayaal: [
      att("t1", { magac: "Kirayste Kowaad", telefoon: "+252 61 2220001", aqoonsi: "ID-2" }, "jooga"),
      att("t2", { magac: "Kirayste Labaad" }, "wakiil", KIRAYSTE_REP.id),
    ],
    "wakiilo_kireeyayaal": [KIREYE_REP],
    "wakiilo_kiraystayaal": [KIRAYSTE_REP],
    guriga: {
      nooca_guriga: "guri_xaas",
      goobta: "Hodan, Muqdisho",
      cinwaanka_guriga: "Wadada 21ka, Guri 44",
      sharraxaad: "Guri 3-qol ah.",
      qolada: "",
    },
    lacagta: {
      qiimaha_bil_ka: "500",
      habka_bixinta: "mobile",
      taariikhda_bixinta: "1aad ee bil kasta",
      bixinta_hore: "muqadin",
      faahfaahin_lacagta: "",
    },
    deebaaji: { lacagta_deebaajiga: "25", shuruudaha_deebaajiga: "" },
    damiinka: { damiin_magac: "", damiin_telefoon: "", damiin_aqoonsi: "", damiin_cinwaan: "" },
    ogaysiinta: {
      mudada_ogaysiinta: "30 maalmood",
      shuruudaha_joojinta: "Labada dhinac waxay is fiiqin karaan 30 maalmood ka hor.",
      faahfaahin_ogaysiinta: "",
    },
    maragyo: [
      { id: "w1", values: { magac: "Asha Omar", telefoon: "", aqoonsi: "", cinwaan: "" } },
    ],
    dheeraad: { shuruudo_dheeraad: "" },
  };
}

/* ------------------------------------------------------------------ */

describe("#21 — multiple parties + wakiil + conditional sections", () => {
  const xml = () =>
    render(
      [
        p("{{#KIREYEYAYAAL}}"),
        p("{{NUMBER}}. {{MAGAC}}"),
        p("{{IF:WAKIIL}}Wakiil: {{WAKIIL_MAGAC}} — {{WAKIIL_TELEFOON}}{{END:WAKIIL}}"),
        p("{{/KIREYEYAYAAL}}"),
        p("{{#KIRAYSTAYAAL}}{{NUMBER}}. {{MAGAC}}{{IF:WAKIIL}} | Wakiil: {{WAKIIL_MAGAC}}{{END:WAKIIL}}|{{/KIRAYSTAYAAL}}"),
        p("{{IF:DEEBAAJI_HAA}}QAYBTA DEEBAAJIGA{{END:DEEBAAJI_HAA}}"),
        p("{{IF:DAMIIN_HAA}}QAYBTA DAMIINKA{{END:DAMIIN_HAA}}"),
        p("{{IF:KIRO_XIDHAN}}Taariikhda Dhammaadka: {{TAARIIKH_DHAMMAAD}}{{END:KIRO_XIDHAN}}"),
      ].join(""),
      scenario21(),
    );

  test("2 kireeye are rendered — never {{KIREYE_1}} tokens", () => {
    const out = xml();
    expect(out).toContain("1. Kireeye Kowaad");
    expect(out).toContain("2. Kireeye labaad");
    expect(out).not.toContain("{{KIREYE_");
  });

  test("wakiil is shown for the absent Kireeye 2 only", () => {
    const out = xml();
    expect(out).toContain("Wakiil: Cali Joof — +252 61 7770001");
    // One wakiil line only (Kireeye 1 is jooga → nothing rendered).
    expect(out.split("Wakiil: Cali Joof").length - 1).toBe(1);
  });

  test("2 kirayste are rendered with the wakiil of Kirayste 2", () => {
    const out = xml();
    expect(out).toContain("1. Kirayste Kowaad");
    expect(out).toContain("2. Kirayste Labaad");
    expect(out).toContain("Wakiil: Hodan Joof");
  });

  test("deposit section included, guarantor section removed", () => {
    const out = xml();
    expect(out).toContain("QAYBTA DEEBAAJIGA");
    expect(out).not.toContain("QAYBTA DAMIINKA");
  });

  test("Kiro Furan never renders the End Date", () => {
    const out = xml();
    expect(out).not.toContain("Taariikhda Dhammaadka");
    expect(out).not.toContain("{{TAARIIKH_DHAMMAAD}}");
  });

  test("Kiro Xidhan DOES render the End Date (flag + alias)", () => {
    const values = scenario21();
    (values.heshiiska as Record<string, string>).muddada_nooca = "xidhan";
    (values.heshiiska as Record<string, string>).taariikhda_dhammaadka = "2027-09-30";
    const out = render(
      p("{{IF:KIRO_XIDHAN}}Taariikhda Dhammaadka: {{TAARIIKH_DHAMMAAD}}{{END:KIRO_XIDHAN}}"),
      values,
    );
    expect(out).toContain("Taariikhda Dhammaadka: 30/09/2027");
  });

  test("stale end-date value from the draft is blanked under Furan", () => {
    const values = scenario21();
    (values.heshiiska as Record<string, string>).taariikhda_dhammaadka = "2027-09-30";
    const out = render(p("End: {{TAARIIKH_DHAMMAAD}}|{{TAARIIKHDA_DHAMMAADKA}}"), values);
    expect(out).toContain("End: |");
    expect(out).not.toContain("2027");
  });
});

/* ------------------------------------------------------------------ */

describe("placeholder aliases (the office names its own template)", () => {
  test("every example token is KNOWN to the engine", () => {
    const known = knownPlaceholderNames(config);
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
      "WAKIIL_MAGAC",
      "WAKIIL_TELEFOON",
      "KIREEYE_WAKIIL_MAGAC",
      "KIRAYSTE_WAKIIL_MAGAC",
      "DEEBAAJI_HAA",
      "DAMIIN_HAA",
      "KIRO_XIDHAN",
      "#KIREYEYAYAAL",
      "/KIREYEYAYAAL",
      "#KIRAYSTAYAAL",
    ]) {
      expect(known.has(token)).toBe(true);
    }
  });

  test("aliases resolve to the same form-state values", () => {
    const out = render(
      p(
        "Ref: {{REF_NUMBER}} | Taariikh: {{TAARIIKH}} | Nooca: {{NOOCA_KIRADA}} | Guri: {{GURI_GOOBTA}} / {{GURI_NOOCA}} | Qiimaha: {{KIRADA_QIIMAHA}} | Bixinta: {{HABKA_BIXINTA}}",
      ),
      scenario21(),
    );
    expect(out).toContain("Ref: DPN/K/021");
    expect(out).toContain("Taariikh: 29/09/2026");
    expect(out).toContain("Nooca: Guri Xaas");
    expect(out).toContain("Guri: Hodan, Muqdisho / Guri Xaas");
    expect(out).toContain("Qiimaha: $500");
    expect(out).toContain("Bixinta: Mobile Money (EVC / Sahal)");
  });

  test("global {{WAKIIL_MAGAC}}/{{WAKIIL_TELEFOON}} resolve to the represented party", () => {
    const out = render(
      p("Kireeye: {{KIREYE_MAGAC}} · Wakiil: {{WAKIIL_MAGAC}} · {{WAKIIL_TELEFOON}}"),
      scenario21(),
    );
    expect(out).toContain("Kireeye: Kireeye Kowaad");
    expect(out).toContain("Wakiil: Cali Joof");
    expect(out).toContain("+252 61 7770001");
  });

  test("group-specific wakiil tokens stay separate (config-derived)", () => {
    const out = render(
      p("K: {{KIREEYE_WAKIIL_MAGAC}} | T: {{KIRAYSTE_WAKIIL_MAGAC}}"),
      scenario21(),
    );
    expect(out).toContain("K: Cali Joof | T: Hodan Joof");
  });

  test("no {{TOKEN}} ever survives — empty optional values are clean", () => {
    const out = render(
      p("Qolada: {{QOLADA}} | Shuruudo: {{SHURUUDO_DHEERAAD}} | WakiilK: {{KIREEYE_WAKIIL_MAGAC}}"),
      scenario21(),
    );
    expect(out).not.toMatch(/\{\{[A-Za-z0-9_#/]+(:[A-Za-z0-9_]+)?\}\}/);
  });
});

/* ------------------------------------------------------------------ */

describe("user-owned template end-to-end", () => {
  /** A .docx shaped like the office's OWN template (their naming). */
  async function userTemplateBytes(): Promise<ArrayBuffer> {
    return await miniDocx([
      p("HESHIIS KIRO — {{NOOCA_KIRADA}}"),
      p("Ref: {{REF_NUMBER}} · Taariikh: {{TAARIIKH}}"),
      p("GURIGA: {{GURI_NOOCA}}, {{GURI_GOOBTA}}"),
      p("{{#KIREYEYAYAAL}}"),
      p("Kireeye {{NUMBER}}: {{MAGAC}} / {{TELEFOON}}"),
      p("{{IF:WAKIIL}}Wakiil: {{WAKIIL_MAGAC}} — {{WAKIIL_TELEFOON}}{{END:WAKIIL}}"),
      p("{{/KIREYEYAYAAL}}"),
      p("{{#KIRAYSTAYAAL}}{{NUMBER}}. {{MAGAC}}{{/KIRAYSTAYAAL}}"),
      p("{{IF:DEEBAAJI_HAA}}DEEBAAJI: {{DEEBAAJI_AMOUNT}}{{END:DEEBAAJI_HAA}}"),
      p("{{IF:DAMIIN_HAA}}DAMIIN: {{DAMIIN_MAGAC}}{{END:DAMIIN_HAA}}"),
      p("{{IF:KIRO_XIDHAN}}End: {{TAARIIKH_DHAMMAAD}}{{END:KIRO_XIDHAN}}"),
      p("Kirada: {{KIRADA_QIIMAHA}} — {{HABKA_BIXINTA}}"),
    ]);
  }

  test("the user's template is filled from the final form state", async () => {
    const bytes = await userTemplateBytes();
    const record = {
      _id: "tpl1",
      _creationTime: 0,
      documentType: "heshiis_kiro",
      name: "Heshiis Kiro — Xaafada",
      fileName: "heshiis_kiro_template.docx",
      storageId: "stg1",
      sizeBytes: bytes.byteLength,
      isDefault: true as const,
      status: "active" as const,
      createdAt: 0,
      updatedAt: 0,
    };
    const out = await generateDocument({
      config,
      values: scenario21(),
      referenceNumber: "DPN-K-021",
      subTypeLabel: "Guri Xaas",
      templateBytes: bytes,
      spec: toTemplateSpec(record),
    });

    const zip = await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer()));
    const doc = await zip.file("word/document.xml")!.async("string");

    expect(doc).toContain("HESHIIS KIRO — Guri Xaas");
    expect(doc).toContain("Kireeye 1: Kireeye Kowaad");
    expect(doc).toContain("Kireeye 2: Kireeye labaad");
    expect(doc).toContain("Wakiil: Cali Joof");
    expect(doc).toContain("1. Kirayste Kowaad");
    expect(doc).toContain("DEEBAAJI: $25");
    expect(doc).not.toContain("DAMIIN:");
    expect(doc).not.toContain("End:");
    expect(out.templateValidation?.valid).toBe(true);
    expect(out.outputValidation?.valid).toBe(true);

    // Archive naming: Heshiis_Kiro_[REF].docx under output/Kiro/.
    expect(out.result.fileName).toBe("Heshiis_Kiro_Ref-DPN-K-021.docx");
    expect(out.result.outputDocxPath.startsWith("output/Kiro/")).toBe(true);
    expect(out.result.templateId).toBe("USER_tpl1");
  });

  test("no-overwrite: a repeated reference gets a unique file name", async () => {
    const bytes = await userTemplateBytes();
    const taken = new Set<string>();
    const first = await generateDocument({
      config,
      values: scenario21(),
      referenceNumber: "DPN-K-021",
      subTypeLabel: "Guri Xaas",
      templateBytes: bytes,
      spec: { ...toTemplateSpec({ _id: "tpl1", documentType: "heshiis_kiro", name: "t", fileName: "t.docx", storageId: "s", sizeBytes: 1, isDefault: true, status: "active", createdAt: 0, updatedAt: 0, _creationTime: 0 }), templateId: "USER_tpl1" },
      issuedFileNames: taken,
    });
    const second = await generateDocument({
      config,
      values: scenario21(),
      referenceNumber: "DPN-K-021",
      subTypeLabel: "Guri Xaas",
      templateBytes: bytes,
      spec: { ...toTemplateSpec({ _id: "tpl1", documentType: "heshiis_kiro", name: "t", fileName: "t.docx", storageId: "s", sizeBytes: 1, isDefault: true, status: "active", createdAt: 0, updatedAt: 0, _creationTime: 0 }), templateId: "USER_tpl1" },
      issuedFileNames: taken,
    });
    expect(first.result.fileName).toBe("Heshiis_Kiro_Ref-DPN-K-021.docx");
    expect(second.result.fileName).toBe("Heshiis_Kiro_Ref-DPN-K-021-2.docx");
  });

  test("unknown placeholder = WARNING only; generation still succeeds", async () => {
    const bytes = await miniDocx([
      p("Ref: {{REF_NUMBER}} · Maqan: {{SOMETHING_UNKNOWN}}"),
      p("{{#MARAGYO}}{{NUMBER}}. {{MAGAC}}{{/MARAGYO}}"),
    ]);
    const out = await generateDocument({
      config,
      values: scenario21(),
      referenceNumber: "DPN-K-022",
      subTypeLabel: "Guri Xaas",
      templateBytes: bytes,
      spec: {
        templateId: "USER_tpl2",
        documentType: "heshiis_kiro",
        subtype: "guri_xaas",
        name: "Unknown-token template",
        filePath: "storage:stg2",
        version: 1,
        status: "active",
        createdAt: 0,
        updatedAt: 0,
      },
    });
    expect(out.templateValidation?.valid).toBe(true);
    expect(
      out.templateValidation?.issues.some(
        (i) => i.level === "warning" && i.message.includes("SOMETHING_UNKNOWN"),
      ),
    ).toBe(true);
    const zip = await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer()));
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).not.toContain("{{SOMETHING_UNKNOWN}}");
    expect(doc).toContain("DPN-K-022");
  });

  test("formatting is preserved (template design untouched)", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `<w:document><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>HESHIIS: {{REF_NUMBER}}</w:t></w:r></w:p></w:body></w:document>`,
    );
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    const out = await generateDocument({
      config,
      values: scenario21(),
      referenceNumber: "DPN-K-023",
      subTypeLabel: "Guri Xaas",
      templateBytes: bytes,
    });
    const outZip = await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer()));
    const doc = await outZip.file("word/document.xml")!.async("string");
    expect(doc).toContain("<w:b/>");
    expect(doc).toContain('w:val="center"');
    expect(doc).toContain("HESHIIS: DPN-K-023");
  });
});

/* ------------------------------------------------------------------ */

describe("Template Manager placeholder recognition", () => {
  test("scan splits recognized vs unknown tokens", async () => {
    const bytes = await miniDocx([
      p("{{REF_NUMBER}} · {{GURI_GOOBTA}} · {{AAD_ALOOG_AQOON}}"),
      p("{{#KIREYEYAYAAL}}{{MAGAC}}{{/KIREYEYAYAAL}}"),
      p("{{IF:DEEBAAJI_HAA}}deebaaji{{END:DEEBAAJI_HAA}}"),
    ]);
    const report = await scanTemplateTokens(bytes, config);
    expect(report.recognized).toContain("REF_NUMBER");
    expect(report.recognized).toContain("GURI_GOOBTA");
    expect(report.unknown).toContain("AAD_ALOOG_AQOON");
    expect(report.syntaxErrors).toEqual([]);
  });

  test("unbalanced blocks are reported as syntax errors", async () => {
    const bytes = await miniDocx([
      p("{{#KIREYEYAYAAL}}"),
      p("{{MAGAC}}"),
      p("{{IF:DEEBAAJI_HAA}}"),
      p("deebaaji"),
    ]);
    const report = await scanTemplateTokens(bytes, config);
    expect(report.syntaxErrors.length).toBeGreaterThan(0);
  });

  test("listTemplateTokens dedupes across the document", async () => {
    const bytes = await miniDocx([p("{{REF_NUMBER}} {{REF_NUMBER}} {{TAARIIKH}}")]);
    const tokens = await listTemplateTokens(bytes);
    expect(tokens).toEqual(["REF_NUMBER", "TAARIIKH"]);
  });
});

/* ------------------------------------------------------------------ */

describe("registry template still works with #21 answers", () => {
  test("generates a clean DOCX with no leftover tokens", async () => {
    const out = await generateDocument({
      config,
      values: scenario21(),
      referenceNumber: "DPN/K/021",
      subTypeLabel: "Guri Xaas",
      templateBytes: await registryBytes(),
    });
    const zip = await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer()));
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain("Kireeye Kowaad");
    expect(doc).toContain("Kireeye labaad");
    expect(doc).toContain("Kirayste Kowaad");
    expect(doc).toContain("Kirayste Labaad");
    expect(doc).not.toMatch(/\{\{[A-Za-z0-9_#/]+(:[A-Za-z0-9_]+)?\}\}/);
    expect(out.outputValidation?.valid).toBe(true);
  });

  test("scenario A (all present) keeps guarantor + end date", async () => {
    const out = await generateDocument({
      config,
      values: scenarioA(),
      referenceNumber: "DPN/K/030",
      subTypeLabel: "Guri Xaas",
      templateBytes: await registryBytes(),
    });
    const zip = await JSZip.loadAsync(Buffer.from(await out.result.blob.arrayBuffer()));
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain("Maxamed Nuur"); // damiin
    expect(doc).toContain("30/09/2027"); // end date
  });
});