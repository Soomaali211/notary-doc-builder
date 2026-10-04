/**
 * §34 — Fit Width / Fit Page are WIRED, not decorative.
 *
 * `masterPrompt.test.tsx` proves the controls exist and that `fitScale` is
 * correct arithmetic. This file proves the part a notary can actually feel:
 * pressing "Fit Width" really measures the pane and really changes the scale
 * of the rendered pages.
 *
 * A real DOM (happy-dom) is installed as globals BEFORE React loads, so the
 * component runs exactly as it does in the browser — including the
 * ResizeObserver path that recomputes the fit when the pane resizes. Nothing
 * about the component is stubbed; only the layout numbers are, because
 * happy-dom does no layout engine.
 */
import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

let UNREGISTER: (() => void) | undefined;

beforeAll(async () => {
  const win = new Window({ url: "http://localhost/" });
  const g = globalThis as unknown as Record<string, unknown>;
  const keys = [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "Element",
    "Node",
    "Event",
    "CustomEvent",
    "MutationObserver",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "DOMParser",
    "XMLSerializer",
    "NodeFilter",
    "HTMLInputElement",
    "HTMLButtonElement",
  ];
  // React only flushes effects inside act() when this flag is set.
  (globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const saved: Record<string, unknown> = {};
  for (const k of keys) {
    saved[k] = g[k];
    const value = (win as unknown as Record<string, unknown>)[k];
    if (value !== undefined) g[k] = value;
  }
  if (g.window === undefined) g.window = win;
  // The component must take the ResizeObserver path, not the window-resize
  // fallback — so the observer is the recorded one.
  g.ResizeObserver = ManualResizeObserver;
  UNREGISTER = () => {
    for (const k of keys) g[k] = saved[k];
    g.ResizeObserver = saved.ResizeObserver;
    void win.close();
  };
});

afterAll(() => {
  UNREGISTER?.();
  observed.clear();
});

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { LiveDocumentReview } = await import(
  "../src/components/notary/LiveDocumentReview"
);
const { HANTI_CONFIG, HANTI_TEMPLATES, hantiValues, templateBytes } = await import(
  "./_fixtures"
);

/** Size the pane, then let the observer deliver the measurement to the UI. */
async function setPane(host: HTMLElement, width: number, height: number) {
  stubLayout(host.querySelector("[data-review-scroll]")!, width, height);
  await fireResize();
}

/** happy-dom does no layout engine, so the pane's size is supplied here. */
function stubLayout(node: Element, width: number, height: number) {
  Object.defineProperty(node, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(node, "clientHeight", { value: height, configurable: true });
}

/**
 * A ResizeObserver that RECORDS its callbacks so a test can fire them.
 *
 * happy-dom ships a ResizeObserver that never fires, so the component would
 * keep measuring a zero-sized pane and every Fit assertion would silently
 * test the 60 % fallback instead of the fit. This stub keeps the component's
 * real observer path intact — it still calls observe()/disconnect() — and
 * exposes `fireResize()` so a test can drive the exact callback the browser
 * would have invoked when the window resized.
 */
const observed = new Set<() => void>();
class ManualResizeObserver {
  private targets = new Set<Element>();
  constructor(private callback: () => void) {
    observed.add(() => {
      if (this.targets.size > 0) this.callback();
    });
  }
  observe(el: Element) {
    this.targets.add(el);
  }
  unobserve(el: Element) {
    this.targets.delete(el);
  }
  disconnect() {
    this.targets.clear();
  }
}
/** Trigger the observers exactly as a real window resize would. */
async function fireResize() {
  await act(async () => {
    for (const cb of [...observed]) cb();
  });
}

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <LiveDocumentReview
        config={HANTI_CONFIG}
        values={hantiValues({ sellerCount: 3, buyerCount: 2 })}
        referenceNumber="DPN-MG-001"
        subTypeLabel="Dhul Banaan"
        templateBytes={templateBytes(HANTI_TEMPLATES.dhul_banaan)}
      />,
    );
  });
  // The model is built asynchronously (template parse + pagination). Fitting
  // before it exists would test the 60 % fallback instead of the real fit, so
  // wait until the pages are actually on screen.
  for (let i = 0; i < 200 && !host.querySelector("[data-doc-page]"); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
  if (!host.querySelector("[data-doc-page]")) {
    throw new Error("LiveDocumentReview never rendered its pages in the test");
  }
  return { host, root };
}

