/**
 * Req #12 — REAL UI verification (not just engine logic).
 *
 * Renders the actual Step 1 components (SetupField + SectionStep) through
 * React SSR and asserts the produced HTML:
 *   – Deebaaji/Damiin Haa|Maya choice cards are VISIBLE with selected state
 *   – they are radio (single-choice) controls, never checkboxes
 *   – Kiro Furan  → Taariikhda Dhammaadka ABSENT (no field, no *)
 *   – Kiro Xidhan → Taariikhda Dhammaadka PRESENT with required star
 *   – the same component toggles immediately with values (no refresh)
 */
/** @jsxRuntime automatic */
/** @jsxImportSource react */
import * as React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionStep } from "../src/pages/NewDocumentInterview";
import { SetupField } from "../src/components/notary/SetupField";
import { PartyListEditor } from "../src/components/notary/PartyListEditor";
import { heshiisKiroConfig as config } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues, PartyRow } from "../src/lib/notary/types";
import { FIELD_SKIPPED } from "../src/lib/notary/types";
import { FieldRenderer } from "../src/components/notary/FieldRenderer";
import { PartyStatusEditor } from "../src/components/notary/PartyStatusEditor";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const heshiiskaSection = config.sections.find((s) => s.id === "heshiiska")!;
const landlordDef = config.sections
  .flatMap((s) => s.parties ?? [])
  .find((p) => p.id === "kireeyayaal")!;
const tenantDef = config.sections
  .flatMap((s) => s.parties ?? [])
  .find((p) => p.id === "kiraystayaal")!;

/** Req #10 exact case: Guri Xaas + Kireeye + Kirayste + Furan + Maya + Maya. */
function furanValues(): FormValues {
  return {
    heshiiska: {
      sub_type: "guri_xaas",
      kireeye_mode: "single",
      kirayste_mode: "single",
      muddada_nooca: "furan",
      deebaaji_haa: "no",
      damiin_haa: "no",
      taariikhda_bilowga: "2026-10-01",
    },
  } as unknown as FormValues;
}

function xidhanValues(base: FormValues): FormValues {
  return {
    heshiiska: {
      ...(base.heshiiska as Record<string, string>),
      muddada_nooca: "xidhan",
    },
  } as unknown as FormValues;
}

function renderStep(values: FormValues): string {
  return renderToStaticMarkup(
    <SectionStep
      step={{ kind: "section", section: heshiiskaSection }}
      values={values}
      validation={{}}
      stepErrors={false}
      setValues={() => {}}
      config={config}
    />,
  );
}

/* ------------------------------------------------------------------ */
/* #10 — Kiro Furan: choices visible, End Date gone                    */
/* ------------------------------------------------------------------ */

