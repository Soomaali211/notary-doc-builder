/**
 * Generates the Cadayn Cilaaj Word template:
 *
 *   public/templates/cadayn_cilaaj/cilaaj.docx
 *
 * THE SCAN IS THE WORDING. Every fixed line below is transcribed from the
 * office's live paper (Ref/Dpn/CC/000024/01/026 — "Cadayn Masuuliyad Qaadis
 * Bukaan", read in full, single page). Only the data points the form
 * collects are {{PLACEHOLDERS}}; nothing legal is invented, nothing legal
 * is paraphrased, and no clause is added that the scan does not carry.
 *
 * The eleven clauses are FIXED template text. Their wording never changes —
 * only the values inside them (the names, the hospital, the age, the
 * relationship word) are placeholders. Clause 4's parentheses keep the
 * scan's pair "Ee Eehnimoyahaya Iyo Eehlhinimo" plus the chosen relationship
 * word ({{XIRIIRKA}}) — the notary's scan shows "(Adeer)" in that slot.
 *
 * Run: bun scripts/generate-cilaaj-template.ts [--force]
 */
import {
  AlignmentType,
  Document,
  Footer,
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

/** The date is printed inside the scan's own header line, exactly as it. */
const header = {
  ref: "{{REF_NUMBER}}",
  weekday: "Salaasa",
  dateLine: "Taariikh: {{TAARIIKH}}",
  recipient: "Ku: - {{MACNAAS}}.",
  title: "Cadayn Masuuliyad Qaadis Bukaan.",
  opening:
    "Anigoo ah {{MASUULKA_MAGAC}} Degan {{MASUULKA_DEGAN}} xafiiskan hortiisa Waxaan ka cadaynayaa",
} as const;

/**
 * The eleven clauses. Text other than the placeholders is the scan's own —
 * capitalisation follows the scan letter for letter.
 */
const CLAUSES: string[] = [
  "In aan masuul buuxa ka ahay bukaanka Magaciisu yahay {{BUKAANKA_MAGAC}}",
  "In Bukaankan Da'diisu Tahay {{BUKAANKA_DAADI}} Jir.",
  "In aanay jirin Wax Hanti ah oo uu Gaar u leeyahay Iyo Dhadhaxaltoona.",
  "In Xiddhiidhka naga dhexeeya Ee Eehnimoyahaya Iyo Eehlhinimo yahay ({{XIRIIRKA}}).",
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
  attestationHeading: "Cadaynta Xafiiska :",
  attestation:
    " - Xafiisku waxa uu qirayaa in cadayntani u dhacday sifo sharciga waafaqsan laguna hor saxeexay laguna camal fali doono.",
  notaryName: "(Gr. Maxamed Cumar C/Jaahi)",
  notaryTitle: "Sarkaalka Xafiiska Nootayada Sharciga ah EeDaloodho",
} as const;

/* ------------------------------------------------------------------ */
/* Small builders                                                      */
/* ------------------------------------------------------------------ */

const p = (text: string, opts?: { bold?: boolean; underline?: object }) =>
  new Paragraph({
    spacing: { after: 120, line: 300 },
    children: [new TextRun({ text, bold: opts?.bold, ...opts?.underline ? { underline: {} } : {} })],
  });

function clauseTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, underline: {} })],
    spacing: { before: 200, after: 120 },
  });
}

function docTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, underline: {}, size: 32 })],
    spacing: { after: 120 },
  });
}

function witnessLine(n: string, name: string, phone: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${n} ${name}` }),
      new TextRun({ children: [new Tab()] }),
      new TextRun({ text: `Tell: ${phone}` }),
    ],
  });
}

/** The scan's signature card: name, phone, right — a 2x2 table. */
function sigCard(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([left, right]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 55, type: WidthType.PERCENTAGE },
              children: [p(left)],
              borders: noBorders,
            }),
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              children: [p(right)],
              borders: noBorders,
            }),
          ],
        }),
    ),
  });
}

const noBorders = {
  top: { style: "none" as const, size: 0, color: "auto" },
  bottom: { style: "none" as const, size: 0, color: "auto" },
  left: { style: "none" as const, size: 0, color: "auto" },
  right: { style: "none" as const, size: 0, color: "auto" },
  insideHorizontal: { style: "none" as const, size: 0, color: "auto" },
  insideVertical: { style: "none" as const, size: 0, color: "auto" },
};

/* ------------------------------------------------------------------ */
/* The document                                                        */
/* ------------------------------------------------------------------ */

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
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Cadayn Cilaaj (Qoraal Hubanti Ah Oo Sugan)  ",
                  }),
                  // REF_NUMBER resolves to the FULL composed reference
                  // (Ref/Dpn/CC/{serial}/{MM}/{YY}) — never prefix again.
                  new TextRun({ text: "{{REF_NUMBER}}" }),
                  new TextRun({ text: "  Page " }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: [
          /* ---- header line: Ref · Salaasa · Taariikh — the scan's shape -- */
          new Paragraph({
            tabStops: [
              { type: TabStopType.LEFT, position: 0 },
              { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
              { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
            ],
            children: [
              new TextRun({ text: header.ref, bold: true, italics: true, underline: {} }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: header.weekday, bold: true, italics: true, underline: {} }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: header.dateLine, bold: true, italics: true, underline: {} }),
            ],
            spacing: { after: 120 },
          }),

          /* ---- Ku: - Maamulka … + title ---- */
          p(header.recipient, { bold: true }),
          docTitle(header.title),

          /* ---- opening + numbered clauses ---- */
          p(header.opening),
          ...CLAUSES.map((text, i) => p(`${i + 1}.${text}`)),

          /* ---- signature ---- */
          clauseTitle(CLOSING.signatureHeading),
          p("1.  {{MASUULKA_MAGAC}}", { bold: true }),
          p("Tell: {{MASUULKA_TELEFOON}}"),

          clauseTitle(CLOSING.witnessHeading),
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
              new TextRun({ text: CLOSING.notaryTitle, bold: true, underline: {} }),
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
    console.log(`⊘ cilaaj.docx wuxuu horey u jiraa — lama beddelin. (--force si aad u regenerate gareysid)`);
    return;
  }
  const bytes = await Packer.toBuffer(buildCilaajTemplate());
  writeFileSync(target, bytes);
  console.log(`✔ cilaaj.docx (${bytes.length} bytes)`);
  console.log(
    "  Written VERBATIM from the scan; placeholders only where the form collects data.",
  );
}

main();
