/**
 * KALA IIBSI HANTI — SCAN EVIDENCE REGISTER.
 *
 * The office's rule: the form is a translation of the REAL documents, not of
 * a data model the developer invented. This file is the audit trail that
 * keeps that honest.
 *
 * For every point on the office's reading list it records, per scan:
 *
 *   scan_confirmed — read off the actual paper, so the form MUST carry it
 *   spec_only      — the office stated it; no scan read so far shows it
 *   gap            — the scans show it and the form does not collect it
 *                    yet (see SCAN_GAPS; each one names its fix)
 *   not_form_data  — it lives in the Word template and is deliberately NOT a
 *                    form question (legal prose must never be re-typed)
 *
 * Two scans were actually analysed:
 *
 *   DHUL BANAAN "D/SALAAM"   2pp · Ref/Dpn/MG/000432/08/026 · 1 seller,
 *                            1 buyer, 3 witnesses, 5 fingerprint ovals,
 *                            letterhead on page 1 only
 *   BEER "DAARA-SALAAM"      2pp · Ref/Dpn/MG/000250/05/025 · group
 *                            "Ilma Xassan Qaalib", 13 persons, 8 photos,
 *                            6 signature lines, 2 witnesses, 6 clauses,
 *                            roles IIBISO / IIBISO/WAKIIL / M/QIYAM /
 *                            D/MAALKA, certs MDH/C/839-842/2025 +
 *                            Ref:APN/096/2025, Ruun + Farax as wakiil
 *
 * THE SINGLE MOST IMPORTANT LINE IN THIS FILE: a count in a scan is a
 * POSSIBLE CASE, never a required number. 13 sellers and 8 photographs is
 * one document, not the shape of every document. So `counts` below describe
 * what the scans were free to do, and nothing in the form may enforce them.
 */

/** What a single reading-list point costs us to be wrong about. */
export type EvidenceStatus =
  | "scan_confirmed"
  | "spec_only"
  | "gap"
  | "not_form_data";

export interface ScanPoint {
  /** The office's numbering, so a gap can be quoted back verbatim. */
  point: number;
  /** What the reading-list point is called. */
  title: string;
  dhul_banaan: EvidenceStatus;
  beer: EvidenceStatus;
  /** Where the answer lives in the app, or why it does not. */
  livesIn: string;
  note?: string;
}

