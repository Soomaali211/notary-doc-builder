import type {
  Condition,
  DocumentConfig,
  FieldDef,
  PlaceholderMapping,
  SelectOption,
  TemplateSpec,
} from "../types";
import { KALA_IIBSI_HANTI_PLACEHOLDERS } from "../placeholderRegistry";

/**
 * KALA IIBSI HANTI — sale of property (dhul banaan / guri / beer).
 *
 * This is pure DATA, exactly like Heshiis Kiro: the interview, validation,
 * review and generation all read from it. Nothing here designs the Word
 * template and nothing here writes legal wording — the office's own .docx
 * owns the prose, this file only says which data exists, how it is
 * validated, and which placeholder carries it.
 *
 * The DHUL BANAAN shape (the sub-type the office actually delivers today) is
 * derived from the scanned sale agreements: one date, the plot's location,
 * the sellers, the buyers, the guarantor, the price, the witnesses. Every
 * party is a repeatable row — there is no `iibiyaha_1` / `iibiyaha_2`
 * anywhere, because the scans contain one seller in every sample and the
 * count must never be capped by the form.
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

/**
 * Sida hantida la helay. The seller either INHERITED the plot or BOUGHT it,
 * and the proof of that is a different document in each case: the heirs'
 * certificate (beerta) when he inherited, the notary/sale reference when he
 * bought it. Stated once, in the form, so the proof field can never be
 * collected for the wrong case.
 */
const SIDA_HANTIDA: SelectOption[] = [
  { value: "dhaxlay", label: "Wuu dhaxlay (her / beerta)" },
  { value: "iibsaday", label: "Wuu iibsaday (qof kale)" },
];

