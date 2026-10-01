/**
 * Phase Template Generator — builds the INITIAL, EDITABLE Word template
 * `heshiis_kiro_template.docx`.
 *
 * The template owns NO data: every value is a placeholder token taken from
 * the central Placeholder Registry, with the exact {{NAME}} syntax. The
 * user opens this file in Word/LibreOffice and owns the design from then on
 * (fonts, logo, tables, legal wording, signature areas) — the system only
 * ever fills placeholders afterwards.
 *
 * Two rules are enforced by the tests:
 *   1. every canonical placeholder token is present, spelled exactly as the
 *      registry defines it (never renamed, never invented);
 *   2. repeat {{#BLOCK}}…{{/BLOCK}} and conditional {{IF:FLAG}}…{{END:FLAG}}
 *      markers sit ALONE in their own paragraph so the engine can expand,
 *      duplicate or remove whole sections.
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
  VerticalAlign,
  WidthType,
} from "docx";
import { HESHIIS_KIRO_PLACEHOLDERS, tokenString } from "./placeholderRegistry";

/** Canonical token for a registry group/label — typo-proof by construction. */
const T = (token: string): string => tokenString(token);

const KIREYE_MAGAC = T("KIREYE_MAGAC");
const KIREYE_TELEFOON = T("KIREYE_TELEFOON");
const KIREYE_AQOONSI = T("KIREYE_AQOONSI");
const KIREYE_CINWAAN = T("KIREYE_CINWAAN");
const KIRAYSTE_MAGAC = T("KIRAYSTE_MAGAC");
const KIRAYSTE_TELEFOON = T("KIRAYSTE_TELEFOON");
const KIRAYSTE_AQOONSI = T("KIRAYSTE_AQOONSI");
const KIRAYSTE_CINWAAN = T("KIRAYSTE_CINWAAN");
const WAKIIL_MAGAC = T("WAKIIL_MAGAC");
const WAKIIL_TELEFOON = T("WAKIIL_TELEFOON");

/* ------------------------------------------------------------------ */
/* Small builders                                                      */
/* ------------------------------------------------------------------ */

/** A marker-only paragraph ({{#BLOCK}}, {{/BLOCK}}, {{IF:…}}, {{END:…}}). */
function marker(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true })], spacing: { after: 60 } });
}

/** A normal paragraph — tokens are always kept inside ONE text run. */
function line(text: string, opts: { bold?: boolean; italic?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italic })],
    alignment: opts.align,
    spacing: { after: 120 },
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
  });
}

function cell(text: string, opts: { bold?: boolean; width?: number } = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 4 },
      left: { style: BorderStyle.SINGLE, size: 4 },
      right: { style: BorderStyle.SINGLE, size: 4 },
    },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold })],
        spacing: { after: 0 },
      }),
    ],
  });
}

/** Two-column label/value table (used for the fixed information blocks). */
function infoTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) => new TableRow({ children: [cell(label, { bold: true, width: 30 }), cell(value)] })),
  });
}

/** Signature line cell (editable area for the user to restyle). */
function signatureCell(label: string, width = 50): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 240, bottom: 240, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: " ", size: 28 })],
        spacing: { after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6 } },
      }),
      new Paragraph({ children: [new TextRun({ text: label, bold: true })], spacing: { before: 60 } }),
      new Paragraph({ children: [new TextRun({ text: "Saxiiid / Stamp:", italics: true })] }),
    ],
  });
}

/* ------------------------------------------------------------------ */
/* The template                                                         */
/* ------------------------------------------------------------------ */

/**
 * Heshiis Kiro — editable starter template. Content order mirrors the
 * interview so the generated document reads like the contract.
 */