export const SCAN_EVIDENCE: ScanPoint[] = [
  {
    point: 1,
    title: "Qaybaha document-ka",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "config.sections — dejinta, iibiyaha, kooxaha, sawirrada, saxeexayaasha, shaxadaha, iibsadaha, hantida_*, damiinka, qiimaha, maragyada (the wakiil has no section of its own — he is entered inside the party he stands for)",
  },
  {
    point: 2,
    title: "Noocyada dadka ku jira",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "partyModel.Person + per-row `jinsi` select (male / female / unknown)",
    note: "Gender is an INPUT. It is never read from the name and never defaulted.",
  },
  {
    point: 3,
    title: "Xiriirka dadka",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "iibiyeyaal.xiriirka_qoyska → personModel.Person.familyRelationship",
    note: "Ruun is 'mother'. A relationship is DATA and grants no authority.",
  },
  {
    point: 4,
    title: "Doorarka dadka",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "iibiyeyaal.dooro → IIBIYAHA_DOORO",
    note: "Role ≠ gender. 'M/QIYAM' and 'D/MAALKA' are roles, not genders.",
  },
  {
    point: 5,
    title: "Wakiillada",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "attendance ('Ma Joogaa Heshiiska? → Maya → Qaybta Wakiilka') + the shared wakiilo_* list → partyModel.Representation",
    note: "One wakiil may stand for many people; several may split one group. The link is drawn ONCE, on the person's own attendance card, so the same question can never be answered twice.",
  },
  {
    point: 6,
    title: "Wakiil-Qayimka",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "wakiilo_*.nooca_wakiilka → Representation.type ('wakiil' | 'wakiil_qayim')",
    note: "Never defaulted to 'wakiil'. A different answer about the REPRESENTED person's capacity.",
  },
  {
    point: 7,
    title: "Qoysaska / kooxaha",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "kooxaha list + iibiyeyaal.koox → SellerGroup (a NAME, never a person)",
  },
  {
    point: 8,
    title: "Sawirrada",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "sawirrada list → PersonPhoto (independent; per-person requiredWhenRowStatus only)",
    note: "1 seller → 3 photos, and 13 sellers → 8 photos, are BOTH valid. No count is ever compared. The D/Salaam scan prints the role under each photograph ('Iibisada' / 'Iibsato') with the person's name beside it — caption + name, which is what {{CAPTION}} + {{SHAKHSIGA}} already carry.",
  },
  {
    point: 9,
    title: "Saxeexyada",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "saxeexayaasha list → PersonSignature",
    note:
      "13 sellers → 6 signatories is valid. A seller is never required to sign. The D/Salaam scan prints 'Magaca Iyo Saxeexa Iibisada Dhulka' / '…Iibsatada Dhulka' with the word 'Saxeex' and a dashed oval for the stamp — 2 signatories.",
  },
  {
    point: 10,
    title: "Magacyada iyo captions-ka",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "row `magac` on every list; sawirrada.caption for the photo label",
  },
  {
    point: 11,
    title: "Certificates iyo references",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "shaxadaha list (MDH/C/839-842/2025, Ref:APN/096/2025)",
    note: "Five papers in one scan. A single certificate slot could not hold them.",
  },
  {
    point: 12,
    title: "Hantida iyo nooca hantida",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "dejinta.sub_type + the matching hantida_dhul_banaan / hantida_guri / hantida_beer",
  },
  {
    point: 13,
    title: "Xuduudaha iyo jihooyinka",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "degmada, xaafada, cabbirka, jiho_1..3, soohdimaha (Dhul Banaan) · magaca_beerta, degmada_xaafadda, cabbirka, jiho_1..2, xuduudaha (Beer)",
    note:
      "Beer carries its OWN Beer name, which Dhul Banaan does not — the two must not collapse into one field set. The D/Salaam scan labels this block 'JIHOOYINKA' and each side answers Waddo or Dhisme — which is exactly the jiho_waqooyi/koonfur/bari/galbeed pair already collected.",
  },
  {
    point: 14,
    title: "Qiimaha iyo lacag-bixinta",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "qiimaha.qiimaha_guud (+ QIIMAHA_QORAAL derived) and qiimaha.lacagta_bixiyay",
  },
  {
    point: 15,
    title: "Maragyada",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "maragyo list → MARAGYO repeat block",
    note: "Dhul Banaan scan had 3 witnesses and Beer had 2 — so the count is dynamic, min 1.",
  },
  {
    point: 16,
    title: "Qodobbada / clauses",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn:
      "not_form_data — every legal sentence lives in the template. NONE of them is ever a form question.",
    note:
      "Beer scan had 6 clauses; the D/Salaam scan has 5 (numbered 1.–5. as one continuous run, carried across the page break). The app must NOT re-ask for them and must NOT rewrite them. IMPORTANT: this holds for the FINISHED document, not for the office's data-collection .docx — public/templates/kala_iiibsi_hanti/dhul_banaan.docx carries no legal prose at all (see SCAN_OPEN_ITEMS).",
  },
  {
    point: 17,
    title: "Fiiro gaar ah",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn: "hantida_*.faahfaahin_dheeraad + damiinka.gurmadka_dammaanadda",
    note:
      "D/Salaam scan: qodobka 4 (DAMAANAD) wuxuu qorayaa 'Xafiiskan Dhexiisa' — qaadilku waa ROLE, qof koobad ka duusan iibsadaha. Magaca damiinka ma jiro halbeenkii.",
  },
  {
    point: 18,
    title: "Erayada gender-ka",
    dhul_banaan: "spec_only",
    beer: "scan_confirmed",
    livesIn: "partyModel.GENDER_WORDS / GENDER_WORDS_DEFINITE → {{IIBIYE_WORD(S)}}, {{IIBSADE_WORD(S)}}",
    note: "The Beer scan prints IIBISO and IIBIYE-shaped prefixes; the exact plural remains OPEN — see partyModel.OPEN_DECISIONS.pluralSpelling.",
  },
  {
    point: 19,
    title: "Qaabka xogta loogu soo bandhigo document-ka",
    dhul_banaan: "scan_confirmed",
    beer: "scan_confirmed",
    livesIn:
      "repeat blocks ({{#IIBIYEYAAL}}, {{#SAWIRRADA}}, {{#SAXEEXAYAASHA}} …) + composed Ref/Dpn/MG/{serial}/{MM}/{YY}",
    note:
      "The D/Salaam scan prints the title WITH the district ('Kala Iibsi Dhul Banaan Oo Ku Yaalla Degmada D/SALAAM'), a sub-title with the area ('Cabirkiisuna Yahay ( 18 X 24 Meter)'), the day name 'Sabti' beside the date, and a footer on EVERY page carrying the reference again. It also carries TWO different references: the document's own Ref/Dpn/MG/000432/08/026 and the plot's Ref/Dpn/Mg/0263/08/16.",
  },
];