describe("Step 1 real render (req #10)", () => {
  const html = renderStep(furanValues());

  test("Deebaaji + Damiin Haa/Maya choice cards are VISIBLE", () => {
    expect(html.includes('aria-label="Deebaaji ma jiraa?"')).toBe(true);
    expect(html.includes('aria-label="Damiin ma jiraa?"')).toBe(true);
    // Both options render inside each group.
    expect(html.includes("Haa")).toBe(true);
    expect(html.includes("Maya")).toBe(true);
  });

  test("they are single-choice radios — never checkboxes", () => {
    expect(html.includes('role="radiogroup"')).toBe(true);
    expect(html.includes('role="radio"')).toBe(true);
    expect(html.includes('type="checkbox"')).toBe(false);
  });

  test("Maya is the selected option in both groups (neumorphic active state)", () => {
    const deebaajiBlock = html.split('aria-label="Deebaaji ma jiraa?"')[1] ?? "";
    const damiinBlock = deebaajiBlock.split('aria-label="Damiin ma jiraa?"')[1] ?? "";
    for (const block of [deebaajiBlock, damiinBlock]) {
      expect(block.includes('aria-checked="true"')).toBe(true);
      expect(block.includes("Maya")).toBe(true);
      expect(block.includes("neu-inset")).toBe(true); // active card style
    }
  });

  test("Kiro Furan radio selected; Taariikhda Bilowga visible", () => {
    expect(html.includes('aria-label="Nooca Muddada Kirada"')).toBe(true);
    expect(html.includes("Taariikhda Bilowga")).toBe(true);
  });

  test("Taariikhda Dhammaadka is COMPLETELY ABSENT (no field, no required *)", () => {
    expect(html.includes("Taariikhda Dhammaadka")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* SetupField in isolation — the choice-card control itself            */
/* ------------------------------------------------------------------ */

describe("SetupField Haa/Maya card (req #1/#2)", () => {
  const field = heshiiskaSection.fields.find((f) => f.id === "deebaaji_haa")!;

  function renderField(value: string): string {
    return renderToStaticMarkup(
      <SetupField
        field={field}
        values={{
          heshiiska: { deebaaji_haa: value },
        } as unknown as FormValues}
        sectionId="heshiiska"
        landlordDef={landlordDef}
        tenantDef={tenantDef}
        onValues={() => {}}
      />,
    );
  }

  test("unselected: no option is checked (initial = not selected)", () => {
    const html = renderField("");
    expect(html.includes('aria-checked="true"')).toBe(false);
    expect(html.includes("Haa")).toBe(true);
    expect(html.includes("Maya")).toBe(true);
  });

  test("Haa selected: exactly one aria-checked=true with the active style", () => {
    const html = renderField("yes");
    expect(html.split('aria-checked="true"').length - 1).toBe(1);
    const checkedIdx = html.indexOf('aria-checked="true"');
    const after = html.slice(checkedIdx);
    expect(after.includes("Haa")).toBe(true);
    expect(after.includes("neu-inset")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* #11 — toggle Furan ⇄ Xidhan: End Date appears/disappears instantly  */
/* ------------------------------------------------------------------ */

describe("Step 1 real render (req #11)", () => {
  const base = furanValues();

  test("Furan → Xidhan: End Date + required star appear immediately", () => {
    const xidhanHtml = renderStep(xidhanValues(base));
    expect(xidhanHtml.includes("Taariikhda Dhammaadka / Mudada")).toBe(true);
    // Required indicator (*) rendered by FieldRenderer right after the label.
    expect(
      /Taariikhda Dhammaadka \/ Mudada[\s\S]{0,200}\*\s*<\/span>/.test(xidhanHtml),
    ).toBe(true);
    // Taariikhda Bilowga remains visible and required too.
    expect(/Taariikhda Bilowga[\s\S]{0,200}\*\s*<\/span>/.test(xidhanHtml)).toBe(true);
  });

  test("Xidhan → Furan: End Date + star disappear immediately (same component)", () => {
    const furanHtml = renderStep(base);
    expect(furanHtml.includes("Taariikhda Dhammaadka")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* req #15 — EVERY step renders real answer inputs                     */
/* ------------------------------------------------------------------ */

const sec = (id: string) => config.sections.find((s) => s.id === id)!;
const kireeyeDef = config.sections
  .flatMap((s) => s.parties ?? [])
  .find((p) => p.id === "kireeyayaal")!;

function renderSection(section: ReturnType<typeof sec>, values: FormValues): string {
  return renderToStaticMarkup(
    <SectionStep
      step={{ kind: "section", section }}
      values={values}
      validation={{}}
      stepErrors={false}
      setValues={() => {}}
      config={config}
    />,
  );
}

const countInputs = (html: string) => html.split('data-slot="input"').length - 1;
const countTextareas = (html: string) => html.split('data-slot="textarea"').length - 1;
const countSelects = (html: string) => html.split('data-slot="select-trigger"').length - 1;

function partyRows(n: number): PartyRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `row-${i}`,
    values: { magac: i === 0 ? "Cabdi Xasan" : "", telefoon: "", aqoonsi: "", cinwaan: "", faahfaahin_dheeraad: "" },
  }));
}

describe("req #15 — every step has real inputs", () => {
  test("Faahfaahinta Guriga — text inputs + select render", () => {
    const html = renderSection(sec("guriga"), { guriga: {} } as unknown as FormValues);
    expect(html.includes("Nooca Guriga")).toBe(true);
    expect(html.includes("Goobta / Location")).toBe(true);
    expect(html.includes("Cinwaanka Guriga")).toBe(true);
    expect(countSelects(html)).toBe(1); // Nooca Guriga select
    expect(countInputs(html)).toBeGreaterThanOrEqual(3);
  });

  test("Lacagta — payment fields render; bank fields follow habka_bixinta immediately", () => {
    const cash = renderSection(sec("lacagta"), {
      lacagta: { habka_bixinta: "cash" },
    } as unknown as FormValues);
    expect(html_has(cash, "Qiimaha Kirada Bishii", "Habka Bixinta", "Maalinta Bixinta"));
    expect(cash.includes("Magaca Bangiga")).toBe(false); // conditional hidden

    const bank = renderSection(sec("lacagta"), {
      lacagta: { habka_bixinta: "bank" },
    } as unknown as FormValues);
    expect(bank.includes("Magaca Bangiga")).toBe(true); // conditional shown
    expect(bank.includes("Nambarka Xisaabta")).toBe(true);
  });

  test("Deebaaji (Haa) — deposit fields render with inputs", () => {
    const html = renderSection(sec("deebaaji"), {
      heshiiska: { deebaaji_haa: "yes" },
      deebaaji: {},
    } as unknown as FormValues);
    expect(html.includes("Lacagta Deebaajiga")).toBe(true);
    expect(html.includes("Shuruudaha Deebaajiga")).toBe(true);
    expect(countInputs(html) + countTextareas(html)).toBeGreaterThanOrEqual(2);
  });

  test("Damiinka (Haa) — guarantor fields render with inputs", () => {
    const html = renderSection(sec("damiinka"), {
      heshiiska: { damiin_haa: "yes" },
      damiinka: {},
    } as unknown as FormValues);
    expect(html.includes("Magaca Damiinka")).toBe(true);
    expect(html.includes("Telefoonka Damiinka")).toBe(true);
    expect(countInputs(html)).toBeGreaterThanOrEqual(4);
  });

  test("Ogaysiinta + Dheeraad — notice and terms fields render", () => {
    const og = renderSection(sec("ogaysiinta"), { ogaysiinta: {} } as unknown as FormValues);
    expect(html_has(og, "Mudada Ogaysiinta", "Shuruudaha Joojinta"));
    const dhe = renderSection(sec("dheeraad"), { dheeraad: {} } as unknown as FormValues);
    expect(dhe.includes("Shuruudo Dheeraad ah")).toBe(true);
    expect(countTextareas(dhe)).toBe(1);
  });

  test("Maragyada — dynamic witness list renders one card per row with inputs", () => {
    const values = { maragyo: partyRows(3) } as unknown as FormValues;
    const html = renderSection(sec("maragyada"), values);
    expect(html.includes("Magaca Maraga")).toBe(true);
    expect(html.split('Magaca Maraga').length - 1).toBe(3); // one per row
  });

  test("Party forms — N rows render N independent party forms (dynamic, not hard-coded)", () => {
    for (const n of [1, 3, 5]) {
      const html = renderToStaticMarkup(
        <PartyListEditor
          partyDef={kireeyeDef}
          rows={partyRows(n)}
          canAdd={true}
          onFieldChange={() => {}}
          onAdd={() => {}}
          onRemove={() => {}}
        />,
      );
      // Each row: 5 fields (magac input, telefoon, aqoonsi, cinwaan, textarea).
      expect(countInputs(html)).toBe(n * 4);
      expect(countTextareas(html)).toBe(n);
      // Row 0 shows its stored name; unnamed rows fall back to "Kireeye N".
      expect(html.includes("Cabdi Xasan")).toBe(true); // value kept in state
      if (n > 1) expect(html.includes("Kireeye 2")).toBe(true);
    }
  });
});

/** Small helper: assert every fragment occurs in the html. */
function html_has(html: string, ...fragments: string[]): boolean {
  for (const f of fragments) {
    if (!html.includes(f)) throw new Error(`Missing: ${f}`);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* req #2/#3 — Guided skip UI: required * / (Optional) / Skip marker   */
/* ------------------------------------------------------------------ */

function renderGuideField(field: FieldDefOf, value: string): string {
  return renderToStaticMarkup(
    <FieldRenderer field={field} value={value} onChange={() => {}} />,
  );
}

type FieldDefOf = (typeof kireeyeDef.fields)[number];

describe("guided form skip UI (req #2/#3)", () => {
  const aqoonsi = kireeyeDef.fields.find((f) => f.id === "aqoonsi")!;
  const magac = kireeyeDef.fields.find((f) => f.id === "magac")!;

  test("optional + skippable, empty: (Optional) label + Skip link, still an input", () => {
    const html = renderGuideField(aqoonsi, "");
    expect(html.includes("(Optional)")).toBe(true);
    expect(/>\s*Skip\s*<\/button>/.test(html)).toBe(true);
    expect(html.includes("— Skipped —")).toBe(false);
    expect(html.includes("Buuxi hadda")).toBe(false);
    // Empty ≠ skipped: the field stays a real editable input.
    expect(countInputs(html)).toBe(1);
  });

  test("skipped: — Skipped — panel + [Buuxi hadda]; input replaced, Skip link gone", () => {
    const html = renderGuideField(aqoonsi, FIELD_SKIPPED);
    expect(html.includes("— Skipped —")).toBe(true);
    expect(html.includes("Buuxi hadda")).toBe(true);
    // No editable control while skipped (panel takes its place).
    expect(countInputs(html)).toBe(0);
    expect(/>\s*Skip\s*<\/button>/.test(html)).toBe(false);
  });

  test("required field: * shown, no (Optional), never offers Skip", () => {
    const html = renderGuideField(magac, "");
    expect(/\*\s*<\/span>/.test(html)).toBe(true);
    expect(html.includes("(Optional)")).toBe(false);
    expect(/>\s*Skip\s*<\/button>/.test(html)).toBe(false);
    expect(html.includes("Buuxi hadda")).toBe(false);
    expect(countInputs(html)).toBe(1);
  });

  test("Skip link sits inside the (Optional) field block, right after the input", () => {
    const html = renderGuideField(aqoonsi, "");
    const afterLabel = html.slice(html.indexOf("(Optional)"));
    expect(afterLabel.includes('data-slot="input"')).toBe(true);
    expect(/>\s*Skip\s*<\/button>/.test(afterLabel)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* STEP 2 — Xogta iyo Xaaladda (req: Haa/Maya + inline wakiil inputs)  */
/* ------------------------------------------------------------------ */

function statusRow(
  id: string,
  values: Record<string, string>,
  attendance?: { status: string; representativeId?: string },
): PartyRow {
  return { id, values, ...(attendance ? { attendance } : {}) } as unknown as PartyRow;
}

function renderPartyStatus(rows: PartyRow[], reps: PartyRow[] = []): string {
  return renderToStaticMarkup(
    <PartyStatusEditor
      partyDef={kireeyeDef}
      values={{ kireeyayaal: rows, wakiilo_kireeyayaal: reps } as unknown as FormValues}
      onFieldChange={() => {}}
      onPresence={() => {}}
      onLinkRep={() => {}}
      onCreateRep={() => {}}
      onUpdateRep={() => {}}
      onRemoveRep={() => {}}
    />,
  );
}

const emptyPerson = (over: Record<string, string> = {}) => ({
  magac: "",
  telefoon: "",
  aqoonsi: "",
  cinwaan: "",
  faahfaahin_dheeraad: "",
  ...over,
});

describe("Step 2 — PartyStatusEditor real render", () => {
  test("Ma Joogaa Heshiiska? is asked per party (Haa/Maya radios)", () => {
    const html = renderPartyStatus([statusRow("r1", emptyPerson())]);
    expect(html.includes("Ma Joogaa Heshiiska?")).toBe(true);
    expect(html.includes("Haa")).toBe(true);
    expect(html.includes("Maya")).toBe(true);
    expect(html.includes('role="radiogroup"')).toBe(true);
    // Unanswered: only Magaca renders — no telefoon, no wakiil block.
    expect(html.includes("Magaca Kireeyaha")).toBe(true);
    expect(html.includes("Telefoonka Kireeyaha")).toBe(false);
    expect(html.includes("Qaybta Wakiilka")).toBe(false);
    expect(countInputs(html)).toBe(1);
  });

  test("TEST 3 — Haa: Magaca + Telefoonka qofka *; Wakiil fields HIDDEN", () => {
    const html = renderPartyStatus([
      statusRow("r1", emptyPerson({ magac: "Cabdi" }), { status: "jooga" }),
    ]);
    expect(html.includes("Magaca Kireeyaha")).toBe(true);
    expect(html.includes("Telefoonka Kireeyaha")).toBe(true);
    // Required star for the jooga phone (requiredWhenRowStatus).
    expect(/Telefoonka Kireeyaha[\s\S]{0,220}\*\s*<\/span>/.test(html)).toBe(true);
    expect(html.includes("Magaca Wakiilka")).toBe(false);
    expect(html.includes("Telefoonka Wakiilka")).toBe(false);
    expect(html.includes("Qaybta Wakiilka")).toBe(false);
    // Magac, telefoon, aqoonsi, cinwaan inputs + faahfaahin textarea.
    expect(countInputs(html)).toBe(4);
    expect(countTextareas(html)).toBe(1);
    // Haa is the active radio.
    expect(html.split('aria-checked="true"').length - 1).toBe(1);
  });

  test("TEST 4 — Maya: Wakiil fields are REAL inputs; qofka telefoon hidden", () => {
    const html = renderPartyStatus(
      [
        statusRow("r1", emptyPerson({ magac: "Cabdi" }), {
          status: "wakiil",
          representativeId: "rep-1",
        }),
      ],
      [statusRow("rep-1", { magac: "Wakiil A", telefoon: "+252 61 2222222", aqoonsi: "", cinwaan: "" })],
    );
    expect(html.includes("Qaybta Wakiilka")).toBe(true);
    expect(html.includes("Magaca Wakiilka")).toBe(true);
    expect(html.includes("Telefoonka Wakiilka")).toBe(true);
    // Party's own telefoon is N/A under Maya (req #11).
    expect(html.includes("Telefoonka Kireeyaha")).toBe(false);
    // Inputs: party magac + wakiil magac + wakiil telefoon (real fields).
    expect(countInputs(html)).toBe(3);
    // Bound to the linked rep's stored values — not labels.
    expect(html.includes('value="Wakiil A"')).toBe(true);
    expect(html.includes('value="+252 61 2222222"')).toBe(true);
    // Maya is the active radio.
    expect(html.split('aria-checked="true"').length - 1).toBe(1);
  });

  test("TEST 5 — rows stay independent: row 1 wakiil, row 2 own phone", () => {
    const html = renderPartyStatus(
      [
        statusRow("r1", emptyPerson({ magac: "Axmed" }), {
          status: "wakiil",
          representativeId: "rep-1",
        }),
        statusRow("r2", emptyPerson({ magac: "Faadumo", telefoon: "+252 61 1111111" }), {
          status: "jooga",
        }),
      ],
      [statusRow("rep-1", { magac: "Wakiil A", telefoon: "+252 61 2222222", aqoonsi: "", cinwaan: "" })],
    );
    // The wakiil block exists for row 1 ONLY.
    expect(html.split("Qaybta Wakiilka").length - 1).toBe(1);
    expect(html.includes("Wakiil A")).toBe(true);
    // Row 2 keeps its own identity data (never mixed with the rep's).
    expect(html.includes("Faadumo")).toBe(true);
    expect(html.includes('value="+252 61 1111111"')).toBe(true);
    expect(html.includes('value="+252 61 2222222"')).toBe(true);
  });
});
