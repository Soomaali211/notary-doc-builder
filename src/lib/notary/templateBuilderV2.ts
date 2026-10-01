/**
 * TEMPLATE v2 — heshiis Kiro Guri Xaas oo dhab ah.
 *
 * Qaabka wuxuu ka yimid tusaalaha dhab ee Daloodho Public Notary Office:
 * waa DUKUMEENTI SARA SHARCIYEED, ma aha database report. Miis ma jiro
 * qaybta xogta — xogtu waxay ku dhex jirtaa QORAALKA heshiiska, oo qodobado
 * sharciyeed lagu qabtay (1., 2., 3. …).
 *
 * Qoraalka sharciyeed ee joogtada ah waa STATIC text; xogga isbedbedesha
 * oo keliya ayaa placeholder ({{...}}). Laakiin MUHIIM: aan la abla marin
 * qoraal sharci cusub — waxaa la soo qaatay tusaalaha dhabta ah sidaa.
 *
 * Do NOT rename any placeholder — names come from placeholderRegistry.
 * Repeat {{#BLOCK}}…{{/BLOCK}} and conditional {{IF:FLAG}}…{{END:FLAG}}
 * markers sit ALONE so the engine can expand or remove whole sections.
 */

import {
  AlignmentType,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  Tab,
  TextRun,
  TabStopType,
  TabStopPosition,
} from "docx";
import { HESHIIS_KIRO_PLACEHOLDERS, tokenString } from "./placeholderRegistry";

/** {{NAME}} for a registry token — typo-proof by construction. */
const T = (token: string): string => tokenString(token);

/** Strip braces from a token so it can sit inside {{IF:...}} / {{#...}}. */
const N = (token: string): string => tokenString(token).replace(/[{}]/g, "");

/* ------------------------------------------------------------------ */
/* Legal wording — lifted from the reference document, NOT invented.    */
/* ------------------------------------------------------------------ */

const LEGAL = {
  // Reference item 1
  c1a: "Qiimaha Bishii Gurigu waa",
  // Reference item 2
  c2a: "Taariikhda kiradu ka bilaabantay waa",
  // Reference item 3
  c3a: "Mudada Heshiiska Wejiga Koowaad waa",
  // Reference item 4
  c4a: "Habka bixinta kiradu waa",
  c4b: "Bil walbana Lacagta kirada waxaa uu qadimayaa bisha",
  // Reference item 5 — damage clause
  c5a:
    "Haddii Kiraysadu Guriga u baahato, Waxay Kiraystaha siinaysaa 2 Bilood Ogaysiisa,",
  c5b:
    "Waxaa shardi u ah in kiraystuhu fuliyo dhammaan qodobada heshiiska. Sidoo kale, haddii kiraystuhu iskii uga maarmo guriga, wuxuu ogeysiinta bixinayaa bil ka hor.",
  // Reference item 6 — non-division clause
  c6:
    "Kireystuhu Gurigan masii kireyn karo Qayb ahaan iyo gebi ahaan toona, waxaana ka reeban in lagu sameeyo Guriga Dhexdisa waxaabaha dintooda suuban, oo loo reebtay lamana dhigi karo Wax Hub ah, Walxo qarxa iyo Qalab Ciidan aan sharciyaysnayn, iyo inaanay jaarku kasoo cabanin.",
  // Reference item 7 — landlord declaration
  c7:
    "Haddii aan ahay Kireystaha guriga, wuxaan cadaynayaa in aan heshiiskan raali ka ahay, Masuulka ka ahay wixii khasaare soo gaadha mudada aan ku jiro Guriga, anigoo diyaar u ah in aan sameeyo sidistina ka dhigo marka laga reebo masibbooyinka dabiciiga ah biyaha iyo laydhka wixii aan isticmaalo. Aniga ayaa iska bixinay bill kasta, markaan ka baxayana waxaan balanqaadayaa inaan lacagta laydhka sii bixin doono.",
  // Reference item 8 — effective date
  c8:
    "Heshiiskani Waxaa uu Dhaqan galaya isla Maanta, Dhina-cyada Midkoodna Kama Bixi karo iyada oo aan la dabaaqin qodobada Heshiiskan.",
  // Reference item 10 — closing
  c10:
    "Sidana waxaanu ku saxeexnay xafiiska nootaayada sharciga ah hortisa, anagoo miyir iyo maan ba qabna, xiskayaguna dhan yahay.",
  // Reference closing — the document ENDS with these three lines.
  closingTitle: "Cadaynta Xafiiska:",
  closingBody:
    "Xafiisku waxa uu cadaynayaa in heshiiskani-kirada ahi u dhacay sifo sharciga waafaqsan, waafaqaan laguna hor saxeexay laguna camal-fali doono.",
  closingSeal: "(Sarkaalka Xafiiska Nootaayada Sharciga ah Ee Daloodho)",
} as const;

