/**
 * Writes the three Kala Iibsi Hanti Word templates the registry asks for:
 *
 *   public/templates/kala_iiibsi_hanti/dhul_banaan.docx
 *   public/templates/kala_iiibsi_hanti/guri.docx
 *   public/templates/kala_iiibsi_hanti/beer.docx
 *
 * IMPORTANT — the app never designs Word documents. These are PLACEHOLDER
 * templates: the notary office replaces each file with its own designed
 * template as long as the same {{TOKENS}} are kept:
 *
 *   {{PLACEHOLDER}}            plain replacement
 *   {{IF:FLAG}}…{{ENDIF}}      conditional section (false → removed whole)
 *   {{#BLOCK}}…{{/BLOCK}}      repeated block (once per row of that list)
 *
 * The shape deliberately mirrors the office's own Heshiis Kiro template
 * (centred title, numbered Heading 1 sections, label|value tables, one
 * wakiil block per attendance side, a signature table at the end) so a Hanti
 * document reads like a Kiro one.
 *
 * NOTHING HERE IS INVENTED LEGAL WORDING. Kala Iibsi Hanti Kale has no scan,
 * so this template states FACTS — names, counts, amounts, who stands for
 * whom, who signs — and leaves the office's clause text to the notary. Every
 * {{…}} token used below is one the engine actually resolves; the guard at
 * the end of this script proves it by running the real validator.
 *
 * NEVER overwrites silently: if a file exists the script stops (the user may
 * have edited it in Word). Pass --force to regenerate.
 *
 * Run: bun scripts/generate-hanti-templates.ts [--force]
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { validateTemplate } from "../src/lib/notary/templateValidator";
import { buildDataContext } from "../src/lib/notary/dataContext";
import { kalaIiibsiHantiConfig } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { createInitialValues } from "../src/lib/notary/formValues";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/templates/kala_iiibsi_hanti");
const force = process.argv.includes("--force");

/* ------------------------------------------------------------------ */
/* Paragraph + table helpers — the office's own two-column shape      */
/* ------------------------------------------------------------------ */

const p = (text: string, opts?: { bold?: boolean; heading?: boolean }) =>
  new Paragraph({
    heading: opts?.heading ? HeadingLevel.HEADING_1 : undefined,
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: opts?.bold ?? opts?.heading })],
  });

const centred = (text: string, opts?: { bold?: boolean; size?: number }) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({ text, bold: opts?.bold, size: opts?.size ? opts.size * 2 : undefined }),
    ],
  });

const BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "auto",
} as const;

const borders = {
  top: BORDER,
  bottom: BORDER,
  left: BORDER,
  right: BORDER,
  insideHorizontal: BORDER,
  insideVertical: BORDER,
};

/** A bordered label | value table — the same shape Kiro's template uses. */
const kvTable = (rows: [string, string][]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              children: [p(label, { bold: true })],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [p(value)],
            }),
          ],
        }),
    ),
  });

/** A signature table: two signing columns, each with its own lines. */
const signatureTable = (rows: [string, string][]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: rows.map(
      ([left, right]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [p(left)],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [p(right)],
            }),
          ],
        }),
    ),
  });

/* ------------------------------------------------------------------ */
/* The document, shared by every sub-type                              */
/* ------------------------------------------------------------------ */

/** The property questions, which are the ONLY thing that differs per
 *  sub-type: Dhul Banaan asks four compass sides and how the seller got
 *  the plot, Guri asks the house's own details, Beer asks the beer's. */
