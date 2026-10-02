import type {
  Condition,
  DocumentConfig,
  PlaceholderMapping,
  SelectOption,
  TemplateSpec,
} from "../types";
import { KALA_IIBSI_HANTI_PLACEHOLDERS } from "../placeholderRegistry";

/**
 * KALA IIBSI HANTI — sale of property (land / house / shop).
 *
 * This is pure DATA, exactly like Heshiis Kiro: the interview, validation,
 * review and generation all read from it. Nothing here designs the Word
 * template and nothing here writes legal wording — the office's own .docx
 * owns the prose, this file only says which data exists, how it is
 * validated, and which placeholder carries it.
 *
 * The placeholder list is BUILT from the central Placeholder Registry so
 * the token names can never drift apart from the inventory the office sees.
 */
function registryPlaceholders(
  specs = KALA_IIBSI_HANTI_PLACEHOLDERS,
): PlaceholderMapping[] {
  const out: PlaceholderMapping[] = [];
  for (const spec of specs) {
    if (!spec.key) continue;
    const mapping = {
      key: spec.key,
      ...(spec.format ? { format: spec.format } : {}),
      ...(spec.fallback ? { fallback: spec.fallback } : {}),
    };
    out.push({ placeholder: `{{${spec.token}}}`, mapping });
    for (const alias of spec.aliases ?? []) {
      out.push({ placeholder: `{{${alias}}}`, mapping });
    }
  }
  return out;
}

/** Dejinta (the setup section) — sub-type is chosen here. */
const DEJINTA = "dejinta";

const HANTI_SUBTYPES: SelectOption[] = [
  { value: "dhul_banaan", label: "Dhul Banaan" },
  { value: "guri", label: "Guri" },
  { value: "beer", label: "Beer" },
];

/** How the purchase price is being settled. */
const HABKA_BIXINTA: SelectOption[] = [
  { value: "dhan", label: "Lacag Dhan (Full Payment)" },
  { value: "qayb", label: "Qayb Lacag ah (Partial Payment)" },
  { value: "hadhaa", label: "Hadhaaga (Balance)" },
];

const YES_NO: SelectOption[] = [
  { value: "yes", label: "Haa" },
  { value: "no", label: "Maya" },
];

/** Sub-type equals one of the given values. */
const isHanti = (...values: string[]): Condition => ({
  op: "or",
  conditions: values.map((value) => ({
    op: "equals" as const,
    field: `${DEJINTA}.sub_type`,
    value,
  })),
});

/**
 * Word templates per sub-type. The office designs each .docx; the app only
 * fills placeholders. The three files are added when the office delivers
 * them — until then the generation step reports the missing template instead
 * of producing a document with unresolved placeholders.
 */
