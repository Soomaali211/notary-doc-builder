/**
 * Representative grouping — the UI's checkbox behaviour (driven through the
 * same handlers the page uses) plus the document rendering that follows it.
 *
 * Covers the review's TEST A–I:
 *   A  one wakiil covering four absent people
 *   B  two wakiils, disjoint groups, no cross-wiring
 *   C  the document shows BOTH the person and the representative
 *   D  a present person is never given a representative
 *   E  one wakiil covering many people is named on each row
 *   F  Kiro Furan hides the end date
 *   G  Kiro Xidhan shows the end date
 *   H  Deebaaji = Maya hides the deposit section
 *   I  Damiin = Maya hides the section
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { renderXmlForTest } from "../src/lib/notary/pipeline";
import { buildRepeatBlockData, resolveFlags } from "../src/lib/notary/dataContext";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import {
  createRepresentative,
  linkPartyRepresentative,
  setPartyAttendance,
  deleteRepresentative,
} from "../src/lib/notary/engine";
import { getRepresentatives, representedByRep } from "../src/lib/notary/formValues";
import type { FormValues, PartyDef, PartyRow } from "../src/lib/notary/types";

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

const def = (id: string): PartyDef =>
  heshiisKiroConfig.sections
    .flatMap((s) => s.parties ?? [])
    .find((p) => p.id === id)!;

const KIREYE = () => def("kireeyayaal");
const KIRAYSTE = () => def("kiraystayaal");

const row = (
  id: string,
  magac: string,
  telefoon: string,
  status: "jooga" | "wakiil" | "ma_joogo",
  representativeId?: string,
): PartyRow => ({
  id,
  values: { magac, telefoon, aqoonsi: "", cinwaan: "", faahfaahin_dheeraad: "" },
  attendance:
    status === "wakiil"
      ? { status, representativeId }
      : { status },
});

const repRow = (id: string, magac: string, telefoon: string): PartyRow => ({
  id,
  values: { magac, telefoon, aqoonsi: "", cinwaan: "" },
});

function base(over: Partial<Record<string, string>> = {}): FormValues {
  return {
    heshiiska: {
      reference: "DPN/K/UI",
      taariikhda_heshiiska: "2026-09-29",
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
    deebaaji: {},
    damiinka: {},
    ogaysiinta: {},
    dheeraad: { shuruudo_dheeraad: "" },
  } as FormValues;
}

/**
 * The exact handler the grouping panel calls — copied so the test exercises
 * the same transition the UI performs (a present person is never linkable).
 */
function toggleRepMember(
  v: FormValues,
  partyDef: PartyDef,
  repId: string,
  rowIndex: number,
  member: boolean,
): FormValues {
  const rows = (v[partyDef.id] ?? []) as PartyRow[];
  if (rows[rowIndex]?.attendance?.status === "jooga") return v;
  if (member) return linkPartyRepresentative(v, partyDef.id, rowIndex, repId);
  return setPartyAttendance(v, partyDef.id, rowIndex, "ma_joogo");
}

describe("TEST A — 5 Kireeye, persons 2,3,4,5 absent, ONE wakiil covering all four", () => {
  let v = base();
  v.kireeyayaal = [
    row("k1", "P1 CABDI", "063111", "jooga"),
    row("k2", "P2 XASAN", "063222", "ma_joogo"),
    row("k3", "P3 MAXAMED", "063333", "ma_joogo"),
    row("k4", "P4 CALI", "063444", "ma_joogo"),
    row("k5", "P5 HAAJI", "063555", "ma_joogo"),
  ];
  v.wakiilo_kireeyayaal = [repRow("W001", "AXMED CALI", "0600999")];
  v.kiraystayaal = [row("t1", "HODAN", "062222", "jooga")];

  // The user ticks Qof 2, 3, 4, 5 on the SAME representative.
  for (const i of [1, 2, 3, 4]) {
    v = toggleRepMember(v, KIREYE(), "W001", i, true);
  }

  test("4 people selected → 1 record → 4 references", () => {
    expect(getRepresentatives(v, KIREYE()).length).toBe(1);
    const rows = v.kireeyayaal as PartyRow[];
    const linked = rows.filter((r) => r.attendance?.representativeId === "W001");
    expect(linked.length).toBe(4);
    expect(representedByRep(v, KIREYE(), "W001")).toEqual([
      "P2 XASAN",
      "P3 MAXAMED",
      "P4 CALI",
      "P5 HAAJI",
    ]);
  });

  test("the present person was never linked", () => {
    const rows = v.kireeyayaal as PartyRow[];
    expect(rows[0].attendance?.status).toBe("jooga");
    expect(rows[0].attendance?.representativeId).toBeUndefined();
  });

  test("unticking one person drops only that link", () => {
    let after = toggleRepMember(v, KIREYE(), "W001", 3, false);
    const rows = after.kireeyayaal as PartyRow[];
    expect(rows[3].attendance?.representativeId).toBeUndefined();
    expect(representedByRep(after, KIREYE(), "W001").length).toBe(3);
    // The other three keep their link.
    expect(representedByRep(after, KIREYE(), "W001")).toContain("P4 CALI".replace("P4 CALI", "P3 MAXAMED"));
  });
});