/** Nooca dammaanadda — a third party guarantees, or the seller guarantees. */
const NOOCA_DAMIIN: SelectOption[] = [
  { value: "qof_3aad", label: "Damiin qof 3aad" },
  { value: "iibiyaha", label: "Iibiyaha oo is-damiinaya" },
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

const HANTIDA_DHUL_BANAAN = "hantida_dhul_banaan";

/** Sida hantida la helay equals one of the given values. */
const sidaHantida = (...values: string[]): Condition => ({
  op: "or",
  conditions: values.map((value) => ({
    op: "equals" as const,
    field: `${HANTIDA_DHUL_BANAAN}.sida_hantida_loo_helay`,
    value,
  })),
});

/** The guarantor is a third party (not the seller guaranteeing himself). */
const DAMIIN_QOF_3AAD: Condition = {
  op: "equals",
  field: "damiinka.nooca_damiinta",
  value: "qof_3aad",
};

/**
 * Word templates per sub-type. The office designs each .docx; the app only
 * fills placeholders. The files are added when the office delivers them —
 * until then the generation step reports the missing template instead of
 * producing a document with unresolved placeholders.
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

/**
 * Identity + photo of one seller or one buyer.
 *
 * The phone and the photo belong to the PERSON. For a BUYER they are
 * collected only when he is present: an absent buyer is represented by a
 * wakiil, so asking for the buyer's own phone or photo would ask for data
 * that does not exist. For a SELLER there is no attendance state at all — he
 * always signs his own sale — so those two fields carry no row-status rule.
 */
function partyFields(role: string, opts: { attendance: boolean }): FieldDef[] {
  return [
    {
      id: "magac",
      type: "text",
      label: `Magaca ${role}`,
      validation: { required: true },
      placeholder: `Magaca ${role.toLowerCase()}`,
    },
    {
      id: "degan",
      type: "text",
      label: `Degan ${role}`,
      validation: { required: true },
      placeholder: "Degmada / Xaafadda / Magaalada",
    },
    {
      id: "telefoon",
      type: "phone",
      label: `Telefoonka ${role}`,
      optional: true,
      ...(opts.attendance
        ? { requiredWhenRowStatus: "jooga" as const, showOnlyWhenRowStatus: "jooga" as const }
        : {}),
      placeholder: "+252 61 5551234",
    },
    {
      id: "sawir",
      type: "photo",
      label: `Sawirka ${role}`,
      optional: true,
      ...(opts.attendance
        ? { requiredWhenRowStatus: "jooga" as const, showOnlyWhenRowStatus: "jooga" as const }
        : {}),
      description: "Sawirka qofka (nolosha, tirakoob badan).",
    },
  ];
}

/**
 * Per-wakiil data (entered once per representative, shared by all the absent
 * parties they stand for). The scans show only a name and a photo for the
 * person who signs in an absent buyer's place.
 */
const REPRESENTATIVE_FIELDS: FieldDef[] = [
  { id: "magac", type: "text", label: "Magaca Wakiilka", validation: { required: true } },
  { id: "sawir", type: "photo", label: "Sawirka Wakiilka", optional: true },
];

export const kalaIiibsiHantiConfig: DocumentConfig = {
  id: "kala_iibsi_hanti",
  title: "Kala Iibsi Hanti",
  description:
    "Kala iibsi hanti oo u dhaxeeya iibiyaha iyo iibsadaha — dhul banaan, guri ama beer.",
  fileNamePrefix: "Kala-Iibsi-Hanti",
  outputFolder: "KalaIibsiHanti",
  templatePath: "/templates/kala_iiibsi_hanti/guri.docx",
  // The short serial the DATABASE stores. It is allocated by the notary_counters
  // table (strictly sequential, never reused) and passes the server's
  // letters/digits/dashes rule untouched.
  referencePrefix: "DPN-MG",
  // The reference the DOCUMENT prints — the same serial plus the document's
  // own month/year, exactly as the scanned agreements show it. Composed for
  // printing only; the database keeps referencePrefix + serial.
  referenceFormat: "Ref/Dpn/MG/{serial}/{MM}/{YY}",
  referenceDateKey: `${DEJINTA}.taariikhda_hantida`,
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
  // several absent buyers sharing one wakiil produce ONE wakiil record.
  repeatBlocks: [
    { blockId: "MARAGYO", partyId: "maragyo", numberPlaceholder: "NUMBER" },
    { blockId: "IIBIYEYAAL", partyId: "iibiyeyaal" },
    { blockId: "IIBSADAYAAL", partyId: "iibsadayaal" },
    { blockId: "WAKIILO_IIBSADAYAAL", partyId: "wakiilo_iibsadayaal", numberPlaceholder: "NUMBER" },
  ],

  // {{IF:…}} flags.
  conditionFlags: {
    HANTI_DHUL_BANAAN: { op: "equals", field: `${DEJINTA}.sub_type`, value: "dhul_banaan" },
    HANTI_GURI: { op: "equals", field: `${DEJINTA}.sub_type`, value: "guri" },
    HANTI_BEER: { op: "equals", field: `${DEJINTA}.sub_type`, value: "beer" },
    // Proof of how the seller got the plot: inherited → beerta, bought → ref.
    HANTIDA_DHAXLAT: sidaHantida("dhaxlay"),
    HANTIDA_IIBSADAY: sidaHantida("iibsaday"),
    // The guarantor is somebody else, or the seller himself.
    DAMIIN_QOF_3AAD,
    DAMIIN_IIBIYAHA: { op: "equals", field: "damiinka.nooca_damiinta", value: "iibiyaha" },
  },

  // Same formatting contract as every other document type in the office.
  format: {
    dateFormat: "DD/MM/YYYY",
    currency: { mode: "symbol", symbol: "$", code: "USD", wordsUnit: "Dollar" },
  },

  // Somali wording for stored values. The form stores machine values
  // ("dhul_banaan", "dhaxlay"); the document must read as Somali prose, so
  // the mapping lives here and a raw storage value can never be printed.
  derivedText: {
    [`${DEJINTA}.sub_type`]: {
      dhul_banaan: "Dhul Banaan",
      guri: "Guri",
      beer: "Beer",
    },
    [`${HANTIDA_DHUL_BANAAN}.sida_hantida_loo_helay`]: {
      dhaxlay: "Hantida waxuu iibiyuhu dhaxlay",
      iibsaday: "Hantida waxuu iibiyuhu iibsaday",
    },
    "damiinka.nooca_damiinta": {
      qof_3aad: "Damiin qof 3aad",
      iibiyaha: "Iibiyaha oo is-damiinaya",
    },
  },

  // Values the SYSTEM derives — the user never types them, so they can
  // never contradict the answers they come from.
  //   DAMIIN_MAGACA = the third-party guarantor's name, or the SELLER's own
  //                  name when he guarantees his own sale (one slot, one name).
  derivedValues: [
    {
      token: "DAMIIN_MAGACA",
      op: "conditional",
      when: DAMIIN_QOF_3AAD,
      thenKey: "damiinka.magaca_damiinka",
      elseKey: "iibiyeyaal.magac",
      label: "Magaca damiinka (qof 3aad, ama iibiyaha is-damiinaya)",
    },
  ],

  sections: [
    {
      id: DEJINTA,
      title: "Dejinta Hantida",
      description: "Nooca hantida la iibsaday iyo taariikhda iibka.",
      fields: [
        {
          id: "sub_type",
          type: "select",
          label: "Nooca Hantida",
          options: HANTI_SUBTYPES,
          validation: { required: true },
          hint: "Dhul Banaan, Guri ama Beer",
          colSpan: 2,
        },
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
          // The interview asks "Tirada Iibiyayaasha?" in its own step before
          // the data step — the scan count is whatever the sale actually has.
          countFirst: true,
          fields: partyFields("Iibiyaha", { attendance: false }),
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
          // Buyers carry attendance: present (signs, with photo) or absent
          // (a wakiil signs, and the buyer's own photo is not used).
          attendance: true,
          countFirst: true,
          representativeFields: REPRESENTATIVE_FIELDS,
          fields: partyFields("Iibsadaha", { attendance: true }),
        },
      ],
      fields: [],
    },
    {
      id: HANTIDA_DHUL_BANAAN,
      title: "Faahfaahinta Dhulka",
      description: "Goobta dhulka la iibsanayo iyo caddaynta lahaanshaha.",
      visibleWhen: isHanti("dhul_banaan"),
      fields: [
        { id: "degmada", type: "text", label: "Degmada", validation: { required: true }, placeholder: "Tusaale: Degmada Waardhiil" },
        { id: "xaafada", type: "text", label: "Xaafada", validation: { required: true }, placeholder: "Tusaale: Xaafadda Sooma" },
        { id: "cabbirka", type: "text", label: "Cabbirka", validation: { required: true }, placeholder: "Tusaale: 5,000 m²" },
        { id: "jiho_1", type: "text", label: "Xadka / Jiho 1", validation: { required: true }, placeholder: "Tusaale: Xarunta Wacatariga" },
        { id: "jiho_2", type: "text", label: "Xadka / Jiho 2", validation: { required: true }, placeholder: "Tusaale: Jidka Mogadishu" },
        { id: "jiho_3", type: "text", label: "Xadka / Jiho 3", validation: { required: true }, placeholder: "Tusaale: Badda Sooma" },
        {
          id: "sida_hantida_loo_helay",
          type: "select",
          label: "Sida iibiyuhu hantida u helay",
          options: SIDA_HANTIDA,
          validation: { required: true },
          hint: "Wuxuu dhaxlay mise wuu iibsaday?",
          colSpan: 2,
        },
        // The proof of that: the heirs' certificate when the plot was
        // inherited, the notary reference when it was bought. Collect one —
        // the other is never asked for in that case.
        {
          id: "notary_ref",
          type: "text",
          label: "Tixraaca Notary / Warqadda Iibka",
          optional: true,
          requiredWhen: sidaHantida("iibsaday"),
          placeholder: "Tusaale: Nambarka warqadda iibka / File No / Tr No",
        },
        {
          id: "beerta",
          type: "text",
          label: "Beerta / Warqadda Dhaxalka",
          optional: true,
          requiredWhen: sidaHantida("dhaxlay"),
          placeholder: "Tusaale: Ilmo Hebel / Tr No",
        },
      ],
    },
    {
      // Guri and Beer keep the sections the office already approved for them.
      // Only Dhul Banaan was re-shaped from the scans — the other two sub-types
      // are untouched, so selecting them still collects their own property data.
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
      id: "damiinka",
      title: "Dammaanadda",
      description: "Qofka dammaanadda bixinaya — qof 3aad, ama iibiyaha isagu.",
      fields: [
        {
          id: "nooca_damiinta",
          type: "select",
          label: "Nooca Dammaanadda",
          options: NOOCA_DAMIIN,
          validation: { required: true },
          hint: "Qof 3aad mise iibiyaha isagu?",
          colSpan: 2,
        },
        // A third-party guarantor needs his own identity; when the seller
        // guarantees, the seller's name already stands in this slot.
        {
          id: "magaca_damiinka",
          type: "text",
          label: "Magaca Damiinka",
          optional: true,
          visibleWhen: DAMIIN_QOF_3AAD,
          requiredWhen: DAMIIN_QOF_3AAD,
          placeholder: "Magaca damiinka",
        },
        {
          id: "telefoonka_damiinka",
          type: "phone",
          label: "Telefoonka Damiinka",
          optional: true,
          visibleWhen: DAMIIN_QOF_3AAD,
          placeholder: "+252 61 5551234",
        },
        {
          id: "gurmadka_dammaanadda",
          type: "textarea",
          label: "Gurmadka / Qoraalka Dammaanadda",
          validation: { required: true },
          colSpan: 2,
          placeholder: "Waxa dammiinku dammaanadda ugu gaddaynayo…",
        },
        {
          id: "sawirka_damiinka",
          type: "photo",
          label: "Sawirka Damiinka",
          optional: true,
          visibleWhen: DAMIIN_QOF_3AAD,
          description: "Sawirka damiinka marka uu yahay qof 3aad.",
        },
      ],
    },
    {
      id: "qiimaha",
      title: "Qiimaha Hantida",
      description: "Qiimaha guud ee dhulka. Qoraalka waxuu system-ka iska soo saaraa.",
      fields: [
        {
          id: "qiimaha_guud",
          type: "currency",
          label: "Qiimaha Guud",
          validation: { required: true, min: 0 },
          placeholder: "Tusaale: 1600",
          colSpan: 2,
        },
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
          description: "Ku dar hal ama marag badan.",
          min: 1,
          fields: [
            { id: "magac", type: "text", label: "Magaca Maraga", validation: { required: true } },
            { id: "telefoon", type: "phone", label: "Telefoon", optional: true },
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
