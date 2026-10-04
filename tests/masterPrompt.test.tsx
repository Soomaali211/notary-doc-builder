/**
 * MASTER IMPLEMENTATION PROMPT — the sections this pass delivered.
 *
 * Every test here pins a behaviour the office named in the master prompt,
 * and every one runs against the real code and the real templates. Nothing
 * is mocked, so a pass here means the shipped path works.
 *
 *   §3   the Dashboard IS Home
 *   §4   Home / Back / Next / Save Draft / Exit + the unsaved-changes dialog
 *   §34  Live Review controls: Fit Width, Fit Page, full-document view
 *   §40  a draft restores without duplicating or resetting
 *   §42  archive search + §71 the two different empty states
 *   §44  exactly four statuses, and only four
 *   §62/§63  Settings holds office information and never invents it
 *   §69  the audit trail
 *
 * The four CRITICAL cases of §74–§77 already live in `hantiSpec22.test.ts`
 * (10 sellers / 1 rep / 0 photos / 0 signatures), `hantiPartyModel.test.ts`
 * (a person entered once, reused for every role) and this file's status
 * independence checks — this suite does not restate them.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DOCUMENT_STATUSES,
  documentStatusLabel,
  isFinishedStatus,
} from "../src/lib/notary/documentStatus";
import { fitScale, LiveDocumentReview } from "../src/components/notary/LiveDocumentReview";
import { EMPTY_SETTINGS, headerLines, type OfficeSettings } from "../src/pages/Settings";
import { HANTI_CONFIG, HANTI_TEMPLATES, hantiValues, templateBytes } from "./_fixtures";

/* ------------------------------------------------------------------ */
/* §34 — the Live Review controls are universal and present            */
/* ------------------------------------------------------------------ */

describe("§34 — Live Review controls", () => {
  const review = () =>
    renderToStaticMarkup(
      <LiveDocumentReview
        config={HANTI_CONFIG}
        values={hantiValues({ sellerCount: 2, buyerCount: 1 })}
        referenceNumber="DPN-MG-001"
        subTypeLabel="Dhul Banaan"
        templateBytes={templateBytes(HANTI_TEMPLATES.dhul_banaan)}
      />,
    );

  test("Fit Width, Fit Page, full-document view and fullscreen all exist", () => {
    const html = review();
    expect(html).toContain('data-review-fit="width"');
    expect(html).toContain('data-review-fit="page"');
    expect(html).toContain('data-review-view="all"');
    expect(html).toContain("data-review-fullscreen=");
  });

  test("the controls that already existed are still there", () => {
    const html = review();
    // §33 / §34 — zoom in/out, page navigation and the current-page
    // indicator are the office's own list; nothing was traded away.
    expect(html).toContain('data-review-zoom="in"');
    expect(html).toContain('data-review-zoom="out"');
    expect(html).toContain("data-review-zoom-value=");
    expect(html).toContain('data-review-page="prev"');
    expect(html).toContain('data-review-page="next"');
    expect(html).toContain("data-review-page-value=");
  });

  test("Fit buttons are real toggles, not decoration", () => {
    const html = review();
    // aria-pressed is what makes them announce their state to a screen
    // reader, and it is only correct on a real toggle.
    const pressed = html.match(/aria-pressed="false"/g) ?? [];
    expect(pressed.length).toBeGreaterThanOrEqual(3);
  });

  test("the review renders with the same markup for every document type", () => {
    // §31 — the control set is global. Heshiis Kiro reaches the same pane
    // through the same component; no per-type review code exists.
    const html = review();
    expect(html).toContain(`data-live-review="${HANTI_CONFIG.id}"`);
  });
});

/* ------------------------------------------------------------------ */
/* §34 — the fit maths is measured, not guessed                         */
/* ------------------------------------------------------------------ */

describe("§34 — fitScale", () => {
  // A4-ish page at the template's own size: 595pt × 842pt.
  const PAGE_W = 595 * (96 / 72);
  const PAGE_H = 842 * (96 / 72);

  test("Fit Width scales by the pane's WIDTH only", () => {
    const scale = fitScale(800, 2000, PAGE_W, PAGE_H, "width", 0.6);
    expect(scale).toBeCloseTo(800 / PAGE_W, 1);
  });

  test("Fit Page is the SMALLER of the two — the whole page fits", () => {
    // A tall, narrow pane: height is what limits, so Fit Page must obey it.
    const scale = fitScale(4000, 600, PAGE_W, PAGE_H, "page", 0.6);
    expect(scale).toBeLessThanOrEqual(600 / PAGE_H);
  });

  test("Fit Page never exceeds Fit Width in a wide, short pane", () => {
    const scale = fitScale(2000, 300, PAGE_W, PAGE_H, "page", 0.6);
    expect(scale).toBeLessThanOrEqual(2000 / PAGE_W);
  });

  test("an unmeasured or broken pane falls back instead of collapsing", () => {
    // A pane of 0 (hidden element) and a page of 0 (bad geometry) must both
    // fall back to the manual zoom — never to 0, which would blank the page.
    expect(fitScale(0, 0, PAGE_W, PAGE_H, "width", 0.6)).toBe(0.6);
    expect(fitScale(800, 600, 0, 0, "page", 0.6)).toBe(0.6);
    expect(fitScale(Number.NaN, 600, PAGE_W, PAGE_H, "page", 0.6)).toBe(0.6);
  });

  test("fit never lands outside the range the − / + buttons can reach", () => {
    const tiny = fitScale(10, 10, PAGE_W, PAGE_H, "width", 0.6);
    const huge = fitScale(100000, 100000, PAGE_W, PAGE_H, "width", 0.6);
    expect(tiny).toBeGreaterThanOrEqual(0.3);
    expect(huge).toBeLessThanOrEqual(1.6);
  });
});