/* ------------------------------------------------------------------ */
/* Small builders                                                      */
/* ------------------------------------------------------------------ */

/** A marker-only paragraph ({{#BLOCK}}, {{/BLOCK}}, {{IF:…}}, {{END:…}}). */
function marker(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true })], spacing: { after: 80 } });
}

/**
 * A body paragraph: STATIC legal text with {{PLACEHOLDERS}} embedded.
 * Tokens always live inside ONE text run so the scanner finds them whole.
 */
function body(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 300 },
  });
}

/** An underlined, bold section title (matches the reference's styling). */
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
    spacing: { after: 200 },
  });
}

/**
 * One party line: "❖ <name>" left, "Tell <phone>" right-tabbed — the shape
 * used by the reference document. Both halves stay in one text run group so
 * the scanner sees each token whole.
 */
function partyLine(namePart: string, phonePart: string): Paragraph {
  // When the phone token is absent (an absent party — their phone is shown
  // on the wakiil line instead), emit no dangling "Tell ".
  const children = phonePart
    ? [
        new TextRun({ text: namePart }),
        new TextRun({ children: [new Tab()] }),
        new TextRun({ text: `Tell ${phonePart}` }),
      ]
    : [new TextRun({ text: namePart })];
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children,
    spacing: { after: 60 },
  });
}

/**
 * A repeat-row party line. An absent party has no name of its own, so the
 * row must show ONLY the representative who stands in — never a dangling
 * "❖ 2. Tell" with no name. Returns two paragraphs: the name row (skipped
 * when empty by the renderer's own empty-token rule) and the wakiil row.
 */

/** Small centred heading used for "QODOBADA HESHIISKA" etc. */
function centredHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, underline: {}, size: 24 })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 140 },
  });
}

/* ------------------------------------------------------------------ */
/* The template                                                         */
/* ------------------------------------------------------------------ */

/**
 * Heshiis Kiro Guri Xaas — v2 legal-document template.
 * Continuous prose with numbered clauses; no data tables anywhere.
 */