const PROPERTY_ROWS: Record<string, [string, string][]> = {
  dhul_banaan: [
    ["Degmada", "{{DEGMADA}}"],
    ["Xaafadda / Deegaanka", "{{XAAFADA}}"],
    ["Cabbirka", "{{CABBIRKA}}"],
    ["Jiho Waqooyi", "{{JIHO_WAQOOYI}}"],
    ["Jiho Koonfur", "{{JIHO_KOONFUR}}"],
    ["Jiho Bari", "{{JIHO_BARI}}"],
    ["Jiho Galbeed", "{{JIHO_GALBEED}}"],
    ["Soohdimaha (Xadka)", "{{SOOHDIMADA}}"],
  ],
  guri: [
    ["Nooca Guriga", "{{GURI_NOOCA}}"],
    ["Goobta Guriga", "{{GURI_GOOBTA}}"],
    ["Degmada / Xaafadda", "{{GURI_DEGMADA_XAAFADDA}}"],
    ["Cabbirka Guriga", "{{GURI_CABBIRKA}}"],
    ["Xuduudaha Guriga", "{{GURI_XUDUUDAAHA}}"],
    ["Lambar / Aqoonsi Lahaansho", "{{GURI_LAMBARKA_LAHAANSHO}}"],
    ["Faahfaahin Dheeraad ah", "{{GURI_FAAHFAAHIN}}"],
  ],
  beer: [
    ["Magaca Beeraha", "{{BEER_MAGAC}}"],
    ["Nooca Beeraha", "{{BEER_NOOCA}}"],
    ["Goobta Beeraha", "{{BEER_GOOBTA}}"],
    ["Degmada / Xaafadda", "{{BEER_DEGMADA_XAAFADDA}}"],
    ["Cabbirka Beeraha", "{{BEER_CABBIRKA}}"],
    ["Jiho / Xad 1", "{{BEER_JIHO_1}}"],
    ["Jiho / Xad 2", "{{BEER_JIHO_2}}"],
    ["Xuduudaha Beeraha", "{{BEER_XUDUUDAAHA}}"],
    ["Shayada Ceelka", "{{BEER_SHAYADA_CEELKA}}"],
    ["Lambar / Aqoonsi Lahaansho", "{{BEER_LAMBARKA_LAHAANSHO}}"],
    ["Faahfaahin Dheeraad ah", "{{BEER_FAAHFAAHIN}}"],
  ],
};

const SUBTYPE_LABEL: Record<string, string> = {
  dhul_banaan: "Dhul Banaan",
  guri: "Guri",
  beer: "Beer",
};

