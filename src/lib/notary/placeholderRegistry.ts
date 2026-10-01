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
    bodyTokens: ["NUMBER", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "FAAHFAAHIN_DHEERAAD", "WAKIIL", "JOOGA", "WAKIIL_MAGAC", "WAKIIL_TELEFOON"],
    group: "Kireeyayaal",
  },
  {
    token: "KIRAYSTAYAAL",
    kind: "block",
    label: "Kiraystayaal (kasta hal unug)",
    bodyTokens: ["NUMBER", "MAGAC", "TELEFOON", "AQOONSI", "CINWAAN", "FAAHFAAHIN_DHEERAAD", "WAKIIL", "JOOGA", "WAKIIL_MAGAC", "WAKIIL_TELEFOON"],
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