export function buildHeshiisKiroTemplateV2(): Document {
  return new Document({
    creator: "Notary Doc Builder",
    title: "Heshiis Kiro Guri Xaas — Template",
    description:
      "Word template u eeg qoraal sharciyeed oo joogto. {{PLACEHOLDER}} tokens ha iska beddelin.",
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
                children: [new TextRun({ children: [PageNumber.CURRENT] })]
              }),
            ],
          }),
        },
        children: [
          /* ---- Reference header (Ref | month | date) ---- */
          new Paragraph({
            tabStops: [
              { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
              { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
            ],
            children: [
              new TextRun({ text: `Ref/Dpn/HK/${T("REF_NUMBER")}` }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: T("MAALINTA") }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: `Taariikh: ${T("TAARIIKH")}` }),
            ],
            spacing: { after: 160 },
          }),

          // The subtype is DATA, never hard-coded: {{NOOCA_KIRADA}} renders
          // "Guri Xaas" / "Qol Meherad" / "Jiingad" from the form, so a
          // qol-meherad contract can never be titled "Guri Xaas".
          docTitle(`HESHIIS KIRO ${T("NOOCA_KIRADA")}.`),

          /* ---- Kireeye: SINGULAR or PLURAL, never both (no duplicate) ----
           {{IF:KIREYE_HAL}}        → one person, singular label
           {{IF:KIREEYAYAAL_BADAN}}  → repeat block, plural label */
          marker(`{{IF:${N("KIREYE_HAL")}}}`),
          clauseTitle("Magaca Kireeysada Guriga"),
          // Present → print the person. Absent → the line is skipped entirely
          // (no empty "❖ Tell" remnant).
          marker(`{{IF:KIREEYE_JOOGA}}`),
          partyLine(`❖ ${T("KIREYE_MAGAC")}`, T("KIREYE_TELEFOON")),
          marker("{{END:KIREEYE_JOOGA}}"),
          // Absent → the person is STILL named, with the representative who
          // acts for them on the next line.
          marker("{{IF:KIREEYE_WAKIIL}}"),
          partyLine(`❖ ${T("KIREYE_MAGAC")}`, T("KIREYE_TELEFOON")),
          new Paragraph({
            children: [
              new TextRun({ text: "    Wakiilka: " }),
              new TextRun({ text: "{{KIREEYE_WAKIIL_MAGAC}}", bold: true }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: "Tell {{KIREEYE_WAKIIL_TELEFOON}}" }),
            ],
            spacing: { after: 60 },
          }),
          marker("{{END:KIREEYE_WAKIIL}}"),
          marker(`{{END:${N("KIREYE_HAL")}}}`),

          marker(`{{IF:${N("KIREEYAYAAL_BADAN")}}}`),
          clauseTitle("Magacyada Kireeyayaasha Guriga"),
          marker(`{{#${N("KIREYEYAYAAL")}}}`),
          // Present row: the person's own name and phone.
          marker("{{IF:JOOGA}}"),
          partyLine("❖ {{NUMBER}}. {{MAGAC}}", "{{TELEFOON}}"),
          marker("{{END:JOOGA}}"),
          // Absent row: the representative bound to THIS row stands in.
          marker("{{IF:WAKIIL}}"),
          // The person keeps their OWN name; the representative who acts
          // for them is printed on its own line and NEVER replaces them.
          partyLine("❖ {{NUMBER}}. {{MAGAC}}", ""),
          new Paragraph({
            children: [
              new TextRun({ text: "    Wakiilka: " }),
              new TextRun({ text: "{{WAKIIL_MAGAC}}", bold: true }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: "Tell {{WAKIIL_TELEFOON}}" }),
            ],
            spacing: { after: 60 },
          }),
          marker("{{END:WAKIIL}}"),
          marker(`{{/${N("KIREYEYAYAAL")}}}`),
          marker(`{{END:${N("KIREEYAYAAL_BADAN")}}}`),

          /* ---- Kirayste: same singular/plural rule ---- */
          marker(`{{IF:${N("KIRAYSTE_HAL")}}}`),
          clauseTitle("Magaca Kiraystaha Guriga"),
          marker("{{IF:KIRAYSTE_JOOGA}}"),
          partyLine(`❖ ${T("KIRAYSTE_MAGAC")}`, T("KIRAYSTE_TELEFOON")),
          marker("{{END:KIRAYSTE_JOOGA}}"),
          marker("{{IF:KIRAYSTE_WAKIIL}}"),
          // The person is STILL named; the representative appears below.
          partyLine(`❖ ${T("KIRAYSTE_MAGAC")}`, T("KIRAYSTE_TELEFOON")),
          new Paragraph({
            children: [
              new TextRun({ text: "    Wakiilka: " }),
              new TextRun({ text: "{{KIRAYSTE_WAKIIL_MAGAC}}", bold: true }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: "Tell {{KIRAYSTE_WAKIIL_TELEFOON}}" }),
            ],
            spacing: { after: 60 },
          }),
          marker("{{END:KIRAYSTE_WAKIIL}}"),
          marker(`{{END:${N("KIRAYSTE_HAL")}}}`),

          marker(`{{IF:${N("KIRAYSTAYAAL_BADAN")}}}`),
          clauseTitle("Magacyada Kiraystayaasha Guriga"),
          marker(`{{#${N("KIRAYSTAYAAL")}}}`),
          marker("{{IF:JOOGA}}"),
          partyLine("❖ {{NUMBER}}. {{MAGAC}}", "{{TELEFOON}}"),
          marker("{{END:JOOGA}}"),
          marker("{{IF:WAKIIL}}"),
          // The person keeps their OWN name; the representative who acts
          // for them is printed on its own line and NEVER replaces them.
          partyLine("❖ {{NUMBER}}. {{MAGAC}}", ""),
          new Paragraph({
            children: [
              new TextRun({ text: "    Wakiilka: " }),
              new TextRun({ text: "{{WAKIIL_MAGAC}}", bold: true }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: "Tell {{WAKIIL_TELEFOON}}" }),
            ],
            spacing: { after: 60 },
          }),
          marker("{{END:WAKIIL}}"),
          marker(`{{/${N("KIRAYSTAYAAL")}}}`),
          marker(`{{END:${N("KIRAYSTAYAAL_BADAN")}}}`),

          // The property — inline sentence, as in the reference. The property
          // type comes from {{GURI_NOOCA}} (the guriga section's own field),
          // so it tracks the same answer without being hard-coded.
          body(
            `Waa ${T("GURI_NOOCA")} ku yaalla ${T("GURI_GOOBTA")}, ${T("GURI_SHARRAXAAD")}`,
          ),

          /* ---- Numbered legal clauses ---- */
          centredHeading("QODOBADA HESHIISKA"),

          body(`{{CLAUSE_NO}}. ${LEGAL.c1a} ${T("KIRADA_QIIMAHA")} ${T("KIRADA_QIIMAHA_QORAAL")}.`),

          body(`{{CLAUSE_NO}}. ${LEGAL.c2a} ${T("TAARIIKH_BILOWGA")}.`),

          body(`{{CLAUSE_NO}}. ${LEGAL.c3a} ${T("XALADDA_KIRADA")}.`),

          // Payment method is NOT conditional — it always prints.
          body(`{{CLAUSE_NO}}. ${LEGAL.c4a} ${T("HABKA_BIXINTA")}.`),
          // Only the FIXED-TERM end date depends on Xidhan vs Furan.
          marker(`{{IF:${N("KIRO_XIDHAN")}}}`),
          body(`Taariikhda uu heshiisku ku dhammaanayo waa ${T("TAARIIKH_DHAMMAAD")}.`),
          marker(`{{END:${N("KIRO_XIDHAN")}}}`),

          body(
            `{{CLAUSE_NO}}. ${LEGAL.c4b} ${T("TAARIIKH_BILOWGA")}, lacagta kirada waxaa la qadimay ${T("KIRADA_QIIMAHA")} ${T("KIRADA_QIIMAHA_QORAAL")}. ${T("FAAHFAAHIN_LACAGTA")}`,
          ),

          // Deposit breach clause — only when a deposit is agreed.
          marker(`{{IF:${N("DEEBAAJI_HAA")}}}`),
          body(
            `{{CLAUSE_NO}}. ${LEGAL.c5a} ${T("DEEBAAJI_QIIMAHA")}. ${LEGAL.c5b}`,
          ),
          marker(`{{END:${N("DEEBAAJI_HAA")}}}`),

          body(`{{CLAUSE_NO}}. ${LEGAL.c6}`),

          body(`{{CLAUSE_NO}}. ${LEGAL.c7}`),

          body(`{{CLAUSE_NO}}. ${LEGAL.c8}`),

          // Damiin — a legal attestation, not a data row.
          marker(`{{IF:${N("DAMIIN_HAA")}}}`),
          body(
            `{{CLAUSE_NO}}. DAMIIN MAAL: Anigoo ah ${T("DAMIIN_MAGAC")}, Waxaan Cadaynayaa inaan Damiinta Buuxa ka ahay kiraystaha Gurigan. Haddii Dhinaca laga bilaabo wax Kaso noqdaan ama Lacag Lagu Yesho, Aniga ayaa la iiraacay doonaa.`,
          ),
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: "❖ Saxeexa Damiinka: " }),
              new TextRun({ text: T("DAMIIN_MAGAC"), bold: true, underline: {} }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: `Tell ${T("DAMIIN_TELEFOON")}` }),
            ],
            spacing: { before: 100, after: 100 },
          }),
          marker(`{{END:${N("DAMIIN_HAA")}}}`),

          body(`{{CLAUSE_NO}}. ${LEGAL.c10}`),

          /* ---- Extra terms (kept as prose) ---- */
          body(`${T("DHERAAD_SHURUUDO")}`),

          /* ---- Data annex ----
             Form fields the reference legal wording has no clause for. Printed
             as neutral "Label: value" lines, never as invented legal prose —
             and a line with an empty value prints nothing at all. The annex
             heading is part of the DATA, not static text, so the whole block
             disappears when no annex field has a value. */
          marker(`{{IF:${N("ANNEX_HAS_VALUES")}}}`),
          centredHeading("XOGTA HESHIISKA"),
          marker(`{{IF:${N("ANNEX_BANGIGA")}}}`),
          body(`${"Magaca Bangiga"}: ${T("BANGIGA_MAGACA")}`),
          body(`${"Nambarka Xisaabta"}: ${T("BANGIGA_HISAABKA")}`),
          marker(`{{END:${N("ANNEX_BANGIGA")}}}`),
          marker(`{{IF:${N("ANNEX_HADSHAN")}}}`),
          body(`${"Lacagta Hadhsan"}: ${T("LACAGTA_HADSHAN")}`),
          marker(`{{END:${N("ANNEX_HADSHAN")}}}`),
          marker(`{{IF:${N("ANNEX_BIXINTA")}}}`),
          body(`${"Maalinta Bixinta"}: ${T("MUDDADA_BIXINTA")}`),
          body(`${"Xaaladda Bixinta"}: ${T("BIXINTA_HORE")}`),
          marker(`{{END:${N("ANNEX_BIXINTA")}}}`),
          marker(`{{IF:${N("ANNEX_CINWAAN")}}}`),
          body(`${"Cinwaanka Guriga"}: ${T("GURI_CINWAAN")}`),
          marker(`{{END:${N("ANNEX_CINWAAN")}}}`),
          marker(`{{IF:${N("ANNEX_QOLADA")}}}`),
          body(`${"Qolada"}: ${T("GURI_QOLADA")}`),
          marker(`{{END:${N("ANNEX_QOLADA")}}}`),
          marker(`{{IF:${N("ANNEX_SHURUUDAHA")}}}`),
          body(`${"Shuruudaha Gaarka ah"}: ${T("SHURUUDAHA_GAARKA_AH")}`),
          marker(`{{END:${N("ANNEX_SHURUUDAHA")}}}`),
          marker(`{{IF:${N("ANNEX_DEEBAAJI")}}}`),
          body(`${"Shuruudaha Deebaajiga"}: ${T("DEEBAAJI_SHURUUDO")}`),
          marker(`{{END:${N("ANNEX_DEEBAAJI")}}}`),
          marker(`{{IF:${N("ANNEX_DAMIIN_AQOONSI")}}}`),
          body(`${"Aqoonsiga Damiinka"}: ${T("DAMIIN_AQOONSI")}`),
          marker(`{{END:${N("ANNEX_DAMIIN_AQOONSI")}}}`),
          marker(`{{IF:${N("ANNEX_DAMIIN_CINWAAN")}}}`),
          body(`${"Cinwaanka Damiinka"}: ${T("DAMIIN_CINWAAN")}`),
          marker(`{{END:${N("ANNEX_DAMIIN_CINWAAN")}}}`),
          marker(`{{IF:${N("ANNEX_OGAYSIIN_MUDADA")}}}`),
          body(`${"Mudada Ogaysiinta"}: ${T("OGAYSIIN_MUDADA")}`),
          marker(`{{END:${N("ANNEX_OGAYSIIN_MUDADA")}}}`),
          marker(`{{IF:${N("ANNEX_OGAYSIIN_SHURUUDO")}}}`),
          body(`${"Shuruudaha Joojinta"}: ${T("OGAYSIIN_SHURUUDAH")}`),
          marker(`{{END:${N("ANNEX_OGAYSIIN_SHURUUDO")}}}`),
          marker(`{{IF:${N("ANNEX_OGAYSIIN_FAAHFAAHIN")}}}`),
          body(`${"Faahfaahin Ogaysiin"}: ${T("OGAYSIIN_FAAHFAAHIN")}`),
          marker(`{{END:${N("ANNEX_OGAYSIIN_FAAHFAAHIN")}}}`),
          marker(`{{END:${N("ANNEX_HAS_VALUES")}}}`),

          /* ---- Witnesses — repeatable, prose style ---- */
          centredHeading("Maragyo Goob Joogayaala."),
          marker(`{{#${N("MARAGYO")}}}`),
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: "{{NUMBER}}- {{MAGAC}}" }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: "Tell {{PHONE}}" }),
            ],
            spacing: { after: 60 },
          }),
          marker(`{{/${N("MARAGYO")}}}`),

          /* ---- Closing attestation — the document ends here ---- */
          body(LEGAL.closingTitle),
          body(LEGAL.closingBody),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: LEGAL.closingSeal, bold: true, underline: {} }),
            ],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });
}

/** Bytes of the v2 editable starter template (real .docx). */
export async function buildHeshiisKiroTemplateV2Bytes(): Promise<Uint8Array> {
  return await Packer.toBuffer(buildHeshiisKiroTemplateV2());
}

/** Browser download of the v2 starter template. */
export async function buildHeshiisKiroTemplateV2Blob(): Promise<Blob> {
  return await Packer.toBlob(buildHeshiisKiroTemplateV2());
}

/** Canonical tokens the v2 template is expected to carry. */
export function requiredTemplateTokensV2(): string[] {
  return HESHIIS_KIRO_PLACEHOLDERS.filter(
    (s) => s.kind === "placeholder" || s.kind === "computed" || s.kind === "block",
  ).map((s) => s.token);
}

/** Suggested file name of the v2 legal-document template. */
export const TEMPLATE_FILE_NAME_V2 = "heshiis_kiro_template_v2.docx";

/**
 * No-overwrite guard for v2 — identical policy to v1: the file is only
 * written when missing, or when the operator explicitly passes --force.
 */
export function canWriteTemplateV2(fileExists: boolean, force = false): boolean {
  return !fileExists || force;
}