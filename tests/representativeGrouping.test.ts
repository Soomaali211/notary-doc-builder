/**
 * REPRESENTATIVE CORRECTION — one wakiil may stand in for ONE person or
 * MANY people. These tests walk the whole chain the review lists:
 *
 *   STEP 1 → PARTY COUNT → PARTY STATUS → REPRESENTATIVE GROUPING
 *   → FORM STATE → DATA MODEL → DOCUMENT DATA → SIGNATURE DATA → DOCX
 *
 * The contract being enforced:
 *   • a representative is stored ONCE, referenced by every party they act
 *     for (no per-person copy of name/phone);
 *   • a wakiil NEVER replaces the person — the document always shows the
 *     party's own name plus the representative acting for them;
 *   • a present person is never given a representative;
 *   • one signature per representative, not per absent person.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { renderXmlForTest } from "../src/lib/notary/pipeline";
import { buildRepeatBlockData, resolveFlags } from "../src/lib/notary/dataContext";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import {
  ensurePartyRepresentative,
  linkPartyRepresentative,
} from "../src/lib/notary/engine";
import {
  getRepresentatives,
  representedByRep,
} from "../src/lib/notary/formValues";
import type { FormValues, PartyRow, PartyDef } from "../src/lib/notary/types";

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

const render = (values: FormValues): string =>
  renderXmlForTest(docXml, heshiisKiroConfig, values)
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

const count = (t: string, n: string): number => t.split(n).length - 1;

const partyDef = (id: string): PartyDef =>
  heshiisKiroConfig.sections
    .flatMap((s) => s.parties ?? [])
    .find((p) => p.id === id)!;

/** Party row helper. status: "jooga" | "wakiil". */
const row = (
  id: string,
  magac: string,
  telefoon: string,
  status: "jooga" | "wakiil",
  representativeId?: string,
): PartyRow => ({
  id,
  values: { magac, telefoon, aqoonsi: "", cinwaan: "", faahfaahin_dheeraad: "" },
  attendance:
    status === "wakiil" ? { status, representativeId } : { status },
});

const repRow = (id: string, magac: string, telefoon: string): PartyRow => ({
  id,
  values: { magac, telefoon, aqoonsi: "", cinwaan: "" },
});

/** Base form state; `mode` is the Step-1 radio answer. */
function base(over: {
  kireeye_mode?: string;
  kirayste_mode?: string;
  muddada_nooca?: string;
  deebaaji_haa?: string;
  damiin_haa?: string;
  kireeyayaal?: PartyRow[];
  kiraystayaal?: PartyRow[];
  wakiilo_kireeyayaal?: PartyRow[];
  wakiilo_kiraystayaal?: PartyRow[];
}): FormValues {
  return {
    heshiiska: {
      reference: "DPN/K/REP",
      taariikhda_heshiiska: "2026-09-29",
      sub_type: "guri_xaas",
      kireeye_mode: over.kireeye_mode ?? "multiple",
      kirayste_mode: over.kirayste_mode ?? "multiple",
      muddada_nooca: over.muddada_nooca ?? "furan",
      deebaaji_haa: over.deebaaji_haa ?? "no",
      damiin_haa: over.damiin_haa ?? "no",
      taariikhda_bilowga: "2026-10-01",
      taariikhda_dhammaadka:
        (over.muddada_nooca ?? "furan") === "xidhan" ? "2027-09-30" : "",
      shuruudaha_gaarka_ah: "",
    },
    kireeyayaal: over.kireeyayaal ?? [],
    kiraystayaal: over.kiraystayaal ?? [],
    wakiilo_kireeyayaal: over.wakiilo_kireeyayaal ?? [],
    wakiilo_kiraystayaal: over.wakiilo_kiraystayaal ?? [],
    maragyo: [],
    guriga: {
      nooca_guriga: "guri_xaas",
      goobta: "Degmada 26 June",
      cinwaanka_guriga: "",
      sharraxaad: "",
      qolada: "",
    },
    lacagta: {
      qiimaha_bil_ka: "200",
      habka_bixinta: "cash",
      taariikhda_bixinta: "bisha 1aad",
      bixinta_hore: "muqadin",
      faahfaahin_lacagta: "",
    },
    deebaaji: over.deebaaji_haa === "yes" ? { lacagta_deebaajiga: "25" } : {},
    damiinka:
      over.damiin_haa === "yes"
        ? { damiin_magac: "MUSTAFE CABDI", damiin_telefoon: "0634714915" }
        : {},
    ogaysiinta: {},
    dheeraad: { shuruudo_dheeraad: "" },
  } as FormValues;
}

