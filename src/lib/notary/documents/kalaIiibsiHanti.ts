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

/**
 * The four property kinds the office sells.
 *
 * OPEN DECISION — "Hanti Kale" has NO scan. It is offered because the office
 * named it, and selecting it reveals NOTHING beyond the shared property
 * questions: no field, clause or wording has been invented for it. When the
 * Hanti Kale scan arrives, its fields are added here and nowhere else.
 * (See OPEN_DECISIONS.hantiKaleScan.)
 */
const HANTI_SUBTYPES: SelectOption[] = [
  { value: "dhul_banaan", label: "Dhul Banaan" },
  { value: "guri", label: "Guri" },
  { value: "beer", label: "Beer" },
  { value: "hanti_kale", label: "Hanti Kale" },
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

/**
 * Nooca dammaanadda — THREE answers, because "Maya" is a real answer.
 *
 * With only two options the form could never say "there is no guarantor", so
 * every agreement was forced to invent one. "Iibiyaha ayaa is-damiinaya"
 * connects the guarantee to the SELLER instead of creating an unnecessary
 * external person.
 */
/**
 * THE FOUR SIDES OF A PLOT. Each side answers ONE question — does the plot
 * run to a road, or to a building? — and offers nothing else.
 */
const JIHADA = {
  waqooyi: { label: "Waqooyi", options: [{ value: "waddo", label: "Waddo" }, { value: "dhisme", label: "Dhisme" }] },
  koonfur: { label: "Koonfur", options: [{ value: "waddo", label: "Waddo" }, { value: "dhisme", label: "Dhisme" }] },
  bari: { label: "Bari", options: [{ value: "waddo", label: "Waddo" }, { value: "dhisme", label: "Dhisme" }] },
  galbeed: { label: "Galbeed", options: [{ value: "waddo", label: "Waddo" }, { value: "dhisme", label: "Dhisme" }] },
} as const satisfies Record<string, { label: string; options: SelectOption[] }>;

/** Which KIND of office reference this plot carries. */
const NOOCA_TIXRAACA: SelectOption[] = [
  { value: "file_no", label: "File No." },
  { value: "tr_no", label: "TR No." },
  { value: "notary_reference", label: "Notary Reference" },
];

/**
 * Paid in full, or only in part. The balance is a real question, so it is
 * asked — and "Lacagta Baaqiga ah" is shown only in the state where there
 * CAN be a balance. Paid in full, the balance field simply is not there.
 */
const SIDA_LACAGTA: SelectOption[] = [
  { value: "si_buuxda", label: "Si buuxda ayaa loo bixiyay" },
  { value: "qayb_aad_ah", label: "Qayb ayaa la bixiyay" },
];

const hasBalanceOwed: Condition = {
  op: "equals",
  field: "qiimaha.sida_lacagta",
  value: "qayb_aad_ah",
};

/** Step 1 — the Haa/Maya answer. The setup cards render `options`, so a
 *  yes/no question needs them spelled out (same shape as Heshiis Kiro).
 */
const YES_NO: SelectOption[] = [
  { value: "yes", label: "Haa" },
  { value: "no", label: "Maya" },
];

/**
 * Step 1 — one seller or several? Asked ONCE, here.
 *
 * This is the SAME shape Heshiis Kiro already uses for "Kireeye /
 * Kireeyayaal": a single/multiple choice that then reveals the count. The
 * choice and the count together are the single source of truth for the seller
 * list — no later step asks either again.
 */
const IIBIYE_MODE: SelectOption[] = [
  { value: "single", label: "Iibiye" },
  { value: "multiple", label: "Iibiyayaal" },
];

/** Step 1 — one buyer or several? Same single source of truth as above. */
const IIBSADE_MODE: SelectOption[] = [
  { value: "single", label: "Iibsade" },
  { value: "multiple", label: "Iibsadayaal" },
];

const NOOCA_DAMIIN: SelectOption[] = [
  { value: "qof_3aad", label: "Qof 3aad ayaa damiinaya" },
  { value: "iibiyaha", label: "Iibiyaha / Iibiyayaasha ayaa is-damiinaya" },
];

/**
 * SOMEBODY GUARANTEES. A sale is ALWAYS guaranteed — either by a third party
 * or by the seller himself. There is no third state: "Maya" here means the
 * SELLERS guarantee, not that no one does.
 *
 * The answer is given ONCE, in Dejinta Heshiiska, so Step 6 only collects the
 * details it already knows are needed.
 */
const DAMIIN_QOF_3AAD: Condition = {
  op: "equals",
  field: `${DEJINTA}.nooca_damiinta`,
  value: "qof_3aad",
};

/** The SELLERS guarantee their own sale — no third person is created. */
const DAMIIN_IIBIYAHA: Condition = {
  op: "equals",
  field: `${DEJINTA}.nooca_damiinta`,
  value: "iibiyaha",
};

/**
 * A yes/no gate in "Dejinta Heshiiska" that reveals one optional list.
 *
 * The question is asked ONCE, at the top, and the list it controls simply
 * does not exist until the answer is "Haa". That is what keeps "Tirada
 * Wakiillada" off the screen for the many sales that have no representative
 * at all.
 */
const isGate = (fieldId: string): Condition => ({
  op: "equals",
  field: `${DEJINTA}.${fieldId}`,
  value: "yes",
});

/**
 * The people a picker may offer: everyone already entered — sellers, buyers
 * and the representatives — so a name is chosen, never retyped.
 */
const PERSON_SOURCE = "iibiyeyaal,iibsadayaal";

/**
 * JINSIGA — a person's gender, chosen by the notary.
 *
 * It is an ANSWER, never an inference. Nothing in this system reads a gender
 * out of a name, and there is no "iibiye → iibiso" rule anywhere: gender and
 * definiteness are two different axes (see partyModel.GENDER_WORDS), which is
 * exactly why a find-and-replace would corrupt the legal wording.
 */
const JINSI: SelectOption[] = [
  { value: "male", label: "Lab" },
  { value: "female", label: "Dheddig" },
  { value: "unknown", label: "Lama cayimin" },
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
/**
 * Xaaladda iibiyaha — where the person is in the room.
 *
 * This CLASSIFIES the sellers the count already created; it never changes how
 * many there are. Ten sellers stay ten sellers whether all ten are present,
 * three are absent and a representative signs for them.
 */
const XAALADDA_IIBIYE: SelectOption[] = [
  { value: "jooga", label: "Jooga — isaga isaga ayaa saxiixaya" },
  { value: "maqan", label: "Maqan — ma soo gaarin" },
  { value: "wakiil_ku_jooga", label: "Wakiil ku jooga" },
  { value: "wakiil_qayim_ku_matalaya", label: "Wakiil Qayim ku matalaya" },
];

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

/** The plot HAS an office reference (the notary answered "Haa"). */
const hasReference: Condition = {
  op: "equals",
  field: `${HANTIDA_DHUL_BANAAN}.tixraaca_ma_jiraan`,
  value: "yes",
};

/** The plot has NO office reference — the "Calaamad Dheeraad ah" branch. */
const noReference: Condition = {
  op: "equals",
  field: `${HANTIDA_DHUL_BANAAN}.tixraaca_ma_jiraan`,
  value: "no",
};

/** Sida hantida la helay equals one of the given values. */
const sidaHantida = (...values: string[]): Condition => ({
  op: "or",
  conditions: values.map((value) => ({
    op: "equals" as const,
    field: `${HANTIDA_DHUL_BANAAN}.sida_hantida_loo_helay`,
    value,
  })),
});

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
 * This person IS represented — the answer that reveals the representative
 * picker. Blank means "nobody signs for this one", so the picker stays hidden.
 */
const MATALO_JIRO = ["wakiil", "wakiil_qayim"];

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
      // §4/§5/§24 — asked for ONE person only. With several people the
      // document uses plural wording, so per-person gender would contradict
      // it; it is never guessed from a name either.
      hideWhenListHasMany: true,
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
        // A family relationship is DATA about this person ("mother", "heir").
        // It grants no authority whatsoever and is never read from the name.
        id: "xiriirka_qoyska",
        type: "text" as const,
        label: "Xiriirka Qoyska",
        optional: true,
        placeholder: "Tusaale: Hooyada",
        description: "Xiriirku waa xog — ma aha u matalaa.",
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
      optional: true,
      placeholder: "Degmada / Xaafadda / Magaalada",
      description: "Xog dheeraad ah — haddii uu qorbaadkoodu u baahan yahay.",
    },
    ...(opts.role ? ([
      {
        id: "xaalad",
        type: "select" as const,
        label: "Xaaladda",
        options: XAALADDA_IIBIYE,
        optional: true,
        hint: "Wixii xaaladda qofka — tirada iibiyayaasha ma isbedelin.",
      },
    ] satisfies FieldDef[]) : []),
    {
      id: "telefoon",
      type: "phone",
      label: `Telefoonka ${role}`,
      // Shown for a PRESENT person only — an absent one is represented by a
      // wakiil, so the number belongs to the wakiil instead. Never required:
      // thirteen sellers must not each be forced to produce a phone number
      // (§22 — optional never blocks).
      optional: true,
      ...(opts.attendance ? { showOnlyWhenRowStatus: "jooga" as const } : {}),
      placeholder: "+252 61 5551234",
    },
    // Representation lives with the person's OWN step, exactly as Heshiis
    // Kiro does it: "Ma Joogaa Heshiiska?" → Maya → Qaybta Wakiilka. There is
    // no separate Matalaad question and no separate wakiil picker on the row,
    // because that asked the same thing twice in two places.
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
  // §7 — WAKIIL ≠ WAKIIL QAYIM. The two are different legal answers, asked
  // where the representative is entered, and NEVER defaulted to one another.
  {
    id: "nooca_wakiilka",
    type: "select",
    label: "Nooca Wakiilnimo",
    options: NOOCA_WAKIILKA,
    optional: true,
    hint: "Wakiil caadi ah iyo Wakiil Qayim waa laba arrimo oo kala duwan.",
  },
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
  // A witness is NOT required on every sale: the notary skips the list when
// the document does not call for one, and Continue still works.
requiresWitness: false,
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
    { blockId: "WAKIILO_IIBIYEYAAL", partyId: "wakiilo_iibiyeyaal", numberPlaceholder: "NUMBER" },
    { blockId: "WAKIILO_IIBSADAYAAL", partyId: "wakiilo_iibsadayaal", numberPlaceholder: "NUMBER" },
    // Independent lists. Each block repeats over ITS OWN list — a template
    // may print eight photographs beside thirteen sellers without the engine
    // once comparing the two counts.
    { blockId: "KOOXAHA", partyId: "kooxaha", numberPlaceholder: "NUMBER" },
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
    DAMIIN_IIBIYAHA,
    // The THIRD answer, and a real one: this sale has no guarantor at all.
    // Without this flag a template cannot tell "Maya" apart from "the notary
    // never got that far", and would print a guarantor slot for nobody.
    // Whether the plot carries an office reference at all (File / TR /
    // Notary), or is known only by a "Calaamad Dheeraad ah".
    HANTI_TIXRAACA: hasReference,
    HANTI_CALAAMAD_DHEERAAD: noReference,
    // The four "does this sale have one of those?" gates, so a template can
    // leave out a heading whose list is empty. Each mirrors exactly what the
    // notary answered at the top of the interview — nothing is inferred.
    SAWIRRO_MA_JIRAAN: isGate("sawirro_ma_jiraan"),
    SAXEEXO_MA_JIRAAN: isGate("saxeexo_ma_jiraan"),
    SHAXADO_MA_JIRAAN: isGate("shaxado_ma_jiraan"),
    // Is anybody representing the sellers? Same purpose as the gates above:
    // without a representative the wakiil section — heading included — must
    // leave the page completely, never sit there empty. It reads the notary's
    // own list of representatives, so it can never disagree with the rows.
    WAKIILO_IIBIYEYAAL: { op: "is_not_empty", field: "wakiilo_iibiyeyaal.magac" },
    WAKIILO_IIBSADAYAAL: { op: "is_not_empty", field: "wakiilo_iibsadayaal.magac" },
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
      hanti_kale: "Hanti Kale",
    },
    [`${HANTIDA_DHUL_BANAAN}.sida_hantida_loo_helay`]: {
      dhaxlay: "Hantida waxuu iibiyuhu dhaxlay",
      iibsaday: "Hantida waxuu iibiyuhu iibsaday",
    },
    "damiinka.nooca_damiinta": {
      qof_3aad: "Damiin qof 3aad",
      iibiyaha: "Iibiyaha oo is-damiinaya",
      ma_jiro: "Damiin ma jiro",
    },
    [`${DEJINTA}.nooca_damiinta`]: {
      qof_3aad: "Damiin qof 3aad ayaa damiinaya",
      iibiyaha: "Iibiyaha / Iibiyayaasha ayaa is-damiinaya",
    },
    // A compass side stores "waddo" or "dhisme"; the paper must read the
    // Somali word, never the storage value.
    [`${HANTIDA_DHUL_BANAAN}.jiho_waqooyi`]: { waddo: "Waddo", dhisme: "Dhisme" },
    [`${HANTIDA_DHUL_BANAAN}.jiho_koonfur`]: { waddo: "Waddo", dhisme: "Dhisme" },
    [`${HANTIDA_DHUL_BANAAN}.jiho_bari`]: { waddo: "Waddo", dhisme: "Dhisme" },
    [`${HANTIDA_DHUL_BANAAN}.jiho_galbeed`]: { waddo: "Waddo", dhisme: "Dhisme" },
    [`${HANTIDA_DHUL_BANAAN}.nooca_tixraaca`]: {
      file_no: "File No.",
      tr_no: "TR No.",
      notary_reference: "Notary Reference",
    },
    // The payment state reads as Somali too.
    "qiimaha.sida_lacagta": {
      si_buuxda: "Si buuxda ayaa loo bixiyay",
      qayb_aad_ah: "Qayb ayaa la bixiyay",
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
      flowStep: { n: 1, title: "Dejinta" },
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
        // §2 — the AGREEMENT'S date, not the date the property changed hands.
        // Renamed from "Taariikhda Iibka" so Step 1 reads exactly like the
        // Kiro setup; the key is unchanged, so the registry token and
        // referenceDateKey keep resolving exactly as before.
        {
          id: "taariikhda_hantida",
          type: "date",
          label: "Taariikhda Heshiiska",
          validation: { required: true },
        },
        // §2 — the reference is ALLOCATED BY THE OFFICE, not invented here:
        // the empty box is filled once, kept in the draft, and never asked
        // again. Same placeholder and optional rule as Heshiis Kiro.
        {
          id: "reference",
          type: "text",
          label: "Tixraaca Heshiiska (Reference Number)",
          placeholder: "Si toos ah ayaa la abuurayaa",
          optional: true,
          colSpan: 2,
        },
        // §1 — one seller or several. `setupCard` gives this the same big
        // selectable cards Heshiis Kiro uses for "Kireeye / Kireeyayaal", and
        // `partyModeTarget` wires the choice to the seller list below so no
        // step ever asks the same question twice.
        {
          id: "iibiye_mode",
          type: "radio",
          label: "Iibiye mise Iibiyayaal?",
          options: IIBIYE_MODE,
          // Not a blocking requirement (§22): an unanswered mode simply leaves
          // the list as-is, and the seller list's own min-1 rule still asks for
          // a seller. When answered, it decides the row count exactly.
          optional: true,
          description: "Hal iibiye ama laba iyo wixii ka badan",
          colSpan: 2,
          setupCard: true,
          partyModeTarget: "iibiyeyaal",
        },
        // The count is asked HERE and nowhere else — and only once "Iibiyayaal"
        // is chosen. Hidden fields are neither rendered nor validated, so the
        // single-seller path never shows or demands a number.
        {
          id: "tirada_iibiyayaasha",
          type: "number",
          label: "Tirada Iibiyayaasha",
          optional: true,
          visibleWhen: { op: "equals", field: `${DEJINTA}.iibiye_mode`, value: "multiple" },
          hint: "Hal sawir ama hal saxeex kasta ma qayb aha — tiradu waxay ka duul tahay.",
          colSpan: 2,
        },
        // §5 — buyers, exactly as sellers: one choice, one count, one place.
        {
          id: "iibsade_mode",
          type: "radio",
          label: "Iibsade mise Iibsadayaal?",
          options: IIBSADE_MODE,
          optional: true,
          description: "Hal iibsade ama laba iyo wixii ka badan",
          colSpan: 2,
          setupCard: true,
          partyModeTarget: "iibsadayaal",
        },
        {
          id: "tirada_iibsadayaasha",
          type: "number",
          label: "Tirada Iibsadayaasha",
          optional: true,
          visibleWhen: { op: "equals", field: `${DEJINTA}.iibsade_mode`, value: "multiple" },
          hint: "Hal sawir ama hal saxeex kasta ma qayb aha.",
          colSpan: 2,
        },
        // ONE place to say which optional lists this sale has. Each answer
        // A representative is decided INSIDE the person's own step
        // ("Ma Joogaa Heshiiska?" → Maya → Qaybta Wakiilka), exactly as
        // Heshiis Kiro does. There is no Step-1 "Wakiil ma jiraan?" — asking
        // it here too would decide the same thing twice.
        {
          id: "sawirro_ma_jiraan",
          type: "yes_no",
          options: YES_NO,
          label: "Sawirro ma jiraan?",
          optional: true,
          setupCard: true,
          hint: "Tiradu ma la xiriirin tirada iibiyayaasha.",
        },
        {
          id: "saxeexo_ma_jiraan",
          type: "yes_no",
          options: YES_NO,
          label: "Saxeexyaal ma jiraan?",
          optional: true,
          setupCard: true,
          hint: "Qof kasta oo iibiye ah ma saxeyn karo.",
        },
        {
          id: "shaxado_ma_jiraan",
          type: "yes_no",
          options: YES_NO,
          label: "Shaxado / Tixraacyo ma jiraan?",
          optional: true,
          setupCard: true,
          hint: "Beerta, wakiilnimo, tixraaca notary.",
        },
        // THE GUARANTEE IS DECIDED HERE, once. A sale is always guaranteed:
        // either a third party stands behind it, or the sellers guarantee
        // themselves. Step 6 then only collects what this answer made
        // necessary — the question itself is never asked twice.
        {
          id: "nooca_damiinta",
          type: "radio",
          label: "Damiin qof 3aad mise iibiyaha is-damiinanaya?",
          options: NOOCA_DAMIIN,
          optional: true,
          hint: "Maya = iibiyaha / iibiyayaasha ayaa is-damiinaya.",
          colSpan: 2,
          setupCard: true,
        },
      ],
    },
    {
      id: "iibiyaha",
      title: "Iibiyaha",
      flowStep: { n: 2, title: "Iibiyayaasha" },
      description: "Qofka ama dadka hantida iibsanaya.",
      parties: [
        {
          id: "iibiyeyaal",
          label: "Iibiyayaal",
          singular: "Iibiyaha",
          description: "Hal iibiy oo keliya ama dad badan.",
          min: 1,
          // The interview asks "Tirada Iibiyayaasha?" ONCE, in Dejinta
          // Heshiiska, and this list is built from that number — so it gets
          // NO count step of its own. The scan count is whatever the sale
          // actually has; it is never guessed from the people below.
          countFirst: true,
          countFrom: `${DEJINTA}.tirada_iibiyayaasha`,
          // "Iibiye" collapses the list to exactly one row; "Iibiyayaal"
          // uses the count typed beside the card.
          countFromMode: `${DEJINTA}.iibiye_mode`,
          // Sellers fill their data and status EXACTLY as Heshiis Kiro's
          // landlords do: "Ma Joogaa Heshiiska?" → Maya → Qaybta Wakiilka,
          // inside the same combined step. There is no second wakiil list.
          attendance: true,
          representativeFields: REPRESENTATIVE_FIELDS,
          fields: partyFields("Iibiyaha", { attendance: true, role: true }),
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
      flowStep: { n: 2, title: "Iibiyayaasha" },
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
      // PHOTOGRAPHS — a list in its own right.
      //
      // Nothing here is derived from the seller list and nothing here is
      // required: a sale may print eight photographs for thirteen sellers, or
      // none at all. Each row names the PERSON the picture belongs to.
      id: "sawirrada",
      title: "Sawirrada",
      flowStep: { n: 4, title: "Hantida" },
      description: "Sawirka qofka — tiradu ma la xiriirin tirada iibiyayaasha.",
      visibleWhen: isGate("sawirro_ma_jiraan"),
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
              // The person is CHOSEN from those already entered — the value is
              // that person's ID. The name is never typed a second time.
              id: "shakhsiga",
              type: "person",
              label: "Qofka",
              personSource: PERSON_SOURCE,
              validation: { required: true },
              description: "Dooro qofka hore u geliyey — sawirku ma xiranayo tirada iibiyayaasha.",
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
      flowStep: { n: 4, title: "Hantida" },
      description: "Yaa saxeexaya? Kasta hal unug — ma la xiriirin tirada iibiyayaasha.",
      visibleWhen: isGate("saxeexo_ma_jiraan"),
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
              id: "shakhsiga",
              type: "person",
              label: "Qofka saxeexaya",
              personSource: PERSON_SOURCE,
              validation: { required: true },
              description: "Qof kasta oo iibiye ah ma saxeyn karo.",
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
      flowStep: { n: 4, title: "Hantida" },
      description: "Beerta, wakiilnimo, tixraac — hal warqad ama badan.",
      visibleWhen: isGate("shaxado_ma_jiraan"),
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
      flowStep: { n: 3, title: "Iibsadayaasha" },
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
          // The buyer count is asked ONCE, in Dejinta Heshiiska — so this
          // list gets NO "Tirada Iibsadayaasha" step of its own.
          countFrom: `${DEJINTA}.tirada_iibsadayaasha`,
          countFromMode: `${DEJINTA}.iibsade_mode`,
          representativeFields: REPRESENTATIVE_FIELDS,
          fields: partyFields("Iibsadaha", { attendance: true }),
        },
      ],
      fields: [],
    },
    {
      id: HANTIDA_DHUL_BANAAN,
      title: "Faahfaahinta Dhulka",
      flowStep: { n: 4, title: "Hantida" },
      description: "Goobta dhulka la iibsanayo iyo caddaynta lahaanshaha.",
      visibleWhen: isHanti("dhul_banaan"),
      fields: [
        { id: "degmada", type: "text", label: "Degmada", optional: true, placeholder: "Tusaale: Degmada Waardhiil" },
        { id: "xaafada", type: "text", label: "Xaafadda / Deegaanka", optional: true, placeholder: "Tusaale: Xaafadda Sooma" },
        { id: "cabbirka", type: "text", label: "Cabbirka", optional: true, placeholder: "Tusaale: 5,000 m²" },
        // THE FOUR SIDES. Each side is a real compass direction with ONE
        // binary answer: the plot runs to a ROAD, or to a BUILDING. Nothing
        // else is offered, and nothing is defaulted — an unanswered side
        // prints nothing rather than picking one for the notary.
        ...(["waqooyi", "koonfur", "bari", "galbeed"] as const).map((side) => ({
          id: `jiho_${side}`,
          type: "select" as const,
          label: `Jiho ${JIHADA[side].label}`,
          options: JIHADA[side].options,
          optional: true,
          hint: `Waddo ama Dhisme?`,
        })),
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
        /* ---- THE FILE / TR / NOTARY BRANCH -----------------------
           One question decides whether this plot has an office reference at
           all. "Haa" leads to WHICH kind and then the number; "Maya" leads to
           a "Calaamad Dheeraad ah" instead — the description under which the
           notary already knows it. The notary is never pushed into inventing
           a reference that does not exist, and never types the number twice:
           {{NOTARY_REF}} and {{BEERTA}} both read this one field. */
        {
          id: "tixraaca_ma_jiraan",
          type: "yes_no",
          label: "Hantidu ma leedahay File No., TR No. ama Notary Reference?",
          optional: true,
          colSpan: 2,
          hint: "Maya = calaad dheeraad ah oo lagu aqoonsan karo hantida.",
        },
        {
          id: "nooca_tixraaca",
          type: "select",
          label: "Nooca Tixraaca",
          options: NOOCA_TIXRAACA,
          optional: true,
          visibleWhen: hasReference,
          hint: "File No., TR No., mise Notary Reference?",
        },
        {
          id: "lambarka_tixraaca",
          type: "text",
          label: "Lambarka / Tixraaca",
          optional: true,
          requiredWhen: hasReference,
          visibleWhen: hasReference,
          placeholder: "Tusaale: Tr No 4471",
        },
        {
          id: "calaamad_dheeraad",
          type: "textarea",
          label: "Calaamad Dheeraad ah",
          optional: true,
          visibleWhen: noReference,
          colSpan: 2,
          placeholder: "Faahfaahinta / calaadda dheeraadka ee hantida lagu aqoonsan karo…",
          description: "Plot-ka kama jiro tixraac la bixiyo? Halkan ayuu notary ku qortaa.",
        },
      ],
    },
    {
      // Guri and Beer keep the sections the office already approved for them.
      // Only Dhul Banaan was re-shaped from the scans — the other two sub-types
      // are untouched, so selecting them still collects their own property data.
      id: "hantida_guri",
      title: "Faahfaahinta Guriga",
      flowStep: { n: 4, title: "Hantida" },
      description: "Xuduudaha guriga la iibsanayo.",
      visibleWhen: isHanti("guri"),
      fields: [
        { id: "goobta", type: "text", label: "Goobta Guriga", optional: true, placeholder: "Tusaale: Hargeisa" },
        { id: "degmada_xaafadda", type: "text", label: "Degmada / Xaafadda", optional: true, placeholder: "Tusaale: Degmada Hargeisa" },
        { id: "cabbirka", type: "text", label: "Cabbirka Guriga", optional: true, skippable: true, placeholder: "Tusaale: 150 m²" },
        { id: "nooca_guriga", type: "text", label: "Nooca Guriga", optional: true, placeholder: "Tusaale: Guri Xaas" },
        { id: "xuduudaha", type: "text", label: "Xuduudaha Guriga", optional: true, skippable: true, placeholder: "Tusaale: Koronto, biyo, dariik" },
        { id: "lambarka_lahaansho", type: "text", label: "Lambar / Aqoonsi Lahaansho", optional: true, placeholder: "Lambarka lahaanshaha" },
        { id: "faahfaahin_dheeraad", type: "textarea", label: "Faahfaahin Dheeraad ah", optional: true, colSpan: 2, placeholder: "Wax ka badan oo guriga ku saabsan…" },
      ],
    },
    {
      id: "hantida_beer",
      title: "Faahfaahinta Beeraha",
      flowStep: { n: 4, title: "Hantida" },
      description: "Xuduudaha beeraha la iibsanayo.",
      visibleWhen: isHanti("beer"),
      fields: [
        {
          id: "magaca_beerta",
          type: "text",
          label: "Magaca Beeraha",
          optional: true,
          placeholder: "Tusaale: Beer Daara-Salaam",
          description:
            "Beer scan-ku wuxuu qabtay beer magac leh — goobta iyo beerka labo arrimo oo kala duwan.",
        },
        { id: "goobta", type: "text", label: "Goobta Beeraha", optional: true, placeholder: "Tusaale: Hargeisa" },
        { id: "degmada_xaafadda", type: "text", label: "Degmada / Xaafadda", optional: true, placeholder: "Tusaale: Degmada Hargeisa" },
        { id: "cabbirka", type: "text", label: "Cabbirka Beeraha", optional: true, placeholder: "Tusaale: 80 m²" },
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
        { id: "nooca_beeraha", type: "text", label: "Nooca Beeraha", optional: true, placeholder: "Tusaale: Beer Dhab ah" },
        { id: "xuduudaha", type: "text", label: "Xuduudaha Beeraha", optional: true, skippable: true, placeholder: "Tusaale: Bandhig, kalkaaliye" },
        { id: "lambarka_lahaansho", type: "text", label: "Lambar / Aqoonsi Lahaansho", optional: true, placeholder: "Lambarka lahaanshaha" },
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
      flowStep: { n: 6, title: "Damiin & Maragyo" },
      description: "Qofka dammaanadda bixinaya — qof 3aad, ama iibiyaha isagu.",
      // The WHETHER is already answered in Step 1, so it is never asked a
      // second time here. This step only collects what that answer made
      // necessary: a third party's details, or nothing at all when the
      // sellers guarantee themselves.
      fields: [
        // A third-party guarantor needs his own identity; when the sellers
        // guarantee, their names already stand in this slot — no new person
        // is ever created and no name is typed twice.
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
          id: "degan_damiinka",
          type: "text",
          label: "Degan Damiinka",
          optional: true,
          visibleWhen: DAMIIN_QOF_3AAD,
          placeholder: "Tusaale: Hargeisa",
        },
        {
          id: "gurmadka_dammaanadda",
          type: "textarea",
          label: "Gurmadka / Qoraalka Dammaanadda",
          optional: true,
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
      flowStep: { n: 5, title: "Qiimaha" },
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
          label: "Lacagta La Bixiyay",
          optional: true,
          // The amount paid can never exceed the price of the plot. This is a
          // numeric rule about ONE pair of fields — it says nothing about how
          // many people, photos or signatures the document has.
          // `notMoreThan` names a SIBLING field id (the engine compares two
          // fields of the same section), not a section-qualified path.
          validation: { min: 0, notMoreThan: "qiimaha_guud" },
          placeholder: "Tusaale: 600",
        },
        {
          id: "sida_lacagta",
          type: "select",
          label: "Sida Lacagta loo Bixiyay",
          options: SIDA_LACAGTA,
          optional: true,
        },
        // Asked ONLY when there is a balance left, and never above the price.
        {
          id: "lacagta_baaqiga_ah",
          type: "currency",
          label: "Lacagta Baaqiga ah",
          optional: true,
          visibleWhen: hasBalanceOwed,
          validation: { min: 0, notMoreThan: "qiimaha_guud" },
          placeholder: "Tusaale: 1000",
        },
        {
          // Free text on purpose: no scan names the payment methods this
          // office accepts, and inventing an option list would put wording
          // into a signed contract that no evidence supports.
          id: "habka_bixinta",
          type: "text",
          label: "Habka Lacag-bixinta",
          optional: true,
          placeholder: "Tusaale: Cash / Bank Transfer / Check",
        },
        {
          id: "faahfaahin_lacageed",
          type: "textarea",
          label: "Faahfaahin Lacageed",
          optional: true,
          skippable: true,
          colSpan: 2,
          placeholder: "Shuruudo / faahfaahin dheeraad oo ku saabsan lacag-bixinta…",
        },
      ],
    },
    {
      id: "maragyada",
      title: "Maragyada",
      flowStep: { n: 6, title: "Damiin & Maragyo" },
      description: "W maragyo — dynamic list, ugu yaraan hal.",
      parties: [
        {
          id: "maragyo",
          label: "Maragyo",
          singular: "Marag",
          description: "Ku dar hal ama marag badan.",
          // OPTIONAL. A sale the office does not require a witness for must
          // not be stopped by one, and an empty list is a real answer — never
          // a placeholder witness invented to satisfy a minimum.
          min: 0,
          optionalList: true,
          fields: [
            { id: "magac", type: "text", label: "Magaca Maraga", validation: { required: true } },
            { id: "telefoon", type: "phone", label: "Telefoon", optional: true },
            { id: "degan", type: "text", label: "Degan Maraga", optional: true, placeholder: "Degmada / Xaafadda" },
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