const NOW = 0;
const HANTI_TEMPLATES: TemplateSpec[] = [
  {
    templateId: "HANTI_DHUL_BANAAN_V1",
    documentType: "kala_iibsi_hanti",
    subtype: "dhul_banaan",
    name: "Kala Iibsi Dhul Banaan",
    filePath: "/templates/kala_iiibsi_hanti/dhul_banaan.docx",
    version: 1,
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    templateId: "HANTI_GURI_V1",
    documentType: "kala_iibsi_hanti",
    subtype: "guri",
    name: "Kala Iibsi Guri",
    filePath: "/templates/kala_iiibsi_hanti/guri.docx",
    version: 1,
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    templateId: "HANTI_BEER_V1",
    documentType: "kala_iibsi_hanti",
    subtype: "beer",
    name: "Kala Iibsi Beer",
    filePath: "/templates/kala_iiibsi_hanti/beer.docx",
    version: 1,
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

/** Shared per-row data for a seller or a buyer. */
function partyFields(role: string) {
  return [
    { id: "magac", type: "text" as const, label: `Magaca ${role}`, validation: { required: true }, placeholder: `Magaca ${role.toLowerCase()}` },
    // Telefoon belongs to the PERSON: required when they are present, and
    // not applicable when a wakiil signs for them.
    { id: "telefoon", type: "phone" as const, label: `Telefoonka ${role}`, optional: true, requiredWhenRowStatus: "jooga" as const, showOnlyWhenRowStatus: "jooga" as const, placeholder: "+252 61 5551234" },
    { id: "aqoonsi", type: "text" as const, label: "Nambarka Aqoonsiga / Document", optional: true, skippable: true, showOnlyWhenRowStatus: "jooga" as const, placeholder: "ID / Passport" },
    { id: "cinwaan", type: "text" as const, label: "Cinwaanka", optional: true, showOnlyWhenRowStatus: "jooga" as const, placeholder: "Degmada, magaalada" },
    { id: "faahfaahin_dheeraad", type: "textarea" as const, label: "Faahfaahin Dheeraad ah", optional: true, colSpan: 2 as const, showOnlyWhenRowStatus: "jooga" as const },
  ];
}

/** Shared per-representative data (entered once per wakiil, shared by all). */
const REPRESENTATIVE_FIELDS = [
  { id: "magac", type: "text" as const, label: "Magaca Wakiilka", validation: { required: true } },
  { id: "telefoon", type: "phone" as const, label: "Telefoonka Wakiilka", validation: { required: true }, placeholder: "+252 61 5551234" },
  { id: "aqoonsi", type: "text" as const, label: "Nambarka Aqoonsiga / Document", optional: true, placeholder: "ID / Passport" },
  { id: "cinwaan", type: "text" as const, label: "Cinwaanka", optional: true, placeholder: "Degmada, magaalada" },
];

export const kalaIiibsiHantiConfig: DocumentConfig = {
  id: "kala_iibsi_hanti",
  title: "Kala Iibsi Hanti",
  description:
    "Kala iibsi hanti oo u dhaxeeya iibiyaha iyo iibsadaha — dhul banaan, guri ama beer.",
  fileNamePrefix: "Kala-Iibsi-Hanti",
  outputFolder: "KalaIibsiHanti",
  templatePath: "/templates/kala_iiibsi_hanti/guri.docx",
  referencePrefix: "DPN-H",
  // The setup section carries the sub-type; the engine reads it from here
  // instead of assuming "heshiiska".
  setupSectionId: DEJINTA,
  requiresWitness: true,
  witnessPlaceholder: "{{MARAGYO_LIST}}",
  witnessSeparator: "\n",
  subTypes: HANTI_SUBTYPES,
  templates: HANTI_TEMPLATES,

  // Repeated blocks over the dynamic party lists. A representative list is
  // rendered once per wakiil plus who they stand for ({{MATALAYA}}), so
  // three absent sellers sharing one wakiil produce ONE wakiil record.
  repeatBlocks: [
    { blockId: "MARAGYO", partyId: "maragyo", numberPlaceholder: "NUMBER", aliases: { PHONE: "telefoon", ID: "aqoonsi" } },
    { blockId: "IIBIYEYAAL", partyId: "iibiyeyaal" },
    { blockId: "IIBSADAYAAL", partyId: "iibsadayaal" },
    { blockId: "WAKIILO_IIBIYEYAAL", partyId: "wakiilo_iibiyeyaal", numberPlaceholder: "NUMBER" },
    { blockId: "WAKIILO_IIBSADAYAAL", partyId: "wakiilo_iibsadayaal", numberPlaceholder: "NUMBER" },
  ],

  // {{IF:…}} flags. The property flags come from the chosen sub-type; the
  // rest from the answers in the shuruudaha section.
  conditionFlags: {
    HANTI_DHUL_BANAAN: { op: "equals", field: `${DEJINTA}.sub_type`, value: "dhul_banaan" },
    HANTI_GURI: { op: "equals", field: `${DEJINTA}.sub_type`, value: "guri" },
    HANTI_BEER: { op: "equals", field: `${DEJINTA}.sub_type`, value: "beer" },
    BIXINTA_DHAN: { op: "equals", field: "qiimaha.habka_bixinta", value: "dhan" },
    BIXINTA_QAYB: { op: "equals", field: "qiimaha.habka_bixinta", value: "qayb" },
    BIXINTA_HADHAA: { op: "equals", field: "qiimaha.habka_bixinta", value: "hadhaa" },
    RAHMAD_JIRA: { op: "is_true", field: "shuruudaha.iibiyuhu_bixinayaa_dammaanad" },
    WAREEJINTA_LAA_SAHAN: { op: "is_true", field: "shuruudaha.hantida_wareegay" },
    LAHAANSHAHA_CADDEEY: { op: "is_true", field: "shuruudaha.iibiyuhu_caddeynayaa" },
    IIBSADAHU_AQBALAY: { op: "is_true", field: "shuruudaha.iibsaduhu_ahqiiqiyay" },
  },

  // Same formatting contract as every other document type in the office.
  format: {
    dateFormat: "DD/MM/YYYY",
    currency: { mode: "symbol", symbol: "$", code: "USD", wordsUnit: "Dollar" },
  },

  // Somali wording for stored values. The form stores machine values
  // ("dhul_banaan", "dhan"); the document must read as Somali prose, so
  // the mapping lives here and a raw storage value can never be printed.
  derivedText: {
    [`${DEJINTA}.sub_type`]: {
      dhul_banaan: "Dhul Banaan",
      guri: "Guri",
      beer: "Beer",
    },
    "qiimaha.habka_bixinta": {
      dhan: "Lacag Dhan (Full Payment)",
      qayb: "Qayb Lacag ah (Partial Payment)",
      hadhaa: "Hadhaaga (Balance)",
    },
    "shuruudaha.hantida_wareegay": { yes: "Hantida waxaa la wareejiyay iibsadaha", no: "Hantida weli ma la wareejin" },
    "shuruudaha.iibiyuhu_caddeynayaa": { yes: "Iibiyuhu wuxuu caddeynayaa inuu hantida u leeyahay", no: "Iibiyuhu ma caddeynayso lahaanshaha" },
    "shuruudaha.iibsaduhu_ahqiiqiyay": { yes: "Iibsaduhu wuxuu xaqiijinayaa inuu iibka uu qabtay", no: "Iibsaduhu weli ma xaqiijin aqbalashada" },
    "shuruudaha.iibiyuhu_bixinayaa_dammaanad": { yes: "Dammaanad ma la bixiyay lahaanshaha", no: "Dammaanad ma jiro" },
  },

  // Values the SYSTEM derives — the user never types them, so they can
  // never contradict the answers they come from.
  //   LACAGTA_HADHAY  = qiimaha_guud − lacagta_bixiyay (never negative)
  //   TIRADA_…        = number of filled sellers / buyers
  derivedValues: [
    {
      token: "LACAGTA_HADHAY",
      op: "subtract",
      keys: ["qiimaha.qiimaha_guud", "qiimaha.lacagta_bixiyay"],
      format: "currency",
      label: "Lacagta Hadhay (qiimaha − bixiyay)",
    },
    {
      token: "LACAGTA_HADHAY_QORAAL",
      op: "subtract",
      keys: ["qiimaha.qiimaha_guud", "qiimaha.lacagta_bixiyay"],
      format: "currency_words",
      label: "Lacagta Hadhay (qoraal)",
    },
    { token: "TIRADA_IIBIYEYAAL", op: "party_count", partyId: "iibiyeyaal", format: "number", label: "Tirada iibiyayaasha" },
    { token: "TIRADA_IIBSADAYAAL", op: "party_count", partyId: "iibsadayaal", format: "number", label: "Tirada iibsadayaasha" },
  ],

  sections: [
    {
      id: DEJINTA,
      title: "Dejinta Hantida",
      description: "Nooca hantida la iibsaday, nambarka tixraaca iyo taariikhda.",
      fields: [
        { id: "sub_type", type: "select", label: "Nooca Hantida", options: HANTI_SUBTYPES, validation: { required: true }, hint: "Dhul Banaan, Guri ama Beer", colSpan: 2 },
        { id: "reference", type: "text", label: "Nambarka Tixraaca (Reference Number)", optional: true, placeholder: "Si toos ah ayaa la abuurayaa" },
        { id: "taariikhda_hantida", type: "date", label: "Taariikhda Iibka", validation: { required: true } },
      ],
    },
    {
      id: "iibiyaha",
      title: "Iibiyaha",
      description: "Qofka ama dadka hantida iibsanaya.",
      parties: [
        {
          id: "iibiyeyaal",
          label: "Iibiyayaal",
          singular: "Iibiyaha",
          description: "Hal iibiy oo keliya ama dad badan.",
          min: 1,
          attendance: true,
          // The interview asks "Tirada Iibiyayaasha?" in its own step
          // before the data/attendance step.
          countFirst: true,
          representativeFields: REPRESENTATIVE_FIELDS,
          fields: partyFields("Iibiyaha"),
        },
      ],
      fields: [],
    },
    {
      id: "iibsadaha",
      title: "Iibsadaha",
      description: "Qofka ama dadka hantida iibsanaya.",
      parties: [
        {
          id: "iibsadayaal",
          label: "Iibsadayaal",
          singular: "Iibsadaha",
          description: "Hal iibsade oo keliya ama dad badan.",
          min: 1,
          attendance: true,
          countFirst: true,
          representativeFields: REPRESENTATIVE_FIELDS,
          fields: partyFields("Iibsadaha"),
        },
      ],
      fields: [],
    },
    {
      id: "hantida_dhul_banaan",
      title: "Faahfaahinta Dhulka",
      description: "Xuduudaha dhulka la iibsanayo.",
      visibleWhen: isHanti("dhul_banaan"),
      fields: [
        { id: "nooca_hantida", type: "text", label: "Nooca Hantida (Nooca Dhulka)", validation: { required: true }, placeholder: "Tusaale: Dhul Degmada, Dhul Beere, Dhul Miisa" },
        { id: "goobta", type: "text", label: "Goobta / Degmada / Xaafadda", validation: { required: true }, placeholder: "Tusaale: Degmada Waardhiil, Xaafadda Sooma" },
        { id: "cabbirka", type: "text", label: "Cabbirka Dhulka", validation: { required: true }, placeholder: "Tusaale: 5,000 m²" },
        { id: "xadka_waqooyi", type: "text", label: "Xadka Waqooyi", optional: true, placeholder: "Waxaa ku jira xad" },
        { id: "xadka_bari", type: "text", label: "Xadka Bari", optional: true, placeholder: "Waxaa ku jira xad" },
        { id: "xadka_koonfur", type: "text", label: "Xadka Koonfur", optional: true, placeholder: "Waxaa ku jira xad" },
        { id: "xadka_galbeed", type: "text", label: "Xadka Galbeed", optional: true, placeholder: "Waxaa ku jira xad" },
        { id: "lambarka_lahaansho", type: "text", label: "Lambar / Aqoonsi Lahaansho", optional: true, skippable: true, placeholder: "Lambarka lahaanshaha (haddii jiro)" },
        { id: "faahfaahin_dheeraad", type: "textarea", label: "Faahfaahin Dheeraad ah", optional: true, colSpan: 2, placeholder: "Wax ka badan oo dhulka ku saabsan…" },
      ],
    },
    {
      id: "hantida_guri",
      title: "Faahfaahinta Guriga",
      description: "Xuduudaha guriga la iibsanayo.",
      visibleWhen: isHanti("guri"),
      fields: [
        { id: "goobta", type: "text", label: "Goobta Guriga", validation: { required: true }, placeholder: "Tusaale: Hargeisa" },
        { id: "degmada_xaafadda", type: "text", label: "Degmada / Xaafadda", validation: { required: true }, placeholder: "Tusaale: Degmada Hargeisa" },
        { id: "cabbirka", type: "text", label: "Cabbirka Guriga", optional: true, skippable: true, placeholder: "Tusaale: 150 m²" },
        { id: "nooca_guriga", type: "text", label: "Nooca Guriga", validation: { required: true }, placeholder: "Tusaale: Guri Xaas" },
        { id: "xuduudaha", type: "text", label: "Xuduudaha Guriga", optional: true, skippable: true, placeholder: "Tusaale: Koronto, biyo, dariik" },
        { id: "lambarka_lahaansho", type: "text", label: "Lambar / Aqoonsi Lahaansho", validation: { required: true }, placeholder: "Lambarka lahaanshaha" },
        { id: "faahfaahin_dheeraad", type: "textarea", label: "Faahfaahin Dheeraad ah", optional: true, colSpan: 2, placeholder: "Wax ka badan oo guriga ku saabsan…" },
      ],
    },
    {
      id: "hantida_beer",
      title: "Faahfaahinta Beeraha",
      description: "Xuduudaha beeraha la iibsanayo.",
      visibleWhen: isHanti("beer"),
      fields: [
        { id: "goobta", type: "text", label: "Goobta Beeraha", validation: { required: true }, placeholder: "Tusaale: Hargeisa" },
        { id: "degmada_xaafadda", type: "text", label: "Degmada / Xaafadda", validation: { required: true }, placeholder: "Tusaale: Degmada Hargeisa" },
        { id: "cabbirka", type: "text", label: "Cabbirka Beeraha", validation: { required: true }, placeholder: "Tusaale: 80 m²" },
        { id: "nooca_beeraha", type: "text", label: "Nooca Beeraha", validation: { required: true }, placeholder: "Tusaale: Beer Dhab ah" },
        { id: "xuduudaha", type: "text", label: "Xuduudaha Beeraha", optional: true, skippable: true, placeholder: "Tusaale: Bandhig, kalkaaliye" },
        { id: "lambarka_lahaansho", type: "text", label: "Lambar / Aqoonsi Lahaansho", validation: { required: true }, placeholder: "Lambarka lahaanshaha" },
        { id: "faahfaahin_dheeraad", type: "textarea", label: "Faahfaahin Dheeraad ah", optional: true, colSpan: 2, placeholder: "Wax ka badan oo beeraha ku saabsan…" },
      ],
    },
    {
      id: "qiimaha",
      title: "Qiimaha & Habka Lacag Bixinta",
      description: "Qiimaha guud, lacagta la bixiyay iyo habka bixinta.",
      fields: [
        { id: "qiimaha_guud", type: "currency", label: "Qiimaha Guud ee Hantida", validation: { required: true, min: 0 }, placeholder: "Tusaale: 12500" },
        { id: "habka_bixinta", type: "select", label: "Habka Bixinta", options: HABKA_BIXINTA, validation: { required: true }, colSpan: 2 },
        // Required as soon as any part of the price is still outstanding,
        // and never more than the total price.
        { id: "lacagta_bixiyay", type: "currency", label: "Lacagta la Bixiyay", optional: true, requiredWhen: { op: "or", conditions: [{ op: "equals", field: "qiimaha.habka_bixinta", value: "qayb" }, { op: "equals", field: "qiimaha.habka_bixinta", value: "hadhaa" }] }, validation: { min: 0, notMoreThan: "qiimaha_guud" }, placeholder: "Waxaa la bixiyay" },
        { id: "taariikhda_bixinta", type: "date", label: "Taariikhda Bixinta", optional: true, skippable: true },
        { id: "bangiga_hisaabka", type: "text", label: "Bangi / Account", optional: true, skippable: true, placeholder: "Nambarka xisaabta (haddii bangi la bixiyo)" },
      ],
    },
    {
      id: "shuruudaha",
      title: "Xuduudaha & Shuruudaha Iibka",
      description: "Wareejinta, lahaanshaha, dammaanadda iyo qoraalka dheeraad ah.",
      fields: [
        { id: "hantida_wareegay", type: "yes_no", label: "Hantida waxaa la wareejiyay iibsadaha?", options: YES_NO, validation: { required: true }, colSpan: 2 },
        { id: "iibiyuhu_caddeynayaa", type: "yes_no", label: "Iibiyuhu wuxuu caddeynayaa inuu hantida u leeyahay?", options: YES_NO, validation: { required: true }, colSpan: 2 },
        { id: "iibsaduhu_ahqiiqiyay", type: "yes_no", label: "Iibsaduhu wuxuu xaqiijinayaa inuu iibka uu qabtay?", options: YES_NO, validation: { required: true }, colSpan: 2 },
        { id: "iibiyuhu_bixinayaa_dammaanad", type: "yes_no", label: "Dammaanad ma la bixinay lahaanshaha (rah mad / aamaanad)?", options: YES_NO, validation: { required: true }, description: "Haddii Haa, tallaabada xiga ah ayaa muuqan doonta", colSpan: 2 },
        { id: "shuruudaha_gaarka_ah", type: "textarea", label: "Shuruudaha Iibka (Qoraal Dheeraad ah)", optional: true, colSpan: 2, placeholder: "Shuruudo dheeraad ah oo iibka ku saabsan (haddii jira)…" },
      ],
    },
    {
      id: "rahmad",
      title: "Rahmad / Aamaanad",
      description: "Xogta rahmadda ama aamaanada hantida leh.",
      // The whole section exists only when the pledge question was Haa —
      // when there is no pledge, this part simply does not appear.
      visibleWhen: { op: "is_true", field: "shuruudaha.iibiyuhu_bixinayaa_dammaanad" },
      fields: [
        { id: "nooca_rahmada", type: "text", label: "Nooca Rahmadda / Aamaanada", validation: { required: true }, placeholder: "Tusaale: Dabadeed, Reer, Ishaan" },
        { id: "degmada_xaafadda", type: "text", label: "Degmada / Xaafadda", validation: { required: true }, placeholder: "Tusaale: Degmada Hargeisa" },
        { id: "lambarka_lahaansho", type: "text", label: "Lambar Lahaansho / Title Number", validation: { required: true }, placeholder: "Lambarka rahmadda" },
        { id: "faahfaahin", type: "textarea", label: "Faahfaahin", optional: true, colSpan: 2, placeholder: "Wax ka badan oo rahmadda ku saabsan…" },
      ],
    },
    {
      id: "maragyada",
      title: "Maragyada",
      description: "W maragyo — dynamic list, ugu yaraan hal.",
      parties: [
        {
          id: "maragyo",
          label: "Maragyo",
          singular: "Marag",
          description: "Ku dar hal ama dhowr marag.",
          min: 1,
          fields: [
            { id: "magac", type: "text", label: "Magaca Maraga", validation: { required: true } },
            { id: "telefoon", type: "phone", label: "Telefoon", optional: true },
            { id: "aqoonsi", type: "text", label: "Aqoonsi", optional: true },
            { id: "cinwaan", type: "text", label: "Cinwaan", optional: true },
          ],
        },
      ],
      fields: [],
    },
  ],

  // BUILT FROM THE PLACEHOLDER REGISTRY — canonical names first, accepted
  // aliases after them (never generated, always resolvable).
  placeholders: registryPlaceholders(),

  // No {{CLAUSE_*}} blocks: every legal sentence lives in the office's own
  // Word template. The engine only fills the answers it reads from above.
  clauses: [],
};
