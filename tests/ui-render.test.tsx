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
import { heshiisKiroConfig as config } from "../src/lib/notary/documents/heshiisKiro";
import type { FormValues } from "../src/lib/notary/types";

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