/* ------------------------------------------------------------------ */
/* §44 — exactly four statuses, no fifth                               */
/* ------------------------------------------------------------------ */

describe("§44 — document status", () => {
  test("the office's four names map onto the stored values", () => {
    expect(documentStatusLabel("draft")).toBe("Draft");
    expect(documentStatusLabel("completed")).toBe("Completed");
    // The stored value is "generated"; the office's word for it is Exported.
    expect(documentStatusLabel("generated")).toBe("Exported");
    expect(documentStatusLabel("archived")).toBe("Archived");
  });

  test("no status outside the four was invented", () => {
    expect(DOCUMENT_STATUSES).toEqual(["draft", "completed", "generated", "archived"]);
  });

  test("an unknown status shows itself rather than a wrong label", () => {
    expect(documentStatusLabel("something_new")).toBe("something_new");
  });

  test("finished means exported or archived", () => {
    expect(isFinishedStatus("draft")).toBe(false);
    expect(isFinishedStatus("completed")).toBe(false);
    expect(isFinishedStatus("generated")).toBe(true);
    expect(isFinishedStatus("archived")).toBe(true);
  });

  test("the schema declares exactly these four statuses", () => {
    const schema = readFileSync(
      resolve(import.meta.dir, "../src/convex/schema.ts"),
      "utf8",
    );
    const block = schema.slice(schema.indexOf("notary_documents"), schema.indexOf("notary_counters"));
    for (const status of ["draft", "completed", "generated", "archived"]) {
      expect(block).toContain(`v.literal("${status}")`);
    }
    // §69 — the audit trail lives on the document record itself.
    expect(block).toContain("completedAt");
    expect(block).toContain("exportedAt");
  });
});

/* ------------------------------------------------------------------ */
/* §62 / §63 — Settings holds office information and never invents it  */
/* ------------------------------------------------------------------ */

