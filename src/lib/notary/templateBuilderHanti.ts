/**
 * KALA IIBSI HANTI — THE CANONICAL PROPERTY-SALE TEMPLATE BUILDER (v2).
 *
 * ONE .docx for all three property subtypes (Dhul Banaan, Guri, Beer).
 * The subtype never changes the template FILE — it changes what the engine
 * PRINTS, through {{IF:HANTI_DHUL_BANAAN}} / {{IF:HANTI_GURI}} /
 * {{IF:HANTI_BEER}} condition flags that already exist in the registry.
 *
 * The legal wording is NOT invented. The five numbered clauses and the
 * closing attestation are the office's own paper
 * (Ref/Dpn/MG/000432/08/026, transcribed verbatim in
 * scanEvidence.DHUL_BANAAN_SCAN). The ONLY differences from the paper are
 * the placeholders where the paper prints a name or a figure.
 *
 * Design rules held here:
 *   - Tokens sit in ONE text run so the scanner sees each whole.
 *   - Repeat/conditional markers sit ALONE in their own paragraph.
 *   - {{REF_NUMBER}} is printed as-is: the pipeline already resolves it to
 *     the composed "Ref/Dpn/MG/001/01/26" — never prefix it again.
 *   - Subtype conditionals never nest markers inside table cells: the
 *     block pass walks body paragraphs, so branch lines stay in the body.
 */

import {
  AlignmentType,
  BorderStyle,
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
import { tokenString } from "./placeholderRegistry";

/** {{NAME}} for a registry token — typo-proof by construction. */
const T = (token: string): string => tokenString(token);

/** Strip braces so a token can sit inside {{IF:...}} / {{#...}}. */
const N = (token: string): string => tokenString(token).replace(/[{}]/g, "");

/* ------------------------------------------------------------------ */
/* Legal wording — from the office's own paper, VERBATIM.              */
/* ------------------------------------------------------------------ */

const SCAN = {
  /** The title's district line + area subtitle — Dhul Banaan's own paper. */
  titleDistrict: `Oo Ku Yaalla Degmada ${T("DEGMADA")}`,
  subTitle: `Cabirkiisuna Yahay ( ${T("CABBIRKA")} ).`,
  /** The intro that opens the numbered clauses (date = the document date). */
  intro: `Hadii aanu nahay dhinacyadan sare ku xusan maanta oo ay taarikhdu tahay ${T("TAARIIKH")} xafiiskan hortiisa waxaanu ku wada galnay heshiiska iibka dhulkan banaan oo u dhacay sidan:-`,

  /* ---- clause 1: the seller's attestation ---------------------- */
  c1: `Anigoo ah ${T("IIBIYE_WORDS")} dhulkan waxaan cadaynayaa inaan dhulkaygan sare ku faahfaahsan ka iibiyay ${T("IIBSADAHA_MAGAC")} kana siiyay Lacag dhan ${T("QIIMAHA_HANTIDA")} ${T("QIIMAHA_QORAAL")}, dhamaan lacagtana kaga wada qaatay naqad (Xafiiskan Dhexiisa) wax baaqi ah oo igu hadhsanina aanay jirin.`,

  /* ---- clause 2: the buyer's attestation — NO name, as printed -- */
  c2: `Anigoo ah ${T("IIBSADE_WORDS")} dhulkan waxaan cadaynayaa inaan dhulkan iska soo eegay, cabirtay kuna qancay kuna iibsaday lacagtan sare ku xusan oo naqad ah.`,

  /* ---- clause 3: delivery — "manta", the document date ---------- */
  c3: `Laga Bilaabo manta iyo wixii ka dambeeya mulkigii dhulkani wuxuu ku wareegay oo yeelatay Iibsato ${T("IIBSADAHA_MAGAC")}.`,

  /* ---- clause 4: DAMAANAD — the guarantor's attestation. ONE slot,
     ONE derived name: a third party when the notary chose qof 3aad, or
     the sellers themselves when they guarantee their own sale. */
  c4: `Anigoo ah Iibisada Dhulka ${T("DAMIIN_MAGACA")} hadii heshiiska iibka dhulkan dhinacayga wax kasoo noqdaan sida lahaanshaha, Nootaayada, iyo dhamaan wixii khilaafaya heshiiskan aniga ayaa la iiraacayaa oo ka masuula, bixinayana hantidan iyo kharash wixii raacayba anigoo isku damiinanaya hantidayda guud ee aan gaarka u leeyahay guurto iyo ma guurtaba.`,

  /* ---- clause 5: closing (no heading on the paper) -------------- */
  c5: `Sidana waxa aamu ku saxeexnay xafiiska nootaayada sharciga hortiisa, anaga oo miyir iyo maanba qabna xiskayaguna dhan yahay.`,
} as const;

/**
 * Page-2 attestation — Hanti's OWN closing wording, distinct from Kiro's
 * (scan: "in kala iibkani u dhacay", not Kiro's "in heshiiskani-kirada ahi
 * u dhacay"). The notary's name is FIXED template text — the office's
 * decision, not a form field.
 */
const CLOSING = {
  sellerHeading: "Magaca Iyo Saxeexa Iibisada Dhulka.",
  buyerHeading: "Magaca Iyo Saxeexa Iibsatada Dhulka .",
  witnessesHeading: "Maragyo Goob-Joogayaal Ah",
  attestationHeading: "Cadaynta Xafiiska",
  attestationBody:
    ": -Xafiisku waxa uu cadaynayaa in kala iibkani u dhacay sifo sharciga waafaqaan, waafaqaan laguna hor saxeexay laguna camal fali doono.",
  notaryName: "(Gar. Maxamed Cumar Cabdillaahi)",
  notaryTitle: "Sarkaalka Xafiiska Nootaayada Sharciga ah EeDaloodho",
} as const;

/* ------------------------------------------------------------------ */
/* Small builders                                                      */
/* ------------------------------------------------------------------ */

/** A marker-only paragraph ({{#BLOCK}}, {{/BLOCK}}, {{IF:…}}, {{END:…}}). */
function marker(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true })],
    spacing: { after: 80 },
  });
}