/**
 * Every reading-list point the scans raise that the form does not yet
 * collect, named so it can be fixed rather than forgotten.
 *
 * This list is meant to reach EMPTY. An entry here is an admission, not a
 * design: it says "the paper shows this and we cannot yet type it in".
 */
export interface ScanGap {
  /** Reading-list point number, so it can be quoted back. */
  point: number;
  /** What the scan shows. */
  found: string;
  /** Which scan(s) show it. */
  seenIn: "dhul_banaan" | "beer" | "both";
  /** Where the form must grow to hold it. */
  fix: string;
}

export const SCAN_GAPS: ScanGap[] = [
  {
    point: 13,
    found: "Beer-ka wuxuu leeyahay MAGAC (Beer Daara-Salaam) — goobta iyo beerka labo arrimo.",
    seenIn: "beer",
    fix: "hantida_beer.magaca_beerta — ADDED (required, prints as BEER_MAGAC).",
  },
  {
    point: 13,
    found: "Beer-ka wuxuu qabtay jihooyin (Xadka), sida Dhul Banaan.",
    seenIn: "beer",
    fix: "hantida_beer.jiho_1 / jiho_2 (optional) — ADDED, prints as BEER_JIHO_1 / BEER_JIHO_2.",
  },
  {
    point: 13,
    found: "Dhul Banaan-ka wuxuu qabtay soohdimo dhulka.",
    seenIn: "dhul_banaan",
    fix: "hantida_dhul_banaan.soohdimaha (optional, skippable) — ADDED, prints as SOOHDIMADA.",
  },

  ];

/** Reading-list points with NO open gap — i.e. the form covers them today. */
export function coveredScanPoints(): number[] {
  const gapped = new Set(SCAN_GAPS.map((g) => g.point));
  return SCAN_EVIDENCE.filter((p) => !gapped.has(p.point)).map((p) => p.point);
}

/* ================================================================== */
/* THE 22/Aug/2026 D/SALAAM SCAN — VERBATIM TRANSCRIPT                 */
/* ================================================================== */

/**
 * Transcribed WORD FOR WORD off the two scanned pages of
 * Ref/Dpn/MG/000432/08/026 (Daloodho Public Notary Office, Kala Iibsi Dhul
 * Banaan, Degmada D/SALAAM, Cabir 18 X 24 Meter, Taariikh 22/Aug/2026).
 *
 * WHY THIS IS IN CODE: these sentences are LEGAL TEXT. They are copied from
 * the office's own paper so nobody ever retypes them, and so a change to any
 * word is visible in a diff instead of hidden inside a .docx. Every word
 * below is what is printed; names and figures are THE SCAN'S OWN and are
 * kept only to show the shape of a sentence — they are never defaults.
 */
