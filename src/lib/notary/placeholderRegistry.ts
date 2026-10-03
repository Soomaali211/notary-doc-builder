/**
 * Central PLACEHOLDER REGISTRY — the DATA CONTRACT that binds the form
 * system to the document generator.
 *
 * ONE canonical name per data point. A canonical name is what the system
 * writes into the template it generates; the `aliases` list holds the other
 * names that resolve to the SAME value (kept for older templates). Nothing
 * outside this file may invent a new name for existing data — the registry
 * is the single source of truth:
 *
 *   heshiisKiroConfig.placeholders  ← built from here
 *   knownPlaceholderNames()         ← reads here
 *   buildHeshiisKiroTemplate()      ← emits these exact tokens
 *   Template Manager UI             ← shows these names
 *
 * Token syntax never changes: {{TOKEN_NAME}} (uppercase, underscores).
 */

import type { FormatKind } from "./types";

/** What kind of token this is (drives how the generator writes it). */
export type PlaceholderKind = "placeholder" | "computed" | "block" | "flag" | "clause" | "list";

export interface PlaceholderSpec {
  /** Canonical token name without braces, e.g. "KIREYE_MAGAC". */
  token: string;
  /** Form-state path resolved by the data context ("heshiiska.reference"). */
  key?: string;
  format?: FormatKind;
  /** Text used when the value is empty (optional fields). */
  fallback?: string;
  /** Somali label shown next to the token in the generated template. */
  label: string;
  /** Other names that resolve identically — never generated, always accepted. */
  aliases?: string[];
  kind?: PlaceholderKind;
  /** For {{IF:FLAG}} blocks — the flag the section depends on. */
  flags?: string[];
  /** For repeat blocks — tokens available inside the block body. */
  bodyTokens?: string[];
  /** Section of the template the token belongs to. */
  group: string;
}

/* ------------------------------------------------------------------ */
/* Heshiis Kiro — canonical contract                                    */
/* ------------------------------------------------------------------ */

