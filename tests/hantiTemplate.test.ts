/**
 * KALA IIBSI HANTI — THE WORD TEMPLATES.
 *
 * The registry promises three files:
 *
 *   /templates/kala_iiibsi_hanti/dhul_banaan.docx
 *   /templates/kala_iiibsi_hanti/guri.docx
 *   /templates/kala_iiibsi_hanti/beer.docx
 *
 * A registered template that is not on disk is a broken promise: the notary
 * fills the interview, presses Generate, and gets an error instead of a
 * document. So these tests read the REAL files the app would fetch, run the
 * REAL validator over them, and drive the REAL pipeline to a .docx — not a
 * mock of any of it.
 *
 * Two rules shape what these files may contain:
 *
 *   1. Every {{…}} token must be one the engine resolves. An orphan token is
 *      stripped from the finished document, so the notary's page would lose a
 *      fact silently.
 *   2. No legal clause text is invented. Hanti Kale has no scan, so the
 *      templates state FACTS and leave the office's wording to the notary.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { buildDataContext } from "../src/lib/notary/dataContext";
import { generateDocument } from "../src/lib/notary/pipeline";
import { selectTemplate } from "../src/lib/notary/registry";
import { validateTemplate } from "../src/lib/notary/templateValidator";
import { validateDocument } from "../src/lib/notary/validation";
import { kalaIiibsiHantiConfig as C } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { createInitialValues } from "../src/lib/notary/formValues";
import type { FormValues } from "../src/lib/notary/types";

const PUBLIC_DIR = resolve(import.meta.dir, "../public");

/* ------------------------------------------------------------------ */
/* A filled-in answer set                                              */
/* ------------------------------------------------------------------ */

const row = (id: string, values: Record<string, string>): any => ({ id, values });

function values(subType: string, over: Record<string, unknown> = {}): FormValues {
  const base = createInitialValues(C);
  // `over.dejinta` is MERGED into the setup answers, not spread over them:
  // replacing the whole object would drop the sub-type, and the registry
  // would then select no template at all.
  const { dejinta: overDejinta, ...rest } = over;
  return {
    ...base,
    dejinta: {
      ...(base.dejinta as Record<string, string>),
      sub_type: subType,
      reference: "DPN-MG-001",
      taariikhda_hantida: "2026-01-30",
      // Every gate OPEN, so the whole interview — and the whole template —
      // is visible at once.
      sawirro_ma_jiraan: "yes",
      saxeexo_ma_jiraan: "yes",
      shaxado_ma_jiraan: "yes",
      iibiye_mode: "multiple",
      tirada_iibiyayaasha: "2",
      iibsade_mode: "single",
      tirada_iibsadayaasha: "1",
      nooca_damiinta: "qof_3aad",
      ...(overDejinta as Record<string, string> | undefined),
    },
    hantida_dhul_banaan: {
      degmada: "Waardhiil",
      xaafada: "Sooma",
      cabbirka: "5,000 m2",
      jiho_waqooyi: "waddo",
      jiho_koonfur: "dhisme",
      jiho_bari: "waddo",
      jiho_galbeed: "dhisme",
      soohdimaha: "Soohdimo Degmada Waardhiil",
      sida_hantida_loo_helay: "iibsaday",
      tixraaca_ma_jiraan: "yes",
      nooca_tixraaca: "tr_no",
      lambarka_tixraaca: "Tr No 4471",
    },
    hantida_guri: {
      nooca_guriga: "Guri Xaas",
      goobta: "Hargeisa",
      degmada_xaafadda: "Degmada Hargeisa",
      cabbirka: "150 m2",
      xuduudaha: "Koronto, biyo, dariik",
      lambarka_lahaansho: "LAH-12",
      faahfaahin_dheeraad: "Guri laba qol.",
    },
    hantida_beer: {
      magaca_beerta: "Beer Daara-Salaam",
      nooca_beeraha: "Beer Dhab ah",
      goobta: "Hargeisa",
      degmada_xaafadda: "Degmada Hargeisa",
      cabbirka: "80 m2",
      jiho_1: "Xarunta Wacatariga",
      jiho_2: "Jidka Mogadishu",
      xuduudaha: "Bandhig, kalkaaliye",
      lambarka_lahaansho: "LAH-13",
      faahfaahin_dheeraad: "Beer wuxuu leeyahay 6 qodob.",
      ceel: "yes",
      shayada_ceelka: "Ceel 3m, Xaafadda Degmada Hargeisa",
    },
    kooxaha: [row("g", { magac: "Ilma Xassan Qaalib" })],
    // Two sellers: one present, one absent and represented. That is the shape
    // the wakiil block exists for, so the fixtures always contain it.
    iibiyeyaal: [
      {
        ...row("s1", {
          magac: "AHMED CALI",
          jinsi: "male",
          degan: "Hargeisa",
          dooro: "iibiye",
          koox: "Ilma Xassan Qaalib",
          telefoon: "0622000001",
        }),
        attendance: { status: "jooga" },
      },
      {
        ...row("s2", {
          magac: "MARYAN XASSAN",
          jinsi: "female",
          degan: "Hargeisa",
          koox: "Ilma Xassan Qaalib",
          telefoon: "0622000002",
        }),
        attendance: { status: "wakiil", representativeId: "r1" },
      },
    ],
    wakiilo_iibiyeyaal: [
      row("r1", { magac: "FARAX AHMED", nooca_wakiilka: "wakiil_qayim" }),
    ],
    wakiilo_iibsadayaal: [],
    iibsadayaal: [
      {
        ...row("b1", {
          magac: "SOMALI JAMAC",
          jinsi: "male",
          degan: "Hargeisa",
          telefoon: "0622000009",
        }),
        attendance: { status: "jooga" },
      },
    ],
    sawirrada: [row("p1", { shakhsiga: "s1", caption: "Ahmed Cali", sawir: "stor_p1" })],
    saxeexayaasha: [row("x1", { shakhsiga: "s1", prefix: "IIBIYE" })],
    shaxadaha: [
      row("c1", {
        tixraaca: "MDH/C/842/2025",
        nooca_shaxadaha: "beerta",
        haysa: "Ilma Xassan Qaalib",
      }),
    ],
    maragyo: [
      row("m1", { magac: "MARAG KOOW", telefoon: "0633333333" }),
      row("m2", { magac: "MARAG LABO", telefoon: "0633333334" }),
    ],
    damiinka: {
      nooca_damiinta: "qof_3aad",
      magaca_damiinka: "KHALID NOOR",
      telefoonka_damiinka: "0635555555",
      gurmadka_dammaanadda: "Reer deggan.",
      sawirka_damiinka: "",
    },
    qiimaha: {
      qiimaha_guud: "1600",
      lacagta_bixiyay: "600",
      qiimaha_qoraal: "Lacagta miqra ah: Kun iyo Saddexaar dollar",
    },
    ...rest,
  } as unknown as FormValues;
}