export function buildHeshiisKiroTemplate(): Document {
  return new Document({
    creator: "Notary Doc Builder",
    title: "Heshiis Kiro — Template",
    description:
      "Word template uu isticmaalay xogta heshiiska. {{PLACEHOLDER}} tokens ha iska beddelin.",
    styles: {
      default: {
        document: { run: { font: "Arial", size: 22 }, paragraph: { spacing: { line: 276 } } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children: [
          /* ---- Title ---- */
          new Paragraph({
            children: [new TextRun({ text: "HESHIIS KIRO", bold: true, size: 40 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          line(`${T("NOOCA_KIRADA")} — ku salaysan ku', wuxuu ku qorayaa xaaladda kirada.`, {
            italic: true,
            align: AlignmentType.CENTER,
          }),

          /* ---- 1. Heshiiska ---- */
          heading("1. XOGTA HESHIISKA"),
          infoTable([
            ["Nambarka Tixraaca", T("REF_NUMBER")],
            ["Taariikhda Heshiiska", T("TAARIIKH")],
            ["Taariikhda Bilowga", T("TAARIIKH_BILOWGA")],
          ]),
          // Conditional: Kiro Xidhan shows the End Date, Kiro Furan removes it.
          marker(`{{IF:${T("KIRO_XIDHAN").replace(/[{}]/g, "")}}}`),
          line(`Taariikhda Dhammaadka: ${T("TAARIIKH_DHAMMAAD")}`),
          marker(`{{END:${T("KIRO_XIDHAN").replace(/[{}]/g, "")}}}`),
          line(`Shuruudaha Gaarka ah: ${T("SHURUUDAHA_GAARKA_AH")}`),

          /* ---- 2. Kireeyayaal (repeat block) ---- */
          heading("2. KIREEYAYAAL"),
          line(`Kireeyaha (si kooban): ${KIREYE_MAGAC} · ${KIREYE_TELEFOON} · Aqoonsi: ${KIREYE_AQOONSI} · ${KIREYE_CINWAAN}`),
          marker(`{{#${T("KIREYEYAYAAL").replace(/[{}]/g, "")}}}`),
          line(`Kireeye {{NUMBER}}: {{MAGAC}} · Telefoon: {{TELEFOON}} · Aqoonsi: {{AQOONSI}} · {{CINWAAN}}`),
          // A party that is NOT present is represented by its wakiil.
          marker("{{IF:WAKIIL}}"),
          line(`Wakiilka matalaya: {{WAKIIL_MAGAC}} — {{WAKIIL_TELEFOON}}`),
          marker("{{END:WAKIIL}}"),
          marker("{{IF:JOOGA}}"),
          line("Qofka wuxuu isaga jooga dhammaadka saxiixu.", { italic: true }),
          marker("{{END:JOOGA}}"),
          marker(`{{/${T("KIREYEYAYAAL").replace(/[{}]/g, "")}}}`),
          line("Wakiillo Kireeyayaal (hal wakiil hal kireeye uu matalo):"),
          marker("{{#WAKIILO_KIREEYAYAAL}}"),
          line(`{{NUMBER}}. {{MAGAC}} · {{TELEFOON}} — Matalaya: {{MATALAYA}}`),
          marker("{{/WAKIILO_KIREEYAYAAL}}"),

          /* ---- 3. Kiraystayaal (repeat block) ---- */
          heading("3. KIRAYSTAYAAL"),
          line(`Kiraystaha (si kooban): ${KIRAYSTE_MAGAC} · ${KIRAYSTE_TELEFOON} · Aqoonsi: ${KIRAYSTE_AQOONSI} · ${KIRAYSTE_CINWAAN}`),
          marker("{{#KIRAYSTAYAAL}}"),
          line(`Kirayste {{NUMBER}}: {{MAGAC}} · Telefoon: {{TELEFOON}} · Aqoonsi: {{AQOONSI}} · {{CINWAAN}}`),
          marker("{{IF:WAKIIL}}"),
          line(`Wakiilka matalaya: {{WAKIIL_MAGAC}} — {{WAKIIL_TELEFOON}}`),
          marker("{{END:WAKIIL}}"),
          marker(`{{/${T("KIRAYSTAYAAL").replace(/[{}]/g, "")}}}`),
          marker("{{#WAKIILO_KIRAYSTAYAAL}}"),
          line(`{{NUMBER}}. {{MAGAC}} · {{TELEFOON}} — Matalaya: {{MATALAYA}}`),
          marker("{{/WAKIILO_KIRAYSTAYAAL}}"),

          /* ---- 4. Guriga ---- */
          heading("4. FAAHFAAHINTA GURIGA"),
          infoTable([
            ["Nooca Guriga", T("GURI_NOOCA")],
            ["Goobta", T("GURI_GOOBTA")],
            ["Cinwaanka", T("GURI_CINWAAN")],
            ["Faahfaahin kale", T("GURI_SHARRAXAAD")],
            ["Qolada / la xiriira", T("GURI_QOLADA")],
          ]),

          /* ---- 5. Lacagta ---- */
          heading("5. LACAGTA & HABKA BIXINTA"),
          infoTable([
            ["Qiimaha Kirada Bishii", T("KIRADA_QIIMAHA")],
            ["Habka Bixinta", T("HABKA_BIXINTA")],
            ["Muddada Bixinta", T("MUDDADA_BIXINTA")],
            ["Bixinta Horay / Dambe", T("BIXINTA_HORE")],
            ["Faahfaahin kale", T("FAAHFAAHIN_LACAGTA")],
          ]),

          /* ---- 6. Deebaaji (conditional) ---- */
          marker("{{IF:DEEBAAJI_HAA}}"),
          heading("6. DEEBAAJI"),
          infoTable([
            ["Qiimaha Deebaajiga (bil kasta)", T("DEEBAAJI_QIIMAHA")],
            ["Shuruudaha Deebaajiga", T("DEEBAAJI_SHURUUDO")],
          ]),
          marker("{{END:DEEBAAJI_HAA}}"),

          /* ---- 7. Damiin (conditional) ---- */
          marker("{{IF:DAMIIN_HAA}}"),
          heading("7. DAMIIN (DAMMAANAD)"),
          infoTable([
            ["Magaca Damiinka", T("DAMIIN_MAGAC")],
            ["Telefoonka", T("DAMIIN_TELEFOON")],
            ["Aqoonsiga", T("DAMIIN_AQOONSI")],
            ["Cinwaanka", T("DAMIIN_CINWAAN")],
          ]),
          marker("{{END:DAMIIN_HAA}}"),

          /* ---- 8. Ogaysiinta ---- */
          heading("8. OGAYSIINTA"),
          infoTable([
            ["Mudada Ogaysiinta", T("OGAYSIIN_MUDADA")],
            ["Shuruudaha Joojinta", T("OGAYSIIN_SHURUUDAH")],
            ["Faahfaahin kale", T("OGAYSIIN_FAAHFAAHIN")],
          ]),

          /* ---- 9. Maragyo (repeat block) ---- */
          heading("9. MARAGYO"),
          marker("{{#MARAGYO}}"),
          line(`{{NUMBER}}. {{MAGAC}} · Telefoon: {{PHONE}} · Aqoonsi: {{ID}} · {{CINWAAN}}`),
          marker("{{/MARAGYO}}"),

          /* ---- 10. Shuruudo dheeraad ---- */
          heading("10. SHURUUDO DHEERAAD AH"),
          line(T("DHERAAD_SHURUUDO")),

          /* ---- Signature areas (editable by the user) ---- */
          heading("11. SAXIIXA DIIJADALADA"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [signatureCell("Saxiixa Kireeyaha"), signatureCell("Saxiixa Kiraystaha")] }),
              new TableRow({ children: [signatureCell("Magaca Kireeyaha: " + KIREYE_MAGAC), signatureCell("Magaca Kiraystaha: " + KIRAYSTE_MAGAC)] }),
            ],
          }),
          heading("12. SAXIIXA WAKIILKA"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [signatureCell(`Saxiixa Wakiilka — ${WAKIIL_MAGAC} (${WAKIIL_TELEFOON})`, 100)],
              }),
            ],
          }),
          heading("13. MARAGYO (SAXIIX)"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [signatureCell("Marag 1"), signatureCell("Marag 2")] }),
            ],
          }),
          line(
            "Xogta dhabta ah waa in lagu buuxiyo marka heshiiska la abuurayo — template-ka waa iska leh user-ka, qoraalka sharciga wuxuu beddeli karaa.",
            { italic: true },
          ),
        ],
      },
    ],
  });
}

/** Bytes of the editable starter template (real .docx). */
export async function buildHeshiisKiroTemplateBytes(): Promise<Uint8Array> {
  return await Packer.toBuffer(buildHeshiisKiroTemplate());
}

/** Browser download of the starter template (opens/edits in Word). */
export async function buildHeshiisKiroTemplateBlob(): Promise<Blob> {
  return await Packer.toBlob(buildHeshiisKiroTemplate());
}

/** Canonical tokens the generated template MUST contain (never renamed). */
export function requiredTemplateTokens(): string[] {
  return HESHIIS_KIRO_PLACEHOLDERS.filter(
    (s) => s.kind === "placeholder" || s.kind === "computed" || s.kind === "block",
  ).map((s) => s.token);
}

/** Suggested file name of the system-generated starter template. */
export const TEMPLATE_FILE_NAME = "heshiis_kiro_template.docx";