export const HESHIIS_KIRO_PLACEHOLDERS: PlaceholderSpec[] = [
  /* ---- Heshiiska ---- */
  {
    token: "REF_NUMBER",
    key: "heshiiska.reference",
    label: "Nambarka Tixraaca",
    aliases: ["REFERENCE_NUMBER"],
    group: "Heshiiska",
  },
  {
    token: "TAARIIKH",
    key: "heshiiska.taariikhda_heshiiska",
    format: "date",
    label: "Taariikhda Heshiiska",
    aliases: ["CONTRACT_DATE"],
    group: "Heshiiska",
  },
  { token: "NOOCA_KIRADA", key: "heshiiska.sub_type", label: "Nooca Kirada", aliases: ["SUB_TYPE"], group: "Heshiiska" },
  {
    token: "TAARIIKH_BILOWGA",
    key: "heshiiska.taariikhda_bilowga",
    format: "date",
    label: "Taariikhda Bilowga",
    aliases: ["TAARIIKHDA_BILOWGA"],
    group: "Heshiiska",
  },
  {
    token: "TAARIIKH_DHAMMAAD",
    key: "heshiiska.taariikhda_dhammaadka",
    format: "date",
    label: "Taariikhda Dhammaadka",
    aliases: ["TAARIIKHDA_DHAMMAADKA"],
    group: "Heshiiska",
  },
  {
    token: "SHURUUDAHA_GAARKA_AH",
    key: "heshiiska.shuruudaha_gaarka_ah",
    fallback: "— Ma jiro.",
    label: "Shuruudaha Gaarka ah",
    group: "Heshiiska",
  },
  {
    // Reference document header: "Ismin" (month word) beside the date.
    // Same source value as TAARIIKH, rendered as the Somali month name.
    token: "MAALINTA",
    key: "heshiiska.taariikhda_heshiiska",
    format: "month",
    label: "Bishii (sida qoraal)",
    group: "Heshiiska",
  },
  {
    // Reference clause 3 — duration wording ("mid furan Oo Waa Kiro u Joog").
    token: "XALADDA_KIRADA",
    key: "heshiiska.muddada_nooca",
    label: "Mudada Kirada (qoraal)",
    group: "Heshiiska",
  },

  /* ---- Kireeyaha (single-row view; the full list is a repeat block) ---- */
  { token: "KIREYE_MAGAC", key: "kireeyayaal.magac", format: "text", label: "Magaca Kireeyaha", group: "Kireeyaha" },
  { token: "KIREYE_TELEFOON", key: "kireeyayaal.telefoon", label: "Telefoonka Kireeyaha", group: "Kireeyaha" },
  { token: "KIREYE_AQOONSI", key: "kireeyayaal.aqoonsi", label: "Aqoonsiga Kireeyaha", group: "Kireeyaha" },
  { token: "KIREYE_CINWAAN", key: "kireeyayaal.cinwaan", fallback: "—", label: "Cinwaanka Kireeyaha", group: "Kireeyaha" },

  /* ---- Kiraystaha ---- */
  { token: "KIRAYSTE_MAGAC", key: "kiraystayaal.magac", label: "Magaca Kiraystaha", group: "Kiraystaha" },
  { token: "KIRAYSTE_TELEFOON", key: "kiraystayaal.telefoon", label: "Telefoonka Kiraystaha", group: "Kiraystaha" },
  { token: "KIRAYSTE_AQOONSI", key: "kiraystayaal.aqoonsi", label: "Aqoonsiga Kiraystaha", group: "Kiraystaha" },
  { token: "KIRAYSTE_CINWAAN", key: "kiraystayaal.cinwaan", fallback: "—", label: "Cinwaanka Kiraystaha", group: "Kiraystaha" },

  /* ---- Wakiil (computed from the linked representative; empty when
         nobody is represented) ---- */
  { token: "WAKIIL_MAGAC", kind: "computed", label: "Magaca Wakiilka", group: "Wakiil" },
  { token: "WAKIIL_TELEFOON", kind: "computed", label: "Telefoonka Wakiilka", group: "Wakiil" },
  { token: "KIREEYE_WAKIIL_MAGAC", kind: "computed", label: "Wakiilka Kireeyaha", group: "Wakiil" },
  { token: "KIREEYE_WAKIIL_TELEFOON", kind: "computed", label: "Telefoonka Wakiilka (Kireeye)", group: "Wakiil" },
  { token: "KIRAYSTE_WAKIIL_MAGAC", kind: "computed", label: "Wakiilka Kiraystaha", group: "Wakiil" },
  { token: "KIRAYSTE_WAKIIL_TELEFOON", kind: "computed", label: "Telefoonka Wakiilka (Kirayste)", group: "Wakiil" },

  /* ---- Guriga ---- */
  { token: "GURI_NOOCA", key: "guriga.nooca_guriga", label: "Nooca Guriga", aliases: ["NOOCA_GURIGA"], group: "Guriga" },
  { token: "GURI_GOOBTA", key: "guriga.goobta", label: "Goobta Guriga", aliases: ["GOOBTA"], group: "Guriga" },
  { token: "GURI_CINWAAN", key: "guriga.cinwaanka_guriga", label: "Cinwaanka Guriga", aliases: ["CINWAANKA_GURIGA"], group: "Guriga" },
  { token: "GURI_SHARRAXAAD", key: "guriga.sharraxaad", fallback: "—", label: "Faahfaahinta Guriga", aliases: ["SHARRAXAADDA_GURIGA"], group: "Guriga" },
  { token: "GURI_QOLADA", key: "guriga.qolada", fallback: "—", label: "Qolada / Faahfaahin la xiriira", aliases: ["QOLADA"], group: "Guriga" },

  /* ---- Lacagta ---- */
  { token: "KIRADA_QIIMAHA", key: "lacagta.qiimaha_bil_ka", format: "currency", label: "Qiimaha Kirada Bishii", aliases: ["QIIMAHA_KIRADA"], group: "Lacagta" },
  {
    // Reference clause 1: "$200 LABA BOQOL OO DOLLAR" — the amount in words.
    token: "KIRADA_QIIMAHA_QORAAL",
    key: "lacagta.qiimaha_bil_ka",
    format: "currency_words",
    label: "Qiimaha Kirada (qoraal)",
    group: "Lacagta",
  },
  { token: "HABKA_BIXINTA", key: "lacagta.habka_bixinta", label: "Habka Bixinta", group: "Lacagta" },
  { token: "MUDDADA_BIXINTA", key: "lacagta.taariikhda_bixinta", label: "Muddada Bixinta", aliases: ["TAARIIKHDA_BIXINTA"], group: "Lacagta" },
  { token: "BIXINTA_HORE", key: "lacagta.bixinta_hore", label: "Bixinta Horay / Dambe", group: "Lacagta" },
  { token: "FAAHFAAHIN_LACAGTA", key: "lacagta.faahfaahin_lacagta", fallback: "—", label: "Faahfaahin Lacagta", group: "Lacagta" },

  /* ---- Deebaaji (conditional section) ---- */
  {
    token: "DEEBAAJI_QIIMAHA",
    key: "deebaaji.lacagta_deebaajiga",
    format: "currency",
    label: "Qiimaha Deebaajiga",
    aliases: ["DEEBAAJI_AMOUNT"],
    group: "Deebaaji",
  },
  {
    // Same derived pattern as KIRADA_QIIMAHA_QORAAL: the deposit amount in
    // Somali words, computed from deebaaji.lacagta_deebaajiga. The form only
    // ever asks for the NUMBER — this value is never typed by the user.
    token: "DEEBAAJI_QIIMAHA_QORAAL",
    key: "deebaaji.lacagta_deebaajiga",
    format: "currency_words",
    label: "Qiimaha Deebaajiga (qoraal)",
    group: "Deebaaji",
  },
  { token: "DEEBAAJI_SHURUUDO", key: "deebaaji.shuruudaha_deebaajiga", fallback: "—", label: "Shuruudaha Deebaajiga", group: "Deebaaji" },

  /* ---- Damiin (conditional section) ---- */
  { token: "DAMIIN_MAGAC", key: "damiinka.damiin_magac", label: "Magaca Damiinka", group: "Damiin" },
  { token: "DAMIIN_TELEFOON", key: "damiinka.damiin_telefoon", label: "Telefoonka Damiinka", group: "Damiin" },
  { token: "DAMIIN_AQOONSI", key: "damiinka.damiin_aqoonsi", label: "Aqoonsiga Damiinka", group: "Damiin" },
  { token: "DAMIIN_CINWAAN", key: "damiinka.damiin_cinwaan", fallback: "—", label: "Cinwaanka Damiinka", group: "Damiin" },

  /* ---- Ogaysiinta ---- */
  {
    token: "OGAYSIIN_MUDADA",
    key: "ogaysiinta.mudada_ogaysiinta",
    label: "Mudada Ogaysiinta",
    aliases: ["MUDADA_OGAYSIINTA"],
    group: "Ogaysiinta",
  },
  {
    token: "OGAYSIIN_SHURUUDAH",
    key: "ogaysiinta.shuruudaha_joojinta",
    label: "Shuruudaha Joojinta",
    aliases: ["SHURUUDAHA_JOOJINTA"],
    group: "Ogaysiinta",
  },
  {
    token: "OGAYSIIN_FAAHFAAHIN",
    key: "ogaysiinta.faahfaahin_ogaysiinta",
    fallback: "—",
    label: "Faahfaahin Ogaysiin",
    aliases: ["FAAHFAAHIN_OGAYSIINTA"],
    group: "Ogaysiinta",
  },

  /* ---- Maragyo / Shuruudo dheeraad ---- */
  {
    token: "DHERAAD_SHURUUDO",
    key: "dheeraad.shuruudo_dheeraad",
    fallback: "—",
    label: "Shuruudo Dheeraad ah",
    aliases: ["SHURUUDO_DHEERAAD"],
    group: "Dheeraad",
  },

  /* ---- Repeat blocks (dynamic parties — never {{KIREYE_1}}) ---- */
  {
    token: "KIREYEYAYAAL",
    kind: "block",
    label: "Kireeyayaal (kasta hal unug)",
    bodyTokens: [
      "NUMBER", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "FAAHFAAHIN_DHEERAAD",
      "WAKIIL", "JOOGA", "MATALAYA",
      "WAKIIL_MAGAC", "WAKIIL_TELEFOON", "WAKIIL_AQOONSI", "WAKIIL_CINWAAN",
    ],
    group: "Kireeyayaal",
  },
  {
    token: "KIRAYSTAYAAL",
    kind: "block",
    label: "Kiraystayaal (kasta hal unug)",
    bodyTokens: [
      "NUMBER", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "FAAHFAAHIN_DHEERAAD",
      "WAKIIL", "JOOGA", "MATALAYA",
      "WAKIIL_MAGAC", "WAKIIL_TELEFOON", "WAKIIL_AQOONSI", "WAKIIL_CINWAAN",
    ],
    group: "Kiraystayaal",
  },
  {
    token: "WAKIILO_KIREEYAYAAL",
    kind: "block",
    label: "Wakiillo Kireeyayaal",
    bodyTokens: ["NUMBER", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "MATALAYA"],
    group: "Wakiil",
  },
  {
    token: "WAKIILO_KIRAYSTAYAAL",
    kind: "block",
    label: "Wakiillo Kiraystayaal",
    bodyTokens: ["NUMBER", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "MATALAYA"],
    group: "Wakiil",
  },
  {
    token: "MARAGYO",
    kind: "block",
    label: "Maragyo (kasta hal unug)",
    bodyTokens: ["NUMBER", "MAGAC", "PHONE", "ID", "CINWAAN"],
    group: "Maragyo",
  },
  { token: "MARAGYO_LIST", kind: "list", label: "Maragyada (liis)", group: "Maragyo" },
  { token: "KIREYEYAYAAL_LIST", kind: "list", label: "Kireeyayaal (liis)", group: "Kireeyayaal" },
  { token: "KIRAYSTAYAAL_LIST", kind: "list", label: "Kiraystayaal (liis)", group: "Kiraystayaal" },

  /* ---- Conditional flags ({{IF:FLAG}} … {{END:FLAG}}) ---- */
  { token: "DEEBAAJI_HAA", kind: "flag", label: "Qaybta Deebaajiga (haddii Deebaaji = Haa)", group: "Deebaaji" },
  { token: "DAMIIN_HAA", kind: "flag", label: "Qaybta Damiinka (haddii Damiin = Haa)", group: "Damiin" },
  { token: "KIRO_XIDHAN", kind: "flag", label: "Taariikhda Dhammaadka (haddii Kiro Xidhan)", group: "Heshiiska" },
  { token: "KIRO_FURAN", kind: "flag", label: "Kiro Furan (muddada cad)", group: "Heshiiska" },
  { token: "MUQADIN", kind: "flag", label: "Bixinta MUQADIN", group: "Lacagta" },
  { token: "MUAKHIR", kind: "flag", label: "Bixinta MU'AKHIR", group: "Lacagta" },
  { token: "WAKIIL", kind: "flag", label: "Wakiil (hal unug gudihiisa)", group: "Wakiil" },
  { token: "JOOGA", kind: "flag", label: "Jooga (hal unug gudihiisa)", group: "Wakiil" },

  /* ---- Hal / badan (party-count mode) ---- */
  { token: "KIREYE_HAL", kind: "flag", label: "Kireeye hal oo keliya", group: "Kireeyaha" },
  { token: "KIREEYAYAAL_BADAN", kind: "flag", label: "Kireeyayaal badan", group: "Kireeyayaal" },
  { token: "KIRAYSTE_HAL", kind: "flag", label: "Kirayste hal oo keliya", group: "Kiraystaha" },
  { token: "KIRAYSTAYAAL_BADAN", kind: "flag", label: "Kiraystayaal badan", group: "Kiraystayaal" },

  /* ---- Attendance-derived flags (resolveFlags(): <GROUP>_JOOGA /
         <GROUP>_WAKIIL). Declared here so the Template Manager, the
         audit script and the validator all read the SAME list. ---- */
  { token: "KIREEYE_JOOGA", kind: "flag", label: "Waxaa jooga kireeye", group: "Kireeyayaal" },
  { token: "KIREEYE_WAKIIL", kind: "flag", label: "Waxaa jooga kireeye u wakiil", group: "Kireeyayaal" },
  { token: "KIRAYSTE_JOOGA", kind: "flag", label: "Waxaa jooga kirayste", group: "Kiraystayaal" },
  { token: "KIRAYSTE_WAKIIL", kind: "flag", label: "Waxaa jooga kirayste u wakiil", group: "Kiraystayaal" },

  /* ---- Clause markers (optional engine-provided wording) ---- */
  { token: "CLAUSE_DEEBAAJI", kind: "clause", label: "Sharciga deebaajiga", group: "Deebaaji" },
  { token: "CLAUSE_DAMIIN", kind: "clause", label: "Sharciga damiinka", group: "Damiin" },
  { token: "CLAUSE_MUQADIN", kind: "clause", label: "Sharciga bixinta horay", group: "Lacagta" },
  { token: "CLAUSE_DHEERAAD", kind: "clause", label: "Sharciga shuruudo dheeraad", group: "Dheeraad" },
];