const fitBtn = (host: HTMLElement, kind: "width" | "page") =>
  host.querySelector<HTMLButtonElement>(`[data-review-fit="${kind}"]`);
const zoomLabel = (host: HTMLElement) =>
  host.querySelector("[data-review-zoom-value]")?.textContent ?? "";
const firstPageWidth = (host: HTMLElement) =>
  Number.parseFloat(host.querySelector<HTMLElement>("[data-doc-zoom]")?.style.width ?? "") || 0;

describe("§34 — Fit Width / Fit Page in a real DOM", () => {
  test("the review really renders its pages before anything is clicked", async () => {
    const { host, root } = await mount();
    expect(host.querySelector("[data-doc-page]")).not.toBeNull();
    expect(firstPageWidth(host)).toBeGreaterThan(0);
    expect(zoomLabel(host)).toBe("60%");
    await act(async () => root.unmount());
  });

  test("Fit Width measures the pane and rescales the rendered pages", async () => {
    const { host, root } = await mount();
    // 500px pane vs an ~794px page ⇒ Fit Width must zoom OUT below 100 %.
    await setPane(host, 500, 800);

    await act(async () => {
      fitBtn(host, "width")!.click();
    });

    // The EXACT fit (500/794 ≈ 0.63), not merely "less than 100" — a loose
    // bound would also pass on the untouched 60 % default.
    expect(zoomLabel(host)).toBe("63%");
    // The rendered page box must reflect it — not just the label.
    expect(firstPageWidth(host)).toBeCloseTo(794 * 0.63, 0);
    await act(async () => root.unmount());
  });

  test("a wider pane fits the page at the same 160 % ceiling the + button allows", async () => {
    const { host, root } = await mount();
    await setPane(host, 1400, 800);

    await act(async () => {
      fitBtn(host, "width")!.click();
    });
    expect(zoomLabel(host)).toBe("160%");
    await act(async () => root.unmount());
  });

  test("Fit Page obeys the HEIGHT, which Fit Width ignores", async () => {
    const { host, root } = await mount();
    // Wide but short: width fits easily, height is what limits.
    await setPane(host, 3000, 300);

    await act(async () => {
      fitBtn(host, "width")!.click();
    });
    const byWidth = Number.parseInt(zoomLabel(host), 10);

    await act(async () => {
      fitBtn(host, "width")!.click(); // off
      fitBtn(host, "page")!.click(); // on
    });
    const byPage = Number.parseInt(zoomLabel(host), 10);

    expect(byWidth).toBe(160);
    expect(byPage).toBeLessThan(byWidth);
    await act(async () => root.unmount());
  });

  test("a pane resize RE-FITS, so Fit follows the window instead of freezing", async () => {
    const { host, root } = await mount();
    await setPane(host, 1000, 800);
    await act(async () => {
      fitBtn(host, "width")!.click();
    });
    const wide = zoomLabel(host);

    // The window shrank — no second click, just a resize.
    await setPane(host, 500, 800);
    expect(zoomLabel(host)).not.toBe(wide);
    expect(Number.parseInt(zoomLabel(host), 10)).toBeLessThan(
      Number.parseInt(wide, 10),
    );
    await act(async () => root.unmount());
  });

  test("the − / + buttons take over from Fit and own the percentage", async () => {
    const { host, root } = await mount();
    await setPane(host, 500, 800);

    await act(async () => {
      fitBtn(host, "width")!.click();
    });
    const fitted = zoomLabel(host);

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-review-zoom="in"]')!.click();
    });
    expect(zoomLabel(host)).not.toBe(fitted);
    // Zooming by hand leaves Fit mode, so the number is the notary's own.
    expect(fitBtn(host, "width")!.getAttribute("aria-pressed")).toBe("false");
    await act(async () => root.unmount());
  });

  test("the full-document view removes the pane's height clamp", async () => {
    const { host, root } = await mount();
    const pane = host.querySelector("[data-review-scroll]")!;
    expect(pane.className).toContain("max-h-[72vh]");

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-review-view="all"]')!.click();
    });
    expect(pane.className).not.toContain("max-h-[72vh]");
    expect(pane.getAttribute("data-review-all")).toBe("true");
    await act(async () => root.unmount());
  });
});