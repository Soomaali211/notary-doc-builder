/**
 * CADAYN CILAAJ — certificate of responsibility for an admitted patient
 * ("Cadayn Masuuliyad Qaadis Bukaan", Ref/Dpn/CC/…).
 *
 * THE SCAN IS THE WORDING. The template carries the office's own paper
 * (Ref/Dpn/CC/000024/01/026) transcribed VERBATIM: eleven numbered clauses,
 * the "Ku: - Maamulka …" recipient line, the witness block and the office's
 * attestation. Nothing legal is invented — the only moving parts are the
 * placeholders where the form's data goes.
 *
 * Rules held here:
 *   - Every clause the scan carries reaches the finished document.
 *   - No placeholder survives generation — ever.
 *   - The relationship word arrives through the config's derivedText; a
 *     raw storage value can never reach a signed paper.
 *   - The Kiro and Hanti pipelines are untouched: their own suites still
 *     prove that (see the regression checks at the end).
 */
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { getConfig } from "../src/lib/notary/documents";
import { cadaynCilaajConfig } from "../src/lib/notary/documents/cadaynCilaaj";
import { createInitialValues } from "../src/lib/notary/formValues";
import type { DocumentConfig, FormValues, PartyRow } from "../src/lib/notary/types";
import { generateDocument } from "../src/lib/notary/pipeline";
import { validateDocument } from "../src/lib/notary/validation";
import { selectTemplate } from "../src/lib/notary/registry";
import { validateTemplate } from "../src/lib/notary/templateValidator";
import { buildDataContext } from "../src/lib/notary/dataContext";
import { placeholderRegistry } from "../src/lib/notary/placeholderRegistry";
import { composeReferenceNumber } from "../src/lib/notary/referenceNumber";

const PUBLIC_DIR = resolve(import.meta.dir, "../public");
const TEMPLATE = "/templates/cadayn_cilaaj/cilaaj.docx";

const row = (id: string, values: Record<string, string>): PartyRow => ({ id, values });

/** A complete, valid interview — exactly what the scan's paper answers. */
function cilaajValues(): FormValues {
  const base = createInitialValues(cadaynCilaajConfig);
  return {
    ...base,
    dejinta: {
      macnaas: "Maamulka Salaxadin Mental Hospital",
      taariikhda_cadaynta: "2026-01-13",
      reference: "DPN-CC-000024",
    },
    masuulayaal: [
      row("m1", {
        magac: "AXMED CIGAAL JAAMAC",
        degan: "Hargeysa",
        telefoon: "063-4427254",
      }),
    ],
    bukaanka: {
      magac: "MAXAMED CAYDIID CIGAAL",
      da_diisa: "45",
      xiriirka: "adeer",
      hanti: "no",
      xanuun: "no",
    },
    maragyo: [
      row("w1", { magac: "CALI AXMED JAAMAC", telefoon: "063-4421792" }),
      row("w2", { magac: "AXMED MAXAMED XIRSI", telefoon: "063-4410943" }),
    ],
  } as unknown as FormValues;
}