const KIREYE = () => partyDef("kireeyayaal");
const KIRAYSTE = () => partyDef("kiraystayaal");

describe("CHAIN — Step 1 → count → status → grouping → form state", () => {
  test("a Maya party is auto-linked to a representative (grouping created)", () => {
    let v = base({
      kireeye_mode: "multiple",
      kireeyayaal: [row("k1", "CABDI XASAN", "063111", "jooga"), row("k2", "XASAN AHMED", "063222", "jooga")],
    });
    // The user marks person 2 as absent — exactly as the UI switch does.
    v = ensurePartyRepresentative(v, KIREYE(), "kireeyayaal", 1);
    const reps = getRepresentatives(v, KIREYE());
    expect(reps.length).toBe(1);
    const rows = v.kireeyayaal as PartyRow[];
    expect(rows[1].attendance?.status).toBe("wakiil");
    expect(rows[1].attendance?.representativeId).toBe(reps[0].id);
  });

  test("one representative can be linked to MANY parties (shared, stored once)", () => {
    let v = base({
      kireeye_mode: "multiple",
      kireeyayaal: [
        row("k1", "P1", "1", "jooga"),
        row("k2", "P2", "2", "jooga"),
        row("k3", "P3", "3", "jooga"),
      ],
      wakiilo_kireeyayaal: [repRow("W001", "AXMED CALI", "0600999")],
    });
    // The user ticks Qof 2, 3, 4 on the SAME representative.
    v = linkPartyRepresentative(v, "kireeyayaal", 1, "W001");
    v = linkPartyRepresentative(v, "kireeyayaal", 2, "W001");
    const def = KIREYE();
    // Stored ONCE.
    expect(getRepresentatives(v, def).length).toBe(1);
    // Referenced by both.
    expect(representedByRep(v, def, "W001")).toEqual(["P2", "P3"]);
  });

  test("a present party is never given a representative", () => {
    const v = base({
      kireeye_mode: "multiple",
      kireeyayaal: [row("k1", "P1", "1", "jooga")],
      wakiilo_kireeyayaal: [repRow("W001", "AXMED", "06")],
    });
    const r = (v.kireeyayaal as PartyRow[])[0];
    expect(r.attendance?.representativeId).toBeUndefined();
  });
});

