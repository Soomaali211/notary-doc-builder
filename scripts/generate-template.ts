/**
 * Creates the sample Word template for Heshiis Kiro.
 *
 * The app NEVER designs Word documents — it only fills placeholders in the
 * template found at public/templates/heshiis_kiro_template.docx.
 * Run `bun scripts/generate-template.ts` to (re)create this sample so the
 * workflow is testable. The notary office can replace the file with their own
 * designed template as long as the same {{PLACEHOLDER}} tokens are kept.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "../public/templates/heshiis_kiro_template.docx");
mkdirSync(dirname(outPath), { recursive: true });

const p = (text: string, opts?: { bold?: boolean; heading?: boolean; space?: boolean }) =>
  new Paragraph({
    heading: opts?.heading ? HeadingLevel.HEADING_2 : undefined,
    spacing: { after: opts?.space === false ? 60 : 160 },
    children: [new TextRun({ text, bold: opts?.bold ?? opts?.heading })],
  });

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 24 } },
    },
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
            new TextRun({ text: "Nooca: {{SUB_TYPE}}", italics: true }),
          ],
        }),

        p("1. XOGTA HESHIISKA", { heading: true }),
        p("Nambarka Tixraaca: {{REFERENCE_NUMBER}}"),
        p("Taariikhda Heshiiska: {{CONTRACT_DATE}}"),
        p("Taariikhda Bilowga: {{TAARIIKHDA_BILOWGA}}"),
        p("Taariikhda Dhammaadka: {{TAARIIKHDA_DHAMMAADKA}}"),

        p("2. KIREYEHA (LESSOR)", { heading: true }),
        p("Magaca: {{KIREYE_MAGAC}}"),
        p("Telefoon: {{KIREYE_TELEFOON}}"),
        p("Aqoonsi: {{KIREYE_AQOONSI}}"),
        p("Cinwaan: {{KIREYE_CINWAAN}}"),
        p("Kireeyayaal dheeraad ah: {{KIREYEYAYAAL_LIST}}", { space: false }),

        p("3. KIRAYSTAHA (LESSEE)", { heading: true }),
        p("Magaca: {{KIRAYSTE_MAGAC}}"),
        p("Telefoon: {{KIRAYSTE_TELEFOON}}"),
        p("Aqoonsi: {{KIRAYSTE_AQOONSI}}"),
        p("Cinwaan: {{KIRAYSTE_CINWAAN}}"),
        p("Kiraystayaal dheeraad ah: {{KIRAYSTAYAAL_LIST}}", { space: false }),

        p("4. FAAHFAAHINTA GURIGA", { heading: true }),
        p("Nooca Guriga: {{NOOCA_GURIGA}}"),
        p("Goobta: {{GOOBTA}}"),
        p("Cinwaanka Guriga: {{CINWAANKA_GURIGA}}"),
        p("Sharraxaad: {{SHARRAXAADDA_GURIGA}}"),
        p("Qolada / Faahfaahin: {{QOLADA}}"),

        p("5. LACAGTA & HABKA BIXINTA", { heading: true }),
        p("Qiimaha Kirada Bishii: {{QIIMAHA_KIRADA}}"),
        p("Habka Bixinta: {{HABKA_BIXINTA}}"),
        p("Maalinta Bixinta: {{TAARIIKHDA_BIXINTA}}"),
        p("{{CLAUSE_MUQADIN}}"),
        p("Faahfaahin Lacagta: {{FAAHFAAHIN_LACAGTA}}"),

        p("6. DEEBAAJI", { heading: true }),
        p("{{CLAUSE_DEEBAAJI}}"),
        p("Lacagta Deebaajiga: {{DEEBAAJI_AMOUNT}}"),
        p("Shuruudaha Deebaajiga: {{DEEBAAJI_SHURUUDO}}"),

        p("7. DAMIIN", { heading: true }),
        p("{{CLAUSE_DAMIIN}}"),
        p("Magaca Damiinka: {{DAMIIN_MAGAC}}"),
        p("Telefoon: {{DAMIIN_TELEFOON}}"),
        p("Aqoonsi: {{DAMIIN_AQOONSI}}"),
        p("Cinwaan: {{DAMIIN_CINWAAN}}"),

        p("8. OGAYSIINTA", { heading: true }),
        p("Mudada Ogaysiinta: {{MUDADA_OGAYSIINTA}}"),
        p("Shuruudaha Joojinta: {{SHURUUDAHA_JOOJINTA}}"),
        p("Faahfaahin Dheeraad: {{FAAHFAAHIN_OGAYSIINTA}}"),

        p("9. MARAGYO (WITNESSES)", { heading: true }),
        p("{{MARAGYO_LIST}}"),

        p("10. SHURUUDO DHEERAAD AH", { heading: true }),
        p("{{CLAUSE_DHEERAAD}}"),
        p("{{SHURUUDO_DHEERAAD}}"),

        p("SHURUUDAHA GAARKA AH", { heading: true }),
        p("{{SHURUUDAHA_GAARKA_AH}}"),

        new Paragraph({
          spacing: { before: 480 },
          children: [
            new TextRun({
              text:
                "Saxiixa Kireeyaha: ______________________          Saxiixa Kiraystaha: ______________________",
            }),
          ],
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(outPath, buffer);
console.log(`Sample template written: ${outPath}`);
