import type {
  ClauseMapping,
  DocumentConfig,
  PlaceholderMapping,
  SelectOption,
  TemplateSpec,
} from "../types";
import { CADAYN_CILAAJ_PLACEHOLDERS } from "../placeholderRegistry";

/**
 * CADAYN CILAAJ — "Cadayn Masuuliyad Qaadis Bukaan" (certificate of acceptance
 * of a patient's guarantor, Ref/Dpn/CC/000024/01/026).
 *
 * PURE DATA, exactly like Heshiis Kiro and Kala Iibsi Hanti: the interview,
 * validation, live review and generation all read from this object. Nothing
 * here designs the Word template and nothing here writes legal wording —
 * the office's scan owns the prose.
 *
 * The scan (transcribed verbatim in the template generator) gives:
 *   - fixed header lines:  Ref/ Dpn/CC/000024/01/026 · Salaasa · 13/Jan/2026
 *   - the recipient line:  "Ku: - Maamulka Salaxadin Mental Hospital."
 *   - the legal title:     "Cadayn Masuuliyad Qaadis Bukaan."
 *   - the opening:         "Anigoo ah {MASUULKA_MAGAC} Degan {MASUULKA_DEGAN}
 *                           xafiiskan hortiisa Waxaan ka cadaynayaa"
 *   - ELEVEN numbered clauses whose wording never changes EXCEPT clause 4's
 *     relationship word (Xiddhiidhka → Xiriirka_Xiriirka of the patient).
 *   - the signature heading "Saxeexa Masuulka Bukaanka"
 *   - the witness heading  "Marag Goob Jooga"
 *   - attestation: "Cadaynta Xafiiska: - Xafiisku waxa uu qirayaa in
 *     cadayntani u dhacday sifo sharciga waafaqsan laguna hor saxeexay
 *     laguna camal fali doono."
 *   - notary block: "(Gr. Maxamed Cumar C/Jaahi)" /
 *     "Sarkaalka Xafiiska Nootayada Sharciga ah EeDaloodho"
 */

