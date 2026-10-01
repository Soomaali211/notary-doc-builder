/**
 * FINAL TEMPLATE STRUCTURE — the contract document has NO signature section.
 *
 * The notary's own attestation block is the end of the document:
 *   Maragyo Goob Joogayaala. → Cadaynta Xafiiska → Sarkaalka Xafiiska
 * Nothing may follow the seal line.
 *
 * These tests assert the ABSENCE of every signature construct — in the
 * template source AND in the rendered document — while proving the rest of
 * the document (parties, wakiil, clauses, conditionals, witnesses) is
 * untouched.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { renderXmlForTest } from "../src/lib/notary/pipeline";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues, PartyRow } from "../src/lib/notary/types";

const TEMPLATE = "public/templates/heshiis_kiro_template_v2.docx";

function readZip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const parts = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const lhName = buf.readUInt16LE(localOff + 26);
    const lhExtra = buf.readUInt16LE(localOff + 28);
    const s = localOff + 30 + lhName + lhExtra;
    const raw = buf.subarray(s, s + compSize);
    parts.set(name, method === 0 ? raw : inflateRawSync(raw));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return parts;
}

const docXml = readZip(readFileSync(TEMPLATE)).get("word/document.xml")!.toString("utf8");

/** Every visible string in the template, paragraph by paragraph. */
const templateText = (): string =>
  (docXml.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("\n");

const row = (
  id: string,
  magac: string,
  telefoon: string,
  status: "jooga" | "wakiil",
  representativeId?: string,
): PartyRow => ({
  id,
  values: { magac, telefoon, aqoonsi: "", cinwaan: "", faahfaahin_dheeraad: "" },
  attendance: status === "wakiil" ? { status, representativeId } : { status },
});

const rep = (id: string, magac: string, telefoon: string): PartyRow => ({
  id,
  values: { magac, telefoon, aqoonsi: "", cinwaan: "" },
});

function base(over: Partial<Record<string, string>> = {}): FormValues {
  return {
    heshiiska: {
      reference: "DPN/HK/000 60/03/026",
      taariikhda_heshiiska: "2026-03-16",
      sub_type: "guri_xaas",
      kireeye_mode: "multiple",
      kirayste_mode: "multiple",
      muddada_nooca: "xidhan",
      deebaaji_haa: "yes",
      damiin_haa: "yes",
      taariikhda_bilowga: "2026-10-01",
      taariikhda_dhammaadka: "2027-09-30",
      shuruudaha_gaarka_ah: "",
      ...over,
    },
    kireeyayaal: [],
    kiraystayaal: [],
    wakiilo_kireeyayaal: [],
    wakiilo_kiraystayaal: [],
    maragyo: [
      { id: "w1", values: { magac: "HINDA AADAN", telefoon: "0634250911" } },
      { id: "w2", values: { magac: "SAHRA YUUSUF", telefoon: "0637008152" } },
    ],
    guriga: {
      nooca_guriga: "guri_xaas",
      goobta: "Degmada 26 June",
      cinwaanka_guriga: "",
      sharraxaad: "gaar ahaan Shulaac Waana 4 Qol",
      qolada: "",
    },
    lacagta: {
      qiimaha_bil_ka: "200",
      habka_bixinta: "cash",
      taariikhda_bixinta: "bisha 1aad",
      bixinta_hore: "muqadin",
      faahfaahin_lacagta: "",
    },
    deebaaji: { lacagta_deebaajiga: "25" },
    damiinka: {
      damiin_magac: "MUSTAFE CABDI",
      damiin_telefoon: "0634714915",
    },
    ogaysiinta: {},
    dheeraad: { shuruudo_dheeraad: "" },
  } as FormValues;
}

/** The fullest possible document: every optional section switched ON. */
function fullDocument(): string {
  let v = base();
  v.kireeyayaal = [
    row("k1", "CABDI XASAN", "0634839488", "jooga"),
    row("k2", "XASAN AHMED", "0631110002", "wakiil", "W001"),
    row("k3", "MAXAMED YUUSUF", "0631110003", "wakiil", "W001"),
  ];
  v.wakiilo_kireeyayaal = [rep("W001", "AXMED CALI", "0600999888")];
  v.kiraystayaal = [
    row("t1", "HODAN JOOF", "0632220001", "jooga"),
    row("t2", "SAYID MAXAMED", "0632220002", "wakiil", "WT"),
  ];
  v.wakiilo_kiraystayaal = [rep("WT", "AMINA WALI", "0600777")];
  return renderXmlForTest(docXml, heshiisKiroConfig, v)
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

describe("Template source carries NO signature section", () => {
  const t = templateText();

  test("no signature heading or rule anywhere in the template", () => {
    for (const banned of [
      "Saxiiyada",
      "Saxiix:",
      "Saxiiix",
      "Signature",
      "Sign",
    ]) {
      expect(`${banned}: ${t.includes(banned)}`).toBe(`${banned}: false`);
    }
  });

  test("no signature field labels", () => {
    // A signature block always pairs a name with "Tell:" under a label such
    // as "Kireeye" / "Wakiilka" / "Damiin". None of those exist as blocks.
    for (const banned of ["Magac: ", "Tell: "]) {
      expect(`${banned}: ${t.includes(banned)}`).toBe(`${banned}: false`);
    }
  });

  test("no signature blocks for any party, witness or representative", () => {
    // None of these may appear as a standalone section heading.
    for (const banned of [
      "Kireeye {{NUMBER}}",
      "Kirayste {{NUMBER}}",
      "Wakiilka (oo matalaya",
    ]) {
      expect(`${banned}: ${t.includes(banned)}`).toBe(`${banned}: false`);
    }
  });
});

describe("The document ends at the notary seal", () => {
  const doc = fullDocument();
  const lines = doc.split("\n").map((l) => l.trim()).filter(Boolean);

  test("the last line is the seal", () => {
    expect(lines[lines.length - 1]).toBe(
      "(Sarkaalka Xafiiska Nootaayada Sharciga ah Ee Daloodho)",
    );
  });

  test("the closing attestation is present, in order", () => {
    const titleIdx = lines.findIndex((l) => l === "Cadaynta Xafiiska:");
    expect(titleIdx).toBeGreaterThan(-1);
    expect(lines[titleIdx + 1]).toBe(
      "Xafiisku waxa uu cadaynayaa in heshiiskani-kirada ahi u dhacay sifo sharciga waafaqsan, waafaqaan laguna hor saxeexay laguna camal-fali doono.",
    );
    // Witnesses come BEFORE the attestation.
    const witnessIdx = lines.findIndex((l) => l === "Maragyo Goob Joogayaala.");
    expect(witnessIdx).toBeGreaterThan(-1);
    expect(witnessIdx).toBeLessThan(titleIdx);
  });

  test("witnesses are still listed", () => {
    expect(doc).toContain("HINDA AADAN");
    expect(doc).toContain("SAHRA YUUSUF");
    expect(doc).toContain("0634250911");
  });

  test("nothing at all follows the seal", () => {
    const sealIdx = lines.indexOf(
      "(Sarkaalka Xafiiska Nootaayada Sharciga ah Ee Daloodho)",
    );
    expect(sealIdx).toBe(lines.length - 1);
    expect(lines.slice(sealIdx + 1)).toEqual([]);
  });
});

describe("The rendered document carries NO signature section", () => {
  const doc = fullDocument();

  test("no signature heading or rules", () => {
    for (const banned of ["Saxiiyada", "Saxiix", "Saxiiix", "Signature"]) {
      expect(`${banned}: ${doc.includes(banned)}`).toBe(`${banned}: false`);
    }
  });

  test("no 'Magac:' / 'Tell:' signature fields", () => {
    expect(doc.includes("Magac: ")).toBe(false);
    expect(doc.includes("Tell: ")).toBe(false);
  });

  test("no signature block for any party, wakiil or damiin", () => {
    for (const banned of ["Kireeye 1", "Kirayste 1", "oo matalaya"]) {
      expect(`${banned}: ${doc.includes(banned)}`).toBe(`${banned}: false`);
    }
  });
});

describe("Everything else still works (no collateral damage)", () => {
  const doc = fullDocument();

  test("parties and their representatives still render", () => {
    expect(doc).toContain("❖ 1. CABDI XASAN");
    expect(doc).toContain("❖ 2. XASAN AHMED");
    expect(doc).toContain("Wakiilka: AXMED CALI");
    expect(doc).toContain("Wakiilka: AMINA WALI");
  });

  test("the numbered legal clauses are untouched", () => {
    for (const clause of [
      "Qiimaha Bishii Gurigu waa",
      "Taariikhda kiradu ka bilaabantay waa",
      "Mudada Heshiiska Wejiga Koowaad waa",
      "Habka bixinta kiradu waa",
    ]) {
      expect(`${clause}: ${doc.includes(clause)}`).toBe(`${clause}: true`);
    }
  });

  test("Deebaaji and Damiin sections still render", () => {
    expect(doc).toContain("Haddii Kiraysadu Guriga u baahato");
    expect(doc).toContain("$25");
    expect(doc).toContain("DAMIIN MAAL");
    expect(doc).toContain("MUSTAFE CABDI");
    // The Damiin name is still shown where the section needs it…
    expect(doc).toContain("Saxeexa Damiinka");
  });

  test("Xidhan end date still renders", () => {
    expect(doc).toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
    expect(doc).toContain("30/09/2027");
  });

  test("Furan still hides the end date", () => {
    const furan = base({ muddada_nooca: "furan", taariikhda_dhammaadka: "" });
    furan.kireeyayaal = [row("k1", "K1", "061", "jooga")];
    furan.kiraystayaal = [row("t1", "T1", "062", "jooga")];
    const out = renderXmlForTest(docXml, heshiisKiroConfig, furan)
      .replace(/<[^>]+>/g, "");
    expect(out).not.toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
  });
});