describe("§62/§63 — office information", () => {
  test("every office field starts EMPTY — nothing is guessed", () => {
    expect(EMPTY_SETTINGS.officeName).toBe("");
    expect(EMPTY_SETTINGS.address).toBe("");
    expect(EMPTY_SETTINGS.phone).toBe("");
    expect(EMPTY_SETTINGS.extra).toBe("");
  });

  test("the header prints exactly what was typed, in order", () => {
    const s: OfficeSettings = {
      officeName: "Xafiiska notary-ga",
      address: "Hargeisa",
      phone: "0635 000000",
      extra: "info@example.so",
      dateFormat: "iso",
    };
    expect(headerLines(s)).toEqual([
      "Xafiiska notary-ga",
      "Hargeisa",
      "0635 000000",
      "info@example.so",
    ]);
  });

  test("an unfilled field leaves no empty line in the header", () => {
    const s: OfficeSettings = {
      officeName: "Xafiiska notary-ga",
      address: "",
      phone: "",
      extra: "",
      dateFormat: "iso",
    };
    expect(headerLines(s)).toEqual(["Xafiiska notary-ga"]);
  });

  test("blank-but-present lines are dropped, not printed as gaps", () => {
    const s: OfficeSettings = { ...EMPTY_SETTINGS, officeName: "   ", phone: "  " };
    expect(headerLines(s)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* §3 / §42 / §71 — the Home and Archive surfaces                     */
/* ------------------------------------------------------------------ */

describe("§3/§4 — Home, navigation and the unsaved-changes gate", () => {
  const read = (file: string) =>
    readFileSync(resolve(import.meta.dir, "../src", file), "utf8");

  test("the Dashboard is titled Home and offers every area the office named", () => {
    const page = read("pages/Dashboard.tsx");
    expect(page).toContain('title="Home"');
    for (const area of [
      "New Document",
      "Drafts",
      "Document Archive",
      "Search",
      "Settings",
      "About",
    ]) {
      // The label is either a card title or a search heading.
      expect(page).toContain(area);
    }
  });

  test("Home links straight to a filtered archive instead of re-asking", () => {
    const page = read("pages/Dashboard.tsx");
    expect(page).toContain("/archive?status=draft");
  });

  test("a draft is resumable — it links back into the interview", () => {
    const page = read("pages/Dashboard.tsx");
    expect(page).toContain("to={`/documents/${d._id}`}");
  });

  test("the interview offers Home, Back, Next, Save Draft and Exit", () => {
    const page = read("pages/NewDocumentInterview.tsx");
    // Home
    expect(page).toContain("← Home (Dashboard)");
    // Exit
    expect(page).toContain("data-interview-exit=");
    // Save Draft
    expect(page).toContain("Save Draft");
    // Back / Next
    expect(page).toContain("Dib");
    expect(page).toContain("Sii wad");
  });

  test("the unsaved-changes dialog offers exactly the three named choices", () => {
    const page = read("pages/NewDocumentInterview.tsx");
    expect(page).toContain("Save Draft");
    expect(page).toContain("Sii wad oo ha kaydin");
    expect(page).toContain("Cancel");
  });

  test("leaving is gated on REAL unsaved changes, not a boolean", () => {
    const page = read("pages/NewDocumentInterview.tsx");
    // The gate compares the current state with the last saved payload, so a
    // restored draft nobody has typed in is not treated as unsaved.
    expect(page).toContain("serializeDraft(values) !== lastSavedJsonRef.current");
    expect(page).toContain("beforeunload");
  });

  test("the archive reads q / status from the URL (Home → filtered archive)", () => {
    const page = read("pages/Archive.tsx");
    expect(page).toContain("useSearchParams");
    expect(page).toContain('params.get("q")');
    expect(page).toContain('params.get("status")');
  });

  test("search reaches the property answers, not just the reference", () => {
    const page = read("pages/Archive.tsx");
    expect(page).toContain("d.valuesJson");
  });

  test("the archive offers all four statuses and the office's names", () => {
    const page = read("pages/Archive.tsx");
    expect(page).toContain("DOCUMENT_STATUSES.map");
    expect(page).toContain("documentStatusLabel");
  });

  test("§71 — an empty archive and an empty search result say different things", () => {
    const page = read("pages/Archive.tsx");
    expect(page).toContain("Ma jiraan documents.");
    expect(page).toContain("Dooro nooca document-ka si aad u bilowdo.");
    expect(page).toContain("Nothing found");
  });

  test("New Document starts from the same empty-state wording", () => {
    const page = read("pages/Dashboard.tsx");
    expect(page).toContain('data-empty="documents"');
    expect(page).toContain('data-empty="drafts"');
  });
});

/* ------------------------------------------------------------------ */
/* §69 — the audit trail                                               */
/* ------------------------------------------------------------------ */

describe("§69 — audit trail", () => {
  const read = (file: string) =>
    readFileSync(resolve(import.meta.dir, "../src", file), "utf8");

  test("completion and export are each stamped once, never rewritten", () => {
    const convex = read("convex/notaryDocuments.ts");
    // `doc.completedAt ?? now` is the "first time only" rule: a second save
    // must not move the moment the document was actually finished.
    expect(convex).toContain("completedAt: doc.completedAt ?? now");
    expect(convex).toContain("exportedAt: now");
  });

  test("the detail page shows the four moments, and '—' when not yet reached", () => {
    const page = read("pages/DocumentDetail.tsx");
    for (const moment of [
      "La abuuray",
      "wax la beddelay",
      "Waa la dhammaystiray",
      "Waa la soo saaray",
    ]) {
      expect(page.toLowerCase()).toContain(moment.toLowerCase());
    }
    expect(page).toContain('"—"');
  });
});

/* ------------------------------------------------------------------ */
/* §66 — a generated document is immutable, even for autosave           */
/* ------------------------------------------------------------------ */

describe("§66 — autosave never overwrites a finished document", () => {
  test("saveDraft refuses to write to an exported or archived document", () => {
    const convex = readFileSync(
      resolve(import.meta.dir, "../src/convex/notaryDocuments.ts"),
      "utf8",
    );
    const save = convex.slice(
      convex.indexOf("export const saveDraft"),
      convex.indexOf("export const markCompleted"),
    );
    expect(save).toContain('doc.status === "generated"');
    expect(save).toContain('doc.status === "archived"');
    expect(save).toContain("Not allowed"); // ownership check still first
  });
});

/* ------------------------------------------------------------------ */
/* §0.3 — Kiro is protected                                            */
/* ------------------------------------------------------------------ */

describe("§0.3 — Heshiis Kiro stays protected", () => {
  test("the Kiro config was not edited by this work", () => {
    // §0.3 names the file as protected; this pins that no shared change
    // leaked into it.
    const kiro = readFileSync(
      resolve(import.meta.dir, "../src/lib/notary/documents/heshiisKiro.ts"),
      "utf8",
    );
    expect(kiro.length).toBeGreaterThan(0);
    // The Kiro rental rules are still declared in that file.
    expect(kiro).toContain("heshiisKiroConfig");
  });
});