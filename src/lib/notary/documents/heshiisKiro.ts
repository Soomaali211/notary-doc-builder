import type { DocumentConfig, SelectOption, TemplateSpec } from "../types";

const KIRO_SUBTYPES: SelectOption[] = [
  { value: "guri_xaas", label: "Guri Xaas" },
  { value: "qol_meherad", label: "Qol Meherad" },
  { value: "jiingad", label: "Jiingad" },
];

const PAYMENT_METHODS: SelectOption[] = [
  { value: "cash", label: "Cash (Lacag Cuskan)" },
  { value: "bank", label: "Bank Transfer (Wareejin Bangi)" },
  { value: "mobile", label: "Mobile Money (EVC / Sahal)" },
];

const PAYMENT_TIMING: SelectOption[] = [
  { value: "muqadin", label: "MUQADIN — horay (bil kasta bilowga)" },
  { value: "muakhir", label: "MU'AKHIR — dambe (dhamaadka bisha)" },
];

const PROPERTY_TYPES: SelectOption[] = KIRO_SUBTYPES;

/** Step 1 — single vs multiple landlords. */
const LANDLORD_MODES: SelectOption[] = [
  { value: "single", label: "Kireeye" },
  { value: "multiple", label: "Kireeyayaal" },
];

/** Step 1 — single vs multiple tenants. */
const TENANT_MODES: SelectOption[] = [
  { value: "single", label: "Kirayste" },
  { value: "multiple", label: "Kiraystayaal" },
];

/** Step 1 — open-ended vs fixed-term rental. */
const DURATION_KINDS: SelectOption[] = [
  { value: "furan", label: "Kiro Furan" },
  { value: "xidhan", label: "Kiro Xidhan" },
];

const YES_NO: SelectOption[] = [
  { value: "yes", label: "Haa" },
  { value: "no", label: "Maya" },
];

/**
 * Phase 3 — per-subtype Word templates. The office designs each .docx; the
 * app only fills placeholders. Selection is automatic by sub-type through
 * the Template Registry (config-driven, never hard-coded).
 */
