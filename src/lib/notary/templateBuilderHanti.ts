/**
 * KALA IIBSI HANTI — THE CANONICAL PROPERTY-SALE TEMPLATE BUILDER (v2).
 *
 * ONE .docx for all three property subtypes (Dhul Banaan, Guri, Beer).
 * The subtype never changes the template file — it changes what the engine
 * PRINTS, through the {{IF:HANTI_DHUL_BANAAN}} / {{IF:HANTI_GURI}} /
 * {{IF:HANTI_BEER}} condition flags that already exist in the registry
 * (kalaIiibsiHanti.ts conditionFlags).
 *
 * The legal wording is NOT invented. The document's core clauses are the
 * numbered attestation of the office's own paper (Ref/Dpn/MG/000432/08/026,
 * transcribed verbatim in scanEvidence.DHUL_BANAAN_SCAN). The five clauses
 * below reproduce that paper exactly; the ONLY differences are the
 * placeholders where the paper prints a name or a figure. Everything else —
 * the party lists, the money, the guarantee slot — states FACTS with
 * placeholders and no extra prose.
 *
 * Design rules held here:
 *   - Tokens always sit in ONE text run so the scanner sees each whole.
 *   - Repeat/conditional markers sit alone in their own paragraph.
 *   - No legal sentence outside the scan-proven ones.
 */

import {
  AlignmentType,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  Tab,
  TabStopPosition,
  TabStopType,
  TextRun,
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
  /** Title + subtitle, with the district as DATA. */
  title: `Kala Iibsi ${T("NOOCA_HANTIDA")} Oo Ku Yaalla Degmada ${T("DEGMADA")}`,
  subTitle: `Cabirkiisuna Yahay ( ${T("CABBIRKA")} ).`,
  /** The intro that opens the numbered clauses (date = the document date). */
  intro: `Hadii aanu nahay dhinacyadan sare ku xusan maanta oo ay taarikhdu tahay ${T("TAARIIKH")} xafiiskan hortiisa waxaanu ku wada galnay heshiiska iibka dhulkan banaan oo u dhacay sidan:-`,

  /* ---- clause 1: the seller's attestation ---------------------- */
  c1: `Anigoo ah ${T("IIBIYE_WORDS")} dhulkan waxaan cadaynayaa inaan dhulkaygan sare ku faahfaahsan ka iibiyay ${T("IIBSADAHA_MAGAC")} kana siiyay Lacag dhan ${T("QIIMAHA_HANTIDA")} ${T("QIIMAHA_QORAAL")}, dhamaan lacagtana kaga wada qaatay naqad (Xafiiskan Dhexiisa) wax baaqi ah oo igu hadhsanina aanay jirin.`,

  /* ---- clause 2: the buyer's attestation — NO name, as printed -- */
  c2: `Anigoo ah ${T("IIBSADE_WORDS")} dhulkan waxaan cadaynayaa inaan dhulkan iska soo eegay, cabirtay kuna qancay kuna iibsaday lacagtan sare ku xusan oo naqad ah.`,

  /* ---- clause 3: delivery — "manta", the document date ---------- */
  c3: `Laga Bilaabo manta iyo wixii ka dambeeya mulkigii dhulkani wuxuu ku wareegay oo yeelatay Iibsato ${T("IIBSADAHA_MAGAC")}.`,

  /* ---- clause 4: DAMAANAD — the guarantor's attestation. The
     guarantor slot prints ONE name: a third party when the notary chose
     qof 3aad, or the sellers themselves when they guarantee their own
     sale ({{DAMIIN_MAGACA}} is the DERIVED token — the user never types
     it twice). The scan's guarantee wording is kept word for word. */
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
  /** The signature mark printed beside every signature line. */
  signatureMark: "Saxeex",
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
    spacing: { after: 160 },
  });
}

