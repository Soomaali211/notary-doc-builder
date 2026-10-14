/**
 * Generates the Cadayn Cilaaj Word template:
 *
 *   public/templates/cadayn_cilaaj/cilaaj.docx
 *
 * THE SCAN IS THE WORDING. Every fixed line below is transcribed from the
 * office's live paper (Ref/Dpn/CC/000024/01/026 — "Cadayn Masuuliyad Qaadis
 * Bukaan") read in full, single page, INCLUDING the letterhead:
 * JAMHUURIYADDA / REPUBLIC OF SOMALILAND trilingual masthead, the DALOODHO
 * PUBLIC NOTARY OFFICE block, the location line and the contact band.
 *
 * Only the data points the form collects are {{PLACEHOLDERS}}; nothing legal
 * is invented, nothing legal is paraphrased, and no clause is added that the
 * scan does not carry. The generated footer of the previous version ("Qoraal
 * Hubanti Ah Oo Sugan") was NOT on the scan and has been REMOVED.
 *
 * The eleven clauses are FIXED template text. Their wording never changes —
 * only the values inside them are placeholders. Clause 4 keeps the scan's
 * exact pair "Ee Ehelnimo" plus the chosen relationship word ({{XIRIIRKA}}) —
 * the notary's scan shows "(Adeer)" in that slot.
 *
 * Run: bun scripts/generate-cilaaj-template.ts --force
 *
 * NOTE: the office emblem (a printed stamp image on the scan) cannot be
 * reproduced from text; everything AROUND it is carried verbatim. If the
 * office supplies the emblem file the masthead can embed it later.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  Tab,
  TabStopPosition,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/templates/cadayn_cilaaj");
const force = process.argv.includes("--force");

/* ------------------------------------------------------------------ */
/* The scan, VERBATIM. Placeholders replace only WHAT VARIES.          */
/* ------------------------------------------------------------------ */

/**
 * The trilingual masthead, exactly as the scan prints it (left column /
 * right column around the office emblem):
 *   JAMHUURIYADDA SOMALILAND            REPUBLIC OF SOMALILAND
 *   WASAARADDA CADAALADDA  وزارة العدل   MINISTRY OF JUSTICE جمهورية صوماليلاند
 *   …emblem… DALOODHO PUBLIC NOTARY OFFICE / Xafiiska … ee Daloodho
 *   Location Hargeisa Somaliland, 26 June District near 26 June Police Station
 *   Email: Daloodhopublic441@gmail.com  Tell:+252-63-4410449/ +252-63-4115487
 */
const MASTHEAD = {
  jamhuuriyadda: "JAMHUURIYADDA SOMALILAND",
  wasaaradda: "WASAARADDA CADAALADDA",
  wasaaraddaArabic: "وزارة العدل",
  republic: "REPUBLIC OF SOMALILAND",
  ministry: "MINISTRY OF JUSTICE",
  republicArabic: "جمهورية صوماليلاند",
  officeEn: "DALOODHO PUBLIC NOTARY OFFICE",
  officeSo: "Xafiiska Nootaayada Sharciga Ah ee Daloodho",
  location: "Location Hargeisa Somaliland , 26 June District near 26 June Police Station",
  contactCountry: "Email: Daloodhopublic441@gmail.com",
  contactTell: "Tell:+252-63-4410449/ +252-63-4115487",
} as const;

/** The date is printed inside the scan's own header line, exactly as it. */
const header = {
  ref: "{{REF_NUMBER}}",
  // The scan prints the weekday between the ref and the date — it is
  // derived from the SAME date the form collects, never typed twice.
  weekday: "{{WEEKDAY}}",
  dateLine: "Taariikh: {{TAARIIKH}}",
  recipient: "Ku: - {{MACNAAS}}.",
  // The certificate title — empty in the form, the scan's own legal title
  // is the fallback (declared in the registry, never hard-coded here).
  title: "{{CINWAANKA_CADAYNTA}}",
  opening:
    "Anigoo ah {{MASUULKA_MAGAC}} Degan {{MASUULKA_DEGAN}} xafiiskan hortiisa Waxaan ka cadaynayaa",
} as const;

/**
 * The eleven clauses. Text other than the placeholders is the scan's own —
 * capitalisation follows the scan letter for letter:
 *   – Clause 3 ends "Iyo Dhaxal toona." (the scan's own words).
 *   – Clause 4 reads "Xidhiidhka … Ee Ehelnimo" (scan spelling).
 */