export const DHUL_BANAAN_SCAN = {
  /** The office's own reference, as printed on page 1 and in the footer. */
  ref: "Ref/Dpn/MG/000432/08/026",
  /** The Somali DAY NAME printed between the reference and the date. */
  maalinta: "Sabti",
  taariikh: "22/Aug/2026",
  docTitle: "Kala Iibsi Dhul Banaan Oo Ku Yaalla Degmada D/SALAAM",
  docSubTitle: "Cabirkiisuna Yahay ( 18 X 24 Meter).",
  /** The centre box between the two photographs: a hand-drawn parcel plan. */
  sketchLabels: {
    top: "WAQOOYI — 18 Meter",
    left: "Galbeed",
    right: "24 Meter — Bari",
    bottom: "Koonfur",
  },
  /** The labels printed under each photograph. */
  photoLabels: { seller: "Iibisada", buyer: "Iibsato" },
  partyHeadings: {
    seller: "MAGACA IIBISADA DHULKA",
    buyer: "MAGACA IIBSATADA DHULKA",
  },
  /** The scan spells the phone label "TELL", not "Telefoonka". */
  phoneLabel: "TELL",
  propertyHeading: "Faahfaahinta Dhulka Iyo Qiimaha La kala siistay.",
  propertyRows: [
    "Degmada | D/Salaam | JIHOOYINKA",
    "Xaafada | Bacaado | Waqooyi | Waddo",
    "Cabirka | ( 18 X 24 Meter) | Galbeed | Dhisme",
    "Tixraac | Ref/Dpn/Mg/0263/08/16 | Bari Iyo Koonfur | Dhisme",
    "Qiimaha aanu kala Siisanay waa | $3,000 SADDEX KUN OO DOLLAR.",
  ],
  /** The sentence that opens the numbered clauses and repeats the date. */
  intro:
    "Hadii aanu nahay dhinacyadan sare ku xusan maanta oo ay taarikhdu tahay 22/Aug/2026 xafiiskan hortiisa waxaanu ku wada galnay heshiiska iibka dhulkan banaan oo u dhacay sidan:-",

  /* ---- THE FIVE NUMBERED CLAUSES, VERBATIM --------------------- */
  clauses: [
    {
      no: 1,
      title: "IIBISADA DHULKA:",
      text:
        "Anigoo ah iibisada Dhulkan waxaan cadaynayaa inaan dhulkaygan sare ku faahfaahsan ka iibiyay Warda Maxamuud Cali kana siiyay Lacag dhan $3,000 Saddex Kun Oo Dollar, dhamaan lacagtana kaga wada qaatay naqad (Xafiiskan Dhexiisa) wax baaqi ah oo igu hadhsanina aanay jirin.",
      /** What varies inside the sentence — names and figures only. */
      variables: ["IIBSADAHA_MAGAC", "QIIMAHA_HANTIDA", "QIIMAHA_QORAAL"],
      note:
        "The guarantor is 'Xafiiskan Dhexiisa' — the OFFICE'S OWN agent, a third person distinct from the buyer. This is a role, not a name typed into a field.",
    },
    {
      no: 2,
      title: "IIBSATADA DHULKAN:",
      text:
        "Anigoo ah iibsatada dhulkan waxaan cadaynayaa inaan dhulkan iska soo eegay, cabirtay kuna qancay kuna iibsaday lacagtan sare ku xusan oo naqad ah.",
      variables: [],
      note:
        "Clause 2 prints NO name — not the buyer's, not anyone's. It is pure prose. The buyer is named in clause 1 and again in clause 3 ('Iibsato Warda Maxamuud Cali'); the same person, named twice, not two people.",
    },
    {
      no: 3,
      title: "Laga Bilaabo manta iyo wixii ka dambeeya",
      text:
        "Laga Bilaabo manta iyo wixii ka dambeeya mulkigii dhulkani wuxuu ku wareegay oo yeelatay Iibsato Warda Maxamuud Cali",
      variables: ["IIBSADAHA_MAGAC"],
      note:
        "There is NO separate delivery date on this document: 'manta' means the date of the document itself. Nothing is collected for it.",
    },
    {
      no: 4,
      title: "DAMAANAD:-",
      text:
        "Anigoo ah Iibisada Dhulka Nimco Koosaar Shire hadii heshiiska iibka dhulkan dhinacayga wax kasoo noqdaan sida lahaanshaha, Nootaayada, iyo dhamaan wixii khilaafaya heshiiskan aniga ayaa la iiraacayaa oo ka masuula, bixinayana hantidan iyo kharash wixii raacayba anigoo isku damiinanaya hantidayda guud ee aan gaarka u leeyahay guurto iyo ma guurtaba.",
      variables: ["DAMIIN_MAGACA"],
      note:
        "Clause 4 carries on to page 2 (top). It opens with the SELLER, not with the guarantor: the seller is the one who answers for the property.",
    },
    {
      no: 5,
      title: null,
      text:
        "Sidana waxa aamu ku saxeexnay xafiiska nootaayada sharciga hortiisa, anaga oo miyir iyo maanba qabna xiskayaguna dhan yahay.",
      variables: [],
    },
  ],

  /* ---- PAGE 2, verbatim ---------------------------------------- */
  signatureHeadings: [
    "Magaca Iyo Saxeexa Iibisada Dhulka.",
    "Magaca Iyo Saxeexa Iibsatada Dhulka .",
  ],
  /** The word printed beside every signature arrow. */
  signatureMark: "Saxeex",
  witnessesHeading: "Maragyo Goob-Joogayaal Ah",
  /** The closing attestation — HANTI's wording, not Kiro's. */
  closingHeading: "Cadaynta Xafiiska",
  closingBody:
    "-Xafiisku waxa uu cadaynayaa in kala iibkani u dhacay sifo sharciga waafaqaan, waafaqaan laguna hor saxeexay laguna camal falsi doona.",
  notaryName: "(Gar. Maxamed Cumar Cabdillaahi)",
  notaryTitle: "Sarkaalka Xafiiska Nootaayada Sharciga ah EeDaloodho",
  footer:
    "Daloodho Public Notary (Qoraal Hubanti Ah Oo sugan)  Ref/Dpn/MG/000432/08/026  Page",
} as const;