function registryPlaceholders(
  specs = CADAYN_CILAAJ_PLACEHOLDERS,
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

/** Step 1 — the certificate is always addressed to somebody named here. */
const MACNAAS_KINDS: SelectOption[] = [
  { value: "ispitaal", label: "Ispitaal / Isbitaal (Hospital)" },
  { value: "xarun_dawo", label: "Xarun dawo ah (Clinic)" },
  { value: "xarun_daryeel", label: "Xarun daryeel ah (Care centre)" },
  { value: "qof_gaadiid", label: "Qof gaadiid ahaa / xaaskiisa" },
];

const NOW = 0;
const CILAAJ_TEMPLATES: TemplateSpec[] = [
  {
    templateId: "CILAAJ_V1",
    documentType: "cadayn_cilaaj",
    // No sub-type in this document: one certificate shape for every
    // admission. Field "" (universal) so selectTemplate finds it even
    // BEFORE the user has opened the interview.
    subtype: "",
    name: "Cadayn Cilaaj",
    filePath: "/templates/cadayn_cilaaj/cilaaj.docx",
    version: 1,
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

/** The relationship options (declared before the config that uses them). */
const XIRIIRKA_OPTIONS: SelectOption[] = [
  { value: "adeer", label: "Adeer" },
  { value: "eedo", label: "Eedo" },
  { value: "walal", label: "Walal" },
  { value: "hooyo", label: "Hooyo" },
  { value: "aabbe", label: "Aabbe" },
  { value: "hoosaysteen", label: "Hoosaysteen" },
  { value: "wilal_ama_abti", label: "Wilal ama Abti" },
  { value: "saaxiib", label: "Saaxiib" },
  { value: "kale", label: "Qof kale (xiddhiidh kale)" },
];

const YES_NO: SelectOption[] = [
  { value: "yes", label: "Haa" },
  { value: "no", label: "Maya" },
];

export const cadaynCilaajConfig: DocumentConfig = {
  id: "cadayn_cilaaj",
  title: "Cadayn Cilaaj",
  description:
    "Cadayn Masuuliyad Qaadis Bukaan — qofkii qaadi isku daaday inuu masuul ka noqdo bukaanka.",
  fileNamePrefix: "Cadayn-Cilaaj",
  outputFolder: "Cadayn Cilaaj",
  templatePath: "/templates/cadayn_cilaaj/cilaaj.docx",
  referencePrefix: "DPN-CC",
  // The scan's reference IS composed: Ref/Dpn/CC/{serial}/{MM}/{YY}.
  referenceFormat: "Ref/Dpn/CC/{serial}/{MM}/{YY}",
  referenceDateKey: "dejinta.taariikhda_cadaynta",
  requiresWitness: true,
  witnessPlaceholder: "{{MARAGYO_LIST}}",
  witnessSeparator: "\\n",
  subTypes: [], // no sub-type; "" is covered by the universal template above.
  templates: CILAAJ_TEMPLATES,

  repeatBlocks: [
    {
      blockId: "MARAGYO",
      partyId: "maragyo",
      numberPlaceholder: "NUMBER",
      aliases: { PHONE: "telefoon" },
    },
  ],

  conditionFlags: {
    // Clause 11 conveys a WARNING; the scan has no variant. Provided as a
    // flag so a future template may section off an optional variant.
    JIRRAAT_BUKAAN: { op: "is_true", field: "dejinta.jirraat_bukaan" },
  },

  format: {
    // The scan prints "13/Jan/2026" — the same DD/MM/YYYY contract every
    // other document uses; the month word is MAALINTA's job.
    dateFormat: "DD/MM/YYYY",
  },

  // Somali wording for stored values — a raw "adeer" can never reach a
  // signed paper. Clause 4's legal word arrives from here.
  derivedText: {
    "bukaanka.xiriirka": {
      adeer: "Adeer",
      eedo: "Eedo",
      walal: "Walal",
      hooyo: "Hooyo",
      aabbe: "Aabbe",
      hoosaysteen: "Hoosaysteen",
      wilal_ama_abti: "Wilal ama Abti",
      saaxiib: "Saaxiib",
      kale: "Qof kale (xiddhiidh kale)",
    },
    "dejinta.macnaas_nooca": {
      ispitaal: "Ispitaal / Isbitaal",
      xarun_dawo: "Xarun dawo ah",
      xarun_daryeel: "Xarun daryeel ah",
      qof_gaadiid: "Qof gaadiid ahaa / xaaskiisa",
    },
  },

  sections: [
    {
      id: "dejinta",
      title: "Dejinta Cadaynta",
      description:
        "Aasaaska cadaynta — nambarka, taariikhda, iyo meesha la cadaynayayo.",
      fields: [
        {
          id: "macnaas",
          type: "text",
          label: "La uu ku cadaynayo (Ku: …)",
          validation: { required: true },
          placeholder: "Maamulka Salaxadin Mental Hospital",
          hint: "Sida dukumentigu ku qoran yahay: Ku: - …",
        },
        {
          id: "taariikhda_cadaynta",
          type: "date",
          label: "Taariikhda Cadaynta",
          validation: { required: true },
        },
        {
          id: "reference",
          type: "text",
          label: "Nambarka Tixraaca (Reference Number)",
          optional: true,
          placeholder: "Si toos ah ayaa la abuurayaa",
        },
        {
          // Registry: {{CINWAANKA_CADAYNTA}} — empty, the scan's own legal
          // title is the fallback, so the slot can never print blank.
          id: "cinwaanka_cadaynta",
          type: "text",
          label: "Cinwaanka Cadaynta (ikhtiyaari)",
          optional: true,
          placeholder: "Cadayn Masuuliyad Qaadis Bukaan",
          hint: "Maran: qoraalka scan-ka ayaa la daabacaa.",
        },
      ],
    },
    {
      id: "masuulka",
      title: "Masuulka Bukaanka",
      description:
        "Qofka qaadi isku daaday masuuliyadda bukaankani — 'Anigoo ah …' oo ku saabsan.",
      parties: [
        {
          id: "masuulayaal",
          label: "Masuulayaasha",
          singular: "Masuul",
          description: "Ku dar hal ama dhowr masuul (qofkii qaadi isku daaday).",
          min: 1,
          renderInline: true,
          fields: [
            {
              id: "magac",
              type: "text",
              label: "Magaca Masuulka",
              validation: { required: true },
              placeholder: "Maxamed Caydiid Cigaal",
            },
            {
              id: "degan",
              type: "text",
              label: "Degan (meesha uu dega)",
              validation: { required: true },
              placeholder: "Hargeysa",
            },
            {
              id: "telefoon",
              type: "phone",
              label: "Telefoonka",
              optional: true,
              placeholder: "+252 63 4427254",
            },
          ],
        },
      ],
      fields: [],
    },
    {
      id: "bukaanka",
      title: "Bukaanka",
      description:
        "Bukaanka la cadaynayayo — magac, da'da, iyo xiddhiidhka naga dhexeeya.",
      fields: [
        {
          id: "magac",
          type: "text",
          label: "Magaca Bukaanka",
          validation: { required: true },
          placeholder: "Maxamed Caydiid Cigaal",
        },
        {
          id: "da_diisa",
          type: "number",
          label: "Da'da Bukaanka (sano)",
          optional: true,
          validation: { min: 0, max: 150 },
          placeholder: "45",
          hint: "Tusaale: 'In Bukaankan Da'diisu Tahay 45 Jir.'",
        },
        {
          id: "xiriirka",
          type: "select",
          label: "Xiddhiidhka naga dhexeeya (Ee Eehnimoyahaya Iyo Eehlhinimo)",
          optional: true,
          options: XIRIIRKA_OPTIONS,
          placeholder: "Adeer",
          hint: "Tusaale: 'In Xiddhiidhka naga dhexeeya Ee Eehnimoyahaya (Adeer).'",
        },
        {
          id: "hanti",
          type: "yes_no",
          label: "Bukaankani hanti ma leeyahay?",
          options: YES_NO,
          validation: { required: true },
          hint: "Cl. 3: 'In aanay jirin Wax Hanti ah oo uu Gaar u leeyahay Iyo Dhadhaxaltoona.'",
        },
        {
          id: "xanuun",
          type: "yes_no",
          label: "Bukaankani wax xanuun ma haysto?",
          options: YES_NO,
          validation: { required: true },
          hint: "Cl. 5: 'Sidoo kalena aanay jirin ama aanan ku ogyan Wax Xanuun ah Oo u Weheliya Xanuunka Dhibirka.'",
        },
      ],
    },
    {
      id: "maragyada",
      title: "Maragyada",
      description: "Maragyo Goob-Joogayaal — laba marag (sida scan-ka).",
      parties: [
        {
          id: "maragyo",
          label: "Maragyada",
          singular: "Marag",
          description: "Ku dar laba marag (sida scan-ka u diiwaan gareeyay).",
          min: 1,
          renderInline: true,
          fields: [
            {
              id: "magac",
              type: "text",
              label: "Magaca Maraga",
              validation: { required: true },
            },
            {
              id: "telefoon",
              type: "phone",
              label: "Telefoonka Maraga",
              optional: true,
              placeholder: "063-4421792",
            },
          ],
        },
      ],
      fields: [],
    },
  ],

  // BUILT FROM THE PLACEHOLDER REGISTRY — canonical names first.
  placeholders: registryPlaceholders(),

  // No {{CLAUSE_*}} markers: all eleven clauses of the scan are FIXED
  // template text — the guarantor's attestation never varies. Only the
  // clause 4 relationship word is a placeholder ({{XIRIIRKA}}).
  clauses: [] as ClauseMapping[],
};