const CLAUSES: string[] = [
  "In aan masuul buuxa ka ahay bukaanka Magaciisu yahay {{BUKAANKA_MAGAC}}",
  "In Bukaankan Da'diisu Tahay {{BUKAANKA_DAADI}} Jir.",
  "In aanay jirin Wax Hanti ah oo uu Gaar u leeyahay Iyo Dhaxal toona.",
  "In Xidhiidhka naga dhexeeya Ee Ehelnimo yahay ({{XIRIIRKA}}).",
  "Sidoo Kalena aanay Jirin ama aanan Ku Ogayn Wax Xanuun ah Oo u Weheliya Xanuunka Dhibirka.",
  "In aniga la ii raaci doono masuulna aan ka ahay wixii dhib ah ee uu bukaankani geysto mudada uu xarunta ku xidhanyahay.",
  "Inaan u hogaansamayo shuruucda Hospitalka u taala, sida booqashada, daawada, shaybaadhka iyo IWM.",
  "Inaan raali ka ahay talaabo kasta oo macquula ah oo bukaankan lagula tacaalayo, hadii ay lagama maarmaan noqotana maamulka xaruntu awood buuxda u leeyihiin inay gaar u xidhaan si ay isaga iyo dadka kaleba u badbaadiyaan.",
  "Inaan bil walba ugu danbayn bixinayo bihsa 5'teeda khidmaca Hospitalka lagu xanaanaynayo bukaanka.",
  "In waqti kasta oo uu ii baahdo Hospitalku ama xaalad degdeg ahi timaado si dhakhso ah u ajiibi doono.",
  "Hadii ay dhacdo in bukahu Nafftiisa dhib u geysto ama qadar kale ku yimaado Hospitalka waxba loogama raacayo.",
];

const CLOSING = {
  signatureHeading: "Saxeexa Masuulka Bukaanka",
  witnessHeading: "Marag Goob Jooga",
  attestationHeading: "CadayntaXafiiska :",
  attestation:
    " - Xafiisku waxa uu qirayaa in cadayntani u dhacday sifo sharciga waafaqsan laguna hor saxeexay laguna camal fali doono.",
  notaryName: "(Gr. Maxamed Cumar C/Jaahi)",
  notaryTitle: "Sarkaalka Xafiiska Nootayada Sharciga ah EeDaloodho",
} as const;

/* ------------------------------------------------------------------ */
/* Small builders                                                      */
/* ------------------------------------------------------------------ */

const p = (text: string, opts?: { bold?: boolean; underline?: boolean }) =>
  new Paragraph({
    spacing: { after: 120, line: 300 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        ...(opts?.underline ? { underline: {} } : {}),
      }),
    ],
  });

/** A left/right split line — the scan lays the name left, the Tell right. */
const splitLine = (
  left: string,
  right: string,
  bold = false,
): Paragraph =>
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { after: 120, line: 300 },
    children: [
      new TextRun({ text: left, bold }),
      new TextRun({ children: [new Tab()] }),
      new TextRun({ text: right }),
    ],
  });

function centeredUnderline(text: string, before = 200): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, underline: {} })],
    spacing: { before, after: 120 },
  });
}

function docTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, underline: {}, size: 32 })],
    spacing: { after: 120 },
  });
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

const cell = (runs: TextRun[], align: (typeof AlignmentType)[keyof typeof AlignmentType], width: number) =>
  new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: noBorders,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: [
      new Paragraph({ alignment: align, spacing: { after: 40 }, children: runs }),
    ],
  });

/**
 * The scan's masthead — the trilingual ministry row, the office title block,
 * the location line and the contact band. NO borders, NO invented text.
 */
