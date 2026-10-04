/**
 * Shared fixtures for the Universal Live Document Review tests.
 *
 * Nothing here is mocked: the templates are the REAL files in `public/` and
 * the answer sets are the REAL config field ids, so a test that passes here
 * proves the product path works, not that a stub returned the right object.
 *
 * (This file is a helper, not a suite — `bun test` only collects `*.test.*`.)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInitialValues } from "../src/lib/notary/formValues";
import { kalaIiibsiHantiConfig } from "../src/lib/notary/documents/kalaIiibsiHanti";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import type { DocumentConfig, FormValues, PartyRow } from "../src/lib/notary/types";

export const PUBLIC_DIR = resolve(import.meta.dir, "../public");

/** Real bytes of a registered template, exactly as `loadTemplate` would fetch it. */
export function templateBytes(filePath: string): ArrayBuffer {
  const buf = readFileSync(resolve(PUBLIC_DIR, filePath.replace(/^\//, "")));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export function row(id: string, values: Record<string, string>): PartyRow {
  return { id, values };
}

/** A party row plus its attendance link (one person, one ID, everywhere). */
export function person(
  id: string,
  values: Record<string, string>,
  attendance: PartyRow["attendance"] = { status: "jooga" },
): PartyRow {
  return { id, values, attendance };
}

export const HANTI_TEMPLATES: Record<string, string> = {
  dhul_banaan: "/templates/kala_iiibsi_hanti/dhul_banaan.docx",
  guri: "/templates/kala_iiibsi_hanti/guri.docx",
  beer: "/templates/kala_iiibsi_hanti/beer.docx",
};

export const KIRO_TEMPLATE = "/templates/heshiis_kiro_template_v2.docx";
export const KIRO_LEGACY_TEMPLATE = "/templates/heshiis_kiro_template.docx";

/* ------------------------------------------------------------------ */
/* Kala Iibsi Hanti                                                    */
/* ------------------------------------------------------------------ */

export interface HantiOptions {
  subType?: string;
  sellerCount?: number;
  buyerCount?: number;
  sellerAttendance?: PartyRow["attendance"][];
  buyerAttendance?: PartyRow["attendance"][];
  /** "qof_3aad" | "iibiyaha" | "ma_jiro" — written to dejinta.nooca_damiinta. */
  guarantor?: string;
  /** Does the plot carry a File / TR / Notary reference? */
  hasReference?: boolean;
  price?: string;
  paid?: string;
  reference?: string;
  photos?: boolean;
  signatures?: boolean;
  sellerGender?: string | null;
  buyerGender?: string | null;
  propertyExtras?: Record<string, string>;
  /** Are any representatives entered at all? (Default: yes.) */
  representatives?: boolean;
}

function sellerName(i: number): string {
  return ["AHMED CALI", "FARAX XAAD", "MAXAMED ADAN", "KHALID NUR", "OMAR DIID"][i % 5];
}

function buyerName(i: number): string {
  return ["ABDIRAHMAN ADEN", "YASIN AHMED", "HUSSEIN MAXAMED", "ALI MUSE"][i % 4];
}

/**
 * A filled Kala Iibsi Hanti answer set built ONLY from the config's real
 * field ids. Defaults describe an ordinary Dhul Banaan sale; every option
 * exists so a single test can isolate one business rule.
 */
export function hantiValues(options: HantiOptions = {}): FormValues {
  const {
    subType = "dhul_banaan",
    sellerCount = 2,
    buyerCount = 1,
    sellerAttendance,
    buyerAttendance,
    guarantor = "qof_3aad",
    hasReference = true,
    price = "25000",
    paid = "10000",
    reference = "DPN-MG-001",
    photos = true,
    signatures = true,
    sellerGender = "male",
    buyerGender = "male",
    propertyExtras = {},
    representatives = true,
  } = options;

  const base = createInitialValues(kalaIiibsiHantiConfig);
  const sellers: PartyRow[] = Array.from({ length: sellerCount }, (_, i) =>
    person(
      `s${i + 1}`,
      sellerGender === null
        ? { magac: sellerName(i), degan: "Degmada Hargeisa", telefoon: "+252 61 1110001" }
        : {
            magac: sellerName(i),
            jinsi: sellerGender,
            degan: "Degmada Hargeisa",
            telefoon: "+252 61 1110001",
            dooro: "iibiye",
          },
      sellerAttendance?.[i] ?? { status: "jooga" },
    ),
  );
  const buyers: PartyRow[] = Array.from({ length: buyerCount }, (_, i) =>
    person(
      `b${i + 1}`,
      buyerGender === null
        ? { magac: buyerName(i), degan: "Degmada Hargeisa", telefoon: "+252 61 2220002" }
        : {
            magac: buyerName(i),
            jinsi: buyerGender,
            degan: "Degmada Hargeisa",
            telefoon: "+252 61 2220002",
          },
      buyerAttendance?.[i] ?? { status: "jooga" },
    ),
  );

  return {
    ...base,
    dejinta: {
      ...(base.dejinta as Record<string, string>),
      sub_type: subType,
      reference,
      taariikhda_hantida: "2026-01-30",
      sawirro_ma_jiraan: photos ? "yes" : "no",
      saxeexo_ma_jiraan: signatures ? "yes" : "no",
      shaxado_ma_jiraan: "yes",
      iibiye_mode: sellerCount === 1 ? "single" : "multiple",
      tirada_iibiyayaasha: String(sellerCount),
      iibsade_mode: buyerCount === 1 ? "single" : "multiple",
      tirada_iibsadayaasha: String(buyerCount),
      nooca_damiinta: guarantor,
    },
    iibiyeyaal: sellers,
    iibsadayaal: buyers,
    wakiilo_iibiyeyaal: representatives
      ? [
          row("r1", { magac: "YASMIN AHMED", nooca_wakiilka: "wakiil_qayim" }),
          row("r2", { magac: "FARAX MAALMO", nooca_wakiilka: "wakiil" }),
        ]
      : [],
    wakiilo_iibsadayaal: representatives
      ? [row("br1", { magac: "HUSSEIN MUSE", nooca_wakiilka: "wakiil" })]
      : [],
    hantida_dhul_banaan: {
      degmada: "Waardhiil",
      xaafada: "Sooma",
      cabbirka: "5,000 m2",
      jiho_waqooyi: "waddo",
      jiho_koonfur: "dhisme",
      jiho_bari: "waddo",
      jiho_galbeed: "dhisme",
      soohdimaha: "Soohdimo Degmada Waardhiil",
      sida_hantida_loo_helay: "iibsaday",
      tixraaca_ma_jiraan: hasReference ? "yes" : "no",
      nooca_tixraaca: "tr_no",
      lambarka_tixraaca: "Tr No 4471",
      calaamad_dheeraad: "Xarunta Wacatariga, koonfur",
      ...propertyExtras,
    },
    hantida_guri: {
      goobta: "Hargeisa",
      degmada_xaafadda: "Degmada Hargeisa",
      cabbirka: "150 m2",
      nooca_guriga: "Guri Xaas",
      xuduudaha: "Koronto, biyo, dariik",
      lambarka_lahaansho: "LAH-12",
      faahfaahin_dheeraad: "Guri laba qol.",
    },
    hantida_beer: {
      magaca_beerta: "Beer Daara-Salaam",
      nooca_beeraha: "Beer Dhab ah",
      goobta: "Hargeisa",
      degmada_xaafadda: "Degmada Hargeisa",
      cabbirka: "80 m2",
      jiho_1: "Xarunta Wacatariga",
      jiho_2: "Jidka Mogadishu",
      xuduudaha: "Bandhig, kalkaaliye",
      lambarka_lahaansho: "LAH-13",
      faahfaahin_dheeraad: "Beer wuxuu leeyahay 6 qodob.",
      ceel: "yes",
      shayada_ceelka: "Ceel 3m, Degmada Hargeisa",
    },
    damiinka: {
      magaca_damiinka: guarantor === "qof_3aad" ? "OMAR DIID" : "",
      telefoonka_damiinka: "+252 61 5551234",
      degan_damiinka: "Hargeisa",
      gurmadka_dammaanadda: "Damiinku wuxuu dammaanadda ugu gaddaynayaa lacagta hadhay.",
    },
    qiimaha: {
      qiimaha_guud: price,
      lacagta_bixiyay: paid,
      lacagta_baaqiga_ah: String(Number(price) - Number(paid || 0)),
      sida_lacagta: "qayb_aad_ah",
      habka_bixinta: "Cash",
      faahfaahin_lacageed: "Lacagta hadhay waa la bixiyaa marka hantida la sii taamiyo.",
    },
    sawirrada: photos
      ? sellers.slice(0, 1).map((s, i) =>
          row(`p${i + 1}`, { shakhsiga: s.id, sawir: "storage_p1", caption: "Sawirka iibiyaha" }),
        )
      : [],
    maragyo: [row("m1", { magac: "KHALID NUR", degan: "Degmada Hargeisa" })],
  } as FormValues;
}

/* ------------------------------------------------------------------ */
/* Heshiis Kiro (locked config — read only)                            */
/* ------------------------------------------------------------------ */

export function kiroValues(over: Record<string, string> = {}): FormValues {
  const base = createInitialValues(heshiisKiroConfig);
  return {
    ...base,
    heshiiska: {
      ...(base.heshiiska as Record<string, string>),
      sub_type: "guri_xaas",
      nooca_kirada: "guri_xaas",
      ...over,
    },
    guri_xaas: {
      qiimaha_bishii: "1500",
      taariikhda_kiradu: "2026-01-01",
      mudada_heshiiska: "12",
      habka_bixinta: "Cash",
      lacagta_moobligaad: "1500",
      lacagta_lacag_bixiyay: "1500",
    },
    kireeyayaal: [row("k1", { magac: "HASSAN ADAN", telefoon: "+252 61 0000001" })],
    kiraystayaal: [row("r1", { magac: "OMAR XAAD", telefoon: "+252 61 0000002" })],
    maragyo: [row("m1", { magac: "KHALID NUR", telefoon: "+252 61 0000003" })],
  } as FormValues;
}

/** Convenience: the config whose answers the fixture belongs to. */
export const HANTI_CONFIG: DocumentConfig = kalaIiibsiHantiConfig;
export const KIRO_CONFIG: DocumentConfig = heshiisKiroConfig;