describe("CHAIN — data model → document data", () => {
  test("the representative's name/phone are NOT copied onto each person", () => {
    const v = base({
      kireeyayaal: [
        row("k2", "XASAN AHMED", "063222", "wakiil", "W001"),
        row("k3", "MAXAMED YUUSUF", "063333", "wakiil", "W001"),
      ],
      wakiilo_kireeyayaal: [repRow("W001", "AXMED CALI", "0600999")],
    });
    const rows = v.kireeyayaal as PartyRow[];
    // Each person keeps THEIR OWN name and phone.
    expect(rows[0].values.magac).toBe("XASAN AHMED");
    expect(rows[0].values.telefoon).toBe("063222");
    expect(rows[1].values.magac).toBe("MAXAMED YUUSUF");
    // Only the LINK is stored on the person.
    expect(rows[0].attendance?.representativeId).toBe("W001");
    expect(rows[1].attendance?.representativeId).toBe("W001");
    // No per-person representativeName / representativePhone fields exist.
    expect(Object.keys(rows[0].values)).not.toContain("representativeName");
    expect(Object.keys(rows[0].values)).not.toContain("representativePhone");
  });

  test("each absent row carries ITS OWN representative token (wakiil stays bound)", () => {
    const v = base({
      kireeyayaal: [
        row("k1", "P1", "1", "jooga"),
        row("k2", "P2", "2", "wakiil", "W001"),
        row("k3", "P3", "3", "wakiil", "W001"),
      ],
      wakiilo_kireeyayaal: [repRow("W001", "AXMED CALI", "0600999")],
    });
    const blocks = buildRepeatBlockData(heshiisKiroConfig, v);
    const rows = blocks.get("KIREYEYAYAAL")!.rows;
    expect(rows.length).toBe(3);
    // Present row: no wakiil data at all.
    expect(rows[0].JOOGA).toBe("1");
    expect(rows[0].WAKIIL_MAGAC).toBe("");
    // Each absent row resolves ITS representative.
    expect(rows[1].WAKIIL).toBe("1");
    expect(rows[1].WAKIIL_MAGAC).toBe("AXMED CALI");
    expect(rows[2].WAKIIL_MAGAC).toBe("AXMED CALI");
    // AND each row still carries its own person name.
    expect(rows[1].MAGAC).toBe("P2");
    expect(rows[2].MAGAC).toBe("P3");
  });

  test("one representative for many people produces ONE signature, not many", () => {
    const v = base({
      kireeye_mode: "multiple",
      kireeyayaal: [
        row("k1", "P1", "1", "jooga"),
        row("k2", "P2", "2", "wakiil", "W001"),
        row("k3", "P3", "3", "wakiil", "W001"),
        row("k4", "P4", "4", "wakiil", "W001"),
      ],
      wakiilo_kireeyayaal: [repRow("W001", "AXMED CALI", "0600999")],
    });
    // The ENGINE must expose both halves of the relationship for every
    // absent row — the person's own name AND the representative acting for
    // them — so the user's own template can print both lines.
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIREYEYAYAAL")!.rows;
    expect(rows.length).toBe(4);
    for (const i of [1, 2, 3]) {
      expect(rows[i].MAGAC).not.toBe("");
      expect(rows[i].WAKIIL_MAGAC).toBe("AXMED CALI");
      expect(rows[i].WAKIIL).toBe("1");
    }
    // One stored record backs all three links.
    expect(getRepresentatives(v, KIREYE()).length).toBe(1);
  });
});

describe("TEST 1 — 1 Kireeye, present", () => {
  const v = base({
    kireeye_mode: "single", kirayste_mode: "single",
    kireeyayaal: [row("k1", "CABDI XASAN", "063111", "jooga")],
    kiraystayaal: [row("t1", "HODAN JOOF", "062222", "jooga")],
  });
  const text = render(v);

  test("name + phone only, no wakiil", () => {
    expect(text).toContain("CABDI XASAN");
    expect(text).toContain("063111");
    expect(text).not.toContain("Wakiilka");
    expect(getRepresentatives(v, KIREYE()).length).toBe(0);
  });
});

describe("TEST 2 — 1 Kireeye, absent via wakiil", () => {
  const v = base({
    kireeye_mode: "single", kirayste_mode: "single",
    kireeyayaal: [row("k1", "XASAN AHMED", "063222", "wakiil", "W001")],
    wakiilo_kireeyayaal: [repRow("W001", "AXMED CALI", "0600999")],
    kiraystayaal: [row("t1", "HODAN JOOF", "062222", "jooga")],
  });
  const text = render(v);

  test("engine exposes the person's name AND the wakiil for the template", () => {
    // Both tokens are available on the row so the user's template can print
    // "XASAN AHMED / Wakiilka: AXMED CALI" — the wakiil never replaces him.
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIREYEYAYAAL")!.rows;
    expect(rows[0].MAGAC).toBe("XASAN AHMED");
    expect(rows[0].TELEFOON).toBe("063222");
    expect(rows[0].WAKIIL_MAGAC).toBe("AXMED CALI");
    expect(rows[0].WAKIIL_TELEFOON).toBe("0600999");
  });

  test("the wakiil never replaces the person", () => {
    // The document must NOT show the representative as if he were the party.
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIREYEYAYAAL")!.rows;
    expect(rows[0].MAGAC).toBe("XASAN AHMED");
    expect(rows[0].WAKIIL_MAGAC).toBe("AXMED CALI");
  });

  test("the wakiil signs for the absent person", () => {
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(sig).toContain("AXMED CALI");
  });
});