function letterhead(): Table[] {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            cell(
              [
                new TextRun({
                  text: MASTHEAD.jamhuuriyadda,
                  bold: true,
                  size: 24,
                }),
              ],
              AlignmentType.LEFT,
              33,
            ),
            cell(
              [
                new TextRun({ text: MASTHEAD.republic, bold: true, size: 24 }),
              ],
              AlignmentType.RIGHT,
              67,
            ),
          ],
        }),
        new TableRow({
          children: [
            cell(
              [
                new TextRun({ text: MASTHEAD.wasaaradda, bold: true, size: 22 }),
              ],
              AlignmentType.LEFT,
              33,
            ),
            cell(
              [
                new TextRun({ text: MASTHEAD.wasaaraddaArabic, size: 18 }),
              ],
              AlignmentType.CENTER,
              33,
            ),
            cell(
              [new TextRun({ text: MASTHEAD.ministry, bold: true, size: 22 })],
              AlignmentType.RIGHT,
              27,
            ),
          ],
        }),
        new TableRow({
          children: [
            // The scan carries the Republic name in Arabic in its own row
            // under the ministry line — declared in MASTHEAD, never printed
            // before. Reproduced exactly as the scan lays it out.
            cell([], AlignmentType.LEFT, 33),
            cell(
              [
                new TextRun({ text: MASTHEAD.republicArabic, size: 18 }),
              ],
              AlignmentType.CENTER,
              33,
            ),
            cell([], AlignmentType.RIGHT, 34),
          ],
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: MASTHEAD.officeEn,
          bold: true,
          size: 36,
          color: "1F4E79",
        }),
      ],
      spacing: { before: 80, after: 20 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: MASTHEAD.officeSo, size: 22 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: MASTHEAD.location, size: 18, color: "1F7A33" }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${MASTHEAD.contactCountry}   ${MASTHEAD.contactTell}`,
          size: 18,
          color: "9C2A2A",
        }),
      ],
      spacing: { after: 200 },
    }),
  ];
}

/* ------------------------------------------------------------------ */
/* The document                                                        */
/* ------------------------------------------------------------------ */

function witnessLine(n: string, name: string, phone: string): Paragraph {
  return splitLine(`${n} ${name}`, `Tell: ${phone}`);
}

/** The scan's signature card: name left, Tell right — a 2-row borderless table. */
function sigCard(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: rows.map(
      ([left, right]) =>
        new TableRow({
          children: [
            cell(
              [new TextRun({ text: left, bold: true })],
              AlignmentType.LEFT,
              55,
            ),
            cell(
              [new TextRun({ text: right })],
              AlignmentType.LEFT,
              45,
            ),
          ],
        }),
    ),
  });
}

function buildCilaajTemplate(): Document {
  return new Document({
    creator: "Notary Doc Builder",
    title: "Cadayn Cilaaj — Cadayn Masuuliyad Qaadis Bukaan",
    description:
      "Word template-ka Cadayn Cilaaj. {{PLACEHOLDER}} ha iska beddelin — engine-ku wuxuu go'aanisaa nooca iyo qodobada.",
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 22 },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
        children: [
          /* ---- the scan's masthead, verbatim ---- */
          ...letterhead(),

          /* ---- header line: Ref · Salaasa · Taariikh — the scan's shape -- */
          new Paragraph({
            tabStops: [
              { type: TabStopType.LEFT, position: 0 },
              { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
              { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
            ],
            children: [
              new TextRun({
                text: header.ref,
                bold: true,
                italics: true,
                underline: {},
              }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({
                text: header.weekday,
                bold: true,
                italics: true,
                underline: {},
              }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({
                text: header.dateLine,
                bold: true,
                italics: true,
                underline: {},
              }),
            ],
            spacing: { after: 120 },
          }),

          /* ---- Ku: - Maamulka … + title ---- */
          p(header.recipient, { bold: true }),
          docTitle(header.title),

          /* ---- opening + numbered clauses ---- */
          p(header.opening),
          ...CLAUSES.map((text, i) => p(`${i + 1}. ${text}`)),

          /* ---- signature ---- */
          centeredUnderline(CLOSING.signatureHeading),
          sigCard([
            ["1. {{MASUULKA_MAGAC}}", "Tell:{{MASUULKA_TELEFOON}}"],
          ]),

          centeredUnderline(CLOSING.witnessHeading),
          p("{{#MARAGYO}}"),
          witnessLine("{{NUMBER}}.", "{{MAGAC}}", "{{PHONE}}"),
          p("{{/MARAGYO}}"),

          /* ---- office attestation ---- */
          p(`${CLOSING.attestationHeading}${CLOSING.attestation}`),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: CLOSING.notaryName, bold: true })],
            spacing: { before: 200 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: CLOSING.notaryTitle,
                bold: true,
                underline: {},
              }),
            ],
            spacing: { after: 120 },
          }),
        ],
      },
    ],
  });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const target = resolve(outDir, "cilaaj.docx");
  if (existsSync(target) && !force) {
    console.log(
      `⊘ cilaaj.docx wuxuu horey u jiraa — lama beddelin. (--force si aad u regenerate gareysid)`,
    );
    return;
  }
  const bytes = await Packer.toBuffer(buildCilaajTemplate());
  writeFileSync(target, bytes);
  console.log(`✔ cilaaj.docx (${bytes.length} bytes)`);
  console.log(
    "  Written VERBATIM from the scan incl. the letterhead; placeholders only where the form collects data.",
  );
}

main();
