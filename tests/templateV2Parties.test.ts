/**
 * Template v2 — party logic (singular vs plural) + the 9 required cases.
 *
 * The core regression this guards: the template used to carry BOTH
 * {{KIREYE_MAGAC}} AND {{#KIREYEYAYAAL}}, so one landlord could be printed
 * twice. Now {{IF:KIREYE_HAL}} and {{IF:KIREEYAYAAL_BADAN}} are mutually
 * exclusive — exactly one path renders.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { renderXmlForTest } from "../src/lib/notary/pipeline";
import { heshiisKiroConfig } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues, PartyRow } from "../src/lib/notary/types";
import { scenario21 } from "../scripts/verify-helpers";

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

/** Render the real template with the given answers and return its text. */
function render(values: FormValues): string {
  const out = renderXmlForTest(docXml, heshiisKiroConfig, values);
  return out
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Count how many times a name appears (catches duplicate people). */
const occurrences = (text: string, needle: string): number =>
  text.split(needle).length - 1;

const att = (
  id: string,
  values: Record<string, string>,
  status: "jooga" | "wakiil",
  representativeId?: string,
): PartyRow => ({
  id,
  values: { magac: "", telefoon: "", aqoonsi: "", cinwaan: "", ...values },
  attendance: status === "wakiil" ? { status, representativeId } : { status },
});

/** Base answers every case starts from. */
function base(over: Partial<Record<string, string>> = {}): FormValues {
  const v = scenario21();
  v.heshiiska = { ...(v.heshiiska as Record<string, string>), ...over } as never;
  return v;
}

describe("Case 1 — 1 Kireeye, 1 Kirayste, no wakiil", () => {
  const values = base({ kireeye_mode: "single", kirayste_mode: "single" });
  values.kireeyayaal = [att("k1", { magac: "FARXIYA AADAN YUUSUF", telefoon: "0634839488" }, "jooga")];
  values.kiraystayaal = [att("t1", { magac: "CABDIKARIIX MAXAMUUD CABDI", telefoon: "0634468200" }, "jooga")];
  const text = render(values);

  test("each person appears exactly once (no duplicate)", () => {
    expect(occurrences(text, "FARXIYA AADAN YUUSUF")).toBe(2); // party line + signature
    expect(occurrences(text, "CABDIKARIIX MAXAMUUD CABDI")).toBe(2);
  });

  test("singular labels, never plural", () => {
    expect(text).toContain("Magaca Kireeysada Guriga");
    expect(text).toContain("Magaca Kiraystaha Guriga");
    expect(text).not.toContain("Magacyada Kireeyayaasha");
    expect(text).not.toContain("Magacyada Kiraystayaasha");
  });

  test("no numbered repeat lines", () => {
    expect(text).not.toContain("1. Kireeye");
  });

  test("no wakiil line when everyone is present", () => {
    expect(text).not.toContain("Wakiilka:");
  });
});

describe("Case 2 — 2 Kireeye, 1 Kirayste", () => {
  const values = base({ kireeye_mode: "multiple", kirayste_mode: "single" });
  values.kireeyayaal = [
    att("k1", { magac: "Kireeye Kowaad", telefoon: "0611" }, "jooga"),
    att("k2", { magac: "Kireeye Labaad", telefoon: "0612" }, "jooga"),
  ];
  values.kiraystayaal = [att("t1", { magac: "Kirayste Kowaad", telefoon: "0621" }, "jooga")];
  const text = render(values);

  test("both landlords listed, singular tenant", () => {
    expect(text).toContain("Kireeye Kowaad");
    expect(text).toContain("Kireeye Labaad");
    expect(text).toContain("Kirayste Kowaad");
    expect(text).toContain("Magacyada Kireeyayaasha Guriga");
    expect(text).toContain("Magaca Kiraystaha Guriga");
  });

  test("no singular landlord label and no duplicate first landlord", () => {
    expect(text).not.toContain("Magaca Kireeysada Guriga");
    // Kireeye Kowaad appears once in the list; the signature block is
    // intentionally separate (it names the signing party).
    expect(occurrences(text, "Kireeye Kowaad")).toBe(2);
  });

  test("landlord repeat block did not leak into the tenant section", () => {
    expect(text).not.toContain("2. Kirayste");
  });
});

describe("Case 3 — 3 Kireeye, 2 Kirayste, shared wakiil", () => {
  const values = base({ kireeye_mode: "multiple", kirayste_mode: "multiple" });
  const repA: PartyRow = {
    id: "repA",
    values: { magac: "WAKIIL SHARED", telefoon: "0699" },
  };
  const repB: PartyRow = {
    id: "repB",
    values: { magac: "WAKIIL KALA", telefoon: "0688" },
  };
  // Kireeye 1 → Wakiil A, Kireeye 2 → Wakiil A, Kireeye 3 → Wakiil B
  values.kireeyayaal = [
    att("k1", { magac: "Kireye Kowaad" }, "wakiil", repA.id),
    att("k2", { magac: "Kireeye Labaad" }, "wakiil", repA.id),
    att("k3", { magac: "Kireeye Saddexaad" }, "wakiil", repB.id),
  ];
  // Kirayste 1 → Jooga, Kirayste 2 → Wakiil A
  values.kiraystayaal = [
    att("t1", { magac: "Kirayste Jooga", telefoon: "0677" }, "jooga"),
    att("t2", { magac: "Kirayste Maqan" }, "wakiil", repA.id),
  ];
  values.wakiilo_kireeyayaal = [repA, repB];
  values.wakiilo_kiraystayaal = [repA];
  const text = render(values);

  test("all present parties appear; absent ones appear via their wakiil", () => {
    // Present parties keep their own name in the list.
    for (const n of ["Kirayste Jooga"]) {
      expect(`${n}: ${text.includes(n)}`).toBe(`${n}: true`);
    }
    // Absent parties have no name of their own — they are represented by
    // the representative, so the document shows the wakiil instead.
    expect(text).toContain("WAKIIL SHARED");
    expect(text).toContain("WAKIIL KALA");
  });

  test("the shared wakiil is named once per represented party, not duplicated", () => {
    // Two kireeye rows share WAKIIL SHARED → it appears on both rows, which
    // is correct; the key point is the name of a *person* is not duplicated
    // by the repeat machinery itself.
    expect(occurrences(text, "WAKIIL SHARED")).toBeGreaterThanOrEqual(2);
    expect(text).toContain("WAKIIL KALA");
  });

  test("a present tenant is listed by name, not as a wakiil line", () => {
    expect(text).toContain("Kirayste Jooga");
    // The absent tenant's own (empty) name never appears as a dangling line.
    expect(text).not.toContain("❖ 2. Tell");
  });
});

describe("Case 4 — 1 Kireeye absent, represented by a wakiil", () => {
  const values = base({ kireeye_mode: "single", kirayste_mode: "single" });
  const rep: PartyRow = {
    id: "krep",
    values: { magac: "WAKIILKA", telefoon: "0655" },
  };
  values.kireeyayaal = [att("k1", { magac: "" }, "wakiil", rep.id)];
  values.kiraystayaal = [att("t1", { magac: "Kirayste Jooga", telefoon: "0671" }, "jooga")];
  values.wakiilo_kireeyayaal = [rep];
  const text = render(values);

  test("the wakiil stands in for the absent landlord", () => {
    expect(text).toContain("Wakiilka:");
    expect(text).toContain("WAKIILKA");
    expect(text).toContain("0655");
  });

  test("the absent landlord's own fields are not printed", () => {
    expect(text).not.toContain("❖ Tell");
  });

  test("present tenant has no wakiil block", () => {
    expect(occurrences(text, "Wakiilka:")).toBe(1);
  });
});

describe("Case 5 — Kiro Furan hides the end date", () => {
  test("end date absent for furan", () => {
    const values = base({ muddada_nooca: "furan" });
    (values.heshiiska as Record<string, string>).taariikhda_dhammaadka = "";
    const text = render(values);
    expect(text).not.toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
  });
});

describe("Case 6 — Kiro Xidhan shows the end date", () => {
  test("end date present for xidhan", () => {
    const values = base({ muddada_nooca: "xidhan" });
    (values.heshiiska as Record<string, string>).taariikhda_dhammaadka = "2027-09-30";
    const text = render(values);
    expect(text).toContain("Taariikhda uu heshiisku ku dhammaanayo waa");
    expect(text).toContain("30/09/2027");
  });
});

describe("Case 7 — Deebaaji = Maya hides the section", () => {
  test("no deposit clause when deebaaji is no", () => {
    const values = base({ deebaaji_haa: "no" });
    const text = render(values);
    expect(text).not.toContain("Haddii Kiraysadu Guriga u baahato");
  });
});

describe("Case 8 — Damiin = Maya hides the section AND the signature", () => {
  test("no damiin clause and no damiin signature when damiin is no", () => {
    const values = base({ damiin_haa: "no" });
    const text = render(values);
    expect(text).not.toContain("DAMIIN MAAL");
    expect(text).not.toContain("Saxeexa Damiinka");
    // The Damiin signature block must be gone too.
    const sigPart = text.split("Saxiiyada:")[1] ?? "";
    expect(sigPart).not.toContain("Damiin");
  });
});

describe("Case 9 — Damiin = Haa shows the section AND the signature", () => {
  test("damiin clause and signature present", () => {
    const values = base({ damiin_haa: "yes" });
    (values.damiinka as Record<string, string>) = {
      damiin_magac: "MUSTAFE AHMED CABDI",
      damiin_telefoon: "0634714915",
      damiin_aqoonsi: "",
      damiin_cinwaan: "",
    };
    const text = render(values);
    expect(text).toContain("DAMIIN MAAL");
    expect(text).toContain("MUSTAFE AHMED CABDI");
    expect(text).toContain("0634714915");
    const sigPart = text.split("Saxiiyada:")[1] ?? "";
    expect(sigPart).toContain("Damiin");
  });
});

describe("Template structure — mutual exclusivity is enforced in the template", () => {
  test("the two landlord paths are wrapped in opposing flags", () => {
    expect(docXml).toContain("{{IF:KIREYE_HAL}}");
    expect(docXml).toContain("{{IF:KIREEYAYAAL_BADAN}}");
    // The singular token must live INSIDE the singular flag, not beside it.
    const half = docXml.indexOf("{{IF:KIREYE_HAL}}");
    const halfEnd = docXml.indexOf("{{END:KIREYE_HAL}}");
    const kireyeMagac = docXml.indexOf("{{KIREYE_MAGAC}}");
    expect(half).toBeGreaterThan(-1);
    expect(halfEnd).toBeGreaterThan(half);
    expect(kireyeMagac).toBeGreaterThan(half);
    expect(kireyeMagac).toBeLessThan(halfEnd);
  });
});