/* ------------------------------------------------------------------ */
/* Kala Iibsi Hanti — canonical contract                                */
/* ------------------------------------------------------------------ */

/**
 * Sale of property (land / house / shop). The office owns the legal
 * wording, so nothing here invents it: every entry below is either a
 * direct answer, a system-derived figure, a conditional flag, or a repeat
 * block. Fields the real template has no home for are reported, never
 * quietly given an invented clause.
 */
export const KALA_IIBSI_HANTI_PLACEHOLDERS: PlaceholderSpec[] = [
  /* ---- Dejinta (setup) ----
     REF_NUMBER is written by the pipeline, not typed by the user: the
     database holds the short serial ("DPN-MG-001") and the document
     prints "Ref/Dpn/MG/001/01/26" (DocumentConfig.referenceFormat). The
     key below is only the draft's copy of the allocated serial. */
  {
    token: "REF_NUMBER",
    key: "dejinta.reference",
    label: "Nambarka Tixraaca (Ref/Dpn/MG/…)",
    aliases: ["REFERENCE_NUMBER"],
    group: "Dejinta",
  },
  {
    token: "TAARIIKH",
    key: "dejinta.taariikhda_hantida",
    format: "date",
    label: "Taariikhda Hantida",
    aliases: ["CONTRACT_DATE"],
    group: "Dejinta",
  },
  {
    token: "MAALINTA",
    key: "dejinta.taariikhda_hantida",
    format: "month",
    label: "Bishii (sida qoraal)",
    group: "Dejinta",
  },
  {
    token: "NOOCA_HANTIDA",
    key: "dejinta.sub_type",
    label: "Nooca Hantida (Dhul Banaan / Guri / Beer)",
    aliases: ["SUB_TYPE", "NOOCA_KALAA_IIBSI"],
    group: "Dejinta",
  },

  /* ---- Iibiyaha (sellers — single-row view; the list is a repeat block) ---- */
  { token: "IIBIYAHA_MAGAC", key: "iibiyeyaal.magac", label: "Magaca Iibiyaha", group: "Iibiyaha" },
  { token: "IIBIYAHA_DEGAN", key: "iibiyeyaal.degan", label: "Degan Iibiyaha", group: "Iibiyaha" },
  { token: "IIBIYAHA_TELEFOON", key: "iibiyeyaal.telefoon", label: "Telefoonka Iibiyaha", group: "Iibiyaha" },
  // No {{IIBIYAHA_SAWIR}} / {{IIBSADAHA_SAWIR}} any more. A photograph is
  // not a property of the seller row: it lives in the independent
  // {{#SAWIRRADA}} block and is linked to a person, so a seller row can
  // never imply a photo. Offering a per-seller photo token would invite the
  // office back into the photo-per-seller rule the scans refuse.

  /* ---- Iibsadaha (buyers — single-row view) ---- */
  { token: "IIBSADAHA_MAGAC", key: "iibsadayaal.magac", label: "Magaca Iibsadaha", group: "Iibsadaha" },
  { token: "IIBSADAHA_DEGAN", key: "iibsadayaal.degan", label: "Degan Iibsadaha", group: "Iibsadaha" },
  { token: "IIBSADAHA_TELEFOON", key: "iibsadayaal.telefoon", label: "Telefoonka Iibsadaha", group: "Iibsadaha" },

  /* ---- Wakiil (computed from the linked representative) ---- */
  { token: "WAKIIL_MAGAC", kind: "computed", label: "Magaca Wakiilka", group: "Wakiil" },
  { token: "WAKIIL_SAWIR", kind: "computed", label: "Sawirka Wakiilka", group: "Wakiil" },
  { token: "IIBSADAHA_WAKIIL_MAGAC", kind: "computed", label: "Wakiilka Iibsadaha", group: "Wakiil" },
  { token: "IIBSADAHA_WAKIIL_SAWIR", kind: "computed", label: "Sawirka Wakiilka (Iibsadaha)", group: "Wakiil" },

  /* ---- Hantida: Dhul Banaan (goobta dhulka + caddaynta lahaanshaha) ---- */
  { token: "DEGMADA", key: "hantida_dhul_banaan.degmada", label: "Degmada", group: "Dhul Banaan" },
  { token: "XAAFADA", key: "hantida_dhul_banaan.xaafada", label: "Xaafada", group: "Dhul Banaan" },
  { token: "CABBIRKA", key: "hantida_dhul_banaan.cabbirka", label: "Cabbirka", group: "Dhul Banaan" },
  { token: "JIHOO_1", key: "hantida_dhul_banaan.jiho_1", label: "Xadka / Jiho 1", group: "Dhul Banaan" },
  { token: "JIHOO_2", key: "hantida_dhul_banaan.jiho_2", label: "Xadka / Jiho 2", group: "Dhul Banaan" },
  { token: "JIHOO_3", key: "hantida_dhul_banaan.jiho_3", label: "Xadka / Jiho 3", group: "Dhul Banaan" },
  {
    token: "SIDA_HANTIDA",
    key: "hantida_dhul_banaan.sida_hantida_loo_helay",
    label: "Sida iibiyuhu hantida u helay (qoraal)",
    group: "Dhul Banaan",
  },
  {
    token: "NOTARY_REF",
    key: "hantida_dhul_banaan.notary_ref",
    label: "Tixraaca Notary / warqadda iibka",
    group: "Dhul Banaan",
  },
  {
    token: "BEERTA",
    key: "hantida_dhul_banaan.beerta",
    label: "Beerta / warqadda dhaxalka",
    group: "Dhul Banaan",
  },

  /* ---- Dammaanadda — ONE slot, TWO possible names (see DAMIIN_MAGACA) ---- */
  {
    token: "DAMIIN_MAGAC",
    key: "damiinka.magaca_damiinka",
    label: "Magaca Damiinka (marka uu yahay qof 3aad)",
    group: "Dammaanadda",
  },
  {
    // Printed when the SELLER guarantees his own sale: the guarantor slot
    // carries the seller's name, not a second person.
    token: "DAMIIN_MAGACA",
    kind: "computed",
    label: "Magaca damiinka (qof 3aad, ama iibiyaha is-damiinaya)",
    group: "Dammaanadda",
  },
  {
    token: "DAMIIN_TELEFOON",
    key: "damiinka.telefoonka_damiinka",
    label: "Telefoonka Damiinka",
    group: "Dammaanadda",
  },
  {
    token: "DAMIIN_GURMAD",
    key: "damiinka.gurmadka_dammaanadda",
    label: "Gurmadka / qoraalka dammaanadda",
    group: "Dammaanadda",
  },
  {
    token: "DAMIIN_SAWIR",
    key: "damiinka.sawirka_damiinka",
    label: "Sawirka Damiinka (marka uu yahay qof 3aad)",
    group: "Dammaanadda",
  },
  {
    token: "NOOCA_DAMIINTA",
    key: "damiinka.nooca_damiinta",
    label: "Nooca dammaanadda (qoraal)",
    group: "Dammaanadda",
  },

  /* ---- Hantida: Guri ---- */
  { token: "GURI_GOOBTA", key: "hantida_guri.goobta", label: "Goobta Guriga", group: "Guri" },
  { token: "GURI_DEGMADA_XAAFADDA", key: "hantida_guri.degmada_xaafadda", label: "Degmada / Xaafadda", group: "Guri" },
  { token: "GURI_CABBIRKA", key: "hantida_guri.cabbirka", fallback: "—", label: "Cabbirka Guriga", group: "Guri" },
  { token: "GURI_NOOCA", key: "hantida_guri.nooca_guriga", label: "Nooca Guriga", group: "Guri" },
  { token: "GURI_XUDUUDAAHA", key: "hantida_guri.xuduudaha", fallback: "—", label: "Xuduudaha Guriga", group: "Guri" },
  { token: "GURI_LAMBARKA_LAHAANSHO", key: "hantida_guri.lambarka_lahaansho", label: "Lambar / Aqoonsi Lahaansho", group: "Guri" },
  { token: "GURI_FAAHFAAHIN", key: "hantida_guri.faahfaahin_dheeraad", fallback: "—", label: "Faahfaahin Dheeraad ah (Guri)", group: "Guri" },

  /* ---- Hantida: Beer ---- */
  { token: "BEER_GOOBTA", key: "hantida_beer.goobta", label: "Goobta Beeraha", group: "Beer" },
  { token: "BEER_DEGMADA_XAAFADDA", key: "hantida_beer.degmada_xaafadda", label: "Degmada / Xaafadda", group: "Beer" },
  { token: "BEER_CABBIRKA", key: "hantida_beer.cabbirka", label: "Cabbirka Beeraha", group: "Beer" },
  { token: "BEER_NOOCA", key: "hantida_beer.nooca_beeraha", label: "Nooca Beeraha", group: "Beer" },
  { token: "BEER_XUDUUDAAHA", key: "hantida_beer.xuduudaha", fallback: "—", label: "Xuduudaha Beeraha", group: "Beer" },
  { token: "BEER_LAMBARKA_LAHAANSHO", key: "hantida_beer.lambarka_lahaansho", label: "Lambar / Aqoonsi Lahaansho", group: "Beer" },
  { token: "BEER_FAAHFAAHIN", key: "hantida_beer.faahfaahin_dheeraad", fallback: "—", label: "Faahfaahin Dheeraad ah (Beer)", group: "Beer" },
  { token: "BEER_CEEL", key: "hantida_beer.ceel", label: "Beerku wuxuu leeyahay ceel?", group: "Beer" },
  { token: "BEER_SHAYADA_CEELKA", key: "hantida_beer.shayada_ceelka", fallback: "—", label: "Shayada Ceelka (Beer)", group: "Beer" },

  /* ---- Qiimaha: what was actually paid (optional) ---- */
  { token: "LACAGTA_BIXIYAY", key: "qiimaha.lacagta_bixiyay", format: "currency", label: "Lacagta Bixiyay", group: "Qiimaha" },

  /* ---- Qiimaha: the figure, and the SAME figure written in words ---- */
  {
    token: "QIIMAHA",
    key: "qiimaha.qiimaha_guud",
    format: "currency",
    label: "Qiimaha Guud",
    aliases: ["QIIMAHA_HANTIDA"],
    group: "Qiimaha",
  },
  {
    // Same derived pattern as Kiro: the amount in Somali words, computed
    // from the NUMBER. The user only ever types the figure.
    token: "QIIMAHA_QORAAL",
    key: "qiimaha.qiimaha_guud",
    format: "currency_words",
    label: "Qiimaha Guud (qoraal)",
    group: "Qiimaha",
  },

  /* ---- Repeat blocks (dynamic parties — never {{IIBIYAHA_1}}) ---- */
  {
    token: "IIBIYEYAAL",
    kind: "block",
    label: "Iibiyayaal (kasta hal unug)",
    bodyTokens: ["NUMBER", "MAGAC", "JINSI", "DOORO", "KOOX", "DEGAN", "TELEFOON", "WAKIIL"],
    group: "Iibiyayaal",
  },
  {
    token: "IIBSADAYAAL",
    kind: "block",
    label: "Iibsadayaal (kasta hal unug)",
    bodyTokens: [
      "NUMBER", "MAGAC", "JINSI", "DEGAN", "TELEFOON",
      "WAKIIL", "JOOGA", "MATALAYA",
      "WAKIIL_MAGAC", "WAKIIL_SAWIR",
    ],
    group: "Iibsadayaal",
  },
  {
    token: "WAKIILO_IIBSADAYAAL",
    kind: "block",
    label: "Wakiillo Iibsadayaal",
    bodyTokens: ["NUMBER", "MAGAC", "SAWIR", "MATALAYA"],
    group: "Wakiil",
  },
  {
    token: "MARAGYO",
    kind: "block",
    label: "Maragyo (kasta hal unug)",
    bodyTokens: ["NUMBER", "MAGAC", "TELEFOON"],
    group: "Maragyo",
  },
  { token: "MARAGYO_LIST", kind: "list", label: "Maragyada (liis)", group: "Maragyo" },

  /* ---- Jinsi (gender) — an ANSWER, never read off the name ---- */
  { token: "IIBIYAHA_JINSI", key: "iibiyeyaal.jinsi", label: "Jinsi Iibiyaha", group: "Iibiyaha" },
  { token: "IIBSADAHA_JINSI", key: "iibsadayaal.jinsi", label: "Jinsi Iibsadaha", group: "Iibsadaha" },
  { token: "IIBIYAHA_DOORO", key: "iibiyeyaal.dooro", label: "Doorka Iibiyaha", group: "Iibiyaha" },
  { token: "IIBIYAHA_KOOX", key: "iibiyeyaal.koox", label: "Kooxa / Qoysku", group: "Iibiyaha" },
  { token: "IIBIYAHA_WAKIIL", key: "iibiyeyaal.wakiil", label: "Wakiilka saxiixaya iibiyaha", group: "Wakiil" },

  /* ---- Qoraalka jinsiga: the legal role words the engine picks ---- */
  { token: "IIBIYE_WORD", kind: "computed", label: "Eryada iibiyaha (iibiye / iibiso / iibiyayaal)", group: "Iibiyaha" },
  { token: "IIBIYE_WORDS", kind: "computed", label: "Eryada iibiyaha (tirad oo la eegay)", group: "Iibiyaha" },
  { token: "IIBSADE_WORD", kind: "computed", label: "Eryada iibsadaha (iibsade / iibsato / iibsadayaal)", group: "Iibsadaha" },
  { token: "IIBSADE_WORDS", kind: "computed", label: "Eryada iibsadaha (tirad oo la eegay)", group: "Iibsadaha" },

  /* ---- Repeat blocks: two lists that are NOT tied to the seller count ---- */
  {
    token: "KOOXAHA",
    kind: "block",
    label: "Kooxaha / Qoysku (magac, ma aha qof)",
    bodyTokens: ["NUMBER", "MAGAC"],
    group: "Kooxaha",
  },
  {
    token: "WAKIILLO",
    kind: "block",
    label: "Wakiillo (hal qof oo matalaa dad badan)",
    bodyTokens: [
      "NUMBER",
      "MAGAC",
      "NOOCA_WAKIILKA",
      "XIRIIRKA_QOYSKA",
      "TIXRAACA_WAKIILNIMO",
      "XADKA_WAKIILNIMO",
    ],
    group: "Wakiil",
  },
  {
    token: "SAWIRRADA",
    kind: "block",
    label: "Sawirrada (tirad madax-bannaan)",
    bodyTokens: ["NUMBER", "MAGAC", "SAWIR", "CAPTION"],
    group: "Sawirrada",
  },
  {
    token: "SAXEEXAYAASHA",
    kind: "block",
    label: "Saxeexayaasha (tirad madax-bannaan)",
    bodyTokens: ["NUMBER", "MAGAC", "PREFIX"],
    group: "Saxeexayaasha",
  },
  {
    token: "SHAXADAHA",
    kind: "block",
    label: "Shaxadaha iyo Warqadaha (MDH/C/…, Ref:APN/…)",
    bodyTokens: ["NUMBER", "TIXRAACA", "NOOCA_SHAXADAH", "HAYSA", "TAARIIKHDA"],
    group: "Shaxadaha",
  },

  /* ---- Count flags for the independent lists (countFirst groups) ---- */
  { token: "KOOXAHA_HAL", kind: "flag", label: "Hal koox", group: "Kooxaha" },
  { token: "KOOXAHA_BADAN", kind: "flag", label: "Kooxo badan", group: "Kooxaha" },
  { token: "WAKIILLO_HAL", kind: "flag", label: "Hal wakiil", group: "Wakiil" },
  { token: "WAKIILLO_BADAN", kind: "flag", label: "Wakiillo badan", group: "Wakiil" },
  { token: "SAWIRRADA_HAL", kind: "flag", label: "Hal sawir", group: "Sawirrada" },
  { token: "SAWIRRADA_BADAN", kind: "flag", label: "Sawirro badan", group: "Sawirrada" },
  { token: "SAXEEXAYAASHA_HAL", kind: "flag", label: "Hal saxeex", group: "Saxeexayaasha" },
  { token: "SAXEEXAYAASHA_BADAN", kind: "flag", label: "Saxeexyaal badan", group: "Saxeexayaasha" },
  { token: "SHAXADAHA_HAL", kind: "flag", label: "Hal shaxad", group: "Shaxadaha" },
  { token: "SHAXADAHA_BADAN", kind: "flag", label: "Shaxado badan", group: "Shaxadaha" },

  // NOTE: no {{IIBIYEYAAL_LIST}} / {{IIBSADAYAAL_LIST}}. The sellers and buyers
  // print through their REPEAT BLOCKS ({{#IIBIYEYAAL}} / {{#IIBSADAYAAL}}), and
  // a joined-list token that nothing resolves is an orphan placeholder — the
  // office must never be offered a token the engine cannot fill.

  /* ---- Conditional flags ({{IF:FLAG}} … {{END:FLAG}}) ---- */
  { token: "HANTI_DHUL_BANAAN", kind: "flag", label: "Qaybta Hantida (Dhul Banaan)", group: "Dejinta" },
  { token: "HANTI_GURI", kind: "flag", label: "Qaybta Hantida (Guri)", group: "Dejinta" },
  { token: "HANTI_BEER", kind: "flag", label: "Qaybta Hantida (Beer)", group: "Dejinta" },
  { token: "HANTIDA_DHAXLAT", kind: "flag", label: "Iibiyuhu wuxuu dhaxlay hantida", group: "Dhul Banaan" },
  { token: "HANTIDA_IIBSADAY", kind: "flag", label: "Iibiyuhu wuxuu iibsaday hantida", group: "Dhul Banaan" },
  // Nooca dammaanadda — decides WHO is printed in the guarantor slot.
  { token: "DAMIIN_QOF_3AAD", kind: "flag", label: "Damiinku waa qof 3aad", group: "Dammaanadda" },
  { token: "DAMIIN_IIBIYAHA", kind: "flag", label: "Iibiyaha isagu waa damiin", group: "Dammaanadda" },
  { token: "WAKIIL", kind: "flag", label: "Wakiil (hal unug gudihiisa)", group: "Wakiil" },
  { token: "JOOGA", kind: "flag", label: "Jooga (hal unug gudihiisa)", group: "Wakiil" },

  /* ---- Hal / badan (party-count flags from the count step) ---- */
  { token: "IIBIYEYAAL_HAL", kind: "flag", label: "Hal iibiy oo keliya", group: "Iibiyayaal" },
  { token: "IIBIYEYAAL_BADAN", kind: "flag", label: "Iibiyayaal badan", group: "Iibiyayaal" },
  { token: "IIBSADAYAAL_HAL", kind: "flag", label: "Hal iibsade oo keliya", group: "Iibsadayaal" },
  { token: "IIBSADAYAAL_BADAN", kind: "flag", label: "Iibsadayaal badan", group: "Iibsadayaal" },

  /* ---- Attendance-derived flags (resolveFlags(): <GROUP>_JOOGA / _WAKIIL).
         Only the BUYERS carry attendance in this document — a seller always
         signs his own sale, so no iibiyaha attendance flag exists. ---- */
  { token: "IIBSADAHA_JOOGA", kind: "flag", label: "Waxaa jooga iibsade", group: "Iibsadayaal" },
  { token: "IIBSADAHA_WAKIIL", kind: "flag", label: "Waxaa jooga iibsade u wakiil", group: "Iibsadayaal" },

  /* ---- System-derived values (config.derivedValues) ---- */
  // Only DAMIIN_MAGACA is derived now. The party COUNTS are not derived
  // values: the template chooses its singular/plural wording from the
  // {{IF:IIBIYEYAAL_HAL}} / {{IF:IIBIYEYAAL_BADAN}} count flags above, so a
  // raw count token would be a second, redundant way to say the same thing.
  { token: "DAMIIN_MAGACA", kind: "computed", label: "Magaca damiinka (qof 3aad, ama iibiyaha is-damiinaya)", group: "Dammaanadda" },
];

