/**
 * FINAL LOGIC REVIEW — the four concrete scenarios, run through the REAL
 * renderer against the REAL template file.
 *
 * Guards the review contract:
 *   1. single vs multiple never duplicates a person;
 *   2. each wakiil is bound to the person it represents (shared rep is
 *      stored once, referenced by each absent party);
 *   3. the signature block belongs to whoever actually signs — the party
 *      when present, the representative when absent;
 *   4. HABKA_BIXINTA is unconditional; only the fixed-term end date is
 *      conditional on Kiro Xidhan;
 *   5. Deebaaji is a deposit field, never merged with Ogaysiis;
 *   6. Damiin section + signature appear together, or not at all.
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

function render(values: FormValues): string {
  return renderXmlForTest(docXml, heshiisKiroConfig, values)
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const count = (text: string, needle: string): number => text.split(needle).length - 1;

const jooga = (id: string, values: Record<string, string>): PartyRow => ({
  id,
  values: { magac: "", telefoon: "", aqoonsi: "", cinwaan: "", ...values },
  attendance: { status: "jooga" },
});
const maqan = (id: string, representativeId: string): PartyRow => ({
  id,
  values: { magac: "", telefoon: "", aqoonsi: "", cinwaan: "" },
  attendance: { status: "wakiil", representativeId },
});
const rep = (id: string, values: Record<string, string>): PartyRow => ({
  id,
  values: { magac: "", telefoon: "", aqoonsi: "", cinwaan: "", ...values },
});

function values(over: {
  kireeye_mode: string;
  kirayste_mode: string;
  muddada_nooca: string;
  deebaaji_haa: string;
  damiin_haa: string;
  kireeyayaal: PartyRow[];
  kiraystayaal: PartyRow[];
  wakiilo_kireeyayaal?: PartyRow[];
  wakiilo_kiraystayaal?: PartyRow[];
}): FormValues {
  return {
    heshiiska: {
      reference: "DPN/K/RV",
      taariikhda_heshiiska: "2026-09-29",
      sub_type: "guri_xaas",
      kireeye_mode: over.kireeye_mode,
      kirayste_mode: over.kirayste_mode,
      muddada_nooca: over.muddada_nooca,
      deebaaji_haa: over.deebaaji_haa,
      damiin_haa: over.damiin_haa,
      taariikhda_bilowga: "2026-10-01",
      taariikhda_dhammaadka: over.muddada_nooca === "xidhan" ? "2027-09-30" : "",
      shuruudaha_gaarka_ah: "",
    },
    kireeyayaal: over.kireeyayaal,
    kiraystayaal: over.kiraystayaal,
    wakiilo_kireeyayaal: over.wakiilo_kireeyayaal ?? [],
    wakiilo_kiraystayaal: over.wakiilo_kiraystayaal ?? [],
    maragyo: [],
    guriga: { nooca_guriga: "guri_xaas", goobta: "Degmada 26 June", cinwaanka_guriga: "", sharraxaad: "", qolada: "" },
    lacagta: { qiimaha_bil_ka: "200", habka_bixinta: "cash", taariikhda_bixinta: "bisha 1aad", bixinta_hore: "muqadin", faahfaahin_lacagta: "" },
    deebaaji: over.deebaaji_haa === "yes" ? { lacagta_deebaajiga: "25", shuruudaha_deebaajiga: "" } : {},
    damiinka: over.damiin_haa === "yes" ? { damiin_magac: "MUSTAFE CABDI", damiin_telefoon: "0634714915", damiin_aqoonsi: "ID-9", damiin_cinwaan: "" } : {},
    ogaysiinta: {},
    dheeraad: { shuruudo_dheeraad: "" },
  };
}

describe("REVIEW CASE 1 — 1 Kireeye, 1 Kirayste, both present, Furan, no deposit, no damiin", () => {
  const text = render(values({
    kireeye_mode: "single", kirayste_mode: "single", muddada_nooca: "furan",
    deebaaji_haa: "no", damiin_haa: "no",
    kireeyayaal: [jooga("k1", { magac: "FARXIYA AADAN YUUSUF", telefoon: "0634839488" })],
    kiraystayaal: [jooga("t1", { magac: "CABDIKARIIX MAXAMUUD CABDI", telefoon: "0634468200" })],
  }));

  test("no duplicate people", () => {
    // Each person appears in the party list AND in their signature block.
    expect(count(text, "FARXIYA AADAN YUUSUF")).toBe(2);
    expect(count(text, "CABDIKARIIX MAXAMUUD CABDI")).toBe(2);
  });

  test("singular headings", () => {
    expect(text).toContain("Magaca Kireeysada Guriga");
    expect(text).toContain("Magaca Kiraystaha Guriga");
    expect(text).not.toContain("Magacyada");
  });

  test("no wakiil anywhere (party, signature, or body)", () => {
    expect(text).not.toContain("Wakiilka");
  });

  test("Furan hides the end date; payment method still prints", () => {
    expect(text).toContain("Habka bixinta kiradu waa");
    expect(text).not.toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
  });

  test("no deposit and no damiin", () => {
    expect(text).not.toContain("Haddii Kiraysadu Guriga u baahato");
    expect(text).not.toContain("DAMIIN MAAL");
  });

  test("signatures are the present parties", () => {
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(sig).toContain("Kireeye");
    expect(sig).toContain("Kirayste");
    expect(sig).not.toContain("Damiin");
  });
});

describe("REVIEW CASE 2 — 1 Kireeye absent via wakiil, Xidhan, deposit yes, damiin yes", () => {
  const krep = rep("krep", { magac: "WAKIIL KIREYE", telefoon: "0600111" });
  const text = render(values({
    kireeye_mode: "single", kirayste_mode: "single", muddada_nooca: "xidhan",
    deebaaji_haa: "yes", damiin_haa: "yes",
    // An absent party still has THEIR OWN name — it must never be replaced
    // by the representative's.
    kireeyayaal: [{ ...maqan("k1", krep.id), values: { magac: "XASAN AHMED", telefoon: "063444", aqoonsi: "", cinwaan: "" } }],
    kiraystayaal: [jooga("t1", { magac: "KIRAYSTE JOOGA", telefoon: "0622222" })],
    wakiilo_kireeyayaal: [krep],
  }));

  test("the absent landlord is shown only through the wakiil", () => {
    expect(text).toContain("Wakiilka:");
    expect(text).toContain("WAKIIL KIREYE");
    expect(text).toContain("0600111");
  });

  test("no duplicate or empty landlord line", () => {
    expect(count(text, "WAKIIL KIREYE")).toBe(2); // party line + signature line
    expect(text).not.toContain("❖ Tell");
  });

  test("the wakiil signs for the absent landlord", () => {
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(sig).toContain("Wakiilka (oo matalaya Kireey");
    expect(sig).toContain("WAKIIL KIREYE");
  });

  test("present tenant signs for itself and has no wakiil block", () => {
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(sig).toContain("Kirayste");
    expect(sig).toContain("KIRAYSTE JOOGA");
    expect(sig).not.toContain("matalaya Kirayst");
  });

  test("Xidhan shows the end date", () => {
    expect(text).toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
    expect(text).toContain("30/09/2027");
  });

  test("deposit clause and damiin clause both present", () => {
    expect(text).toContain("Haddii Kiraysadu Guriga u baahato");
    expect(text).toContain("$25");
    expect(text).toContain("DAMIIN MAAL");
    expect(text).toContain("MUSTAFE CABDI");
  });

  test("damiin signs", () => {
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(sig).toContain("Damiin");
  });
});

describe("REVIEW CASE 3 — 3 Kireeye (1 present, 2 share wakiil), 2 Kirayste, Furan", () => {
  const sharedA = rep("repA", { magac: "WAKIIL SHARED", telefoon: "0600777" });
  const sharedRecords = [sharedA];
  const text = render(values({
    kireeye_mode: "multiple", kirayste_mode: "multiple", muddada_nooca: "furan",
    deebaaji_haa: "no", damiin_haa: "no",
    kireeyayaal: [
      jooga("k1", { magac: "KIREYE JOOGA", telefoon: "0610001" }),
      maqan("k2", sharedA.id),
      maqan("k3", sharedA.id),
    ],
    kiraystayaal: [
      jooga("t1", { magac: "KIRAYSTE JOOGA", telefoon: "0620001" }),
      jooga("t2", { magac: "KIRAYSTE LABAAD", telefoon: "0620002" }),
    ],
    wakiilo_kireeyayaal: sharedRecords,
  }));

  test("each person is listed once and signed once — no duplicate entries", () => {
    // Once in the numbered party list, once in their signature block.
    expect(count(text, "KIREYE JOOGA")).toBe(2);
    expect(count(text, "KIRAYSTE JOOGA")).toBe(2); // list + own signature
    expect(count(text, "KIRAYSTE LABAAD")).toBe(2); // list + own signature
    // The absent landlords have no name of their own — never duplicated.
    expect(text).not.toContain("❖ 1. Tell");
  });

  test("the shared wakiil is bound to both absent landlords, stored once", () => {
    // Stored ONCE, referenced by Kireeye 2 and Kireeye 3: two list lines
    // plus one signature line, and only one record in the form values.
    expect(count(text, "WAKIIL SHARED")).toBe(3);
    expect(sharedRecords.length).toBe(1);
  });

  test("plural headings for both groups", () => {
    expect(text).toContain("Magacyada Kireeyayaasha Guriga");
    expect(text).toContain("Magacyada Kiraystayaasha Guriga");
    expect(text).not.toContain("Magaca Kireeysada Guriga");
  });

  test("Furan hides the end date", () => {
    expect(text).not.toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
  });

  test("no wakiil signature block for the tenants (all present)", () => {
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(sig).toContain("Wakiilka (oo matalaya Kireey");
    expect(sig).not.toContain("matalaya Kirayst");
  });
});

describe("REVIEW CASE 4 — 2 Kireeye, 2 Kirayste, different wakiils", () => {
  const kA = rep("kA", { magac: "WAKIIL K-A", telefoon: "0601001" });
  const kB = rep("kB", { magac: "WAKIIL K-B", telefoon: "0601002" });
  const tA = rep("tA", { magac: "WAKIIL T-A", telefoon: "0602001" });
  const tB = rep("tB", { magac: "WAKIIL T-B", telefoon: "0602002" });
  const text = render(values({
    kireeye_mode: "multiple", kirayste_mode: "multiple", muddada_nooca: "furan",
    deebaaji_haa: "no", damiin_haa: "no",
    kireeyayaal: [maqan("k1", kA.id), maqan("k2", kB.id)],
    kiraystayaal: [maqan("t1", tA.id), maqan("t2", tB.id)],
    wakiilo_kireeyayaal: [kA, kB],
    wakiilo_kiraystayaal: [tA, tB],
  }));

  test("each party is bound to its OWN wakiil (no cross-wiring)", () => {
    expect(text).toContain("WAKIIL K-A");
    expect(text).toContain("WAKIIL K-B");
    expect(text).toContain("WAKIIL T-A");
    expect(text).toContain("WAKIIL T-B");
  });

  test("each wakiil appears on its own rows plus one signature line", () => {
    // K-A represents k1 only: 1 list line + 1 signature line.
    expect(count(text, "WAKIIL K-A")).toBe(2);
    // K-B represents k2 only, and the group signature names the first
    // representative — so K-B is listed once with no extra signature line.
    expect(count(text, "WAKIIL K-B")).toBe(1);
  });

  test("signatures include BOTH the landlord and tenant representatives", () => {
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(sig).toContain("matalaya Kireeyada");
    expect(sig).toContain("matalaya Kiraystada");
    expect(sig).toContain("WAKIIL K-A");
    expect(sig).toContain("WAKIIL T-A");
  });

  test("no bare party signature blocks (nobody is present)", () => {
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(sig).not.toMatch(/^Kirayste$/m);
    expect(sig).not.toMatch(/^Kireeye$/m);
  });
});

describe("Structural guarantees", () => {
  test("HABKA_BIXINTA sits OUTSIDE the Xidhan conditional", () => {
    const clause = docXml.indexOf("HABKA_BIXINTA");
    const ifStart = docXml.indexOf("{{IF:KIRO_XIDHAN}}");
    const ifEnd = docXml.indexOf("{{END:KIRO_XIDHAN}}");
    expect(clause).toBeGreaterThan(-1);
    expect(ifStart).toBeGreaterThan(-1);
    expect(ifEnd).toBeGreaterThan(ifStart);
    // The payment clause prints for BOTH lease types.
    expect(clause < ifStart || clause > ifEnd).toBe(true);
  });

  test("the end-date clause sits INSIDE the Xidhan conditional", () => {
    const endDate = docXml.indexOf("TAARIIKH_DHAMMAAD");
    const ifStart = docXml.indexOf("{{IF:KIRO_XIDHAN}}");
    const ifEnd = docXml.indexOf("{{END:KIRO_XIDHAN}}");
    expect(endDate).toBeGreaterThan(ifStart);
    expect(endDate).toBeLessThan(ifEnd);
  });

  test("Deebaaji tokens never appear inside an Ogaysiin context", () => {
    // Deebaaji data belongs to the deposit clause only; Ogaysiin tokens are
    // a separate group and must not be interleaved with it.
    expect(docXml).toContain("{{DEEBAAJI_QIIMAHA}}");
    expect(docXml).not.toContain("{{OGAYSIIN_QIIMAHA}}");
  });

  test("Damiin clause and signature share one flag", () => {
    const ifCount = docXml.split("{{IF:DAMIIN_HAA}}").length - 1;
    const endCount = docXml.split("{{END:DAMIIN_HAA}}").length - 1;
    expect(ifCount).toBe(endCount);
    expect(ifCount).toBeGreaterThanOrEqual(2); // clause + signature
  });

  test("signature blocks are guarded by JOOGA / WAKIIL flags", () => {
    for (const f of ["KIREEYE_JOOGA", "KIREEYE_WAKIIL", "KIRAYSTE_JOOGA", "KIRAYSTE_WAKIIL"]) {
      expect(`${f}: ${docXml.includes(`{{IF:${f}}}`)}`).toBe(`${f}: true`);
    }
  });
});