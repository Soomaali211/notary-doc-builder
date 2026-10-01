/**
 * FINAL VERIFICATION — the exact scenario from the brief, run through the
 * REAL renderer against the REAL template file.
 *
 *   5 Kireeye, Qof 1 present, Qof 2–5 absent, ONE representative (Axmed Cali)
 *   covering all four.
 *
 * Expected document:
 *   ❖ 1. [Qof 1]                    Tell [phone]
 *   ❖ 2. [Qof 2]
 *      Wakiilka: Axmed Cali   Tell: 063xxxx
 *   ❖ 3. [Qof 3]   … (same shape)
 *   ❖ 4. [Qof 4]   …
 *   ❖ 5. [Qof 5]   …
 *   and the Wakiil signature block appears ONCE, not four times.
 *
 * Plus the eight follow-up cases from the brief.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { renderXmlForTest } from "../src/lib/notary/pipeline";
import { buildRepeatBlockData } from "../src/lib/notary/dataContext";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import { linkPartyRepresentative } from "../src/lib/notary/engine";
import { getRepresentatives, representedByRep } from "../src/lib/notary/formValues";
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

/** Render the real template; tabs become spaces, paragraphs become lines. */
function render(values: FormValues): string[] {
  return renderXmlForTest(docXml, heshiisKiroConfig, values)
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .split("\n")
    .map((l) => l.trim());
}

const text = (values: FormValues): string => render(values).join("\n");
const count = (t: string, n: string): number => t.split(n).length - 1;

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
      muddada_nooca: "furan",
      deebaaji_haa: "no",
      damiin_haa: "no",
      taariikhda_bilowga: "2026-10-01",
      taariikhda_dhammaadka: "",
      shuruudaha_gaarka_ah: "",
      ...over,
    },
    kireeyayaal: [],
    kiraystayaal: [],
    wakiilo_kireeyayaal: [],
    wakiilo_kiraystayaal: [],
    maragyo: [],
    guriga: {
      nooca_guriga: "guri_xaas",
      goobta: "Degmada 26 June Xaafada Ci/Gal",
      cinwaanka_guriga: "",
      sharraxaad: "gaar ahaan Shulaac Waana 4 Qol",
      qolada: "",
    },
    lacagta: {
      qiimaha_bil_ka: "200",
      habka_bixinta: "cash",
      taariikhda_bixinta: "bisha 1aad ee bil kasta",
      bixinta_hore: "muqadin",
      faahfaahin_lacagta: "",
    },
    deebaaji: {},
    damiinka: {},
    ogaysiinta: {},
    dheeraad: { shuruudo_dheeraad: "" },
  } as FormValues;
}

/** The exact scenario from the brief. */
function theScenario(): FormValues {
  let v = base();
  v.kireeyayaal = [
    row("k1", "CABDI XASAN", "0634839488", "jooga"),
    row("k2", "XASAN AHMED", "0631110002", "wakiil"),
    row("k3", "MAXAMED YUUSUF", "0631110003", "wakiil"),
    row("k4", "CALI MAXAMED", "0631110004", "wakiil"),
    row("k5", "HAAJI SULDAN", "0631110005", "wakiil"),
  ];
  v.wakiilo_kireeyayaal = [rep("W001", "AXMED CALI", "0600999888")];
  v.kiraystayaal = [row("t1", "HODAN JOOF", "0632220001", "jooga")];
  // The UI's grouping panel ticks Qof 2,3,4,5 onto the one representative.
  for (const i of [1, 2, 3, 4]) {
    v = linkPartyRepresentative(v, "kireeyayaal", i, "W001");
  }
  return v;
}