/* ------------------------------------------------------------------ */
/* Registry helpers                                                     */
/* ------------------------------------------------------------------ */

/** Registry entries for a document type (config-driven, extensible). */
export function placeholderRegistry(documentTypeId = "heshiis_kiro"): PlaceholderSpec[] {
  if (documentTypeId === "heshiis_kiro") return HESHIIS_KIRO_PLACEHOLDERS;
  if (documentTypeId === "kala_iibsi_hanti") return KALA_IIBSI_HANTI_PLACEHOLDERS;
  return [];
}

/** Every token name (canonical + aliases + blocks + flags), uppercase. */
export function registryTokenNames(specs: PlaceholderSpec[]): Set<string> {
  const names = new Set<string>();
  for (const spec of specs) {
    names.add(spec.token.toUpperCase());
    for (const alias of spec.aliases ?? []) names.add(alias.toUpperCase());
    for (const t of spec.bodyTokens ?? []) names.add(t.toUpperCase());
    if (spec.kind === "block") {
      names.add(`#${spec.token.toUpperCase()}`);
      names.add(`/${spec.token.toUpperCase()}`);
    }
  }
  return names;
}

/** Canonical token for a form-state key (first match wins). */
export function canonicalTokenForKey(specs: PlaceholderSpec[], key: string): string | undefined {
  return specs.find((s) => s.key === key && s.kind !== "block")?.token;
}

/**
 * THE single source of truth for "which canonical token does this name
 * mean?". Accepts a canonical name (returns it unchanged) or any alias
 * (returns the canonical token). Returns undefined for names the system
 * does not know at all — used by the Template Compatibility Validator to
 * tell MATCH from ALIAS from UNKNOWN.
 *
 * No other module may build an alias map: an alias only exists here.
 */
export function canonicalNameFor(
  specs: PlaceholderSpec[],
  name: string,
): string | undefined {
  const n = name.replace(/[{}]/g, "").trim().toUpperCase();
  const spec = specs.find(
    (s) =>
      s.token.toUpperCase() === n ||
      (s.aliases ?? []).some((a) => a.toUpperCase() === n),
  );
  return spec ? spec.token.toUpperCase() : undefined;
}

/** Label shown to the user for a token (canonical or alias). */
export function labelForToken(specs: PlaceholderSpec[], token: string): string {
  const name = token.replace(/[{}]/g, "").toUpperCase();
  return (
    specs.find((s) => s.token.toUpperCase() === name || (s.aliases ?? []).includes(name))?.label ?? name
  );
}

/** {{TOKEN}} string for a canonical token name. */
export function tokenString(token: string): string {
  return `{{${token}}}`;
}