import type { FormValues, PartyRow } from "../src/lib/notary/types";

export function row(values: Record<string, string>): PartyRow {
  return { id: Math.random().toString(36).slice(2), values };
}

/** Attendance-enabled row (jooga default in fixtures). */
export function attRow(values: Record<string, string>): PartyRow {
  return { ...row(values), attendance: { status: "jooga" } };
}

/** Test data #30 — scenario A (everything present). */
export function scenarioA(): FormValues {
  return {
    heshiiska: {
      reference: "DPN/K/001",
      taariikhda_heshiiska: "2026-09-29",
      sub_type: "guri_xaas",
      kireeye_mode: "multiple",
      kirayste_mode: "multiple",
      muddada_nooca: "xidhan",
      deebaaji_haa: "yes",
      damiin_haa: "yes",
      taariikhda_bilowga: "2026-10-01",
      taariikhda_dhammaadka: "2027-09-30",
      shuruudaha_gaarka_ah: "Naadiga waa inuu siiyo macdaanka.",
    },
    kireeyayaal: [
      attRow({ magac: "Cabdi Xasan", telefoon: "+252 61 5551234", aqoonsi: "ID-8842", cinwaan: "Hodan, Muqdisho", faahfaahin_dheeraad: "" }),
      attRow({ magac: "Faadumo Ali", telefoon: "+244 61 5559999", aqoonsi: "PP-2231", cinwaan: "", faahfaahin_dheeraad: "" }),
    ],
    kiraystayaal: [
      attRow({ magac: "Xuseen Maxamed", telefoon: "+252 63 4447777", aqoonsi: "ID-1177", cinwaan: "Wadajir, Muqdisho", faahfaahin_dheeraad: "" }),
      attRow({ magac: "Amina Osman", telefoon: "+252 63 4448888", aqoonsi: "ID-1178", cinwaan: "", faahfaahin_dheeraad: "" }),
      attRow({ magac: "Liibaan Yusuf", telefoon: "+252 63 4449999", aqoonsi: "ID-1179", cinwaan: "", faahfaahin_dheeraad: "" }),
    ],
    guriga: {
      nooca_guriga: "guri_xaas",
      goobta: "Hodan, Muqdisho",
      cinwaanka_guriga: "Wadada 21ka, Guri 44",
      sharraxaad: "Guri 3-qol ah, koronto, biyo joogto ah.",
      qolada: "3 qol, 2 musqul",
    },
    lacagta: {
      qiimaha_bil_ka: "500",
      habka_bixinta: "mobile",
      taariikhda_bixinta: "1aad ee bil kasta",
      bixinta_hore: "muqadin",
      damiin_jira: "yes",
      faahfaahin_lacagta: "",
    },
    deebaaji: {
      deebaaji_jira: "yes",
      lacagta_deebaajiga: "25",
      shuruudaha_deebaajiga: "Meter-ka biyaha waa kan kireeyaha.",
    },
    damiinka: {
      damiin_magac: "Maxamed Nuur",
      damiin_telefoon: "+252 61 1112223",
      damiin_aqoonsi: "ID-5566",
      damiin_cinwaan: "Kaaraan, Muqdisho",
    },
    ogaysiinta: {
      mudada_ogaysiinta: "30 maalmood",
      shuruudaha_joojinta: "Labada dhinac waxay is fiiqin karaan 30 maalmood ka hor.",
      faahfaahin_ogaysiinta: "",
    },
    maragyo: [
      row({ magac: "Asha Omar", telefoon: "+252 61 7778889", aqoonsi: "ID-9900", cinwaan: "" }),
      row({ magac: "Yuusuf Abdi", telefoon: "", aqoonsi: "", cinwaan: "" }),
      row({ magac: "Halimo Yusuf", telefoon: "", aqoonsi: "", cinwaan: "" }),
      row({ magac: "Xasan Idle", telefoon: "", aqoonsi: "", cinwaan: "" }),
    ],
    dheeraad: { shuruudo_dheeraad: "Kiraystuhu wuu dhisi karaa qol dheeraad ah 6 bilood kadib." },
  };
}

/** Test scenario B — deebaaji Maya + damiin Maya → sections removed. */
export function scenarioB(): FormValues {
  const v = scenarioA();
  (v.deebaaji as Record<string, string>) = {
    lacagta_deebaajiga: "",
    shuruudaha_deebaajiga: "",
  };
  (v.heshiiska as Record<string, string>).deebaaji_haa = "no";
  (v.heshiiska as Record<string, string>).damiin_haa = "no";
  (v.damiinka as Record<string, string>) = {
    damiin_magac: "",
    damiin_telefoon: "",
    damiin_aqoonsi: "",
    damiin_cinwaan: "",
  };
  return v;
}