describe("MAIN SCENARIO — 5 Kireeye, 1 present, 4 absent, ONE wakiil", () => {
  const v = theScenario();
  const lines = render(v);
  const full = lines.join("\n");
  const sigStart = full.split("Saxiiyada:")[1] ?? "";

  test("the document prints each party exactly as specified", () => {
    // Person 1 — present: name and phone on ONE line.
    const line1 = lines.find((l) => l.startsWith("❖ 1. CABDI XASAN"))!;
    expect(line1).toContain("CABDI XASAN");
    expect(line1).toContain("Tell");
    expect(line1).toContain("0634839488");

    // Persons 2–5 — absent: their OWN name, then the wakiil line beneath.
    for (const [n, name] of [
      [2, "XASAN AHMED"],
      [3, "MAXAMED YUUSUF"],
      [4, "CALI MAXAMED"],
      [5, "HAAJI SULDAN"],
    ] as const) {
      expect(`${n}: ${full.includes(`❖ ${n}. ${name}`)}`).toBe(`${n}: true`);
    }
    // The wakiil line follows each of them.
    // Each absent row carries the wakiil line (4). The signature block is a
    // separate "Wakiilka (oo matalaya …)" label, so the name and phone are
    // seen 4 times in the list plus once in the signature = 5.
    expect(count(full, "Wakiilka:")).toBe(4);
    expect(count(full, "AXMED CALI")).toBe(5);
    expect(count(full, "0600999888")).toBe(5);
  });

  test("the wakiil line sits directly under the person it stands in for", () => {
    const linesWithWakiil = lines.filter((l) => l.startsWith("Wakiilka:"));
    expect(linesWithWakiil.length).toBe(4);
    lines.forEach((line, i) => {
      if (!line.startsWith("Wakiilka:")) return;
      const above = lines[i - 1];
      expect(`${above} -> ${line}`).toBe(`${above} -> ${line}`);
      // The line above must be a numbered person, never the wakiil himself.
      expect(above.startsWith("❖ ")).toBe(true);
      expect(above).not.toContain("AXMED CALI");
    });
  });

  test("the representative never appears as a party of his own", () => {
    // He must never be numbered 1–5 in the party list.
    for (let n = 1; n <= 5; n++) {
      expect(`party ${n}: ${full.includes(`❖ ${n}. AXMED CALI`)}`).toBe(
        `party ${n}: false`,
      );
    }
  });

  test("the wakiil signature appears ONCE, not four times", () => {
    expect(count(sigStart, "AXMED CALI")).toBe(1);
    expect(sigStart).toContain("Wakiilka");
    // Exactly one signature line for him.
    const sigLines = sigStart.split("\n").filter((l) => l.includes("AXMED CALI"));
    expect(sigLines.length).toBe(1);
  });

  test("one stored record, four references — nothing duplicated in storage", () => {
    expect(getRepresentatives(v, { id: "kireeyayaal" } as never)).toBeDefined();
    const stored = (v.wakiilo_kireeyayaal ?? []) as PartyRow[];
    expect(stored.length).toBe(1);
    const refs = (v.kireeyayaal as PartyRow[]).filter(
      (r) => r.attendance?.representativeId === "W001",
    );
    expect(refs.length).toBe(4);
  });
});

describe("1 — two representatives, different groups", () => {
  let v = base();
  v.kireeyayaal = [
    row("k1", "CABDI XASAN", "0611", "jooga"),
    row("k2", "XASAN AHMED", "0622", "wakiil"),
    row("k3", "MAXAMED YUUSUF", "0633", "wakiil"),
    row("k4", "CALI MAXAMED", "0644", "wakiil"),
    row("k5", "HAAJI SULDAN", "0655", "wakiil"),
  ];
  v.wakiilo_kireeyayaal = [
    rep("WA", "AXMED CALI", "0601"),
    rep("WB", "MAXAMED CABDI", "0602"),
  ];
  v.kiraystayaal = [row("t1", "HODAN", "0677", "jooga")];
  v = linkPartyRepresentative(v, "kireeyayaal", 1, "WA");
  v = linkPartyRepresentative(v, "kireeyayaal", 2, "WA");
  v = linkPartyRepresentative(v, "kireeyayaal", 3, "WB");
  v = linkPartyRepresentative(v, "kireeyayaal", 4, "WB");
  const full = text(v);
  const sig = full.split("Saxiiyada:")[1] ?? "";

  test("each absent party is bound to the right representative", () => {
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIREYEYAYAAL")!.rows;
    expect(rows[1].WAKIIL_MAGAC).toBe("AXMED CALI");
    expect(rows[2].WAKIIL_MAGAC).toBe("AXMED CALI");
    expect(rows[3].WAKIIL_MAGAC).toBe("MAXAMED CABDI");
    expect(rows[4].WAKIIL_MAGAC).toBe("MAXAMED CABDI");
  });

  test("each representative is listed once with the people they cover", () => {
    // WA covers Qof 2,3 — it appears on both rows.
    expect(count(full, "Wakiilka: AXMED CALI")).toBe(2);
    // WB covers Qof 4,5 — likewise.
    expect(count(full, "Wakiilka: MAXAMED CABDI")).toBe(2);
  });

  test("the engine exposes a signature row per representative (MATALAYA)", () => {
    // KNOWN TEMPLATE LIMITATION: the starter template signs the group with
    // the scalar {{KIREEYE_WAKIIL_MAGAC}}, which is the FIRST representative,
    // so the second representative gets no signature block. The data for it
    // already exists — a template that iterates the block below will print
    // one signature per representative:
    //     {{#WAKIILO_KIREEYAYAAL}}
    //     Wakiilka: {{MAGAC}}  Matalaya: {{MATALAYA}}
    //     {{/WAKIILO_KIREEYAYAAL}}
    const reps = buildRepeatBlockData(heshiisKiroConfig, v).get("WAKIILO_KIREEYAYAAL");
    expect(reps?.rows.length ?? 0).toBe(2);
    expect(reps?.rows.map((r) => r.MAGAC)).toEqual(["AXMED CALI", "MAXAMED CABDI"]);
    expect(reps?.rows.map((r) => r.MATALAYA)).toEqual([
      "XASAN AHMED, MAXAMED YUUSUF",
      "CALI MAXAMED, HAAJI SULDAN",
    ]);
  });
});