const SUBTYPES = ["dhul_banaan", "guri", "beer"] as const;

/** The registered file for one sub-type, read from public/ exactly as the
 *  browser would fetch it. */
function templateBytes(subType: string): ArrayBuffer {
  const spec = selectTemplate(C, values(subType))!;
  const file = resolve(PUBLIC_DIR, `.${spec.filePath}`);
  if (!existsSync(file)) throw new Error(`Template ma jiro: ${spec.filePath}`);
  const buf = readFileSync(file);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function documentXml(v: FormValues): Promise<string> {
  const spec = selectTemplate(C, v)!;
  const out = await generateDocument({
    config: C,
    values: v,
    referenceNumber: "DPN-MG-001",
    subTypeLabel: String((v.dejinta as Record<string, string>).sub_type),
    templateBytes: templateBytes(spec.subtype!),
    spec,
  });
  const buf = Buffer.from(await out.result.blob.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  return await zip.file("word/document.xml")!.async("string");
}

/* ------------------------------------------------------------------ */

describe("HANTI TEMPLATES — every registered path exists and is a real .docx", () => {
  test("the registry's three promises are kept on disk", () => {
    for (const subType of SUBTYPES) {
      const spec = selectTemplate(C, values(subType))!;
      expect(spec.filePath).toBe(`/templates/kala_iiibsi_hanti/${subType}.docx`);
      expect(existsSync(resolve(PUBLIC_DIR, `.${spec.filePath}`))).toBe(true);
    }
  });

  test("each file opens as a Word package with a document part", async () => {
    for (const subType of SUBTYPES) {
      const zip = await JSZip.loadAsync(Buffer.from(templateBytes(subType)));
      const parts = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
      expect(parts).toContain("word/document.xml");
      expect(parts).toContain("[Content_Types].xml");
      const xml = await zip.file("word/document.xml")!.async("string");
      expect(xml).toContain("{{");
    }
  });

  test("the office can still edit them — no protection of any kind", async () => {
    for (const subType of SUBTYPES) {
      const zip = await JSZip.loadAsync(Buffer.from(templateBytes(subType)));
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
    }
  });

  test("the Hanti Kale template is NOT here — it has no scan and no wording", () => {
    // Deliberate, not an oversight: the fourth sub-type is registered in the
    // interview but has no template, so generation refuses it rather than
    // printing a document nobody approved.
    expect(existsSync(resolve(PUBLIC_DIR, "./templates/kala_iiibsi_hanti/kale.docx"))).toBe(false);
    expect(selectTemplate(C, values("hanti_kale"))).toBeUndefined();
  });
});

describe("HANTI TEMPLATES — every placeholder is one the engine can fill", () => {
  test("each file validates with NO unknown placeholder", async () => {
    for (const subType of SUBTYPES) {
      const ctx = buildDataContext(C, values(subType));
      const report = await validateTemplate(
        `HANTI_${subType.toUpperCase()}_V1`,
        `/templates/kala_iiibsi_hanti/${subType}.docx`,
        templateBytes(subType),
        ctx,
      );
      const errors = report.issues.filter((i) => i.level === "error");
      const warnings = report.issues.filter((i) => i.level === "warning");
      expect(errors.map((e) => e.message)).toEqual([]);
      expect(warnings.map((w) => w.message)).toEqual([]);
      expect(report.valid).toBe(true);
    }
  });

  test("a file validated against an EMPTY interview is still valid", async () => {
    // The empty case is the one a user meets first: a half-filled draft must
    // not be rejected, it just prints fewer facts.
    for (const subType of SUBTYPES) {
      const empty = { ...createInitialValues(C) } as FormValues;
      (empty.dejinta as Record<string, string>).sub_type = subType;
      const report = await validateTemplate(
        `HANTI_${subType.toUpperCase()}_V1`,
        `/templates/kala_iiibsi_hanti/${subType}.docx`,
        templateBytes(subType),
        buildDataContext(C, empty),
      );
      expect(report.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });
});

describe("HANTI TEMPLATES — each sub-type carries its OWN questions only", () => {
  const tokensOf = async (subType: string): Promise<string> => {
    const zip = await JSZip.loadAsync(Buffer.from(templateBytes(subType)));
    return await zip.file("word/document.xml")!.async("string");
  };

  test("Dhul Banaan asks the plot's compass sides and how it was got", async () => {
    const xml = await tokensOf("dhul_banaan");
    for (const token of [
      "{{JIHO_WAQOOYI}}",
      "{{JIHO_KOONFUR}}",
      "{{JIHO_BARI}}",
      "{{JIHO_GALBEED}}",
      "{{SOOHDIMADA}}",
      "{{SIDA_HANTIDA}}",
      "{{LAMBARKA_TIXRAACA}}",
      "{{CALAAMAD_DHEERAAD}}",
    ]) {
      expect(xml).toContain(token);
    }
    // Never another sub-type's questions — a Dhul Banaan document that
    // asked for the Beer's name would print an em dash where a name belongs.
    expect(xml).not.toContain("{{BEER_MAGAC}}");
    expect(xml).not.toContain("{{GURI_NOOCA}}");
  });

  test("Guri asks the house's own details", async () => {
    const xml = await tokensOf("guri");
    for (const token of ["{{GURI_NOOCA}}", "{{GURI_GOOBTA}}", "{{GURI_CABBIRKA}}"]) {
      expect(xml).toContain(token);
    }
    expect(xml).not.toContain("{{BEER_MAGAC}}");
    expect(xml).not.toContain("{{JIHO_WAQOOYI}}");
  });

  test("Beer asks the beer's own details", async () => {
    const xml = await tokensOf("beer");
    for (const token of [
      "{{BEER_MAGAC}}",
      "{{BEER_NOOCA}}",
      "{{BEER_JIHO_1}}",
      "{{BEER_SHAYADA_CEELKA}}",
    ]) {
      expect(xml).toContain(token);
    }
    expect(xml).not.toContain("{{GURI_NOOCA}}");
    expect(xml).not.toContain("{{JIHO_WAQOOYI}}");
  });

  test("all three carry the parties, the wakiil and the signatures", async () => {
    for (const subType of SUBTYPES) {
      const xml = await tokensOf(subType);
      for (const token of [
        "{{#IIBIYEYAAL}}",
        "{{/IIBIYEYAAL}}",
        "{{#IIBSADAYAAL}}",
        "{{/IIBSADAYAAL}}",
        "{{#WAKIILO_IIBIYEYAAL}}",
        "{{/WAKIILO_IIBIYEYAAL}}",
        "{{#WAKIILO_IIBSADAYAAL}}",
        "{{/WAKIILO_IIBSADAYAAL}}",
        "{{#MARAGYO}}",
        "{{/MARAGYO}}",
        "{{IIBIYAHA_MAGAC}}",
        "{{IIBSADAHA_MAGAC}}",
      ]) {
        expect(xml).toContain(token);
      }
    }
  });
});

describe("HANTI TEMPLATES — the pipeline really produces a document", () => {
  test("the fixture below is itself a COMPLETE interview — the pipeline refuses anything else", () => {
    // Generation validates first, so a fixture with a gap proves nothing
    // about the template. This test says out loud that these answers are
    // the ones a finished interview produces.
    for (const subType of SUBTYPES) {
      const errors = validateDocument(C, values(subType));
      expect(
        Object.entries(errors).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
      ).toEqual([]);
    }
  });
  test("Dhul Banaan end to end: the notary's own numbers are on the page", async () => {
    const xml = await documentXml(values("dhul_banaan"));
    // Facts that only exist because they were answered.
    expect(xml).toContain("AHMED CALI");
    expect(xml).toContain("MARYAN XASSAN");
    expect(xml).toContain("SOMALI JAMAC");
    expect(xml).toContain("FARAX AHMED"); // the wakiil, by name
    expect(xml).toContain("MARAG KOOW");
    expect(xml).toContain("MDH/C/842/2025");
    expect(xml).toContain("KHALID NOOR");
    // The price and what is still owed — one derived, never contradicted.
    expect(xml).toContain("$1,600");
    expect(xml).toContain("$600");
    expect(xml).toContain("$1,000");
    // The reference the DOCUMENT prints is the one the archive file is
    // named with — composed from the same serial the database holds.
    expect(xml).toContain("Ref/Dpn/MG/001/01/26");
    // Nothing unresolved — the office rule.
    expect(xml).not.toContain("{{");
  });

  test("Guri end to end: the house's facts print, the plot's do not", async () => {
    const xml = await documentXml(values("guri"));
    expect(xml).toContain("Guri Xaas");
    expect(xml).toContain("Degmada Hargeisa");
    expect(xml).toContain("AHMED CALI");
    expect(xml).not.toContain("{{");
  });

  test("Beer end to end: the beer's facts print, the plot's do not", async () => {
    const xml = await documentXml(values("beer"));
    expect(xml).toContain("Beer Daara-Salaam");
    expect(xml).toContain("Beer Dhab ah");
    expect(xml).toContain("Ceel 3m");
    expect(xml).toContain("AHMED CALI");
    expect(xml).not.toContain("{{");
  });

  test("a wakiil signs only when somebody was actually represented", async () => {
    const withRep = await documentXml(values("dhul_banaan"));
    expect(withRep).toContain("Saxiixa Wakiilka Iibiyaha");
    // Take the representation away and the signing line goes with it. The
    // wakiil row goes too: a representative nobody points at is a gap the
    // interview rightly refuses to generate from.
    const without = values("dhul_banaan");
    (without.iibiyeyaal as any[])[1].attendance = { status: "jooga" };
    (without as any).wakiilo_iibiyeyaal = [];
    const xml = await documentXml(without);
    expect(xml).not.toContain("Saxiixa Wakiilka Iibiyaha");
    expect(xml).not.toContain("{{");
  });

  test("a sale with no photographs, signatures or certificates prints no empty headings", async () => {
    const bare = values("dhul_banaan", {
      dejinta: {
        sawirro_ma_jiraan: "no",
        saxeexo_ma_jiraan: "no",
        shaxado_ma_jiraan: "no",
      },
      sawirrada: [],
      saxeexayaasha: [],
      shaxadaha: [],
    });
    const xml = await documentXml(bare);
    // The four gates were answered "no", so those sections must be GONE —
    // not present with an empty line under them.
    expect(xml).not.toContain("SAWIRKA");
    expect(xml).not.toContain("SAXEEXAYAASHA");
    expect(xml).not.toContain("SHAXADAYAHA IYO WARQADAH");
    // What was answered is still there.
    expect(xml).toContain("AHMED CALI");
    expect(xml).toContain("MARAG KOOW");
    expect(xml).not.toContain("{{");
  });

  test("the sellers guarantee themselves — no third-party guarantor invented", async () => {
    const selfGuaranteed = values("dhul_banaan", {
      dejinta: { nooca_damiinta: "iibiyaha" },
      damiinka: {
        nooca_damiinta: "iibiyaha",
        magaca_damiinka: "",
        telefoonka_damiinka: "",
        gurmadka_dammaanadda: "",
        sawirka_damiinka: "",
      },
    });
    const xml = await documentXml(selfGuaranteed);
    expect(xml).toContain("DAMMAANADDA");
    expect(xml).not.toContain("KHALID NOOR");
    expect(xml).not.toContain("{{");
  });
});

describe("KIRO — untouched by any of this", () => {
  test("the Kiro template file is byte-for-byte the one it was", () => {
    const kiro = readFileSync(resolve(PUBLIC_DIR, "./templates/heshiis_kiro_template.docx"));
    expect(createHash("sha256").update(kiro).digest("hex")).toBe(
      "1bb592e7492b1b4cb325030113fd2567b48be326efa58cdf7c47c89528ce57db",
    );
  });
});