/** Static legal text with {{TOKENS}} embedded, justified like the paper. */
function body(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 300 },
  });
}

/** Underlined bold heading — matches the scan's styling. */
function clauseTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, underline: {} })],
    spacing: { before: 160, after: 100 },
  });
}

/** Document title — centred, bold, underlined. */
function docTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, underline: {}, size: 32 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
  });
}

/** The scan's party line: name left, phone right-tabbed. */
function partyLine(name: string, phone: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children:
      phone !== ""
        ? [
            new TextRun({ text: name }),
            new TextRun({ children: [new Tab()] }),
            new TextRun({ text: `Tell ${phone}` }),
          ]
        : [new TextRun({ text: name })],
    spacing: { after: 60 },
  });
}

/** Centred heading for page-2 blocks (witnesses, attestation). */
function centredHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, underline: {}, size: 24 })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 120 },
  });
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "auto" } as const;

/** The office's two-column label | value table — as the paper prints them. */
function kvTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: BORDER,
      bottom: BORDER,
      left: BORDER,
      right: BORDER,
      insideHorizontal: BORDER,
      insideVertical: BORDER,
    },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [new TextRun({ text: label, bold: true })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [new TextRun({ text: value })],
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

/* ------------------------------------------------------------------ */
/* The canonical document                                              */
/* ------------------------------------------------------------------ */

/**
 * ONE template for all subtypes. Everything subtype-specific sits inside a
 * subtype conditional, so a Guri document prints nothing Beer-ish.
 */
export function buildHantiCanonicalTemplate(): Document {
  return new Document({
    creator: "Notary Doc Builder",
    title: "Kala Iibsi Hanti — Canonical Template (Dhul Banaan · Guri · Beer)",
    description:
      "Word template hal ah oo Hanti dhan. {{PLACEHOLDER}} ha iska beddelin — engine-ku wuxuu go'aanisaa nooca iyo qodobada.",
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
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Daloodho Public Notary (Qoraal Hubanti Ah Oo sugan)  ",
                  }),
                  // REF_NUMBER resolves to the FULL composed reference —
                  // the pipeline writes it, never prefix it here.
                  new TextRun({ text: T("REF_NUMBER") }),
                  new TextRun({ text: "  Page " }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: [
          /* ---- header line: Ref | date — the scan's own shape ---- */
          new Paragraph({
            tabStops: [
              { type: TabStopType.LEFT, position: 0 },
              { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
            ],
            children: [
              new TextRun({
                text: T("REF_NUMBER"),
                bold: true,
                italics: true,
                underline: {},
              }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({
                text: `Taariikh: ${T("TAARIIKH")}`,
                bold: true,
                italics: true,
                underline: {},
              }),
            ],
            spacing: { after: 120 },
          }),

          /* ---- title: the subtype is DATA, never hard-coded ------- */
          docTitle(`Kala Iibsi ${T("NOOCA_HANTIDA")}`),
          // The district + area lines belong to the Dhul Banaan paper
          // (the other two print their own cabbir in the property table).
          marker(`{{IF:${N("HANTI_DHUL_BANAAN")}}}`),
          docTitle(SCAN.titleDistrict),
          docTitle(SCAN.subTitle),
          marker(`{{END:${N("HANTI_DHUL_BANAAN")}}}`),

          /* ---- page-1 party block: sellers, then buyers ---------- */
          clauseTitle("MAGACA IIBISADA DHULKA"),
          // The single-row summary line prints first (the office's "si
          // kooban" line); the repeat block then prints every seller.
          body(
            `Iibiyaha (si kooban): ${T("IIBIYAHA_MAGAC")} · Degmada: ${T("IIBIYAHA_DEGAN")} · Telefoon: ${T("IIBIYAHA_TELEFOON")}`,
          ),
          marker(`{{#${N("IIBIYEYAAL")}}}`),
          body(
            `Iibiyaha {{NUMBER}}: {{MAGAC}} · Degmada: {{DEGAN}} · Telefoon: {{TELEFOON}} · Doorarka: {{DOORO}}`,
          ),
          marker(`{{IF:WAKIIL}}`),
          body(`Wakiilka matalaya: {{WAKIIL_MAGAC}} ({{WAKIIL_NOOCA_WAKIILKA}})`),
          marker(`{{END:WAKIIL}}`),
          marker(`{{/${N("IIBIYEYAAL")}}}`),
          marker(`{{IF:WAKIILO_IIBIYEYAAL}}`),
          body(
            `Wakiillo Iibiyayaasha (hal wakiil hal iibiy oo uu matalo):`,
          ),
          marker(`{{END:WAKIILO_IIBIYEYAAL}}`),
          marker(`{{#${N("WAKIILO_IIBIYEYAAL")}}}`),
          body(`{{NUMBER}}. {{MAGAC}} ({{NOOCA_WAKIILKA}}) — Matalaya: {{MATALAYA}}`),
          marker(`{{/${N("WAKIILO_IIBIYEYAAL")}}}`),

          clauseTitle("MAGACA IIBSATADA DHULKA"),
          body(
            `Iibsadaha (si kooban): ${T("IIBSADAHA_MAGAC")} · Degmada: ${T("IIBSADAHA_DEGAN")} · Telefoon: ${T("IIBSADAHA_TELEFOON")}`,
          ),
          marker(`{{#${N("IIBSADAYAAL")}}}`),
          body(
            `Iibsade {{NUMBER}}: {{MAGAC}} · Degmada: {{DEGAN}} · Telefoon: {{TELEFOON}}`,
          ),
          marker(`{{IF:WAKIIL}}`),
          body(`Wakiilka matalaya: {{WAKIIL_MAGAC}} ({{WAKIIL_NOOCA_WAKIILKA}})`),
          marker(`{{END:WAKIIL}}`),
          marker(`{{/${N("IIBSADAYAAL")}}}`),
          marker(`{{#${N("WAKIILO_IIBSADAYAAL")}}}`),
          body(`{{NUMBER}}. {{MAGAC}} ({{NOOCA_WAKIILKA}}) — Matalaya: {{MATALAYA}}`),
          marker(`{{/${N("WAKIILO_IIBSADAYAAL")}}}`),

          /* ---- the group — only when there is one ---------------- */
          marker(`{{IF:KOOXAHA_HAL}}`),
          clauseTitle("KOOXA / QOYSKA IIBIYAHA"),
          marker(`{{END:KOOXAHA_HAL}}`),
          marker(`{{IF:KOOXAHA_BADAN}}`),
          clauseTitle("KOOXAHA / QOYSKU IIBIYAAL"),
          marker(`{{END:KOOXAHA_BADAN}}`),
          marker(`{{#${N("KOOXAHA")}}}`),
          body(`{{NUMBER}}. {{MAGAC}}`),
          marker(`{{/${N("KOOXAHA")}}}`),

          /* ---- Faahfaahinta: subtype-conditional property facts -- */
          clauseTitle("Faahfaahinta Hantida Iyo Qiimaha La kala siistay."),

          marker(`{{IF:${N("HANTI_DHUL_BANAAN")}}}`),
          kvTable([
            ["Degmada", T("DEGMADA")],
            ["Xaafada / Deegaanka", T("XAAFADA")],
            ["Cabbirka", T("CABBIRKA")],
            ["Jiho Waqooyi", T("JIHO_WAQOOYI")],
            ["Jiho Koonfur", T("JIHO_KOONFUR")],
            ["Jiho Bari", T("JIHO_BARI")],
            ["Jiho Galbeed", T("JIHO_GALBEED")],
            ["Soohdimaha (Xadka)", T("SOOHDIMADA")],
            ["Sida Hantida Loo Helay", T("SIDA_HANTIDA")],
          ]),
          // The reference is a BRANCH, not a field: one side of the
          // notary's answer or the other — never both, never neither.
          marker(`{{IF:${N("HANTI_TIXRAACA")}}}`),
          body(`Lambarka / Tixraaca Hantida: ${T("LAMBARKA_TIXRAACA")}`),
          marker(`{{END:${N("HANTI_TIXRAACA")}}}`),
          marker(`{{IF:${N("HANTI_CALAAMAD_DHEERAAD")}}}`),
          body(`Calaamad Dheeraad ah: ${T("CALAAMAD_DHEERAAD")}`),
          marker(`{{END:${N("HANTI_CALAAMAD_DHEERAAD")}}}`),
          marker(`{{END:${N("HANTI_DHUL_BANAAN")}}}`),

          marker(`{{IF:${N("HANTI_GURI")}}}`),
          kvTable([
            ["Nooca Guriga", T("GURI_NOOCA")],
            ["Goobta Guriga", T("GURI_GOOBTA")],
            ["Degmada / Xaafadda", T("GURI_DEGMADA_XAAFADDA")],
            ["Cabbirka Guriga", T("GURI_CABBIRKA")],
            ["Xuduudaha Guriga", T("GURI_XUDUUDAAHA")],
            ["Lambar / Aqoonsi Lahaansho", T("GURI_LAMBARKA_LAHAANSHO")],
            ["Faahfaahin Dheeraad ah", T("GURI_FAAHFAAHIN")],
          ]),
          marker(`{{END:${N("HANTI_GURI")}}}`),

          marker(`{{IF:${N("HANTI_BEER")}}}`),
          kvTable([
            ["Magaca Beeraha", T("BEER_MAGAC")],
            ["Nooca Beeraha", T("BEER_NOOCA")],
            ["Goobta Beeraha", T("BEER_GOOBTA")],
            ["Degmada / Xaafadda", T("BEER_DEGMADA_XAAFADDA")],
            ["Cabbirka Beeraha", T("BEER_CABBIRKA")],
            ["Jiho / Xad 1", T("BEER_JIHO_1")],
            ["Jiho / Xad 2", T("BEER_JIHO_2")],
            ["Xuduudaha Beeraha", T("BEER_XUDUUDAAHA")],
            ["Shayada Ceelka", T("BEER_SHAYADA_CEELKA")],
            ["Lambar / Aqoonsi Lahaansho", T("BEER_LAMBARKA_LAHAANSHO")],
            ["Faahfaahin Dheeraad ah", T("BEER_FAAHFAAHIN")],
          ]),
          marker(`{{END:${N("HANTI_BEER")}}}`),

          /* ---- the money: one number, one words-derivation ------- */
          clauseTitle("QIIMAHA & LACAGTA"),
          kvTable([
            ["Qiimaha Hantida", T("QIIMAHA_HANTIDA")],
            ["Lacagta La Bixiyay", T("LACAGTA_BIXIYAY")],
            // Derived as price − paid: the document can never contradict
            // the two numbers it was computed from. $0 when nothing is owed.
            ["Lacagta Hadhay", T("LACAGTA_HADHAY")],
            ["Qiimaha Qoraal", T("QIIMAHA_QORAAL")],
          ]),
          body(
            `Qiimaha aanu kala Siisanay waa ${T("QIIMAHA_HANTIDA")} ${T("QIIMAHA_QORAAL")}.`,
          ),

          /* ---- the three independent gated lists ----------------- */
          marker(`{{IF:${N("SAWIRRO_MA_JIRAAN")}}}`),
          clauseTitle("SAWIRKA"),
          marker(`{{#${N("SAWIRRADA")}}}`),
          body(`{{NUMBER}}. {{SHAKHSIGA}}`),
          body(`{{CAPTION}}`),
          marker(`{{/${N("SAWIRRADA")}}}`),
          marker(`{{END:${N("SAWIRRO_MA_JIRAAN")}}}`),

          marker(`{{IF:${N("SAXEEXO_MA_JIRAAN")}}}`),
          clauseTitle("SAXEEXAYAASHA"),
          marker(`{{#${N("SAXEEXAYAASHA")}}}`),
          body(`{{NUMBER}}. {{PREFIX}} {{SHAKHSIGA}}`),
          marker(`{{/${N("SAXEEXAYAASHA")}}}`),
          marker(`{{END:${N("SAXEEXO_MA_JIRAAN")}}}`),

          marker(`{{IF:${N("SHAXADO_MA_JIRAAN")}}}`),
          clauseTitle("SHAXADAYAHA IYO WARQADAH"),
          marker(`{{#${N("SHAXADAHA")}}}`),
          body(`{{NUMBER}}. {{TIXRAACA}} — {{NOOCA_SHAXADAHA}}`),
          marker(`{{/${N("SHAXADAHA")}}}`),
          marker(`{{END:${N("SHAXADO_MA_JIRAAN")}}}`),

          /* ---- the guarantee's DETAILS: §18 keeps the two branches
             separate — qof 3aad prints its own name and phone; iibiyaha
             prints the sellers' own guarantee line. Nothing else. */
          marker(`{{IF:${N("DAMIIN_QOF_3AAD")}}}`),
          clauseTitle("DAMMAANADDA (DAMIIN)"),
          kvTable([
            ["Magaca Damiinka", T("DAMIIN_MAGAC")],
            ["Telefoonka Damiinka", T("DAMIIN_TELEFOON")],
            ["Gurmadka Dammaanadda", T("DAMIIN_GURMAD")],
          ]),
          marker(`{{END:${N("DAMIIN_QOF_3AAD")}}}`),
          marker(`{{IF:${N("DAMIIN_IIBIYAHA")}}}`),
          clauseTitle("DAMMAANADDA (DAMIIN)"),
          body(
            `${T("NOOCA_DAMIINTA")} — dammaanadda waxaa ku dhegan iibiyaha / iibiyayaasha.`,
          ),
          marker(`{{END:${N("DAMIIN_IIBIYAHA")}}}`),

          /* ---- the clause run: the 5 scan-verbatim clauses ------- */
          body(SCAN.intro),
          body(`1. IIBISADA DHULKA: ${SCAN.c1}`),
          body(`2. IIBSATADA DHULKAN: ${SCAN.c2}`),
          body(`3. ${SCAN.c3}`),
          // Clause 4 prints UNCONDITIONALLY, exactly as the paper does:
          // one derived name covers qof 3aad / iibiyaha / ma_jiro.
          body(`4. DAMAANAD:- ${SCAN.c4}`),
          body(`5. ${SCAN.c5}`),

          /* ---- witnesses — optional, own heading ----------------- */
          centredHeading(CLOSING.witnessesHeading),
          marker(`{{#${N("MARAGYO")}}}`),
          partyLine(`{{NUMBER}}. {{MAGAC}}`, "{{TELEFOON}}"),
          marker(`{{/${N("MARAGYO")}}}`),

          /* ---- page 2: signatures — ONE block, ONE run ----------- */
          // The scan prints two headings (seller / buyer), but the registry
          // has ONE {{#SAXEEXAYAASHA}} list whose rows carry their own
          // {{PREFIX}}. Repeating the block would print everyone twice.
          marker(`{{IF:${N("SAXEEXO_MA_JIRAAN")}}}`),
          clauseTitle(CLOSING.sellerHeading),
          clauseTitle(CLOSING.buyerHeading),
          marker(`{{#${N("SAXEEXAYAASHA")}}}`),
          partyLine(`❖ {{NUMBER}}. {{PREFIX}} {{SHAKHSIGA}}`, ""),
          marker(`{{/${N("SAXEEXAYAASHA")}}}`),
          marker(`{{END:${N("SAXEEXO_MA_JIRAAN")}}}`),

          // A wakiil signs only when somebody was actually represented —
          // exactly what the attendance answer said.
          marker(`{{IF:IIBIYAHA_WAKIIL}}`),
          body(
            `Saxiixa Wakiilka Iibiyaha: ${T("IIBIYAHA_WAKIIL_MAGAC")} — Saxiiid / Stamp:`,
          ),
          marker(`{{END:IIBIYAHA_WAKIIL}}`),
          marker(`{{IF:IIBSADAHA_WAKIIL}}`),
          body(
            `Saxiixa Wakiilka Iibsadaha: ${T("IIBSADAHA_WAKIIL_MAGAC")} — Saxiiid / Stamp:`,
          ),
          marker(`{{END:IIBSADAHA_WAKIIL}}`),
          marker(`{{IF:${N("DAMIIN_QOF_3AAD")}}}`),
          body(`Saxiixa Damiinka: ${T("DAMIIN_MAGAC")} — Saxiiid / Stamp:`),
          marker(`{{END:${N("DAMIIN_QOF_3AAD")}}}`),
          marker(`{{#${N("MARAGYO")}}}`),
          body(`Marag {{NUMBER}}: {{MAGAC}} — Saxiiid / Stamp:`),
          marker(`{{/${N("MARAGYO")}}}`),

          /* ---- office attestation — the document ends here ------- */
          body(`${CLOSING.attestationHeading}${CLOSING.attestationBody}`),
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

/** Bytes of the canonical starter template (real .docx). */
export async function buildHantiCanonicalBytes(): Promise<Uint8Array> {
  return await Packer.toBuffer(buildHantiCanonicalTemplate());
}

/** Browser download of the canonical starter template. */
export async function buildHantiCanonicalBlob(): Promise<Blob> {
  return await Packer.toBlob(buildHantiCanonicalTemplate());
}