describe("TEST B — two wakiils, disjoint groups", () => {
  let v = base();
  v.kireeyayaal = [
    row("k1", "P1 CABDI", "063111", "jooga"),
    row("k2", "P2 XASAN", "063222", "ma_joogo"),
    row("k3", "P3 MAXAMED", "063333", "ma_joogo"),
    row("k4", "P4 CALI", "063444", "ma_joogo"),
    row("k5", "P5 HAAJI", "063555", "ma_joogo"),
  ];
  v.wakiilo_kireeyayaal = [
    repRow("WA", "AXMED CALI", "0600999"),
    repRow("WB", "MAXAMED CABDI", "0600888"),
  ];
  v.kiraystayaal = [row("t1", "HODAN", "062222", "jooga")];

  v = toggleRepMember(v, KIREYE(), "WA", 1, true);
  v = toggleRepMember(v, KIREYE(), "WA", 2, true);
  v = toggleRepMember(v, KIREYE(), "WB", 3, true);
  v = toggleRepMember(v, KIREYE(), "WB", 4, true);

  test("2 records, disjoint groups, no cross-wiring", () => {
    expect(getRepresentatives(v, KIREYE()).length).toBe(2);
    expect(representedByRep(v, KIREYE(), "WA")).toEqual(["P2 XASAN", "P3 MAXAMED"]);
    expect(representedByRep(v, KIREYE(), "WB")).toEqual(["P4 CALI", "P5 HAAJI"]);
  });

  test("each row binds to its own representative", () => {
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIREYEYAYAAL")!.rows;
    expect(rows[1].WAKIIL_MAGAC).toBe("AXMED CALI");
    expect(rows[2].WAKIIL_MAGAC).toBe("AXMED CALI");
    expect(rows[3].WAKIIL_MAGAC).toBe("MAXAMED CABDI");
    expect(rows[4].WAKIIL_MAGAC).toBe("MAXAMED CABDI");
  });

  test("deleting a representative detaches only its own people", () => {
    const after = deleteRepresentative(v, KIREYE(), "WA");
    expect(getRepresentatives(after, KIREYE()).length).toBe(1);
    expect(representedByRep(after, KIREYE(), "WB").length).toBe(2);
    expect(representedByRep(after, KIREYE(), "WA").length).toBe(0);
  });
});

describe("TEST C — the document shows BOTH the person and the representative", () => {
  const v = base();
  v.kireeye_mode = "multiple";
  v.kireeyayaal = [
    row("k1", "P1 CABDI", "063111", "jooga"),
    row("k2", "XASAN AHMED", "063222", "wakiil", "W001"),
    row("k3", "MAXAMED YUUSUF", "063333", "wakiil", "W001"),
    row("k4", "CALI MAXAMED", "063444", "wakiil", "W001"),
    row("k5", "HAAJI SULDAN", "063555", "wakiil", "W001"),
  ];
  v.wakiilo_kireeyayaal = [repRow("W001", "AXMED CALI", "0600999")];
  v.kiraystayaal = [row("t1", "HODAN", "062222", "jooga")];
  const text = render(v);

  test("every person keeps their own name in the document", () => {
    for (const n of ["P1 CABDI", "XASAN AHMED", "MAXAMED YUUSUF", "CALI MAXAMED", "HAAJI SULDAN"]) {
      expect(`${n}: ${text.includes(n)}`).toBe(`${n}: true`);
    }
  });

  test("the representative is named alongside each of them", () => {
    expect(text).toContain("Wakiilka:");
    expect(text).toContain("AXMED CALI");
    expect(text).toContain("0600999");
  });

  test("the representative never replaces the person", () => {
    // The wakiil must not appear as a numbered party of its own.
    expect(text).not.toContain("❖ 5. AXMED CALI");
    const rows = buildRepeatBlockData(heshiisKiroConfig, v).get("KIREYEYAYAAL")!.rows;
    expect(rows[1].MAGAC).toBe("XASAN AHMED");
    expect(rows[1].WAKIIL_MAGAC).toBe("AXMED CALI");
  });
});