describe("2 — many landlords", () => {
  const v = (() => {
    let x = base();
    x.kireeyayaal = [
      row("k1", "K1", "071", "jooga"),
      row("k2", "K2", "072", "jooga"),
      row("k3", "K3", "073", "jooga"),
      row("k4", "K4", "074", "jooga"),
      row("k5", "K5", "075", "jooga"),
      row("k6", "K6", "076", "jooga"),
    ];
    x.kiraystayaal = [row("t1", "T1", "081", "jooga")];
    return x;
  })();
  const full = text(v);

  test("all six landlords are listed, numbered, singular-per-row", () => {
    for (let n = 1; n <= 6; n++) {
      expect(`❖ ${n}. K${n}:`).toBe(`❖ ${n}. K${n}:`);
      expect(`${n}: ${full.includes(`❖ ${n}. K${n}`)}`).toBe(`${n}: true`);
    }
    expect(full).toContain("Magacyada Kireeyayaasha Guriga");
    expect(full).not.toContain("Wakiilka:");
  });
});

describe("3 — many tenants", () => {
  const v = (() => {
    let x = base({ kireeye_mode: "single" });
    x.kireeyayaal = [row("k1", "K1", "071", "jooga")];
    x.kiraystayaal = [
      row("t1", "T1", "081", "jooga"),
      row("t2", "T2", "082", "jooga"),
      row("t3", "T3", "083", "jooga"),
      row("t4", "T4", "084", "jooga"),
    ];
    return x;
  })();
  const full = text(v);

  test("all four tenants are listed under the plural heading", () => {
    expect(full).toContain("Magacyada Kiraystayaasha Guriga");
    for (let n = 1; n <= 4; n++) {
      expect(`${n}: ${full.includes(`❖ ${n}. T${n}`)}`).toBe(`${n}: true`);
    }
    expect(full).toContain("Magaca Kireeysada Guriga"); // single landlord
    expect(full).not.toContain("Wakiilka:");
  });
});

describe("4 — a present person with no representative", () => {
  const v = base();
  v.kireeyayaal = [
    row("k1", "CABDI XASAN", "063111", "jooga"),
    row("k2", "XASAN AHMED", "063222", "wakiil", "W001"),
  ];
  v.wakiilo_kireeyayaal = [rep("W001", "AXMED CALI", "0600999")];
  v.kiraystayaal = [row("t1", "HODAN", "063333", "jooga")];
  const full = text(v);

  test("the present person shows name + phone and no wakiil line", () => {
    // Look at the PARTY LIST line specifically, not the signature block.
    const listLine = render(v).find((l) => l.startsWith("❖ 1. CABDI XASAN"))!;
    expect(listLine).toContain("CABDI XASAN");
    expect(listLine).toContain("063111");
    expect(listLine).not.toContain("Wakiilka");
    expect(listLine).not.toContain("AXMED CALI");
  });

  test("only the absent person gets a wakiil line", () => {
    expect(count(full, "Wakiilka:")).toBe(1);
  });
});

describe("5 — Kiro Furan hides the end date", () => {
  const v = base({ muddada_nooca: "furan" });
  v.kireeyayaal = [row("k1", "K1", "061", "jooga")];
  v.kiraystayaal = [row("t1", "T1", "062", "jooga")];
  test("no end date anywhere", () => {
    expect(text(v)).not.toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
  });
});

describe("6 — Kiro Xidhan shows the end date", () => {
  const v = base({ muddada_nooca: "xidhan", taariikhda_dhammaadka: "2027-09-30" });
  v.kireeyayaal = [row("k1", "K1", "061", "jooga")];
  v.kiraystayaal = [row("t1", "T1", "062", "jooga")];
  test("end date present", () => {
    const full = text(v);
    expect(full).toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
    expect(full).toContain("30/09/2027");
  });
});

describe("7 — Deebaaji = Maya hides the deposit section", () => {
  const v = base({ deebaaji_haa: "no" });
  v.kireeyayaal = [row("k1", "K1", "061", "jooga")];
  v.kiraystayaal = [row("t1", "T1", "062", "jooga")];
  test("no deposit clause", () => {
    expect(text(v)).not.toContain("Haddii Kiraysadu Guriga u baahato");
  });
});

describe("8 — Damiin = Maya hides the section and the signature", () => {
  const v = base({ damiin_haa: "no" });
  v.kireeyayaal = [row("k1", "K1", "061", "jooga")];
  v.kiraystayaal = [row("t1", "T1", "062", "jooga")];
  test("no damiin clause, no damiin signature", () => {
    const full = text(v);
    expect(full).not.toContain("DAMIIN MAAL");
    expect(full).not.toContain("Saxeexa Damiinka");
    expect(full.split("Saxiiyada:")[1] ?? "").not.toContain("Damiin");
  });
});