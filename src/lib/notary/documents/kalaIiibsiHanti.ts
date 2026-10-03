import type {
  Condition,
  DocumentConfig,
  FieldDef,
  PlaceholderMapping,
  SectionDef,
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

/**
 * JINSIGA — a person's gender, chosen by the notary.
 *
 * It is an ANSWER, never an inference. Nothing in this system reads a gender
 * out of a name, and there is no "iibiye → iibiso" rule anywhere: gender and
 * definiteness are two different axes (see partyModel.GENDER_WORDS), which is
 * exactly why a find-and-replace would corrupt the legal wording.
 */
const JINSI: SelectOption[] = [
  { value: "male", label: "Nin (male)" },
  { value: "female", label: "Naag (female)" },
  { value: "unknown", label: "Ma garanayo — halkan lama sheegi karo" },
];

/**
 * The ROLE this person holds in the sale — a ROLE, not a gender and not an
 * authority. "M/QIYAM" and "D/MAALKA" are roles the scans print above a
 * signature line; neither says anything about who may sign for whom.
 * OPEN DECISION: the office's full list of role words is not settled — these
 * are the ones the Beer scan and the approved spec actually show.
 */
const DOORO_IIBIYE: SelectOption[] = [
  { value: "iibiye", label: "Iibiyaha (uu isaga iibsaday)" },
  { value: "wakiil", label: "Wakiil — wuxuu wakiil ka ah iibiyayaasha kale" },
  { value: "qiyam", label: "Qiyam (M/QIYAM)" },
  { value: "dam_maalka", label: "D/MAALKA" },
];

/**
 * The two authorities the office distinguishes.
 *
 *   Wakiil caadi ah — appointed for someone WHO CAN act for himself; the
 *     authority is a convenience, not a legal incapacity.
 *   Wakiil Qayim — appointed for someone WHO CANNOT act alone (a minor, an
 *     heir without capacity, an absent heir). This says something about the
 *     REPRESENTED person's legal capacity, so it is not interchangeable with
 *     an ordinary wakiil and is never defaulted.
 */
const NOOCA_WAKIILKA: SelectOption[] = [
  { value: "wakiil", label: "Wakiil caadi ah (qof siisaba wuxuu u qaadan karaa)" },
  { value: "wakiil_qayim", label: "Wakiil Qayim (qof aan iskiis u qaadi karin)" },
];

/**
 * PER-PERSON representation: does somebody else sign for this one?
 *
 * "Ma jiro" is a real answer and the DEFAULT answer — most people in a sale
 * sign for themselves, and it must never be confused with "we forgot to
 * ask". When either wakiil kind is chosen the office then picks WHICH
 * representative and WHICH people he covers.
 */
const NOOCA_MATALAADA: SelectOption[] = [
  { value: "ma_jiro", label: "Ma jiro — isaga isaga ayaa saxiixaya" },
  { value: "wakiil", label: "Wakiil caadi ah ayaa matalaya" },
  { value: "wakiil_qayim", label: "Wakiil Qayim ayaa matalaya" },
];

/**
 * THE FORM'S STEP ORDER.
 *
 * The office reads a sale aloud in this order, and the flipped form follows
 * it: who is selling, whose family they are, who stands for whom, who is
 * buying, what is being sold, what it costs, then the evidence that goes on
 * the paper — photographs, signatures, witnesses, certificates.
 *
 * The photographs and signatures deliberately come AFTER the price: they are
 * evidence gathered around the deal, not facts about the deal, and they are
 * counted by nobody.
 */
const SECTION_ORDER = [
  "dejinta",
  "iibiyaha",
  "kooxaha",
  "wakiillada",
  "iibsadaha",
  "hantida_dhul_banaan",
  "hantida_guri",
  "hantida_beer",
  "qiimaha",
  "damiinka",
  "sawirrada",
  "saxeexayaasha",
  "maragyada",
  "shaxadaha",
];

/**
 * The office's reading order, exported so the form's own step order can be
 * tested against it rather than against a copy of itself.
 */
export const KALA_IIBSI_HANTI_SECTION_ORDER = SECTION_ORDER;

/**
 * Sort the sections into the office's reading order.
 *
 * A section missing from SECTION_ORDER keeps its declared position at the
 * END rather than vanishing, so a new section is visible in the form the
 * moment it is added instead of disappearing silently.
 */
function ordered(list: SectionDef[]): SectionDef[] {
  const rank = (id: string) => {
    const i = SECTION_ORDER.indexOf(id);
    return i === -1 ? SECTION_ORDER.length : i;
  };
  return list
    .map((section, i) => ({ section, i }))
    .sort((a, b) => rank(a.section.id) - rank(b.section.id) || a.i - b.i)
    .map(({ section }) => section);
}

/** Signature prefixes. Taken from the Beer scan, not invented. */
const PREFIX_SAXEEX: SelectOption[] = [
  { value: "IIBIYE", label: "IIBIYE" },
  { value: "IIBISO", label: "IIBISO" },
  { value: "IIBIYE/WAKIIL", label: "IIBIYE/WAKIIL" },
  { value: "IIBISO/WAKIIL", label: "IIBISO/WAKIIL" },
  { value: "M/QIYAM", label: "M/QIYAM" },
  { value: "D/MAALKA", label: "D/MAALKA" },
];

/**
 * Kinds of supporting paper. MDH/C/… are court/ministry inheritance
 * certificates and Ref:APN/… is an authorization — both read off the scans.
 * OPEN DECISION: the office's full list of accepted papers is not settled.
 */
const NOOCA_SHAXADAH: SelectOption[] = [
  { value: "beerta", label: "Beerta / Warqadda Dhaxalka (MDH/C/…)" },
  { value: "poa", label: "Warqadda Wakiilnimo / POA (Ref:APN/…)" },
  { value: "notary_ref", label: "Tixraaca Notary / Warqadda Iibka" },
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
 * Identity of one seller or one buyer.
 *
 * There is NO photo field here, and that is deliberate. A photograph belongs
 * to the independent `sawirrada` list, linked to a person by name — because
 * the document decides how many photographs it prints, not how many sellers
 * it names. Thirteen sellers may print eight photographs; one seller may
 * print none. A photo field on this row would silently re-create the
 * photo-per-seller rule the office forbids, and would put a second, competing
 * place to enter the same picture.
 *
 * `jinsi` is an INPUT (the notary chooses it) and never derived from the
 * name. `dooro` is the ROLE this person holds — distinct from the gender and
 * distinct from any authority they may hold. `wakiil` names the person who
 * signs FOR this one; it is optional, because most people sign for
 * themselves.
 */
function partyFields(
  role: string,
  opts: { attendance: boolean; role?: boolean },
): FieldDef[] {
  return [
    {
      id: "magac",
      type: "text",
      label: `Magaca ${role}`,
      validation: { required: true },
      placeholder: `Magaca ${role.toLowerCase()}`,
    },
    {
      id: "jinsi",
      type: "select",
      label: "Jinsi",
      options: JINSI,
      optional: true,
      hint: "Wuxuu go'aamiyaa erayada qoraal — ha laga soo saarin magaca.",
    },
    ...(opts.role ? ([
      {
        id: "dooro",
        type: "select" as const,
        label: "Doorka qofka",
        options: DOORO_IIBIYE,
        optional: true,
        hint: "Doorka waa kala duwan jinsiga iyo wakiilnimo.",
      },
      {
        id: "koox",
        type: "text" as const,
        label: "Kooxa / Qoysku u qalmo",
        optional: true,
        placeholder: "Tusaale: Ilma Xassan Qaalib",
      },
    ] satisfies FieldDef[]) : []),
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
      id: "nooca_matalaada",
      type: "select",
      label: "Matalaad",
      options: NOOCA_MATALAADA,
      // NO default on purpose. A default value marks an otherwise-empty row
      // as "filled", which would conjure a nameless phantom party into the
      // document. Leaving it blank already means "nobody signs for this one".
      optional: true,
      hint: "Qof kale ayaa saxiixaya? Hal qof wuxuu matali karaa dad badan.",
    },
    {
      id: "wakiil",
      type: "text",
      label: "Wakiilka saxiixaya (haddii uu jiro)",
      optional: true,
      placeholder: "Magaca wakiilka — haddii uu qof kale u matalo",
    },
  ];
}

/**
 * Per-wakiil data for the ATTENDANCE flow (an absent buyer's representative),
 * collected once per representative and shared by every party they stand
 * for. The scans show a name and a photograph for the person who signs in an
 * absent buyer's place.
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
    // Independent lists. Each block repeats over ITS OWN list — a template
    // may print eight photographs beside thirteen sellers without the engine
    // once comparing the two counts.
    { blockId: "KOOXAHA", partyId: "kooxaha", numberPlaceholder: "NUMBER" },
    { blockId: "WAKIILLO", partyId: "wakiillo", numberPlaceholder: "NUMBER" },
    { blockId: "SAWIRRADA", partyId: "sawirrada", numberPlaceholder: "NUMBER" },
    { blockId: "SAXEEXAYAASHA", partyId: "saxeexayaasha", numberPlaceholder: "NUMBER" },
    { blockId: "SHAXADAHA", partyId: "shaxadaha", numberPlaceholder: "NUMBER" },
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
    // The legal role words. GENDER comes from the notary's own answer and
    // NUMBER from the list length; the two are resolved separately so that
    // "iibiye → iibisada" (which would change both at once) can never happen.
    // Singular with no chosen gender prints nothing rather than guessing.
    {
      token: "IIBIYE_WORDS",
      op: "party_gender_word",
      partyId: "iibiyeyaal",
      role: "seller",
      number: "auto",
      label: "Erayga iibiyaha (jinsi + tirad)",
    },
    {
      token: "IIBIYE_WORD",
      op: "party_gender_word",
      partyId: "iibiyeyaal",
      role: "seller",
      number: "auto",
      definite: true,
      label: "Erayga iibiyaha (definite: iibiyaha / iibisada)",
    },
    {
      token: "IIBSADE_WORDS",
      op: "party_gender_word",
      partyId: "iibsadayaal",
      role: "buyer",
      number: "auto",
      label: "Erayga iibsadaha (jinsi + tirad)",
    },
    {
      token: "IIBSADE_WORD",
      op: "party_gender_word",
      partyId: "iibsadayaal",
      role: "buyer",
      number: "auto",
      definite: true,
      label: "Erayga iibsadaha (definite: iibsadaha / iibsatada)",
    },
    // What is still OWED. This is arithmetic on two numbers the office typed
    // — the price minus what was paid — and nothing more: no wording is
    // invented here, and an unfilled price produces no line at all.
    //
    // OPEN DECISION: whether the sale is PAID IN FULL or PARTLY is a legal
    // statement no scan read so far makes, so the form does not ask it and
    // does not print it. See scanEvidence.ts.
    {
      token: "LACAGTA_HADHAY",
      op: "subtract",
      keys: ["qiimaha.qiimaha_guud", "qiimaha.lacagta_bixiyay"],
      format: "currency",
      label: "Lacagta weli loo bixinayo (qiimaha − la bixiyay)",
    },
  ],

  sections: ordered([
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
          fields: partyFields("Iibiyaha", { attendance: false, role: true }),
        },
      ],
      fields: [],
    },
    {
      // A family that owns the plot together. The group has a NAME and is
      // never a person — "Ilma Xassan Qaalib" cannot sign, be photographed
      // or be represented; its members can. Members ARE the seller rows,
      // which point back here by name, so one human being stays one person
      // however many roles he holds.
      id: "kooxaha",
      title: "Kooxa / Qoysku Iibiyaha",
      description:
        "Magaca kooxka ama qoysku — xubnihuna waa iibiyayaasha.",
      parties: [
        {
          id: "kooxaha",
          label: "Kooxaha",
          singular: "Koox",
          description: "Magaca kooxka ayaa la sheegaa; xubnihana waa iibiyayaasha.",
          min: 0,
          optionalList: true,
          countFirst: true,
          fields: [
            {
              id: "magac",
              type: "text",
              label: "Magaca Kooxka / Qoysku",
              optional: true,
              placeholder: "Tusaale: Ilma Xassan Qaalib",
            },
          ],
        },
      ],
      fields: [],
    },
    {
      // The authorities. A representative may stand for one person or for a
      // dozen, and two representatives may split the same group between
      // them. "Wakiil caadi ah" and "Wakiil Qayim" are different answers and
      // neither is ever assumed from the other.
      id: "wakiillada",
      title: "Wakiillada",
      description: "Qofka ama dadka saxiixaya magaca iibiyayaasha (iyo iibsadaha).",
      parties: [
        {
          id: "wakiillo",
          label: "Wakiillo",
          singular: "Wakiil",
          description:
            "Hal wakiil oo matalaa dad badan, ama wakiillo kala duwan oo qayb qayb u matalaan.",
          min: 0,
          optionalList: true,
          countFirst: true,
          fields: [
            {
              id: "magac",
              type: "text",
              label: "Magaca Wakiilka",
              validation: { required: true },
              placeholder: "Tusaale: Ruun Xassan Qaalib",
            },
            {
              id: "nooca_wakiilka",
              type: "select",
              label: "Nooca Wakiilnimo",
              options: NOOCA_WAKIILKA,
              optional: true,
              hint: "Wakiil caadi ah iyo Wakiil Qayim waa laba arrimo oo kala duwan.",
            },
            {
              id: "xiriirka_qoyska",
              type: "text",
              label: "Xiriirka Qoyska",
              optional: true,
              placeholder: "Tusaale: Hooyada",
              description:
                "Xiriirku waa xog, ma aha u matalaa. Qof waa hooyada ONA, wakiilna ka yahay QOF KALE.",
            },
            {
              id: "tixraaca_wakiilnimo",
              type: "text",
              label: "Tixraaca Wakiilnimo",
              optional: true,
              placeholder: "Tusaale: Ref:APN/096/2025",
            },
            {
              id: "xadka_wakiilnimo",
              type: "text",
              label: "Xadka Wakiilnimo",
              optional: true,
              placeholder: "Muxaadda uu wakiilku matalo",
            },
          ],
        },
      ],
      fields: [],
    },
    {
      // PHOTOGRAPHS — a list in its own right.
      //
      // Nothing here is derived from the seller list and nothing here is
      // required: a sale may print eight photographs for thirteen sellers, or
      // none at all. Each row names the PERSON the picture belongs to.
      id: "sawirrada",
      title: "Sawirrada",
      description: "Sawirka qofka — tiradu ma la xiriirin tirada iibiyayaasha.",
      parties: [
        {
          id: "sawirrada",
          label: "Sawirro",
          singular: "Sawir",
          description: "Hal sawir ama badan. Qofkee sawirkiisa ayaad haysaa?",
          min: 0,
          optionalList: true,
          countFirst: true,
          fields: [
            {
              id: "magac",
              type: "text",
              label: "Magaca Qofka",
              validation: { required: true },
              placeholder: "Magaca qofka sawirkiisa",
              description: "Sawirku wuxuu ku xiran yahay QOOFKA, ma aha tirada iibiyayaasha.",
            },
            {
              id: "sawir",
              type: "photo",
              label: "Sawirka",
              optional: true,
              description: "Sawirka qofka (nolosha, tirakoob badan).",
            },
            {
              id: "caption",
              type: "text",
              label: "Caption (haddii template-ku u baahan yahay)",
              optional: true,
              placeholder: "Tusaale: Iibsato | Faadumo",
            },
          ],
        },
      ],
      fields: [],
    },
    {
      // SIGNATURE LINES — also a list in its own right.
      //
      // Being a seller does NOT mean signing, and having a photograph does
      // NOT mean signing. The prefix is the ROLE printed above the name,
      // chosen by the notary for that line — never assembled from the name.
      id: "saxeexayaasha",
      title: "Saxeexayaasha",
      description: "Yaa saxeexaya? Kasta hal unug — ma la xiriirin tirada iibiyayaasha.",
      parties: [
        {
          id: "saxeexayaasha",
          label: "Saxeexayaal",
          singular: "Saxeex",
          description: "Hal saxeex ama badan. Hal qof ayaa laga saxixi karaa.",
          min: 0,
          optionalList: true,
          countFirst: true,
          fields: [
            {
              id: "magac",
              type: "text",
              label: "Magaca Qofka",
              validation: { required: true },
              placeholder: "Magaca qofka saxeexaya",
            },
            {
              id: "prefix",
              type: "select",
              label: "Doorka (prefix)",
              options: PREFIX_SAXEEX,
              optional: true,
              hint: "Waa doorka, ma aha jinsiga. Lama soo saarin magaca.",
            },
            {
              id: "shaxad",
              type: "text",
              label: "Saxeexda / Aqoonsiga (haddii uu jiro)",
              optional: true,
            },
          ],
        },
      ],
      fields: [],
    },
    {
      // Supporting papers. A single certificate slot cannot carry the four
      // MDH/C numbers the Beer scan prints alongside a POA reference.
      id: "shaxadaha",
      // (the buyers section sits below, after the signatories)
      title: "Shaxadaha iyo Warqadaha",
      description: "Beerta, wakiilnimo, tixraac — hal warqad ama badan.",
      parties: [
        {
          id: "shaxadaha",
          label: "Shaxado",
          singular: "Shaxad",
          description: "Hal shaxad ama badan (MDH/C/…, Ref:APN/…).",
          min: 0,
          optionalList: true,
          countFirst: true,
          fields: [
            {
              id: "tixraaca",
              type: "text",
              label: "Tixraaca",
              validation: { required: true },
              placeholder: "Tusaale: MDH/C/842/2025",
            },
            {
              id: "nooca_shaxadaha",
              type: "select",
              label: "Nooca Warqadda",
              options: NOOCA_SHAXADAH,
              optional: true,
            },
            {
              id: "haysa",
              type: "text",
              label: "Qofka / Kooxka ayay u tidhaahdo",
              optional: true,
              placeholder: "Magaca qofka ama kooxka",
            },
            {
              id: "taariikhda",
              type: "date",
              label: "Taariikhda La Siiyay",
              optional: true,
            },
          ],
        },
      ],
      fields: [],
    },
    {
      // The BUYERS come after the sellers, their group, the authorities, the
      // photographs and the signature lines — the order the office reads the
      // sale aloud in: who is selling, who stands for whom, who is in the
      // room, who signs, and only then who is buying.
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
          // Buyers carry attendance: present (signs in person) or absent (a
          // wakiil signs). The buyer's own photo is NOT collected here — it
          // belongs to the independent `sawirrada` list.
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
          id: "soohdimaha",
          type: "textarea",
          label: "Soohdimaha (Xadka)",
          optional: true,
          skippable: true,
          colSpan: 2,
          placeholder: "Soohdimo / xad-dhaaf ah oo dhulka ku dheereeysan…",
          description:
            "Dhul Banaan scan-ku wuxuu qabtay soohdimo dhulka; Beer scan-ku ma qabin.",
        },
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
        {
          id: "magaca_beerta",
          type: "text",
          label: "Magaca Beeraha",
          validation: { required: true },
          placeholder: "Tusaale: Beer Daara-Salaam",
          description:
            "Beer scan-ku wuxuu qabtay beer magac leh — goobta iyo beerka labo arrimo oo kala duwan.",
        },
        { id: "goobta", type: "text", label: "Goobta Beeraha", validation: { required: true }, placeholder: "Tusaale: Hargeisa" },
        { id: "degmada_xaafadda", type: "text", label: "Degmada / Xaafadda", validation: { required: true }, placeholder: "Tusaale: Degmada Hargeisa" },
        { id: "cabbirka", type: "text", label: "Cabbirka Beeraha", validation: { required: true }, placeholder: "Tusaale: 80 m²" },
        {
          id: "jiho_1",
          type: "text",
          label: "Jiho / Xad 1",
          optional: true,
          placeholder: "Tusaale: Xarunta Wacatariga",
        },
        {
          id: "jiho_2",
          type: "text",
          label: "Jiho / Xad 2",
          optional: true,
          placeholder: "Tusaale: Jidka Mogadishu",
        },
        { id: "nooca_beeraha", type: "text", label: "Nooca Beeraha", validation: { required: true }, placeholder: "Tusaale: Beer Dhab ah" },
        { id: "xuduudaha", type: "text", label: "Xuduudaha Beeraha", optional: true, skippable: true, placeholder: "Tusaale: Bandhig, kalkaaliye" },
        { id: "lambarka_lahaansho", type: "text", label: "Lambar / Aqoonsi Lahaansho", validation: { required: true }, placeholder: "Lambarka lahaanshaha" },
        { id: "faahfaahin_dheeraad", type: "textarea", label: "Faahfaahin Dheeraad ah", optional: true, colSpan: 2, placeholder: "Wax ka badan oo beeraha ku saabsan…" },
        // A well is part of some Beer agreements and absent from others, so
        // it is asked as an optional question rather than asserted as a rule.
        {
          id: "ceel",
          type: "yes_no",
          label: "Beerku wuxuu leeyahay ceel?",
          optional: true,
          hint: "Haddii template-ku u baahan yahay.",
        },
        {
          id: "shayada_ceelka",
          type: "textarea",
          label: "Shayada Ceelka",
          optional: true,
          visibleWhen: {
            op: "equals",
            field: "hantida_beer.ceel",
            value: "yes",
          },
          colSpan: 2,
          placeholder: "Goobta / cabbirka / xaafadda ceelka…",
        },
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
        {
          id: "lacagta_bixiyay",
          type: "currency",
          label: "Lacagta Bixiyay",
          optional: true,
          // The amount paid can never exceed the price of the plot. This is a
          // numeric rule about ONE pair of fields — it says nothing about how
          // many people, photos or signatures the document has.
          // `notMoreThan` names a SIBLING field id (the engine compares two
          // fields of the same section), not a section-qualified path.
          validation: { min: 0, notMoreThan: "qiimaha_guud" },
          placeholder: "Tusaale: 600",
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
  ]),

  // BUILT FROM THE PLACEHOLDER REGISTRY — canonical names first, accepted
  // aliases after them (never generated, always resolvable).
  placeholders: registryPlaceholders(),

  // No {{CLAUSE_*}} blocks: every legal sentence lives in the office's own
  // Word template. The engine only fills the answers it reads from above.
  clauses: [],
};