function buildChildren(subType: string) {
  const isKale = subType === "dhul_banaan";
  const body: (Paragraph | Table)[] = [];

  /* ---- masthead ------------------------------------------------ */
  body.push(centred("KALA IIBSI HANTI", { bold: true, size: 18 }));
  body.push(
    centred(
      "{{NOOCA_KALAA_IIBSI}} — {{REF_NUMBER}} — {{TAARIIKH}}",
    ),
  );

  /* ---- 1. the document's own facts ----------------------------- */
  body.push(p("1. XOGTA HESHIISKA", { heading: true }));
  body.push(
    kvTable([
      ["Nambarka Tixraaca", "{{REF_NUMBER}}"],
      ["Taariikhda Heshiiska", "{{TAARIIKH}}"],
      ["Nooca Hantida", "{{NOOCA_HANTIDA}}"],
      // How the seller got the plot is asked ONLY on Dhul Banaan, so only
      // that template carries it — a Guri or Beer document must not print
      // an answer that was never collected.
      ...(isKale ? ([["Sida Hantida Loo Helay", "{{SIDA_HANTIDA}}"]] as [string, string][]) : []),
    ]),
  );
  if (isKale) {
    // The office reference is a BRANCH, not a field: the notary answered
    // "does this plot have File No. / TR No. / Notary Reference?" once, so
    // the document prints one side of that answer or the other — never both
    // and never neither.
    body.push(p("{{IF:HANTI_TIXRAACA}}"));
    body.push(p("Lambarka / Tixraaca Hantida: {{LAMBARKA_TIXRAACA}}"));
    body.push(p("{{END:HANTI_TIXRAACA}}"));
    body.push(p("{{IF:HANTI_CALAAMAD_DHEERAAD}}"));
    body.push(p("Calaamad Dheeraad ah: {{CALAAMAD_DHEERAAD}}"));
    body.push(p("{{END:HANTI_CALAAMAD_DHEERAAD}}"));
  }

  /* ---- 2. the sellers ------------------------------------------ */
  body.push(p("2. IIBIYAYAAL ({{IIBIYE_WORDS}})", { heading: true }));
  body.push(
    p(
      "Iibiyaha (si kooban): {{IIBIYAHA_MAGAC}} · Degmada: {{IIBIYAHA_DEGAN}} · Telefoon: {{IIBIYAHA_TELEFOON}}",
    ),
  );
  body.push(p("{{#IIBIYEYAAL}}"));
  body.push(
    p("Iibiyaha {{NUMBER}}: {{MAGAC}} · Degmada: {{DEGAN}} · Telefoon: {{TELEFOON}}"),
  );
  // The ROLE gets its own line because it is an OPTIONAL answer, and a blank
  // one then leaves no bare label stuck in the middle of the person's name.
  // The person's STATE is not repeated here: the attendance lines below it
  // already say, in the notary's own words, whether he is present.
  body.push(p("Doorarka: {{DOORO}}"));
  // Attendance is asked ONCE per person, in the same card as their data —
  // so the document says the same thing from that one answer.
  body.push(p("{{IF:WAKIIL}}"));
  body.push(p("Wakiilka matalaya: {{WAKIIL_MAGAC}} ({{WAKIIL_NOOCA_WAKIILKA}})"));
  body.push(p("{{END:WAKIIL}}"));
  body.push(p("{{IF:JOOGA}}"));
  body.push(p("Qofka wuxuu isaga jooga dhammaadka saxiixu."));
  body.push(p("{{END:JOOGA}}"));
  body.push(p("{{/IIBIYEYAAL}}"));
  body.push(p("Wakiillo Iibiyayaasha (hal wakiil hal iibiy oo uu matalo):"));
  body.push(p("{{#WAKIILO_IIBIYEYAAL}}"));
  body.push(p("{{NUMBER}}. {{MAGAC}} ({{NOOCA_WAKIILKA}}) — Matalaya: {{MATALAYA}}"));
  body.push(p("{{/WAKIILO_IIBIYEYAAL}}"));

  /* ---- 3. the family / group, when there is one ---------------- */
  // A group is NOT a person, so it gets its own heading and no attendance
  // question of its own. The hal/badan flags come from the group's own
  // count, so the heading disappears with the list.
  body.push(p("{{IF:KOOXAHA_HAL}}"));
  body.push(p("KOOXA / QOYSKA IIBIYAHA", { heading: true }));
  body.push(p("{{END:KOOXAHA_HAL}}"));
  body.push(p("{{IF:KOOXAHA_BADAN}}"));
  body.push(p("KOOXAHA / QOYSKU IIBIYAAL", { heading: true }));
  body.push(p("{{END:KOOXAHA_BADAN}}"));
  body.push(p("{{#KOOXAHA}}"));
  body.push(p("{{NUMBER}}. {{MAGAC}}"));
  body.push(p("{{/KOOXAHA}}"));

  /* ---- 4. the buyers, entered exactly like the sellers ---------- */
  body.push(p("3. IIBSADAYAAL ({{IIBSADE_WORDS}})", { heading: true }));
  body.push(
    p(
      "Iibsadaha (si kooban): {{IIBSADAHA_MAGAC}} · Degmada: {{IIBSADAHA_DEGAN}} · Telefoon: {{IIBSADAHA_TELEFOON}}",
    ),
  );
  body.push(p("{{#IIBSADAYAAL}}"));
  body.push(
    p("Iibsade {{NUMBER}}: {{MAGAC}} · Degmada: {{DEGAN}} · Telefoon: {{TELEFOON}}"),
  );
  body.push(p("{{IF:WAKIIL}}"));
  body.push(p("Wakiilka matalaya: {{WAKIIL_MAGAC}} ({{WAKIIL_NOOCA_WAKIILKA}})"));
  body.push(p("{{END:WAKIIL}}"));
  body.push(p("{{IF:JOOGA}}"));
  body.push(p("Qofka wuxuu isaga jooga dhammaadka saxiixu."));
  body.push(p("{{END:JOOGA}}"));
  body.push(p("{{/IIBSADAYAAL}}"));
  body.push(p("{{#WAKIILO_IIBSADAYAAL}}"));
  body.push(p("{{NUMBER}}. {{MAGAC}} ({{NOOCA_WAKIILKA}}) — Matalaya: {{MATALAYA}}"));
  body.push(p("{{/WAKIILO_IIBSADAYAAL}}"));

  /* ---- 5. the plot / house / beer's own facts ------------------ */
  body.push(p("4. FAAHFAAHINTA HANTIDA", { heading: true }));
  body.push(kvTable(PROPERTY_ROWS[subType]));

  /* ---- 6-8. the three independent lists ------------------------ */
  // Each list exists only if the notary said it does (Step 1), and each
  // repeats over ITS OWN rows — a sale may print eight photographs beside
  // thirteen sellers and the engine never compares the two counts.
  body.push(p("{{IF:SAWIRRO_MA_JIRAAN}}"));
  body.push(p("SAWIRKA", { heading: true }));
  body.push(p("{{#SAWIRRADA}}"));
  body.push(p("{{NUMBER}}. {{SHAKHSIGA}}"));
  // The caption is the notary's own note about the picture, so it prints on
  // its own line — never welded onto the person's name.
  body.push(p("{{CAPTION}}"));
  body.push(p("{{/SAWIRRADA}}"));
  body.push(p("{{END:SAWIRRO_MA_JIRAAN}}"));

  body.push(p("{{IF:SAXEEXO_MA_JIRAAN}}"));
  body.push(p("SAXEEXAYAASHA", { heading: true }));
  body.push(p("{{#SAXEEXAYAASHA}}"));
  body.push(p("{{NUMBER}}. {{PREFIX}} {{SHAKHSIGA}}"));
  body.push(p("{{/SAXEEXAYAASHA}}"));
  body.push(p("{{END:SAXEEXO_MA_JIRAAN}}"));

  body.push(p("{{IF:SHAXADO_MA_JIRAAN}}"));
  body.push(p("SHAXADAYAHA IYO WARQADAH", { heading: true }));
  body.push(p("{{#SHAXADAHA}}"));
  body.push(p("{{NUMBER}}. {{TIXRAACA}} — {{NOOCA_SHAXADAHA}}"));
  body.push(p("{{/SHAXADAHA}}"));
  body.push(p("{{END:SHAXADO_MA_JIRAAN}}"));

  /* ---- 9. the money -------------------------------------------- */
  body.push(p("5. QIIMAHA & LACAGTA", { heading: true }));
  body.push(
    kvTable([
      ["Qiimaha Hantida", "{{QIIMAHA_HANTIDA}}"],
      ["Lacagta La Bixiyay", "{{LACAGTA_BIXIYAY}}"],
      // Derived as price − paid, so the document can never contradict the
      // two numbers it was computed from. It prints $0 when nothing is owed.
      ["Lacagta Hadhay", "{{LACAGTA_HADHAY}}"],
      ["Qiimaha Qoraal", "{{QIIMAHA_QORAAL}}"],
    ]),
  );

  /* ---- the guarantee: third party, or the sellers themselves --- */
  body.push(p("{{IF:DAMIIN_QOF_3AAD}}"));
  body.push(p("6. DAMMAANADDA (DAMIIN)", { heading: true }));
  body.push(
    kvTable([
      ["Magaca Damiinka", "{{DAMIIN_MAGAC}}"],
      ["Telefoonka Damiinka", "{{DAMIIN_TELEFOON}}"],
      ["Gurmadka Dammaanadda", "{{DAMIIN_GURMAD}}"],
    ]),
  );
  body.push(p("{{END:DAMIIN_QOF_3AAD}}"));
  body.push(p("{{IF:DAMIIN_IIBIYAHA}}"));
  body.push(p("6. DAMMAANADDA (DAMIIN)", { heading: true }));
  body.push(p("{{NOOCA_DAMIINTA}} — dammaanadda waxaa ku dhegan iibiyaha / iibiyayaasha."));
  body.push(p("{{END:DAMIIN_IIBIYAHA}}"));

  /* ---- witnesses ------------------------------------------------ */
  body.push(p("7. MARAGYO", { heading: true }));
  body.push(p("{{#MARAGYO}}"));
  body.push(p("{{NUMBER}}. {{MAGAC}} · Telefoon: {{TELEFOON}}"));
  body.push(p("{{/MARAGYO}}"));

  /* ---- signatures ----------------------------------------------- */
  body.push(p("8. SAXIIXA", { heading: true }));
  body.push(
    signatureTable([
      ["Saxiiixa Iibiyaha\nSaxiiid / Stamp:", "Saxiiixa Iibsadaha\nSaxiiid / Stamp:"],
      [
        "Magaca Iibiyaha: {{IIBIYAHA_MAGAC}}",
        "Magaca Iibsadaha: {{IIBSADAHA_MAGAC}}",
      ],
    ]),
  );
  // A wakiil signs only when somebody was actually represented, so these
  // lines appear exactly when the attendance answer said so.
  body.push(p("{{IF:IIBIYAHA_WAKIIL}}"));
  body.push(
    p(
      "Saxiixa Wakiilka Iibiyaha: {{IIBIYAHA_WAKIIL_MAGAC}} ({{IIBIYAHA_WAKIIL_NOOCA_WAKIILKA}}) — Saxiiid / Stamp:",
    ),
  );
  body.push(p("{{END:IIBIYAHA_WAKIIL}}"));
  body.push(p("{{IF:IIBSADAHA_WAKIIL}}"));
  body.push(
    p(
      "Saxiixa Wakiilka Iibsadaha: {{IIBSADAHA_WAKIIL_MAGAC}} ({{IIBSADAHA_WAKIIL_NOOCA_WAKIILKA}}) — Saxiiid / Stamp:",
    ),
  );
  body.push(p("{{END:IIBSADAHA_WAKIIL}}"));
  body.push(p("{{IF:DAMIIN_QOF_3AAD}}"));
  body.push(p("Saxiixa Damiinka: {{DAMIIN_MAGAC}} — Saxiiid / Stamp:"));
  body.push(p("{{END:DAMIIN_QOF_3AAD}}"));
  body.push(p("{{#MARAGYO}}"));
  body.push(p("Marag {{NUMBER}}: {{MAGAC}} — Saxiiid / Stamp:"));
  body.push(p("{{/MARAGYO}}"));

  body.push(
    p(
      "Xogta dhabta ah waa in lagu buuxiyo marka heshiiska la abuurayo — template-ka waa iska leh user-ka, qoraalka sharciga wuxuu beddeli karaa.",
      { bold: true },
    ),
  );

  return body;
}

