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
/* Registry helpers                                                     */
/* ------------------------------------------------------------------ */

/** Registry entries for a document type (config-driven, extensible). */
export function placeholderRegistry(documentTypeId = "heshiis_kiro"): PlaceholderSpec[] {
  if (documentTypeId === "heshiis_kiro") return HESHIIS_KIRO_PLACEHOLDERS;
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