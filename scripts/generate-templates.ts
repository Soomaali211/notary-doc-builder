/**
 * Creates the sample Word templates for every registered Heshiis Kiro
 * sub-type (public/templates/heshiis_kiro/{guri_xaas,qol_meherad,jiingad}.docx).
 *
 * IMPORTANT — the app never designs Word documents. These sample templates
 * contain ONLY placeholders; the notary office replaces each file with its
 * own designed template as long as the same {{TOKENS}} are kept:
 *
 *   {{PLACEHOLDER}}            plain replacement
 *   {{IF:FLAG}}…{{ENDIF}}      conditional section (false → removed whole)
 *   {{#MARAGYO}}…{{/MARAGYO}}  repeated block (once per witness)
 *   {{CLAUSE_*}}               clause markers resolved by the engine
 *
 * Run: bun scripts/generate-templates.ts
 */
import {
  AlignmentType,
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
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/templates/heshiis_kiro");
mkdirSync(outDir, { recursive: true });

const p = (text: string, opts?: { bold?: boolean; heading?: boolean }) =>
  new Paragraph({
    heading: opts?.heading ? HeadingLevel.HEADING_2 : undefined,
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: opts?.bold ?? opts?.heading })],
  });

// A small party table — proves placeholder + repeater support inside tables.
const partyTable = () =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [p("Magac", { bold: true })] }),
          new TableCell({ children: [p("Telefoon", { bold: true })] }),
          new TableCell({ children: [p("Aqoonsi", { bold: true })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p("{{KIREYE_MAGAC}}")] }),
          new TableCell({ children: [p("{{KIREYE_TELEFOON}}")] }),
          new TableCell({ children: [p("{{KIREYE_AQOONSI}}")] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [p("{{KIRAYSTE_MAGAC}}")] }),
          new TableCell({ children: [p("{{KIRAYSTE_TELEFOON}}")] }),
          new TableCell({ children: [p("{{KIRAYSTE_AQOONSI}}")] }),
        ],
      }),
    ],
  });

const contractDoc = (subTypeLabel: string) =>
  new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 24 } } },
    },
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: "HESHIIS KIRO", bold: true, size: 56 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({ text: `Nooca: ${subTypeLabel}`, italics: true }),
            ],
          }),

          p("1. XOGTA HESHIISKA", { heading: true }),
          p("Nambarka Tixraaca: {{REFERENCE_NUMBER}}"),
          p("Taariikhda Heshiiska: {{CONTRACT_DATE}}"),
          p("Taariikhda Bilowga: {{TAARIIKHDA_BILOWGA}}"),
          p("Taariikhda Dhammaadka: {{TAARIIKHDA_DHAMMAADKA}}"),
          p("Shuruudaha Gaarka ah: {{SHURUUDAHA_GAARKA_AH}}"),

          p("2. XISBIYADA (PARTIES)", { heading: true }),
          partyTable(),
          new Paragraph({ spacing: { after: 120 }, children: [] }),
          p("Kireeyayaal dheeraad ah:", { bold: true }),
          p("{{#KIREYEYAYAAL}}{{NUMBER}}. {{MAGAC}} — {{TELEFOON}}{{/KIREYEYAYAAL}}"),
          p("Kiraystayaal dheeraad ah:", { bold: true }),
          p("{{#KIRAYSTAYAAL}}{{NUMBER}}. {{MAGAC}} — {{TELEFOON}}{{/KIRAYSTAYAAL}}"),

          p("3. FAAHFAAHINTA GURIGA", { heading: true }),
          p("Nooca Guriga: {{NOOCA_GURIGA}}"),
          p("Goobta: {{GOOBTA}}"),
          p("Cinwaanka Guriga: {{CINWAANKA_GURIGA}}"),
          p("Sharraxaad: {{SHARRAXAADDA_GURIGA}}"),
          p("Qolada / Faahfaahin: {{QOLADA}}"),

          p("4. LACAGTA & HABKA BIXINTA", { heading: true }),
          p("Qiimaha Kirada Bishii: {{QIIMAHA_KIRADA}}"),
          p("Habka Bixinta: {{HABKA_BIXINTA}}"),
          p("Maalinta Bixinta: {{TAARIIKHDA_BIXINTA}}"),
          p("{{CLAUSE_MUQADIN}}"),
          p("Faahfaahin Lacagta: {{FAAHFAAHIN_LACAGTA}}"),

          p("{{IF:DEEBAAJI_HAA}}"),
          p("5. DEEBAAJI", { heading: true }),
          p("DEEQAJIGA:", { bold: true }),
          p("Kiraystuhu wuxuu bixiyay deebaaji (koronto, biyo iyo wm.) oo dhan {{DEEBAAJI_AMOUNT}} bil kasta."),
          p("Shuruudaha: {{DEEBAAJI_SHURUUDO}}"),
          p("{{ENDIF}}"),
          p("{{CLAUSE_DEEBAAJI}}"),

          p("{{IF:DAMIIN_HAA}}"),
          p("6. DAMIIN", { heading: true }),
          p("Magaca Damiinka: {{DAMIIN_MAGAC}}"),
          p("Telefoon: {{DAMIIN_TELEFOON}}"),
          p("Aqoonsi: {{DAMIIN_AQOONSI}}"),
          p("Cinwaan: {{DAMIIN_CINWAAN}}"),
          p("{{ENDIF}}"),
          p("{{CLAUSE_DAMIIN}}"),

          p("7. OGAYSIINTA", { heading: true }),
          p("Mudada Ogaysiinta: {{MUDADA_OGAYSIINTA}}"),
          p("Shuruudaha Joojinta: {{SHURUUDAHA_JOOJINTA}}"),
          p("Faahfaahin Dheeraad: {{FAAHFAAHIN_OGAYSIINTA}}"),

          p("8. MARAGYO (WITNESSES)", { heading: true }),
          p("{{#MARAGYO}}"),
          p("{{NUMBER}}. {{MAGAC}}"),
          p("Telefoon: {{PHONE}}"),
          p("ID: {{ID}}"),
          p("{{/MARAGYO}}"),

          p("9. SHURUUDO DHEERAAD AH", { heading: true }),
          p("{{CLAUSE_DHEERAAD}}"),
          p("{{SHURUUDO_DHEERAAD}}"),

          new Paragraph({
            spacing: { before: 480 },
            children: [
              new TextRun({
                text: "Saxiixa Kireeyaha: ______________________          Saxiixa Kiraystaha: ______________________",
              }),
            ],
          }),
        ],
      },
    ],
  });

for (const sub of ["guri_xaas", "qol_meherad", "jiingad"] as const) {
  const buffer = await Packer.toBuffer(contractDoc(sub));
  const outPath = resolve(outDir, `${sub}.docx`);
  writeFileSync(outPath, buffer);
  console.log(`Sample template written: ${outPath}`);
}