/**
 * What the 22/Aug/2026 D/Salaam scan shows and the app STILL cannot do.
 *
 * SCAN_GAPS above is a CLOSED list: every entry there names a field that
 * really exists today (see tests/hantiAcceptance.test.ts). This list is the
 * opposite — findings from the new scan that are NOT fixed yet. They are
 * deliberately kept separate so a gap can never quietly claim to be closed.
 *
 * `point` refers to the office's own 19-point reading list, never to a new
 * numbering: the re-read did not add reading-list points, it added DETAIL
 * inside points that were already registered.
 */
export interface ScanOpenItem {
  /** Which reading-list point this detail belongs to (1–19). */
  point: number;
  /** What the paper does. */
  found: string;
  /** Which scan shows it. */
  seenIn: "dhul_banaan" | "beer" | "both";
  /** Whether a field/token could hold it even in principle. */
  couldBeFormData: "yes" | "no" | "needs_drawing";
  /** What it needs before it can be built. */
  blockedOn: string;
}

export const SCAN_OPEN_ITEMS: ScanOpenItem[] = [
  {
    point: 16,
    found:
      "Qodobado sharciyeed oo isku xiga (1.–5.) ayuu waraaqdu qabatay. Waraaqda xafiiska ee hadda jira (public/templates/kala_iiibsi_hanti/dhul_banaan.docx) wuxuu leeyahay 138 qaybo oo XOG keliya (1. XOGTA HESHIISKA, 2. IIBIYEYAAL, 3. IIBSADAYAAL…) — HAL qoraal sharciyo ma jiro.",
    seenIn: "dhul_banaan",
    couldBeFormData: "no",
    blockedOn:
      "Waraaq cusub oo sharciyo lagu qabtay (Hanti v2, sida Kiro v2). Dhul_banaan.docx ee xafiiska waa in LA BANAAN DOONAA — waxaa laga abuurayaa waraaq cusub.",
  },
  {
    point: 17,
    found:
      "Cadaynta Xafiiska: 'Xafiisku waxa uu cadaynayaa in kala iibkani u dhacay sifo sharciga waafaqaan, waafaqaan laguna hor saxeexay laguna camal falsi doona.' + '(Gar. Maxamed Cumar Cabdillaahi)' + 'Sarkaalka Xafiiska Nootaayada Sharciga ah EeDaloodho'.",
    seenIn: "dhul_banaan",
    couldBeFormData: "yes",
    blockedOn:
      "Token NOTARY_NAME ma jiro. Magaca notary-ga ma noqon qayb xog oo la qorto, mise qoraal joogto? Ma jirtoo. Kiro v2 wuxuu leeyahay cadaynta iyo xafka sar kaalka — MAGACA notary-ga kana ma jiro.",
  },
  {
    point: 19,
    found:
      "Suxundda wuxuu daabacay 'Sabti' — MAGACA MAALINTA, oo u dhex yahay xaafadda iyo 'Taariikh: 22/Aug/2026'. Kadibna footer page kasta: 'Daloodho Public Notary (Qoraal Hubanti Ah Oo sugan)  Ref/Dpn/MG/000432/08/026  Page'.",
    seenIn: "dhul_banaan",
    couldBeFormData: "yes",
    blockedOn:
      "MAALINTA token ayaa Hanti registry-ga jira, laakiin wuxuu yahay MAGACA BISHII ('Bishii (sida qoraal)'), ma aha magaca MAALINTA (Sabti). Labadaba ma isku beddelmi karo. Footer-ka waraaqda xafiiska ma lahayn.",
  },
  {
    point: 13,
    found:
      "Labada dhinac ee sawirka wuxuu qabatay: qaab dhulka oo GACANTA LAGU SAWIRAY (18 X 24, dhulka casaan) oo dhinacyadii 'Waqooyi 18 Meter / Galbeed / 24 Meter Bari / Koonfur', iyo 'JIHOOYINKA' oo cinwaad tilmaamaya Galbeed/Bari/Dhisme/Waddo.",
    seenIn: "dhul_banaan",
    couldBeFormData: "needs_drawing",
    blockedOn:
      "App-ku ma sameeyn karo sawir gacan ah. Waa in la sawiro oo la geliyo (sawaarro) — oo ay go'aan tahay in la geliyo iyo in ay qayb qofka tahay.",
  },
  {
    point: 8,
    found:
      "Sawirrada wuxuu yareeyaa: sawirka Iibisada waxaa ku qoran 'Iibisada' + magaca, sawirka Iibsatada 'Iibsato' + magaca, labadaba sawir ka duul.",
    seenIn: "dhul_banaan",
    couldBeFormData: "no",
    blockedOn:
      "SAWIRRADA wuxuu hadda leeyahay {{SHAKHSIGA}} + {{CAPTION}}, marka qaab-ku-dhow yahay. Waxba ma jiro oo bannaan had iyo jeer.",
  },
  {
    point: 17,
    found:
      "Qodobka 1 wuxuu yahay '…naqad (Xafiiskan Dhexiisa)…' — qaadilku waa QAADILKA XAFIISKA, qof KOOBAD ah ka duusan iibsadaha, ka horreynaya ninka dhulka iibsanaya.",
    seenIn: "dhul_banaan",
    couldBeFormData: "no",
    blockedOn:
      "Qoraalka qaadilku wuxuu yahay 'Xafiiskan Dhexiisa' — ROLE, magac ma jiro. Damiin qof 3aad (NOOCA_DAMIIN = qof_3aad) ayaa damiinka u qaadan karta; waxba ha laga beddelin.",
  },
  {
    point: 16,
    found:
      "Qodobka 3 wuxuu yahay 'Laga Bilaabo manta iyo wixii ka dambeeya' — 'manta' = taariikhda waraaqda. Ma jiro taariikh la siiyay oo kala duwan.",
    seenIn: "dhul_banaan",
    couldBeFormData: "no",
    blockedOn:
      "Waa in la hubo had iyo jeer 'manta' ayuu yahay, mise mar qaar 'Taariikh:' ayuu qorayaa. Haddii 'manta' yahay, taariikh la siiyay MA ABUURNA.",
  },
];