const NOW = 0;
const KIRO_TEMPLATES: TemplateSpec[] = [
  {
    templateId: "KIRO_GURI_XAAS_V1",
    documentType: "heshiis_kiro",
    subtype: "guri_xaas",
    name: "Guri Xaas",
    filePath: "/templates/heshiis_kiro/guri_xaas.docx",
    version: 1,
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    templateId: "KIRO_QOL_MEHERAD_V1",
    documentType: "heshiis_kiro",
    subtype: "qol_meherad",
    name: "Qol Meherad",
    filePath: "/templates/heshiis_kiro/qol_meherad.docx",
    version: 1,
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    templateId: "KIRO_JIINGAD_V1",
    documentType: "heshiis_kiro",
    subtype: "jiingad",
    name: "Jiingad",
    filePath: "/templates/heshiis_kiro/jiingad.docx",
    version: 1,
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

/**
 * Sample configuration: HESHIIS KIRO (rental contract).
 *
 * This is pure data — the form engine, validation, review and generation all
 * read from it. Adding a future document type (Heshiis Deyn, Wakiilnimo,
 * Kala Iibsi Hanti, …) means adding another config like this one.
 */
export const heshiisKiroConfig: DocumentConfig = {
  id: "heshiis_kiro",
  title: "Heshiis Kiro",
  description:
    "Heshiis kiro oo u dhaxeeya kireeye iyo kirayste — guri xaas, qol meherad ama jiingad.",
  fileNamePrefix: "Heshiis-Kiro",
  // Archive output folder (output/Kiro/…) — independent of the title.
  outputFolder: "Kiro",
  templatePath: "/templates/heshiis_kiro_template.docx",
  referencePrefix: "DPN-K",
  requiresWitness: true,
  witnessPlaceholder: "{{MARAGYO_LIST}}",
  witnessSeparator: "\n",
  subTypes: KIRO_SUBTYPES,
  templates: KIRO_TEMPLATES,

  // Phase 3 — repeated blocks over dynamic party lists.
  // Phase Revision — WAKIILO_* blocks let the office's own template render
  // each shared representative ONCE plus who they represent ({{MATALAYA}}).
  repeatBlocks: [
    { blockId: "MARAGYO", partyId: "maragyo", numberPlaceholder: "NUMBER", aliases: { PHONE: "telefoon", ID: "aqoonsi" } },
    { blockId: "KIREYEYAYAAL", partyId: "kireeyayaal" },
    { blockId: "KIRAYSTAYAAL", partyId: "kiraystayaal" },
    { blockId: "WAKIILO_KIREEYAYAAL", partyId: "wakiilo_kireeyayaal", numberPlaceholder: "NUMBER" },
    { blockId: "WAKIILO_KIRAYSTAYAAL", partyId: "wakiilo_kiraystayaal", numberPlaceholder: "NUMBER" },
  ],

  // Phase 3 — named boolean flags for {{IF:FLAG}}…{{ENDIF}} blocks.
  // Step 1 (Dejinta Heshiiska) is the source of truth for these decisions.
  // Phase Document Generation — KIRO_XIDHAN / KIRO_FURAN let the user's own
  // Word template wrap the End-Date line ({{IF:KIRO_XIDHAN}} … {{END:KIRO_XIDHAN}}).
  conditionFlags: {
    DEEBAAJI_HAA: { op: "is_true", field: "heshiiska.deebaaji_haa" },
    DAMIIN_HAA: { op: "is_true", field: "heshiiska.damiin_haa" },
    MUQADIN: { op: "equals", field: "lacagta.bixinta_hore", value: "muqadin" },
    MUAKHIR: { op: "equals", field: "lacagta.bixinta_hore", value: "muakhir" },
    KIRO_XIDHAN: { op: "equals", field: "heshiiska.muddada_nooca", value: "xidhan" },
    KIRO_FURAN: { op: "equals", field: "heshiiska.muddada_nooca", value: "furan" },
  },

  // Phase 3 — configurable document formatting (29/09/2026, $500 …).
  format: {
    dateFormat: "DD/MM/YYYY",
    currency: { mode: "symbol", symbol: "$", code: "USD", wordsUnit: "Dollar" },
  },

  sections: [
    {
      id: "heshiiska",
      title: "Dejinta Heshiiska",
      description: "Aasaaska heshiiska — nambarka, nooca, dadka, muddada iyo go'aannada conditional.",
      fields: [
        // Req #8 — Step 1 UI order: Nooca → Kireeye → Kirayste → Muddada →
        // Deebaaji → Damiin → Bilowga (always) → Dhammaadka (Xidhan only) →
        // Reference → Taariikhda Heshiiska → Shuruudo gaar ah.
        { id: "sub_type", type: "select", label: "Nooca Kirada", options: KIRO_SUBTYPES, validation: { required: true }, hint: "Guri Xaas, Qol Meherad ama Jiingad" },
        { id: "kireeye_mode", type: "radio", label: "Kireeye", options: LANDLORD_MODES, validation: { required: true }, description: "Hal kireeye ama laba iyo wixii ka badan", colSpan: 2 },
        { id: "kirayste_mode", type: "radio", label: "Kirayste", options: TENANT_MODES, validation: { required: true }, description: "Hal kirayste ama laba iyo wixii ka badan", colSpan: 2 },
        { id: "muddada_nooca", type: "radio", label: "Nooca Muddada Kirada", options: DURATION_KINDS, validation: { required: true }, description: "Kiro Furan = muddo aan end date go'an lahayn · Kiro Xidhan = muddo iyo end date cad", colSpan: 2 },
        { id: "deebaaji_haa", type: "yes_no", label: "Deebaaji ma jiraa?", options: YES_NO, validation: { required: true }, description: "Haddii Haa, tallaabada Deebaajiga ayaa muuqan doonta" },
        { id: "damiin_haa", type: "yes_no", label: "Damiin ma jiraa?", options: YES_NO, validation: { required: true }, description: "Haddii Haa, tallaabada Damiinka ayaa muuqan doonta" },
        { id: "taariikhda_bilowga", type: "date", label: "Taariikhda Bilowga", validation: { required: true } },
        { id: "taariikhda_dhammaadka", type: "date", label: "Taariikhda Dhammaadka / Mudada", visibleWhen: { op: "equals", field: "heshiiska.muddada_nooca", value: "xidhan" }, validation: { required: true, notBefore: "taariikhda_bilowga" }, hint: "Waa inay ka dambeysaa taariikhda bilowga" },
        { id: "reference", type: "text", label: "Nambarka Tixraaca (Reference Number)", placeholder: "Si toos ah ayaa la abuurayaa", optional: true, colSpan: 1 },
        { id: "taariikhda_heshiiska", type: "date", label: "Taariikhda Heshiiska", validation: { required: true } },
        { id: "shuruudaha_gaarka_ah", type: "textarea", label: "Shuruudaha Gaarka ah (Special Terms)", optional: true, colSpan: 2, placeholder: "Shuruudaha gaarka ah ee heshiiskan…" },
      ],
    },
    {
      id: "kireeyaha",
      title: "Kireeyaha",
      description: "Xaasiga ama milkiilaha guriga ee kireeyaya.",
      parties: [
        {
          id: "kireeyayaal",
          label: "Kireeyayaal",
          singular: "Kireeye",
          description: "Ku dar hal ama dhowr kireeye.",
          min: 1,
          attendance: true,
          representativeFields: [
            { id: "magac", type: "text", label: "Magaca Wakiilka", validation: { required: true } },
            { id: "telefoon", type: "phone", label: "Telefoonka Wakiilka", validation: { required: true }, placeholder: "+252 61 5551234" },
            { id: "aqoonsi", type: "text", label: "Nambarka Aqoonsiga / Document", optional: true, placeholder: "ID / Passport" },
            { id: "cinwaan", type: "text", label: "Cinwaanka", optional: true, placeholder: "Degmada, magaalada" },
          ],
          // Guided-form metadata: Magac is REQUIRED (a contract cannot be
          // made without it); Telefoon is REQUIRED for a PRESENT party and
          // hidden when a wakiil represents them; Aqoonsi is skippable.
          fields: [
            { id: "magac", type: "text", label: "Magaca Kireeyaha", validation: { required: true }, placeholder: "Magaca kireeyaha" },
            { id: "telefoon", type: "phone", label: "Telefoonka Kireeyaha", optional: true, requiredWhenRowStatus: "jooga", showOnlyWhenRowStatus: "jooga", placeholder: "+252 61 5551234" },
            { id: "aqoonsi", type: "text", label: "Nambarka Aqoonsiga / Document", optional: true, skippable: true, showOnlyWhenRowStatus: "jooga", placeholder: "ID / Passport" },
            { id: "cinwaan", type: "text", label: "Cinwaanka", optional: true, showOnlyWhenRowStatus: "jooga", placeholder: "Degmada, magaalada" },
            { id: "faahfaahin_dheeraad", type: "textarea", label: "Faahfaahin Dheeraad ah", optional: true, colSpan: 2, showOnlyWhenRowStatus: "jooga" },
          ],
        },
      ],
      fields: [],
    },
    {
      id: "kiraystaha",
      title: "Kiraystaha",
      description: "Qofka ama qoysaska kiraysta guriga.",
      parties: [
        {
          id: "kiraystayaal",
          label: "Kiraystayaal",
          singular: "Kirayste",
          description: "Ku dar hal ama dhowr kirayste.",
          min: 1,
          attendance: true,
          representativeFields: [
            { id: "magac", type: "text", label: "Magaca Wakiilka", validation: { required: true } },
            { id: "telefoon", type: "phone", label: "Telefoonka Wakiilka", validation: { required: true }, placeholder: "+252 61 5551234" },
            { id: "aqoonsi", type: "text", label: "Nambarka Aqoonsiga / Document", optional: true, placeholder: "ID / Passport" },
            { id: "cinwaan", type: "text", label: "Cinwaanka", optional: true, placeholder: "Degmada, magaalada" },
          ],
          // Same guided metadata as the landlord group (labels adjusted).
          fields: [
            { id: "magac", type: "text", label: "Magaca Kiraystaha", validation: { required: true }, placeholder: "Magaca kiraystaha" },
            { id: "telefoon", type: "phone", label: "Telefoonka Kiraystaha", optional: true, requiredWhenRowStatus: "jooga", showOnlyWhenRowStatus: "jooga", placeholder: "+252 61 5551234" },
            { id: "aqoonsi", type: "text", label: "Nambarka Aqoonsiga / Document", optional: true, skippable: true, showOnlyWhenRowStatus: "jooga", placeholder: "ID / Passport" },
            { id: "cinwaan", type: "text", label: "Cinwaanka", optional: true, showOnlyWhenRowStatus: "jooga", placeholder: "Degmada, magaalada" },
            { id: "faahfaahin_dheeraad", type: "textarea", label: "Faahfaahin Dheeraad ah", optional: true, colSpan: 2, showOnlyWhenRowStatus: "jooga" },
          ],
        },
      ],
      fields: [],
    },
    {
      id: "guriga",
      title: "Faahfaahinta Guriga",
      description: "Guriga la kiraynayo.",
      fields: [
        { id: "nooca_guriga", type: "select", label: "Nooca Guriga", options: PROPERTY_TYPES, validation: { required: true } },
        { id: "goobta", type: "text", label: "Goobta / Location", validation: { required: true }, placeholder: "Degmada, magaalada" },
        { id: "cinwaanka_guriga", type: "text", label: "Cinwaanka Guriga", validation: { required: true }, colSpan: 2 },
        { id: "sharraxaad", type: "textarea", label: "Sharraxaadda Guriga", optional: true, colSpan: 2, placeholder: "Tusaale: guri 3-qol ah, koronto, biyo…" },
        { id: "qolada", type: "text", label: "Qolada / Faahfaahin La Xiriira", optional: true, placeholder: "Tusaale: 3 qol, 2 musqul" },
      ],
    },
    {
      id: "lacagta",
      title: "Lacagta & Habka Bixinta",
      description: "Qiimaha kirada iyo habka lacagta loo bixiyo.",
      fields: [
        { id: "qiimaha_bil_ka", type: "currency", label: "Qiimaha Kirada Bishii", validation: { required: true, min: 0 }, placeholder: "350" },
        { id: "habka_bixinta", type: "select", label: "Habka Bixinta", options: PAYMENT_METHODS, validation: { required: true }, order: 2 },
        { id: "bangiga_magaca", type: "text", label: "Magaca Bangiga", visibleWhen: { op: "equals", field: "lacagta.habka_bixinta", value: "bank" }, optional: true, order: 3 },
        { id: "bangiga_hisaabka", type: "text", label: "Nambarka Xisaabta", visibleWhen: { op: "equals", field: "lacagta.habka_bixinta", value: "bank" }, optional: true, order: 4 },
        { id: "lacagta_hadhsan", type: "currency", label: "Lacagta Hadhsan (Hadhyay)", visibleWhen: { op: "contains", field: "lacagta.habka_bixinta", value: "partial" }, optional: true, order: 5, description: "Waa in lagu buuxiyaa haddii bixintu ay tahay mid qayb ah" },
        { id: "taariikhda_bixinta", type: "text", label: "Maalinta Bixinta (Bishii)", validation: { required: true }, placeholder: "Tusaale: 1aad ee bil kasta" },
        { id: "bixinta_hore", type: "select", label: "Bixintu ma horay u tahay (MUQADIN) mise dambe (MU'AKHIR)?", options: PAYMENT_TIMING, validation: { required: true }, hint: "Waxaa lagu qori doonaa heshiiska", order: 6 },
        { id: "faahfaahin_lacagta", type: "textarea", label: "Faahfaahin Lacagta Dheeraad ah", optional: true, colSpan: 2, order: 8 },
      ],
    },
    {
      id: "deebaaji",
      title: "Deebaajiga",
      description: "Utility bills — koronto, biyo iyo wm.",
      // Conditional workflow: whole section exists only when Step 1 said Haa.
      visibleWhen: { op: "is_true", field: "heshiiska.deebaaji_haa" },
      fields: [
        { id: "lacagta_deebaajiga", type: "currency", label: "Lacagta Deebaajiga (bil kasta)", optional: true, requiredWhen: { op: "is_true", field: "heshiiska.deebaaji_haa" }, validation: { min: 0 } },
        { id: "shuruudaha_deebaajiga", type: "textarea", label: "Shuruudaha Deebaajiga", optional: true, colSpan: 2, placeholder: "Cinwaanka meter-ka, mas'uuliyadda bixinta…" },
      ],
    },
    {
      id: "damiinka",
      title: "Damiinka",
      description: "Guarantor — damiin optional ah.",
      // Conditional workflow: whole section exists only when Step 1 said Haa.
      visibleWhen: { op: "is_true", field: "heshiiska.damiin_haa" },
      fields: [
        { id: "damiin_magac", type: "text", label: "Magaca Damiinka", validation: { required: true } },
        { id: "damiin_telefoon", type: "phone", label: "Telefoonka Damiinka", validation: { required: true } },
        { id: "damiin_aqoonsi", type: "text", label: "Aqoonsiga Damiinka", validation: { required: true } },
        { id: "damiin_cinwaan", type: "text", label: "Cinwaanka Damiinka", optional: true },
      ],
    },
    {
      id: "ogaysiinta",
      title: "Ogaysiinta",
      description: "Notice period iyo shuruudaha joojinta.",
      fields: [
        { id: "mudada_ogaysiinta", type: "text", label: "Mudada Ogaysiinta", validation: { required: true }, placeholder: "Tusaale: 30 maalmood" },
        { id: "shuruudaha_joojinta", type: "textarea", label: "Shuruudaha Joojinta (Termination)", validation: { required: true }, colSpan: 2 },
        { id: "faahfaahin_ogaysiinta", type: "textarea", label: "Faahfaahin Ogaysiin Dheeraad ah", optional: true, colSpan: 2 },
      ],
    },
    {
      id: "maragyada",
      title: "Maragyada",
      description: "W witnesses — dynamic list.",
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
    {
      id: "dheeraad",
      title: "Dheeraad ah",
      description: "Shuruudo dheeraad ah oo optional ah.",
      fields: [
        { id: "shuruudo_dheeraad", type: "textarea", label: "Shuruudo Dheeraad ah (Optional)", optional: true, colSpan: 2, placeholder: "Wax kasta oo dheeraad ah ee lagu darayo heshiiska…" },
      ],
    },
  ],

  placeholders: [
    { placeholder: "{{REFERENCE_NUMBER}}", mapping: { key: "heshiiska.reference", fallback: "" } },
    { placeholder: "{{CONTRACT_DATE}}", mapping: { key: "heshiiska.taariikhda_heshiiska", format: "date" } },
    { placeholder: "{{SUB_TYPE}}", mapping: { key: "heshiiska.sub_type", format: "text" } },
    { placeholder: "{{TAARIIKHDA_BILOWGA}}", mapping: { key: "heshiiska.taariikhda_bilowga", format: "date" } },
    { placeholder: "{{TAARIIKHDA_DHAMMAADKA}}", mapping: { key: "heshiiska.taariikhda_dhammaadka", format: "date" } },
    { placeholder: "{{SHURUUDAHA_GAARKA_AH}}", mapping: { key: "heshiiska.shuruudaha_gaarka_ah", fallback: "— Ma jiro." } },

    // Phase Document Generation — short aliases for the user's own Word
    // template. The office names its placeholders however it reads best;
    // the engine resolves every alias to the SAME form-state value.
    { placeholder: "{{REF_NUMBER}}", mapping: { key: "heshiiska.reference", fallback: "" } },
    { placeholder: "{{TAARIIKH}}", mapping: { key: "heshiiska.taariikhda_heshiiska", format: "date" } },
    { placeholder: "{{NOOCA_KIRADA}}", mapping: { key: "heshiiska.sub_type" } },
    { placeholder: "{{TAARIIKH_BILOWGA}}", mapping: { key: "heshiiska.taariikhda_bilowga", format: "date" } },
    { placeholder: "{{TAARIIKH_DHAMMAAD}}", mapping: { key: "heshiiska.taariikhda_dhammaadka", format: "date" } },

    { placeholder: "{{KIREYE_MAGAC}}", mapping: { key: "kireeyayaal.magac", format: "text" } },
    { placeholder: "{{KIREYE_TELEFOON}}", mapping: { key: "kireeyayaal.telefoon" } },
    { placeholder: "{{KIREYE_AQOONSI}}", mapping: { key: "kireeyayaal.aqoonsi" } },
    { placeholder: "{{KIREYE_CINWAAN}}", mapping: { key: "kireeyayaal.cinwaan", fallback: "—" } },

    { placeholder: "{{KIRAYSTE_MAGAC}}", mapping: { key: "kiraystayaal.magac" } },
    { placeholder: "{{KIRAYSTE_TELEFOON}}", mapping: { key: "kiraystayaal.telefoon" } },
    { placeholder: "{{KIRAYSTE_AQOONSI}}", mapping: { key: "kiraystayaal.aqoonsi" } },
    { placeholder: "{{KIRAYSTE_CINWAAN}}", mapping: { key: "kiraystayaal.cinwaan", fallback: "—" } },

    { placeholder: "{{NOOCA_GURIGA}}", mapping: { key: "guriga.nooca_guriga" } },
    { placeholder: "{{GOOBTA}}", mapping: { key: "guriga.goobta" } },
    { placeholder: "{{CINWAANKA_GURIGA}}", mapping: { key: "guriga.cinwaanka_guriga" } },
    { placeholder: "{{SHARRAXAADDA_GURIGA}}", mapping: { key: "guriga.sharraxaad", fallback: "—" } },
    { placeholder: "{{QOLADA}}", mapping: { key: "guriga.qolada", fallback: "—" } },
    // Guri aliases for the user-owned template.
    { placeholder: "{{GURI_NOOCA}}", mapping: { key: "guriga.nooca_guriga" } },
    { placeholder: "{{GURI_GOOBTA}}", mapping: { key: "guriga.goobta" } },
    { placeholder: "{{GURI_CINWAAN}}", mapping: { key: "guriga.cinwaanka_guriga" } },
    { placeholder: "{{GURI_SHARRAXAAD}}", mapping: { key: "guriga.sharraxaad", fallback: "—" } },

    { placeholder: "{{QIIMAHA_KIRADA}}", mapping: { key: "lacagta.qiimaha_bil_ka", format: "currency" } },
    { placeholder: "{{HABKA_BIXINTA}}", mapping: { key: "lacagta.habka_bixinta" } },
    { placeholder: "{{TAARIIKHDA_BIXINTA}}", mapping: { key: "lacagta.taariikhda_bixinta" } },
    { placeholder: "{{BIXINTA_HORE}}", mapping: { key: "lacagta.bixinta_hore" } },
    { placeholder: "{{FAAHFAAHIN_LACAGTA}}", mapping: { key: "lacagta.faahfaahin_lacagta", fallback: "—" } },
    // Lacag aliases for the user-owned template.
    { placeholder: "{{KIRADA_QIIMAHA}}", mapping: { key: "lacagta.qiimaha_bil_ka", format: "currency" } },
    { placeholder: "{{MUDDADA_BIXINTA}}", mapping: { key: "lacagta.taariikhda_bixinta" } },

    { placeholder: "{{DEEBAAJI_AMOUNT}}", mapping: { key: "deebaaji.lacagta_deebaajiga", format: "currency" } },
    { placeholder: "{{DEEBAAJI_SHURUUDO}}", mapping: { key: "deebaaji.shuruudaha_deebaajiga", fallback: "—" } },

    { placeholder: "{{DAMIIN_MAGAC}}", mapping: { key: "damiinka.damiin_magac" } },
    { placeholder: "{{DAMIIN_TELEFOON}}", mapping: { key: "damiinka.damiin_telefoon" } },
    { placeholder: "{{DAMIIN_AQOONSI}}", mapping: { key: "damiinka.damiin_aqoonsi" } },
    { placeholder: "{{DAMIIN_CINWAAN}}", mapping: { key: "damiinka.damiin_cinwaan", fallback: "—" } },

    { placeholder: "{{MUDADA_OGAYSIINTA}}", mapping: { key: "ogaysiinta.mudada_ogaysiinta" } },
    { placeholder: "{{SHURUUDAHA_JOOJINTA}}", mapping: { key: "ogaysiinta.shuruudaha_joojinta" } },
    { placeholder: "{{FAAHFAAHIN_OGAYSIINTA}}", mapping: { key: "ogaysiinta.faahfaahin_ogaysiinta", fallback: "—" } },

    { placeholder: "{{SHURUUDO_DHEERAAD}}", mapping: { key: "dheeraad.shuruudo_dheeraad", fallback: "—" } },
  ],

  clauses: [
    {
      placeholder: "{{CLAUSE_DEEBAAJI}}",
      when: { op: "is_true", field: "heshiiska.deebaaji_haa" },
      dynamic: { kind: "deebaaji" },
      fallbackLines: ["Deebaaji (koronto iyo biyo) lama aadin heshiiskan; kiraystuhu wuxuu bixinayaa kirada keliya."],
    },
    {
      placeholder: "{{CLAUSE_DAMIIN}}",
      when: { op: "is_true", field: "heshiiska.damiin_haa" },
      dynamic: { kind: "damiin" },
      fallbackLines: ["Heshiiskan lama hayo damiin."],
    },
    {
      placeholder: "{{CLAUSE_MUQADIN}}",
      when: { op: "is_not_empty", field: "lacagta.bixinta_hore" },
      dynamic: { kind: "advance" },
      fallbackLines: [],
    },
    {
      placeholder: "{{CLAUSE_DHEERAAD}}",
      when: { op: "is_not_empty", field: "dheeraad.shuruudo_dheeraad" },
      dynamic: { kind: "custom" },
      fallbackLines: [],
    },
  ],
};
