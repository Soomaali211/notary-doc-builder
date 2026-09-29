/**
 * Verifies the template filling pipeline: builds test form values,
 * fills the sample DOCX, and asserts no {{TOKEN}} remains except
 * intentionally-unknown ones.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import {
  buildFileBaseName,
  computeReplacements,
  fillTemplate,
} from "../src/lib/notary/template";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

const here = dirname(fileURLToPath(import.meta.url));

function row(values: Record<string, string>): PartyRow {
  return { id: Math.random().toString(36).slice(2), values };
}

const values: FormValues = {
  heshiiska: {
    reference: "",
    taariikhda_heshiiska: "2026-01-15",
    sub_type: "guri_xaas",
    taariikhda_bilowga: "2026-02-01",
    taariikhda_dhammaadka: "2027-01-31",
    shuruudaha_gaarka_ah: "Naadiga waa inuu siiyo macdaanka.",
  },
  kireeyayaal: [
    row({ magac: "Cabdi Xasan", telefoon: "+252 61 5551234", aqoonsi: "ID-8842", cinwaan: "Hodan, Muqdisho" }),
    row({ magac: "Faadumo Ali", telefoon: "+252 61 5559999", aqoonsi: "PP-2231", cinwaan: "" }),
  ],
  kiraystayaal: [
    row({ magac: "Xuseen Maxamed", telefoon: "+252 63 4447777", aqoonsi: "ID-1177", cinwaan: "Wadajir, Muqdisho" }),
  ],
  guriga: {
    nooca_guriga: "guri_xaas",
    goobta: "Hodan, Muqdisho",
    cinwaanka_guriga: "Wadada 21ka, Guri 44",
    sharraxaad: "Guri 3-qol ah, koronto, biyo joogto ah.",
    qolada: "3 qol, 2 musqul",
  },
  lacagta: {
    qiimaha_bil_ka: "350",
    habka_bixinta: "mobile",
    taariikhda_bixinta: "1aad ee bil kasta",
    bixinta_hore: "muqadin",
    faahfaahin_lacagta: "",
  },
  deebaaji: {
    deebaaji_jira: "yes",
    lacagta_deebaajiga: "25",
    shuruudaha_deebaajiga: "Meter-ka biyaha waa kan kireeyaha.",
  },
  damiinka: {
    damiin_jira: "yes",
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
  ],
  dheeraad: {
    shuruudo_dheeraad: "Kiraystuhu wuu dhisi karaa qol dheeraad ah 6 bilood kadib.",
  },
};

const templatePath = resolve(here, "../public/templates/heshiis_kiro_template.docx");
const templateBytes = readFileSync(templatePath);

// 1. computeReplacements sanity
const replacements = computeReplacements(heshiisKiroConfig, values);
const missing: string[] = [];
for (const p of heshiisKiroConfig.placeholders) {
  const v = replacements[p.placeholder];
  if (v === undefined) missing.push(p.placeholder);
}
if (missing.length > 0) {
  console.error("MISSING replacements:", missing);
  process.exit(1);
}

// 2. Fill and inspect the output XML
const blob = await fillTemplate(templateBytes.buffer.slice(0), heshiisKiroConfig, values);
const buf = Buffer.from(await blob.arrayBuffer());
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml")!.async("string");

const leftovers = (xml.match(/\{\{[A-Z0-9_]+\}\}/g) ?? []).filter(
  (t) =>
    ![
      "{{UNKNOWN_TOKEN_SHOULD_STAY}}",
    ].includes(t),
);

if (leftovers.length > 0) {
  console.error("LEFTOVER tokens:", [...new Set(leftovers)]);
  process.exit(1);
}

// 3. Spot-check dynamic content
const checks: [string, boolean][] = [
  ["Cabdi Xasan", xml.includes("Cabdi Xasan")],
  ["Faadumo Ali (2nd kireeye)", xml.includes("Faadumo Ali")],
  ["3 marag", xml.includes("Asha Omar") && xml.includes("Yuusuf Abdi") && xml.includes("Halimo Yusuf")],
  ["Damiin clause", xml.includes("Maxamed Nuur")],
  ["Deebaaji amount", xml.includes("25.00") || xml.includes("25 USD") || xml.includes("25")],
  ["Somali date", xml.includes("Janaayo")],
  ["MUQADIN clause", xml.includes("MUQADIN")],
  ["File name", buildFileBaseName(heshiisKiroConfig, "DPN-K-001") === "Ref-DPN-K-001_Heshiis-Kiro"],
];

let ok = true;
for (const [name, pass] of checks) {
  console.log(`${pass ? "✓" : "✗"} ${name}`);
  if (!pass) ok = false;
}

if (!ok) process.exit(1);
console.log("\nTemplate pipeline verified ✓");
