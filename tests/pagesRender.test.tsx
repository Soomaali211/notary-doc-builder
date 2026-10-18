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
import { MemoryRouter, Route, Routes } from "react-router";
import Documents from "../src/pages/Documents";
import Clients from "../src/pages/Clients";
import Payments from "../src/pages/Payments";
import Reports from "../src/pages/Reports";
import Settings from "../src/pages/Settings";
import Templates from "../src/pages/Templates";
import NewDocument from "../src/pages/NewDocument";
import Catalog from "../src/pages/Catalog";
import Schedule from "../src/pages/Schedule";
import TeamBoard from "../src/pages/TeamBoard";
import DocumentDetailPage from "../src/pages/DocumentDetail";
import Admin from "../src/pages/Admin";
import { ConvexProvider, ConvexReactClient } from "convex/react";
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


/**
 * A client pointed at an address nothing listens on (the harness used by
 * hantiFlowRender): the SSR render never opens a connection, so the convex
 * queries simply stay pending — the loading path the browser shows first.
 */
const convex = new ConvexReactClient("http://127.0.0.1:1");

/** Like `render`, but with the Convex provider for pages that query it. */
function renderWithConvex(
  element: React.ReactElement,
  entry: string = "/documents",
): string {
  return renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(MemoryRouter, { initialEntries: [entry] },
        React.createElement(ConvexProvider, { client: convex }, element),
      ),
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

  test("Template Manager — title, doc-type picker and upload card", () => {
    const html = render(React.createElement(Templates), "/templates");
    expect(html).toContain("Template Manager");
    expect(html).toContain("Nooca Dukumeentiga");
    expect(html).toContain("Soo geli Word Template (.docx)");
  });

  test("Document detail — the honest not-found state for an unknown id", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/archive/unknown-id"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/archive/:docId",
              element: React.createElement(DocumentDetailPage),
            }),
          ),
        ),
      ),
    );
    expect(html).toContain("Dukumeentigan lama helin.");
    expect(html).toContain('data-empty="document"');
  });

  // The two picker pages read only the document registry and the local
  // store — no Convex — so the plain SSR harness is enough.
  test("New Document picker — two steps and the ready/planned badges", () => {
    const html = render(React.createElement(NewDocument), "/new");
    expect(html).toContain("Dukumenti Cusub");
    expect(html).toContain("1 · Nooca Heshiiska");
    expect(html).toContain("Diyaar");
    // Cadayn Cilaaj has no sub-types, so its card carries the start button.
    expect(html).toContain("Bilow Hadda");
    // Upcoming types stay visible and clearly marked.
    expect(html).toContain("La qorsheeyay");
  });

  test("Catalog — ready types first, planned below, engine note present", () => {
    const html = render(React.createElement(Catalog), "/catalog");
    expect(html).toContain("Catalog Dukumintiyada");
    expect(html).toContain("Diyaar u isticmaal");
    expect(html).toContain("Waa imanaya");
    expect(html).toContain("Raadi catalog-ka");
    // The configuration-driven engine note closes the page.
    expect(html).toContain("Mashiinku waa qaab-dhismeed");
  });

  describe("Approvals + Team board over pending queries", () => {
    test("Approvals — shell, list card and booking form", () => {
      const html = renderWithConvex(React.createElement(Schedule), "/schedule");
      expect(html).toContain("Ballannada");
      expect(html).toContain("Ballantaada");
      // Queries stay pending, so the list shows the honest loading text.
      expect(html).toContain("La dejiyayo…");
      expect(html).toContain("Ballan samee");
      expect(html).toContain("Ballan ku qor");
    });

    test("Team board — shell, pin form, honest loading state", () => {
      const html = renderWithConvex(
        React.createElement(TeamBoard),
        "/team",
      );
      expect(html).toContain("Guddiga Kooxda");
      expect(html).toContain("Qoraal cusub dheji");
      expect(html).toContain("Guddiga ku qor");
      // Post list stays pending: the loading text, never the empty state.
      expect(html).toContain("La dejiyayo…");
    });
  });

  test("Admin — shell, stats and the template-validation card over SSR", () => {
    // Queries stay pending (no connection): the stats show 0 and the lists
    // show the honest loading text — no crash is what this guards.
    const html = renderWithConvex(React.createElement(Admin), "/admin");
    expect(html).toContain("Admin");
    expect(html).toContain("Dukumintiyada");
    expect(html).toContain("Ballannada");
    expect(html).toContain("Xaqiijinta template-ka");
    expect(html).toContain("Hubi template-ka");
  });
});