/** The scan's "TELL" party line: name left, phone right-tabbed. */
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
                    text: `Daloodho Public Notary (Qoraal Hubanti Ah Oo sugan)  Ref/Dpn/MG/`,
                  }),
                  new TextRun({ text: T("REF_NUMBER") }),
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
                text: `Ref/Dpn/MG/${T("REF_NUMBER")}`,
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
          // The pipeline prints the district into {{DEGMADA}}, so the title
          // always matches the property the notary answered.
          docTitle(SCAN.title),
          body(SCAN.subTitle),

          /* ---- page-1 party block: sellers, then buyers ---------- */
          clauseTitle("MAGACA IIBISADA DHULKA"),
          marker(`{{#${N("IIBIYEYAAL")}}}`),
          partyLine("{{MAGAC}}", "{{TELEFOON}}"),
          marker(`{{/${N("IIBIYEYAAL")}}}`),

          clauseTitle("MAGACA IIBSATADA DHULKA"),
          marker(`{{#${N("IIBSADAYAAL")}}}`),
          partyLine("{{MAGAC}}", "{{TELEFOON}}"),
          marker(`{{/${N("IIBSADAYAAL")}}}`),

          /* ---- Faahfaahinta: subtype-conditional property facts -- */
          clauseTitle("Faahfaahinta Hantida Iyo Qiimaha La kala siistay."),

          marker(`{{IF:${N("HANTI_DHUL_BANAAN")}}}`),
          body(
            `Degmada: ${T("DEGMADA")} · Xaafada: ${T("XAAFADA")} · Cabbirka: ${T("CABBIRKA")} · Jiho Waqooyi: ${T("JIHO_WAQOOYI")} · Jiho Koonfur: ${T("JIHO_KOONFUR")} · Jiho Bari: ${T("JIHO_BARI")} · Jiho Galbeed: ${T("JIHO_GALBEED")} · Soohdimaha: ${T("SOOHDIMADA")} · Sida Hantida Loo Helay: ${T("SIDA_HANTIDA")}`,
          ),
          marker(`{{END:${N("HANTI_DHUL_BANAAN")}}}`),

          marker(`{{IF:${N("HANTI_GURI")}}}`),
          body(
            `Nooca Guriga: ${T("GURI_NOOCA")} · Goobta Guriga: ${T("GURI_GOOBTA")} · Degmada / Xaafadda: ${T("GURI_DEGMADA_XAAFADDA")} · Cabbirka Guriga: ${T("GURI_CABBIRKA")} · Xuduudaha Guriga: ${T("GURI_XUDUUDAAHA")} · Lambar / Aqoonsi Lahaansho: ${T("GURI_LAMBARKA_LAHAANSHO")} · Faahfaahin Dheeraad ah: ${T("GURI_FAAHFAAHIN")}`,
          ),
          marker(`{{END:${N("HANTI_GURI")}}}`),

          marker(`{{IF:${N("HANTI_BEER")}}}`),
          body(
            `Magaca Beeraha: ${T("BEER_MAGAC")} · Nooca Beeraha: ${T("BEER_NOOCA")} · Goobta Beeraha: ${T("BEER_GOOBTA")} · Degmada / Xaafadda: ${T("BEER_DEGMADA_XAAFADDA")} · Cabbirka Beeraha: ${T("BEER_CABBIRKA")} · Jiho/Xad 1: ${T("BEER_JIHO_1")} · Jiho/Xad 2: ${T("BEER_JIHO_2")} · Xuduudaha: ${T("BEER_XUDUUDAAHA")} · Aqoonsi Lahaansho: ${T("BEER_LAMBARKA_LAHAANSHO")}`,
          ),
          marker(`{{END:${N("HANTI_BEER")}}}`),

          /* ---- the title's reference branch (Dhul Banaan only) ---- */
          /* ---- the money: one number, one words-derivation ------- */
          body(
            `Qiimaha aanu kala Siisanay waa ${T("QIIMAHA_HANTIDA")} ${T("QIIMAHA_QORAAL")}.`,
          ),

          /* ---- the clause run: the 5 scan-verbatim clauses ------- */
          body(SCAN.intro),
          body(`1. IIBISADA DHULKA: ${SCAN.c1}`),
          body(`2. IIBSATADA DHULKAN: ${SCAN.c2}`),
          body(`3. ${SCAN.c3}`),
          // The guarantee attestation ALWAYS prints: qof 3aad prints that
          // person's name; iibiyaha prints the sellers themselves — both
          // are answers the notary gave, and {{DAMIIN_MAGACA}} covers
          // both. ma_jiro prints the slot with no name — never invented.
          body(`4. DAMAANAD:- ${SCAN.c4}`),
          body(`5. ${SCAN.c5}`),

          /* ---- page 2: signatures — ONE block, ONE run ----------- */
          // The scan prints two headings (seller / buyer), but the registry
          // has ONE {{#SAXEEXAYAASHA}} list whose rows carry their own
          // {{PREFIX}} (Iibiyaha / Iibsade). Repeating the block twice would
          // print every signatory twice, so ONE run serves both.
          clauseTitle("Magacyada Iyo Saxeexayaasha."),
          marker(`{{#${N("SAXEEXAYAASHA")}}}`),
          partyLine("❖ {{NUMBER}}. {{PREFIX}} {{SHAKHSIGA}}", ""),
          marker(`{{/${N("SAXEEXAYAASHA")}}}`),

          /* ---- witnesses: repeatable, prose style ---------------- */
          centredHeading(CLOSING.witnessesHeading),
          marker(`{{#${N("MARAGYO")}}}`),
          partyLine("{{NUMBER}}. {{MAGAC}}", "{{TELEFOON}}"),
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
              new TextRun({ text: CLOSING.notaryTitle, bold: true, underline: {} }),
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
