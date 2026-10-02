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
  /* ---- Dejinta (setup) ---- */
  {
    token: "REF_NUMBER",
    key: "dejinta.reference",
    label: "Nambarka Tixraaca",
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
  { token: "IIBIYAHA_TELEFOON", key: "iibiyeyaal.telefoon", label: "Telefoonka Iibiyaha", group: "Iibiyaha" },
  { token: "IIBIYAHA_AQOONSI", key: "iibiyeyaal.aqoonsi", label: "Aqoonsiga Iibiyaha", group: "Iibiyaha" },
  { token: "IIBIYAHA_CINWAAN", key: "iibiyeyaal.cinwaan", fallback: "—", label: "Cinwaanka Iibiyaha", group: "Iibiyaha" },

  /* ---- Iibsadaha (buyers — single-row view) ---- */
  { token: "IIBSADAHA_MAGAC", key: "iibsadayaal.magac", label: "Magaca Iibsadaha", group: "Iibsadaha" },
  { token: "IIBSADAHA_TELEFOON", key: "iibsadayaal.telefoon", label: "Telefoonka Iibsadaha", group: "Iibsadaha" },
  { token: "IIBSADAHA_AQOONSI", key: "iibsadayaal.aqoonsi", label: "Aqoonsiga Iibsadaha", group: "Iibsadaha" },
  { token: "IIBSADAHA_CINWAAN", key: "iibsadayaal.cinwaan", fallback: "—", label: "Cinwaanka Iibsadaha", group: "Iibsadaha" },

  /* ---- Wakiil (computed from the linked representative) ---- */
  { token: "WAKIIL_MAGAC", kind: "computed", label: "Magaca Wakiilka", group: "Wakiil" },
  { token: "WAKIIL_TELEFOON", kind: "computed", label: "Telefoonka Wakiilka", group: "Wakiil" },
  { token: "IIBIYAHA_WAKIIL_MAGAC", kind: "computed", label: "Wakiilka Iibiyaha", group: "Wakiil" },
  { token: "IIBIYAHA_WAKIIL_TELEFOON", kind: "computed", label: "Telefoonka Wakiilka (Iibiyaha)", group: "Wakiil" },
  { token: "IIBSADAHA_WAKIIL_MAGAC", kind: "computed", label: "Wakiilka Iibsadaha", group: "Wakiil" },
  { token: "IIBSADAHA_WAKIIL_TELEFOON", kind: "computed", label: "Telefoonka Wakiilka (Iibsadaha)", group: "Wakiil" },

  /* ---- Hantida: Dhul Banaan ---- */
  { token: "DHUL_NOOCA_HANTIDA", key: "hantida_dhul_banaan.nooca_hantida", label: "Nooca Hantida (Dhul)", group: "Dhul Banaan" },
  { token: "DHUL_GOOBTA", key: "hantida_dhul_banaan.goobta", label: "Goobta / Degmada / Xaafadda", group: "Dhul Banaan" },
  { token: "DHUL_CABBIRKA", key: "hantida_dhul_banaan.cabbirka", label: "Cabbirka Dhulka", group: "Dhul Banaan" },
  { token: "DHUL_XADKA_WAQOOYI", key: "hantida_dhul_banaan.xadka_waqooyi", label: "Xadka Waqooyi", group: "Dhul Banaan" },
  { token: "DHUL_XADKA_BARI", key: "hantida_dhul_banaan.xadka_bari", label: "Xadka Bari", group: "Dhul Banaan" },
  { token: "DHUL_XADKA_KOONFUR", key: "hantida_dhul_banaan.xadka_koonfur", label: "Xadka Koonfur", group: "Dhul Banaan" },
  { token: "DHUL_XADKA_GALBEED", key: "hantida_dhul_banaan.xadka_galbeed", label: "Xadka Galbeed", group: "Dhul Banaan" },
  { token: "DHUL_LAMBARKA_LAHAANSHO", key: "hantida_dhul_banaan.lambarka_lahaansho", label: "Lambar / Aqoonsi Lahaansho", group: "Dhul Banaan" },
  { token: "DHUL_FAAHFAAHIN", key: "hantida_dhul_banaan.faahfaahin_dheeraad", fallback: "—", label: "Faahfaahin Dheeraad ah (Dhul)", group: "Dhul Banaan" },

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

  /* ---- Qiimaha & lacag bixinta ---- */
  {
    token: "QIIMAHA_IIBKU",
    key: "qiimaha.qiimaha_guud",
    format: "currency",
    label: "Qiimaha Guud ee Hantida",
    aliases: ["QIIMAHA_HANTIDA"],
    group: "Qiimaha",
  },
  {
    // Same derived pattern as Kiro: the amount in Somali words, computed
    // from the NUMBER. The user only ever types the figure.
    token: "QIIMAHA_IIBKU_QORAAL",
    key: "qiimaha.qiimaha_guud",
    format: "currency_words",
    label: "Qiimaha Hantida (qoraal)",
    group: "Qiimaha",
  },
  {
    token: "LACAGTA_LA_BIXIYAY",
    key: "qiimaha.lacagta_bixiyay",
    format: "currency",
    label: "Lacagta la Bixiyay",
    group: "Qiimaha",
  },
  {
    // Lacagta hadhay = qiimaha guud − lacagta la bixiyay. Declared in the
    // config's derivedValues (kind: subtract) — the user never types it and
    // can never contradict the two figures it comes from.
    token: "LACAGTA_HADHAY",
    kind: "computed",
    label: "Lacagta Hadhay (qiimaha − bixiyay)",
    group: "Qiimaha",
  },
  {
    token: "LACAGTA_HADHAY_QORAAL",
    kind: "computed",
    label: "Lacagta Hadhay (qoraal)",
    group: "Qiimaha",
  },
  { token: "HABKA_BIXINTA", key: "qiimaha.habka_bixinta", label: "Habka Bixinta", group: "Qiimaha" },
  { token: "TAARIIKHDA_BIXINTA", key: "qiimaha.taariikhda_bixinta", label: "Taariikhda Bixinta", aliases: ["MUDDADA_BIXINTA"], group: "Qiimaha" },
  { token: "BANGIGA_HISAABKA", key: "qiimaha.bangiga_hisaabka", fallback: "—", label: "Nambarka Xisaabta Bangiga", group: "Qiimaha" },

  /* ---- Shuruudaha iibka (the ANSWERS are data; the legal prose that reads
         them aloud lives in the office's own Word template) ---- */
  {
    token: "HANTIDA_LAA_WAREEJIYAY",
    key: "shuruudaha.hantida_wareegay",
    label: "Hantida waxaa la wareejiyay iibsadaha",
    group: "Shuruudaha Iibka",
  },
  {
    token: "IIBIYAHU_CADDEEYAA",
    key: "shuruudaha.iibiyuhu_caddeynayaa",
    label: "Iibiyuhu wuxuu caddeynayaa lahaanshaha",
    group: "Shuruudaha Iibka",
  },
  {
    token: "IIBSADAHA_AQBALAY",
    key: "shuruudaha.iibsaduhu_ahqiiqiyay",
    label: "Iibsaduhu wuxuu xaqiijinayaa inuu aqbalay",
    group: "Shuruudaha Iibka",
  },
  {
    token: "DAMMAANAD_LA_BIXIYAY",
    key: "shuruudaha.iibiyuhu_bixinayaa_dammaanad",
    label: "Dammaanad ma la bixinay lahaanshaha",
    group: "Shuruudaha Iibka",
  },
  {
    token: "SHURUUDAHA_IIBKA",
    key: "shuruudaha.shuruudaha_gaarka_ah",
    fallback: "—",
    label: "Shuruudaha Iibka (qoraal dheeraad ah)",
    group: "Shuruudaha Iibka",
  },

  /* ---- Conditional flags for the same answers ({{IF:…}} wraps the clause) ---- */
  { token: "WAREEJINTA_LAA_SAHAN", kind: "flag", label: "Hantida waa la wareejiyay", group: "Shuruudaha Iibka" },
  { token: "LAHAANSHAHA_CADDEEY", kind: "flag", label: "Iibiyuhu wuxuu caddeeyay lahaanshaha", group: "Shuruudaha Iibka" },
  { token: "IIBSADAHU_AQBALAY", kind: "flag", label: "Iibsaduhu wuxuu xaqiijiyay inuu aqbalay", group: "Shuruudaha Iibka" },

  /* ---- Rahmad / Aamaanad (conditional on the pledge question) ---- */
  { token: "RAHMAD_NOOCA", key: "rahmad.nooca_rahmada", label: "Nooca Rahmadda / Aamaanada", group: "Rahmad" },
  { token: "RAHMAD_DEGMADA", key: "rahmad.degmada_xaafadda", label: "Degmada / Xaafadda (Rahmad)", group: "Rahmad" },
  { token: "RAHMAD_LAMBARKA_LAHAANSHO", key: "rahmad.lambarka_lahaansho", label: "Lambar Lahaansho / Title Number", group: "Rahmad" },
  { token: "RAHMAD_FAAHFAAHIN", key: "rahmad.faahfaahin", fallback: "—", label: "Faahfaahin Rahmad", group: "Rahmad" },

  /* ---- Repeat blocks (dynamic parties — never {{IIBIYAHA_1}}) ---- */
  {
    token: "IIBIYEYAAL",
    kind: "block",
    label: "Iibiyayaal (kasta hal unug)",
    bodyTokens: [
      "NUMBER", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "FAAHFAAHIN_DHEERAAD",
      "WAKIIL", "JOOGA", "MATALAYA",
      "WAKIIL_MAGAC", "WAKIIL_TELEFOON", "WAKIIL_AQOONSI", "WAKIIL_CINWAAN",
    ],
    group: "Iibiyayaal",
  },
  {
    token: "IIBSADAYAAL",
    kind: "block",
    label: "Iibsadayaal (kasta hal unug)",
    bodyTokens: [
      "NUMBER", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "FAAHFAAHIN_DHEERAAD",
      "WAKIIL", "JOOGA", "MATALAYA",
      "WAKIIL_MAGAC", "WAKIIL_TELEFOON", "WAKIIL_AQOONSI", "WAKIIL_CINWAAN",
    ],
    group: "Iibsadayaal",
  },
  {
    token: "WAKIILO_IIBIYEYAAL",
    kind: "block",
    label: "Wakiillo Iibiyayaal",
    bodyTokens: ["NUMBER", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "MATALAYA"],
    group: "Wakiil",
  },
  {
    token: "WAKIILO_IIBSADAYAAL",
    kind: "block",
    label: "Wakiillo Iibsadayaal",
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
  // NOTE: no {{IIBIYEYAAL_LIST}} / {{IIBSADAYAAL_LIST}}. The sellers and buyers
  // print through their REPEAT BLOCKS ({{#IIBIYEYAAL}} / {{#IIBSADAYAAL}}), and
  // a joined-list token that nothing resolves is an orphan placeholder — the
  // office must never be offered a token the engine cannot fill.

  /* ---- Conditional flags ({{IF:FLAG}} … {{END:FLAG}}) ---- */
  { token: "HANTI_DHUL_BANAAN", kind: "flag", label: "Qaybta Hantida (Dhul Banaan)", group: "Dejinta" },
  { token: "HANTI_GURI", kind: "flag", label: "Qaybta Hantida (Guri)", group: "Dejinta" },
  { token: "HANTI_BEER", kind: "flag", label: "Qaybta Hantida (Beer)", group: "Dejinta" },
  { token: "BIXINTA_DHAN", kind: "flag", label: "Lacag dhan la bixiyay", group: "Qiimaha" },
  { token: "BIXINTA_QAYB", kind: "flag", label: "Qayb lacag la bixiyay", group: "Qiimaha" },
  { token: "BIXINTA_HADHAA", kind: "flag", label: "Lacag hadhay / Balance", group: "Qiimaha" },
  { token: "RAHMAD_JIRA", kind: "flag", label: "Waxaa jira rahmad / aamaanad", group: "Rahmad" },
  { token: "WAKIIL", kind: "flag", label: "Wakiil (hal unug gudihiisa)", group: "Wakiil" },
  { token: "JOOGA", kind: "flag", label: "Jooga (hal unug gudihiisa)", group: "Wakiil" },

  /* ---- Hal / badan (party-count flags from the count step) ---- */
  { token: "IIBIYEYAAL_HAL", kind: "flag", label: "Hal iibiy oo keliya", group: "Iibiyayaal" },
  { token: "IIBIYEYAAL_BADAN", kind: "flag", label: "Iibiyayaal badan", group: "Iibiyayaal" },
  { token: "IIBSADAYAAL_HAL", kind: "flag", label: "Hal iibsade oo keliya", group: "Iibsadayaal" },
  { token: "IIBSADAYAAL_BADAN", kind: "flag", label: "Iibsadayaal badan", group: "Iibsadayaal" },

  /* ---- Attendance-derived flags (resolveFlags(): <GROUP>_JOOGA / _WAKIIL) ---- */
  { token: "IIBIYAHA_JOOGA", kind: "flag", label: "Waxaa jooga iibiyaha", group: "Iibiyayaal" },
  { token: "IIBIYAHA_WAKIIL", kind: "flag", label: "Waxaa jooga iibiyaha u wakiil", group: "Iibiyayaal" },
  { token: "IIBSADAHA_JOOGA", kind: "flag", label: "Waxaa jooga iibsadaha", group: "Iibsadayaal" },
  { token: "IIBSADAHA_WAKIIL", kind: "flag", label: "Waxaa jooga iibsadaha u wakiil", group: "Iibsadayaal" },

  /* ---- System-derived values (config.derivedValues) ---- */
  { token: "TIRADA_IIBIYEYAAL", kind: "computed", label: "Tirada iibiyayaasha", group: "Iibiyayaal" },
  { token: "TIRADA_IIBSADAYAAL", kind: "computed", label: "Tirada iibsadayaasha", group: "Iibsadayaal" },
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