describe("TEST D — a present person is never given a representative", () => {
  const v = base();
  v.kireeyayaal = [
    row("k1", "P1 CABDI", "063111", "jooga"),
    row("k2", "P2 XASAN", "063222", "ma_joogo"),
  ];
  v.wakiilo_kireeyayaal = [repRow("W001", "AXMED CALI", "0600999")];
  v.kiraystayaal = [row("t1", "HODAN", "062222", "jooga")];

  test("ticking a present person is ignored by the handler", () => {
    const after = toggleRepMember(v, KIREYE(), "W001", 0, true);
    const rows = after.kireeyayaal as PartyRow[];
    expect(rows[0].attendance?.representativeId).toBeUndefined();
    expect(rows[0].attendance?.status).toBe("jooga");
  });

  test("the present person shows their own name and phone", () => {
    const text = render(v);
    expect(text).toContain("P1 CABDI");
    expect(text).toContain("063111");
    expect(text).not.toContain("AXMED CALI"); // nobody is represented yet
  });
});

describe("TEST E — one wakiil covering many people", () => {
  const v = base();
  v.kireeyayaal = [
    row("k1", "P1 CABDI", "063111", "jooga"),
    row("k2", "P2 XASAN", "063222", "wakiil", "W001"),
    row("k3", "P3 MAXAMED", "063333", "wakiil", "W001"),
    row("k4", "P4 CALI", "063444", "wakiil", "W001"),
    row("k5", "P5 HAAJI", "063555", "wakiil", "W001"),
  ];
  v.wakiilo_kireeyayaal = [repRow("W001", "AXMED CALI", "0600999")];
  v.kiraystayaal = [row("t1", "HODAN", "062222", "jooga")];
  const text = render(v);
  const sig = text.split("Saxiiyada:")[1] ?? "";

  test("the wakiil is named on every row it covers, and there is no signature section", () => {
    // 4 absent rows each name their representative — and only those rows.
    expect(count(text, "Wakiilka: AXMED CALI")).toBe(4);
    expect(count(text, "AXMED CALI")).toBe(4);
    // The document carries no signature block at all.
    expect(sig).toBe("");
    expect(text).not.toContain("Saxiiyada");
    expect(resolveFlags(heshiisKiroConfig, v).KIREEYE_WAKIIL).toBe(true);
  });
});

describe("TEST F — Kiro Furan hides the end date", () => {
  const v = base({ muddada_nooca: "furan" });
  v.kireeyayaal = [row("k1", "P1", "06", "jooga")];
  v.kiraystayaal = [row("t1", "T1", "06", "jooga")];
  test("no end date", () => {
    const text = render(v);
    expect(text).not.toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
  });
});

describe("TEST G — Kiro Xidhan shows the end date", () => {
  const v = base({ muddada_nooca: "xidhan", taariikhda_dhammaadka: "2027-09-30" });
  v.kireeyayaal = [row("k1", "P1", "06", "jooga")];
  v.kiraystayaal = [row("t1", "T1", "06", "jooga")];
  test("end date present", () => {
    const text = render(v);
    expect(text).toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
    expect(text).toContain("30/09/2027");
  });
});

describe("TEST H — Deebaaji = Maya hides the deposit section", () => {
  const v = base({ deebaaji_haa: "no" });
  v.kireeyayaal = [row("k1", "P1", "06", "jooga")];
  v.kiraystayaal = [row("t1", "T1", "06", "jooga")];
  test("no deposit clause", () => {
    const text = render(v);
    expect(text).not.toContain("Haddii Kiraysadu Guriga u baahato");
  });
});

describe("TEST I — Damiin = Maya hides the section and the signature", () => {
  const v = base({ damiin_haa: "no" });
  v.kireeyayaal = [row("k1", "P1", "06", "jooga")];
  v.kiraystayaal = [row("t1", "T1", "06", "jooga")];
  test("no damiin anywhere", () => {
    const text = render(v);
    expect(text).not.toContain("DAMIIN MAAL");
    expect((text.split("Saxiiyada:")[1] ?? "")).not.toContain("Damiin");
  });
});

describe("Grouping UI — creating an unattached representative", () => {
  test("[+ Ku dar Wakiil kale] creates a record with nobody attached", () => {
    let v = base();
    v.kireeyayaal = [row("k1", "P1", "06", "jooga"), row("k2", "P2", "07", "ma_joogo")];
    v = createRepresentative(v, KIREYE());
    const reps = getRepresentatives(v, KIREYE());
    expect(reps.length).toBe(1);
    expect(representedByRep(v, KIREYE(), reps[0].id)).toEqual([]);
    // Ticking a person then links it.
    v = toggleRepMember(v, KIREYE(), reps[0].id, 1, true);
    expect(representedByRep(v, KIREYE(), reps[0].id)).toEqual(["P2"]);
  });
});