describe("TEST 3 — 4 Kireeye, persons 2,3,4 absent, ONE wakiil for all three", () => {
  const v = base({
    kireeye_mode: "multiple",
    kireeyayaal: [
      row("k1", "P1 CABDI", "063111", "jooga"),
      row("k2", "P2 XASAN", "063222", "wakiil", "W001"),
      row("k3", "P3 MAXAMED", "063333", "wakiil", "W001"),
      row("k4", "P4 CALI", "063444", "wakiil", "W001"),
    ],
    wakiilo_kireeyayaal: [repRow("W001", "AXMED CALI", "0600999")],
    kiraystayaal: [row("t1", "HODAN JOOF", "062222", "jooga")],
  });
  const text = render(v);
  const def = KIREYE();

  test("stored ONCE and linked to three people", () => {
    expect(getRepresentatives(v, def).length).toBe(1);
    expect(representedByRep(v, def, "W001")).toEqual([
      "P2 XASAN",
      "P3 MAXAMED",
      "P4 CALI",
    ]);
  });

  test("every person keeps their own name — engine never substitutes the wakiil", () => {
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIREYEYAYAAL")!.rows;
    expect(rows.map((r) => r.MAGAC)).toEqual([
      "P1 CABDI",
      "P2 XASAN",
      "P3 MAXAMED",
      "P4 CALI",
    ]);
    // Each absent row additionally names the one shared representative.
    for (const i of [1, 2, 3]) expect(rows[i].WAKIIL_MAGAC).toBe("AXMED CALI");
  });

  test("one stored representative, referenced by three people", () => {
    expect(getRepresentatives(v, KIREYE()).length).toBe(1);
    expect(representedByRep(v, KIREYE(), "W001").length).toBe(3);
  });
});

describe("TEST 4 — 5 Kireeye, two DIFFERENT wakiils for different groups", () => {
  const v = base({
    kireeye_mode: "multiple",
    kireeyayaal: [
      row("k1", "P1 CABDI", "063111", "jooga"),
      row("k2", "P2 XASAN", "063222", "wakiil", "WA"),
      row("k3", "P3 MAXAMED", "063333", "wakiil", "WA"),
      row("k4", "P4 CALI", "063444", "wakiil", "WB"),
      row("k5", "P5 HAAJI", "063555", "wakiil", "WB"),
    ],
    wakiilo_kireeyayaal: [
      repRow("WA", "AXMED CALI", "0600999"),
      repRow("WB", "MAXAMED CABDI", "0600888"),
    ],
    kiraystayaal: [row("t1", "HODAN JOOF", "062222", "jooga")],
  });
  const text = render(v);
  const def = KIREYE();

  test("two separate representatives with disjoint groups", () => {
    expect(getRepresentatives(v, def).length).toBe(2);
    expect(representedByRep(v, def, "WA")).toEqual(["P2 XASAN", "P3 MAXAMED"]);
    expect(representedByRep(v, def, "WB")).toEqual(["P4 CALI", "P5 HAAJI"]);
  });

  test("each person is bound to the RIGHT representative", () => {
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIREYEYAYAAL")!.rows;
    expect(rows[1].WAKIIL_MAGAC).toBe("AXMED CALI");
    expect(rows[2].WAKIIL_MAGAC).toBe("AXMED CALI");
    expect(rows[3].WAKIIL_MAGAC).toBe("MAXAMED CABDI");
    expect(rows[4].WAKIIL_MAGAC).toBe("MAXAMED CABDI");
    // No cross-wiring: nobody gets the other group's representative.
    expect(rows[1].MAGAC).toBe("P2 XASAN");
    expect(rows[4].MAGAC).toBe("P5 HAAJI");
  });

  test("each group needs exactly ONE representative signature, not one per person", () => {
    // The document-level flag is per GROUP, so the template emits one
    // signature block per representative rather than one per absent party.
    const flags = resolveFlags(heshiisKiroConfig, v);
    expect(flags.KIREEYE_WAKIIL).toBe(true);
    expect(getRepresentatives(v, KIREYE()).length).toBe(2);
    // Two absent persons for WA, two for WB — never four signatures.
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIREYEYAYAAL")!.rows;
    expect(rows.filter((r) => r.WAKIIL === "1").length).toBe(4);
  });
});