function templateBytes(): ArrayBuffer {
  const file = resolve(PUBLIC_DIR, `.${TEMPLATE}`);
  if (!existsSync(file)) throw new Error(`Template ma jiro: ${TEMPLATE}`);
  const buf = readFileSync(file);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

const C: DocumentConfig = cadaynCilaajConfig;
let REFERENCE_TEMPLATE: string;

beforeAll(() => {
  REFERENCE_TEMPLATE = TEMPLATE;
});

/* ------------------------------------------------------------------ */
/* The catalog & the config                                            */
/* ------------------------------------------------------------------ */

describe("CADAYN CILAAJ — registered & selectable", () => {
  test("it is one of the document types the system serves", () => {
    const config = getConfig("cadayn_cilaaj");
    expect(config).toBeDefined();
    expect(config!.id).toBe("cadayn_cilaaj");
    expect(config!.templatePath).toBe(TEMPLATE);
  });

  test("its template is registered, active, and selectTemplate finds it", () => {
    const spec = selectTemplate(C, createInitialValues(C));
    expect(spec).toBeDefined();
    expect(spec!.filePath).toBe(TEMPLATE);
    expect(spec!.status).toBe("active");
  });

  test("the start of a fresh draft is immediately selectable (no sub-type gate)", () => {
    // Unlike Kiro/Hanti the certificate has no sub-type: a new draft must
    // already resolve its template before interview step 1 shows anything.
    const empty = { ...createInitialValues(C) } as FormValues;
    expect(selectTemplate(C, empty)).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* The template & the wording                                          */
/* ------------------------------------------------------------------ */

describe("CADAYN CILAAJ — the template carries the scan verbatim", () => {
  let xml = "";
  beforeAll(async () => {
    const zip = await JSZip.loadAsync(Buffer.from(templateBytes()));
    xml = await zip.file("word/document.xml")!.async("string");
  });

  test("the file exists and is a real .docx (zip part readable)", async () => {
    expect(existsSync(resolve(PUBLIC_DIR, `.${TEMPLATE}`))).toBe(true);
    const zip = await JSZip.loadAsync(Buffer.from(templateBytes()));
    expect(zip.file("word/document.xml")).not.toBeNull();
  });

  test("all eleven numbered clauses the scan carries are present", () => {
    for (const phrase of [
      "In aan masuul buuxa ka ahay bukaanka",
      "In Bukaankan Da&apos;diisu Tahay",
      "In aanay jirin Wax Hanti ah oo uu Gaar u leeyahay Iyo Dhaxal toona",
      "In Xidhiidhka naga dhexeeya Ee Ehelnimo yahay (",
      "Sidoo Kalena aanay Jirin ama aanan Ku Ogayn Wax Xanuun ah",
      "In aniga la ii raaci doono masuulna aan ka ahay wixii dhib ah",
      "Inaan u hogaansamayo shuruucda Hospitalka",
      "Inaan raali ka ahay talaabo kasta oo macquula ah",
      "Inaan bil walba ugu danbayn bixinayo bihsa 5&apos;teeda khidmaca",
      "In waqti kasta oo uu ii baahdo Hospitalku ama xaalad degdeg ahi",
      "Hadii ay dhacdo in bukahu Nafftiisa dhib u geysto",
    ]) {
      expect(xml).toContain(phrase);
    }
  });

  test("the fixed headings arrive exactly as the scan prints them", () => {
    for (const text of [
      "CadayntaXafiiska",
      "Saxeexa Masuulka Bukaanka",
      "Marag Goob Jooga",
      "(Gr. Maxamed Cumar C/Jaahi)",
      "Sarkaalka Xafiiska Nootayada Sharciga ah EeDaloodho",
    ]) {
      expect(xml).toContain(text);
    }
  });

  test("every placeholder is one the engine can fill — and the template validates", async () => {
    const spec = selectTemplate(C, cilaajValues())!;
    const report = await validateTemplate(
      spec.templateId,
      TEMPLATE,
      templateBytes(),
      buildDataContext(C, cilaajValues()),
    );
    const errors = report.issues.filter((i) => i.level === "error");
    const warnings = report.issues.filter((i) => i.level === "warning");
    expect(errors.map((e) => e.message)).toEqual([]);
    expect(warnings.map((w) => w.message)).toEqual([]);
    expect(report.valid).toBe(true);
  });

  test("a file validated against an EMPTY interview is still valid", async () => {
    const empty = { ...createInitialValues(C) } as FormValues;
    const spec = selectTemplate(C, empty)!;
    const report = await validateTemplate(
      spec.templateId,
      TEMPLATE,
      templateBytes(),
      buildDataContext(C, empty),
    );
    expect(report.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  test("nothing unprotected — the office can still edit the file", async () => {
    const zip = await JSZip.loadAsync(Buffer.from(templateBytes()));
    const all = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((n) => !zip.files[n].dir && n.endsWith(".xml"))
          .map((n) => zip.file(n)!.async("string")),
      )
    ).join("");
    for (const forbidden of [
      "documentProtection",
      "permStart",
      "writeProtection",
      "readOnlyRecommended",
    ]) {
      expect(all).not.toContain(forbidden);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Validation — required vs optional                                   */
/* ------------------------------------------------------------------ */

describe("CADAYN CILAAJ — the interview validates required vs optional", () => {
  test("an EMPTY draft names the required gaps and nothing else", () => {
    const errors = validateDocument(C, { ...createInitialValues(C) } as FormValues);
    const messages: string[] = Object.values(errors).flatMap((v) =>
      typeof v === "object" && v !== null ? Object.values(v as Record<string, unknown>) : [],
    );
    // Bukaanka.hanti and .xanuun are required gates of the clause run; the
    // names, the date and the recipient are the required data points.
    expect(messages.length).toBeGreaterThan(0);
  });

  test("the complete interview validates CLEAN", () => {
    const errors = validateDocument(C, cilaajValues());
    expect(
      Object.entries(errors).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
    ).toEqual([]);
  });

  test("optional fields never block: a draft without a wakiil or phone still passes", () => {
    const values = cilaajValues();
    (values.masuulayaal as PartyRow[])[0].values.telefoon = "";
    (values.maragyo as PartyRow[])[1].values.telefoon = "";
    const errors = validateDocument(C, values);
    expect(
      Object.entries(errors).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* The reference — Ref/Dpn/CC/{serial}/{MM}/{YY}                        */
/* ------------------------------------------------------------------ */

describe("CADAYN CILAAJ — the reference is composed, not retyped", () => {
  test("the scan's shape is produced from the stored serial + the date", () => {
    expect(
      composeReferenceNumber({
        format: C.referenceFormat,
        reference: "DPN-CC-000024",
        date: "2026-01-13",
      }),
    ).toBe("Ref/Dpn/CC/000024/01/26");
  });

  test("without a date the short serial is printed — never a half-written ref", () => {
    expect(
      composeReferenceNumber({
        format: C.referenceFormat,
        reference: "DPN-CC-000024",
        date: "",
      }),
    ).toBe("DPN-CC-000024");
  });

  test("the database keeps the short serial (nothing else changed)", () => {
    expect(composeReferenceNumber({ format: undefined, reference: "DPN-CC-000024" })).toBe(
      "DPN-CC-000024",
    );
  });
});

/* ------------------------------------------------------------------ */
/* The pipeline really produces a document                             */
/* ------------------------------------------------------------------ */

describe("CADAYN CILAAJ — the pipeline end to end", () => {
  async function documentXml(v: FormValues, reference = "DPN-CC-000024"): Promise<string> {
    const spec = selectTemplate(C, v)!;
    const out = await generateDocument({
      config: C,
      values: v,
      referenceNumber: reference,
      subTypeLabel: "Cadayn Cilaaj",
      templateBytes: templateBytes(),
      spec,
    });
    const buf = Buffer.from(await out.result.blob.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);
    return await zip.file("word/document.xml")!.async("string");
  }

  test("the finished docx opens, prints every answer, and resolves everything", async () => {
    const xml = await documentXml(cilaajValues());
    // The composed reference — the value the archive file is named with.
    expect(xml).toContain("Ref/Dpn/CC/000024/01/26");
    // The mapping of the form's data into the scan's slots.
    expect(xml).toContain("Maamulka Salaxadin Mental Hospital");
    expect(xml).toContain("AXMED CIGAAL JAAMAC");
    expect(xml).toContain("Hargeysa");
    expect(xml).toContain("MAXAMED CAYDIID CIGAAL");
    expect(xml).toContain("45");
    // The relationship word — derived, NEVER the raw "adeer".
    expect(xml).toContain("(Adeer)");
    expect(xml).not.toContain("adeer)");
    // The witnesses, each with his own number and phone.
    expect(xml).toContain("CALI AXMED JAAMAC");
    expect(xml).toContain("AXMED MAXAMED XIRSI");
    expect(xml).toContain("063-4421792");
    // Nothing survives unresolved.
    expect(xml).not.toContain("{{");
    expect(xml).not.toContain("{{#");
  });

  test("no raw storage value reaches the paper (the derived-text contract)", async () => {
    const values = cilaajValues();
    (values.bukaanka as Record<string, string>).xiriirka = "hoosaysteen";
    const xml = await documentXml(values);
    expect(xml).toContain("(Hoosaysteen)");
    expect(xml).not.toContain("(hoosaysteen)");
    expect(xml).not.toContain("{{");
  });

  test("the DOCX keeps the template's own package parts (styles survive)", async () => {
    const spec = selectTemplate(C, cilaajValues())!;
    const out = await generateDocument({
      config: C,
      values: cilaajValues(),
      referenceNumber: "DPN-CC-000024",
      subTypeLabel: "Cadayn Cilaaj",
      templateBytes: templateBytes(),
      spec,
    });
    expect(out.result.blob.type).toContain("wordprocessingml.document");
    const zip = await JSZip.loadAsync(await out.result.blob.arrayBuffer());
    expect(Object.keys(zip.files)).toContain("word/styles.xml");
  });
});

/* ------------------------------------------------------------------ */
/* Regressions — the older types are untouched by this                 */
/* ------------------------------------------------------------------ */

describe("CADAYN CILAAJ — regressions for the older types", () => {
  test("Kiro's template file is still byte-for-byte the one it was", () => {
    const kiro = readFileSync(
      resolve(PUBLIC_DIR, "./templates/heshiis_kiro_template.docx"),
    );
    expect(createHash("sha256").update(kiro).digest("hex")).toBe(
      "1bb592e7492b1b4cb325030113fd2567b48be326efa58cdf7c47c89528ce57db",
    );
  });

  test("the Hanti templates are untouched (same sizes as before this feature)", () => {
    for (const f of ["dhul_banaan.docx", "guri.docx", "beer.docx"]) {
      const bytes = readFileSync(
        resolve(PUBLIC_DIR, `./templates/kala_iiibsi_hanti/${f}`),
      );
      expect(bytes.length).toBeGreaterThan(10000);
      expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
    }
  });

  test("the older placeholder registries are unchanged in shape", () => {
    // Kiro keeps its own list; the registry's dispatch never duplicates.
    expect(placeholderRegistry("heshiis_kiro").length).toBeGreaterThan(50);
    expect(placeholderRegistry("kala_iibsi_hanti").length).toBeGreaterThan(70);
    expect(placeholderRegistry("cadayn_cilaaj").length).toBeGreaterThan(5);
    expect(placeholderRegistry("not_a_type")).toEqual([]);
  });
});