async function buildDocument(subType: string): Promise<Uint8Array> {
  return Packer.toBuffer(
    new Document({
      creator: "Notary Doc Builder",
      title: `Kala Iibsi Hanti — ${SUBTYPE_LABEL[subType]}`,
      description:
        "Word template uu isticmaalay xogta heshiiska. {{PLACEHOLDER}} tokens ha iska beddelin.",
      sections: [{ children: buildChildren(subType) }],
    }),
  );
}

/* ------------------------------------------------------------------ */
/* One filled-in answer set, for verifying the file we just wrote      */
/* ------------------------------------------------------------------ */

const partyRow = (id: string, values: Record<string, string>) => ({ id, values });

/**
 * A complete, valid answer set for one sub-type. It exists ONLY so this
 * script can prove the template it just wrote is fillable — the template
 * never depends on any particular value.
 */
function sampleValues(subType: string) {
  const base = createInitialValues(kalaIiibsiHantiConfig);
  return {
    ...base,
    dejinta: {
      ...(base.dejinta as Record<string, string>),
      sub_type: subType,
      reference: "DPN-MG-001",
      taariikhda_hantida: "2026-01-30",
      sawirro_ma_jiraan: "yes",
      saxeexo_ma_jiraan: "yes",
      shaxado_ma_jiraan: "yes",
      iibiye_mode: "multiple",
      tirada_iibiyayaasha: "2",
      iibsade_mode: "single",
      tirada_iibsadayaasha: "1",
      nooca_damiinta: "qof_3aad",
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
    kooxaha: [partyRow("g", { magac: "Ilma Xassan Qaalib" })],
    iibiyeyaal: [
      {
        ...partyRow("s1", {
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
        ...partyRow("s2", {
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
      partyRow("r1", { magac: "FARAX AHMED", nooca_wakiilka: "wakiil_qayim" }),
    ],
    wakiilo_iibsadayaal: [],
    iibsadayaal: [
      {
        ...partyRow("b1", {
          magac: "SOMALI JAMAC",
          jinsi: "male",
          degan: "Hargeisa",
          telefoon: "0622000009",
        }),
        attendance: { status: "jooga" },
      },
    ],
    sawirrada: [partyRow("p1", { shakhsiga: "s1", caption: "Ahmed Cali", sawir: "stor_p1" })],
    saxeexayaasha: [partyRow("x1", { shakhsiga: "s1", prefix: "IIBIYE" })],
    shaxadaha: [
      partyRow("c1", {
        tixraaca: "MDH/C/842/2025",
        nooca_shaxadaha: "beerta",
        haysa: "Ilma Xassan Qaalib",
      }),
    ],
    maragyo: [
      partyRow("m1", { magac: "MARAG KOOW", telefoon: "0633333333" }),
      partyRow("m2", { magac: "MARAG LABO", telefoon: "0633333334" }),
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
  } as unknown as Parameters<typeof buildDataContext>[1];
}

/* ------------------------------------------------------------------ */
/* Write + verify                                                      */
/* ------------------------------------------------------------------ */

mkdirSync(outDir, { recursive: true });

const SUBTYPES = ["dhul_banaan", "guri", "beer"];
let failed = false;

for (const subType of SUBTYPES) {
  const target = resolve(outDir, `${subType}.docx`);
  if (existsSync(target) && !force) {
    console.log(`⊘ ${subType}.docx wuxuu horey u jiraa — lama beddelin.`);
    console.log("  Haddii aad rabto template-ka nidaamka la regenerate garo: --force");
    continue;
  }
  const bytes = await buildDocument(subType);
  writeFileSync(target, bytes);

  // Real package, unprotected, and every placeholder the engine knows.
  const zip = await JSZip.loadAsync(Buffer.from(bytes));
  const parts = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const allXml = (
    await Promise.all(
      parts.filter((n) => n.endsWith(".xml")).map((n) => zip.file(n)!.async("string")),
    )
  ).join("");
  const protection = [
    "documentProtection",
    "permStart",
    "permEnd",
    "writeProtection",
    "readOnlyRecommended",
  ].filter((p) => allXml.includes(p));
  if (protection.length) {
    console.error(`✗ ${subType}.docx wuxuu leeyahay protection: ${protection.join(", ")}`);
    failed = true;
  }

  // The real validator, against a REAL data context for this sub-type.
  //
  // An EMPTY context is not enough: the row tokens inside {{#IIBIYEYAAL}} and
  // friends can only be recognised from rows that actually exist, so the guard
  // fills one representative seller, one represented seller with his wakiil,
  // a buyer, a photograph, a signatory, a certificate and two witnesses. Every
  // list the template repeats over therefore has real rows behind it.
  const ctx = buildDataContext(kalaIiibsiHantiConfig, sampleValues(subType));
  const report = await validateTemplate(
    `HANTI_${subType.toUpperCase()}_V1`,
    `/templates/kala_iiibsi_hanti/${subType}.docx`,
    Buffer.from(bytes).buffer as ArrayBuffer,
    ctx,
  );
  if (!report.valid) {
    for (const issue of report.issues.filter((i) => i.level === "error")) {
      console.error(`✗ ${subType}.docx: ${issue.message}`);
    }
    failed = true;
  }
  const warnings = report.issues.filter((i) => i.level === "warning");
  for (const w of warnings) console.log(`  ⚠ ${subType}.docx: ${w.message}`);

  console.log(
    `✔ ${subType}.docx (${bytes.length} bytes, ${parts.length} parts)` +
      (report.valid && warnings.length === 0 ? " — sax, placeholder kasta waa la xalaliyay." : ""),
  );
}

if (failed) process.exit(1);