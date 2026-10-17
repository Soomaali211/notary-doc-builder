/** Cilaaj starter download wiring — Templates.tsx renders the download card
 *  when the Cilaaj doc type is selected, and the bytes are servable. */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("CADAYN CILAAJ — template download/re-upload loop", () => {
  const TPL = resolve("public/templates/cadayn_cilaaj/cilaaj.docx");
  const src = readFileSync("src/pages/Templates.tsx", "utf8");

  test("the template file exists and is a real docx (PK zip magic)", () => {
    expect(existsSync(TPL)).toBe(true);
    const head = readFileSync(TPL).subarray(0, 2);
    expect(head[0]).toBe(0x50);
    expect(head[1]).toBe(0x4b);
  });

  test("Templates.tsx offers the Cilaaj starter download for that doc type", () => {
    expect(src).toContain('config?.id === "cadayn_cilaaj"');
    expect(src).toContain("/templates/cadayn_cilaaj/cilaaj.docx");
    expect(src).toContain("cadayn_cilaaj_template.docx");
    expect(src).toContain("downloadCilaajStarter");
  });

  test("the download card keeps the edit-in-Word / re-upload contract copy", () => {
    // The copy lives in the dictionary now (lang.tsx); the page renders it
    // through t() so it follows the SO/EN toggle.
    const lang = readFileSync("src/lib/lang.tsx", "utf8");
    expect(lang).toContain("soo geli Template");
    expect(lang).toContain("haba seyn");
    expect(src).toContain('t("tplCilaajHint")');
    expect(src).toContain('t("tplCilaajHintB")');
    expect(src).toContain('t("tplDontBreak")');
  });

  test("the upload path accepts any docType — Cilaaj included (generic)", () => {
    // handleUpload is generic over docType; saveTemplateLocal persists the bytes.
    expect(src).toContain("saveTemplateLocal");
    expect(src).toContain('documentType: docType');
  });
});