/**
 * What the scan shows and the app still cannot do, phrased as a QUESTION
 * for the office. Each one blocks a token or a field, and none of them may
 * be answered by guessing — an invented Somali legal sentence is worse than
 * a missing one, because a missing one is visible.
 */
export interface HantiScanOpenDecision {
  /** Which reading-list point the question belongs to (1–19). */
  point: number;
  /** The question, in the office's language. */
  question: string;
  /** What the app will do if the answer is "no" / not yet. */
  untilAnswered: string;
}

export const HANTI_SCAN_OPEN_DECISIONS: HantiScanOpenDecision[] = [
  {
    point: 16,
    question:
      "Waraaqda xafiiska (dhul_banaan.docx) la banaan doonaa oo qodobado sharciyeed lagu dari lahaa, mise waraaq cusub la sameeyaa sida Kiro v2?",
    untilAnswered:
      "Waraaqda xafiiska waa in LA BANAAN DOONAANAA (138 qaybo, xog keliya). Hanti v2 ahaa waraaq cusub, sida Kiro v2.",
  },
  {
    point: 17,
    question:
      "Magaca notary-ga (Gar. Maxamed Cumar Cabdillaahi) ma noqonayo qayb xog oo la qorti karo, mise qoraal joogto oo template-ka?",
    untilAnswered:
      "Cadaynta xafiiska iyo xafka sar kaalka waa qoraal joogto (sida Kiro v2). Magaca notary-ga khad joogto.",
  },
  {
    point: 19,
    question:
      "Sabti waa MAGACA MAALINTA (Sabti, Isni, Khamiista…), MAALINTA qaadarna waa MAGACA BISHII. Labadaba ma la daabacan karo? Taariikhda oo keliya ma la qorto?",
    untilAnswered:
      "MAALINTA token ayaa jira laakiin wuxuu qorayaa bishii ('Bishii (sida qoraal)') — ma aha 'Sabti'. Waxba ha la baddalin. Hanti-kan xaafadda taariikhda ayaa laga qortaa.",
  },
  {
    point: 13,
    question:
      "Qaabka dhulka ee gacanta lagu sawiray (18 X 24, dhulka casaan) ma la geliyaa sawir ahaan, mise qoraal faatafin ah?",
    untilAnswered:
      "Halkan ma jiro sawirka dhulka. Waxaa lagu dari lahaa qayb sawirro oo muhiim ah — laakiin MA ABUURNA ilaa jawaab la helo.",
  },
  {
    point: 13,
    question:
      "Sawirka dhulka wuxuu u dhex yahay sawirrada Iibisada iyo Iibsatada — ma mid ahaa labo sawir, mise saddexda?",
    untilAnswered:
      "SAWIRRADA waa mid kii qofka ah; sawirka dhulka waxaa loo akhriyo qaybta qofka.",
  },
  {
    point: 17,
    question:
      "Qodobka 1, 'Xafiiskan Dhexiisa' ma qoraal role oo had iyo jeer la daabaco, mise magaca qaadilka ayaa la qortaa?",
    untilAnswered:
      "Qoraalka qaadilka wuxuu qorayaa 'Xafiiskan Dhexiisa' — HAD IYO JEER. Magaca damiinka waxaa laga qortaa damiinka section.",
  },
  {
    point: 16,
    question:
      "Qodobka 3 'Laga Bilaabo manta' ma had iyo jeer 'manta' yahay, mise mar qaar 'Taariikh:' ayuu qorayaa?",
    untilAnswered:
      "Qoraalka wuxuu yahay 'manta' iyo TAARIIKH_KUU_XIGTA ma jiro — taariikh la siiyay ma iibsiyo.",
  },
];