describe("TEST 5 — 3 Kireeye, all present", () => {
  const v = base({
    kireeye_mode: "multiple",
    kireeyayaal: [
      row("k1", "P1 CABDI", "063111", "jooga"),
      row("k2", "P2 XASAN", "063222", "jooga"),
      row("k3", "P3 MAXAMED", "063333", "jooga"),
    ],
    kiraystayaal: [row("t1", "HODAN JOOF", "062222", "jooga")],
  });
  const text = render(v);

  test("no wakiil anything", () => {
    expect(text).not.toContain("Wakiilka");
    expect(getRepresentatives(v, KIREYE()).length).toBe(0);
    expect(resolveFlags(heshiisKiroConfig, v).KIREEYE_WAKIIL).toBe(false);
  });
});

describe("TEST 6 — Kiro Furan hides the end date", () => {
  const text = render(base({ muddada_nooca: "furan", kireeye_mode: "single",
    kireeyayaal: [row("k1", "P1", "06", "jooga")],
    kiraystayaal: [row("t1", "T1", "06", "jooga")] }));
  test("no end date", () => {
    expect(text).not.toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
  });
});

describe("TEST 7 — Kiro Xidhan shows the end date", () => {
  const text = render(base({ muddada_nooca: "xidhan", kireeye_mode: "single",
    kireeyayaal: [row("k1", "P1", "06", "jooga")],
    kiraystayaal: [row("t1", "T1", "06", "jooga")] }));
  test("end date present", () => {
    expect(text).toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
    expect(text).toContain("30/09/2027");
  });
});

describe("TEST 8 — Deebaaji = Maya hides the deposit section", () => {
  const text = render(base({ deebaaji_haa: "no", kireeye_mode: "single",
    kireeyayaal: [row("k1", "P1", "06", "jooga")],
    kiraystayaal: [row("t1", "T1", "06", "jooga")] }));
  test("no deposit clause", () => {
    expect(text).not.toContain("Haddii Kiraysadu Guriga u baahato");
    expect(text).not.toContain("$25");
  });
});

describe("TEST 9 — Damiin = Maya hides section and signature", () => {
  const text = render(base({ damiin_haa: "no", kireeye_mode: "single",
    kireeyayaal: [row("k1", "P1", "06", "jooga")],
    kiraystayaal: [row("t1", "T1", "06", "jooga")] }));
  test("no damiin anywhere", () => {
    expect(text).not.toContain("DAMIIN MAAL");
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(sig).not.toContain("Damiin");
  });
});

describe("TEST 10 — several tenants, ONE wakiil standing in for many", () => {
  const v = base({
    kireeye_mode: "single",
    kireeyayaal: [row("k1", "CABDI XASAN", "063111", "jooga")],
    kirayste_mode: "multiple",
    kiraystayaal: [
      row("t1", "T1 HODAN", "062111", "jooga"),
      row("t2", "T2 SAYID", "062222", "wakiil", "WT"),
      row("t3", "T3 AMINA", "062333", "wakiil", "WT"),
    ],
    wakiilo_kiraystayaal: [repRow("WT", "AMINA WALI", "0600777")],
  });
  const text = render(v);
  const def = KIRAYSTE();

  test("one representative stored once, linked to two tenants", () => {
    expect(getRepresentatives(v, def).length).toBe(1);
    expect(representedByRep(v, def, "WT")).toEqual(["T2 SAYID", "T3 AMINA"]);
  });

  test("each absent tenant keeps their own name and shows the wakiil", () => {
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIRAYSTAYAAL")!.rows;
    expect(rows[1].MAGAC).toBe("T2 SAYID");
    expect(rows[1].WAKIIL_MAGAC).toBe("AMINA WALI");
    expect(rows[2].MAGAC).toBe("T3 AMINA");
    expect(rows[2].WAKIIL_MAGAC).toBe("AMINA WALI");
  });

  test("the representative signs once for the tenants", () => {
    const sig = text.split("Saxiiyada:")[1] ?? "";
    expect(count(sig, "AMINA WALI")).toBe(1);
  });

  test("the present tenant is unaffected", () => {
    expect(text).toContain("T1 HODAN");
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIRAYSTAYAAL")!.rows;
    expect(rows[0].WAKIIL_MAGAC).toBe("");
    expect(rows[0].JOOGA).toBe("1");
  });
});