/**
 * PAGE RENDER SMOKE TESTS — the five rebuilt tabs render through React SSR.
 *
 * These are not engine tests: they mount the actual page components inside
 * the routing tree the app uses, and assert the office's own titles, the
 * primary actions and the honest empty states exist. `renderToStaticMarkup`
 * runs in the test runner's memory-only store (no IndexedDB), exactly the
 * degraded path private browsing uses.
 */
/** @jsxRuntime automatic */
/** @jsxImportSource react */
import * as React from "react";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import Documents from "../src/pages/Documents";
import Clients from "../src/pages/Clients";
import Payments from "../src/pages/Payments";
import Reports from "../src/pages/Reports";
import Settings from "../src/pages/Settings";
import { LanguageProvider } from "../src/lib/lang";
import {
  ENTITY_NAMES,
  getAllLocal,
  setLocalStoreOverride,
  useMemoryLocalStore,
} from "../src/lib/notary/localStore";

/**
 * The pages read the machine's own store, which stays warm between reads
 * (`peekAllLocal`). Tests do the same warm-up a browser does after its first
 * visit — one read per table — so every page mounts on the honest flat state
 * of an empty store instead of the loading indication.
 */
beforeAll(async () => {
  useMemoryLocalStore();
  for (const entity of ENTITY_NAMES) await getAllLocal(entity);
});
afterAll(() => setLocalStoreOverride(null));

function render(
  element: React.ReactElement,
  entry: string = "/",
): string {
  return renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(MemoryRouter, { initialEntries: [entry] }, element),
    ),
  );
}

describe("the five tabs render", () => {
  test("Dukumentiyada — title, primary action, filter and verify box", () => {
    const html = render(React.createElement(Documents), "/documents");
    expect(html).toContain("Dukumentiyada");
    expect(html).toContain("Dukumenti cusub");
    expect(html).toContain("Sugaya");
    expect(html).toContain("La xaqiijiyay");
    expect(html).toContain("Xaqiiji QR / Tixraac");
  });

  test("Macaamiisha — title and the honest empty state", () => {
    const html = render(React.createElement(Clients), "/clients");
    expect(html).toContain("Macaamiisha");
    expect(html).toContain("Ma jiro macmiil.");
    expect(html).toContain("Raadi magac, telefoon ama tixraac");
  });

  test("Lacagaha — title, record form and empty ledger", () => {
    const html = render(React.createElement(Payments), "/payments");
    expect(html).toContain("Lacagaha");
    expect(html).toContain("Diiwaan geli bixinta");
    expect(html).toContain("Diiwaanka lacagta wuu madhan yahay.");
  });

  test("Warbixinada — title, CSV action and section headers", () => {
    const html = render(React.createElement(Reports), "/reports");
    expect(html).toContain("Warbixinada");
    expect(html).toContain("Soo degso CSV");
    expect(html).toContain("Noocasta");
    expect(html).toContain("Bishii");
  });

  test("Habayn — title, office details and save action", () => {
    const html = render(React.createElement(Settings), "/habayn");
    expect(html).toContain("Habayn");
    expect(html).toContain("Xogta Xafiiska");
    expect(html).toContain("Kaydi");
  });

  test("the shell's five tabs and the SO/EN toggle are present", () => {
    const html = render(React.createElement(Documents), "/documents");
    for (const label of [
      "Dukumentiyada",
      "Macaamiisha",
      "Lacagaha",
      "Warbixinada",
      "Habayn",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("SO");
    expect(html).toContain("EN");
  });
});
