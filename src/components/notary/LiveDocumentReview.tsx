/**
 * Universal Live Document Review.
 *
 * ONE component for EVERY document type — Heshiis Kiro, Kala Iibsi Hanti,
 * Cadayn Cilaaj and anything registered later. It knows nothing about any
 * single document: it receives a `DocumentConfig`, the current answers and
 * the official template bytes, and renders whatever that template says once
 * the shared resolver has filled it.
 *
 *   Form value → document state → DocumentModel → Live Review
 *
 * The preview is live from the moment a document type and its template
 * exist — there is no "Generate" click in this component, and no per-type
 * preview code. Zoom, page navigation, DOCX export, PDF and print are all
 * universal too, and they all read the same model, so the review, the Word
 * file, the PDF and the printout agree by construction.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Printer,
  Ruler,
  Search,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildUniversalDocument,
  downloadBlob,
  exportDocx,
  exportFileBaseName,
  printDocument,
  type DocumentSource,
} from "@/lib/notary/documentExport";
import type { DocumentBlock, DocumentModel, DocumentPage, ImageRef, ParagraphStyle } from "@/lib/notary/documentModel";

/** Points → CSS pixels (1 pt = 1/72 in, CSS = 96 px/in). */
const PT_TO_PX = 96 / 72;
const px = (pt: number | null | undefined): number =>
  pt == null ? 0 : Math.round(pt * PT_TO_PX * 100) / 100;

/**
 * How the page scale is decided (§34).
 *
 *   manual   — the notary chose a percentage with − / +
 *   width    — the whole page width fits the pane
 *   page     — the WHOLE page, height included, fits the pane
 *
 * `fit` is never stored as a number that can go stale: it is recomputed from
 * the pane's measured size every time the model, the pane or the window
 * changes, so a resized window re-fits instead of keeping a dead scale.
 */
export type ReviewFit = "manual" | "width" | "page";

/**
 * The scale at which one page fits the pane, in both directions.
 *
 * A pane of 0 (not measured yet, or a hidden element) yields `fallback` so
 * the first paint shows the document at the default 60 % instead of
 * collapsing it to nothing.
 */
export function fitScale(
  paneWidth: number,
  paneHeight: number,
  pageWidthPx: number,
  pageHeightPx: number,
  fit: "width" | "page",
  fallback: number,
): number {
  if (pageWidthPx <= 0 || pageHeightPx <= 0) return fallback;
  const byWidth = paneWidth / pageWidthPx;
  const byHeight = paneHeight / pageHeightPx;
  const raw = fit === "page" ? Math.min(byWidth, byHeight) : byWidth;
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  // The same 30 %–160 % range the − / + buttons use, so Fit can never land
  // the notary somewhere they cannot zoom out of by hand.
  return Math.min(1.6, Math.max(0.3, Math.round(raw * 100) / 100));
}

/**
 * Font size in CSS pixels. `null` means the template leaves the size to the
 * Word style (the common case), so the document body falls back to a normal
 * 12 pt — never to 0, which would make the page blank.
 */
const BODY_FONT_PT = 12;
const fontPx = (pt: number | null | undefined): number => px(pt ?? BODY_FONT_PT);

type ReviewStatus = "idle" | "loading" | "ready" | "no-template" | "error";

export interface LiveDocumentReviewProps extends DocumentSource {
  /** Called when the user wants the DOCX/PDF/print actions. */
  className?: string;
  /** Hide the toolbar buttons (used when the pane is embedded in a dialog). */
  compact?: boolean;
  /**
   * True while the notary's OWN template is still being fetched. The review
   * waits instead of quietly rendering the registry sample — a preview of
   * the wrong template is worse than no preview at all.
   */
  templatePending?: boolean;
  /** Name shown in the toolbar, so the notary can see WHICH file is shown. */
  templateName?: string | null;
  onStatusChange?: (status: ReviewStatus) => void;
}

/* ------------------------------------------------------------------ */
/* The live model hook — shared by every surface                       */
/* ------------------------------------------------------------------ */

/**
 * Everything EXCEPT the answers that decides "is this a different
 * document?". It is deliberately value-based: a caller that builds the
 * template spec inline (`toTemplateSpec(row)`) hands over a NEW object on
 * every render, and an identity-based key would rebuild the document
 * forever. The answers are tracked separately by their own identity, which
 * is exactly when a rebuild is wanted.
 */
export function liveRenderKey(source: DocumentSource): string {
  return [
    source.config.id,
    source.spec?.templateId ?? "",
    source.spec?.filePath ?? "",
    source.referenceNumber ?? "",
    source.subTypeLabel ?? "",
    source.templateUrl ?? "",
    source.templateBytes ? source.templateBytes.byteLength : 0,
  ].join("|");
}

/**
 * Resolve the official template + build the model, debounced so typing stays
 * smooth. Stale results are discarded: the newest answers always win.
 */
export function useLiveDocumentModel(
  source: DocumentSource,
  debounceMs = 180,
  enabled = true,
): { model: DocumentModel | null; status: ReviewStatus; error: string | null } {
  const [model, setModel] = useState<DocumentModel | null>(null);
  const [state, setState] = useState<{ status: ReviewStatus; error: string | null }>({
    status: "idle",
    error: null,
  });
  const runId = useRef(0);

  // Read at BUILD time, never captured at schedule time, so the renderer
  // always sees the newest props without the effect depending on an
  // object the caller rebuilds on every render.
  const latest = useRef<DocumentSource>(source);
  useEffect(() => {
    latest.current = source;
  });

  // Identity of the answers changes on every keystroke — exactly when we
  // want to re-render; the debounce only coalesces bursts.
  const renderKey = liveRenderKey(source);
  const { values } = source;

  useEffect(() => {
    if (!enabled) return;
    const id = ++runId.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const run = async () => {
      setState({ status: "loading", error: null });
      try {
        const { model: next } = await buildUniversalDocument(latest.current);
        if (cancelled || id !== runId.current) return;
        setModel(next);
        setState({ status: next.error ? "error" : "ready", error: next.error });
      } catch (err) {
        if (cancelled || id !== runId.current) return;
        const message = err instanceof Error ? err.message : "Document-ka ma la dhisin.";
        setModel(null);
        setState({
          error: message,
          status: message.includes("Template looma helin") ? "no-template" : "error",
        });
      }
    };

    timer = setTimeout(() => void run(), debounceMs);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [values, renderKey, debounceMs, enabled]);

  // Derived: a pending template simply keeps the pane in its loading state.
  const status: ReviewStatus = enabled ? state.status : "loading";
  const error = enabled ? state.error : null;
  return { model, status, error };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function segmentStyle(
  seg: Extract<DocumentBlock, { kind: "paragraph" }>["segments"][number],
  style: ParagraphStyle,
): CSSProperties {
  if (seg.kind !== "text") return {};
  return {
    fontWeight: seg.bold || style.bold ? 700 : undefined,
    fontStyle: seg.italic || style.italic ? "italic" : undefined,
    textDecoration: seg.underline || style.underline ? "underline" : undefined,
    fontSize: px(seg.fontSizePt ?? style.fontSizePt ?? BODY_FONT_PT),
    color: seg.color ?? undefined,
  };
}

function ParagraphView({ block }: { block: Extract<DocumentBlock, { kind: "paragraph" }> }) {
  const { style, signature } = block;
  const fontSize = fontPx(style.fontSizePt);
  const headingSize =
    style.headingLevel >= 7 ? 1.35 : style.headingLevel >= 6 ? 1.2 : 1 + style.headingLevel * 0.04;

  const align: CSSProperties = {
    textAlign:
      style.alignment === "justify"
        ? "justify"
        : style.alignment === "center"
          ? "center"
          : style.alignment === "right"
            ? "right"
            : "left",
    marginTop: px(style.spacingBeforePt) ?? 0,
    marginBottom: px(style.spacingAfterPt) ?? 0,
    paddingLeft: px(style.indentLeftPt) ?? 0,
    paddingRight: px(style.indentRightPt) ?? 0,
    fontSize,
    lineHeight: 1.35,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : undefined,
    color: "#111111",
  };

  // A signature rule is drawn as a real ruled line, the way the sheet will
  // be signed — the notary must see where the hand goes.
  if (signature) {
    return (
      <p style={{ ...align, marginTop: 18, marginBottom: 6 }} data-doc-signature="">
        {signature.label ? <span style={{ marginRight: 8 }}>{signature.label}</span> : null}
        <span
          style={{
            display: "inline-block",
            minWidth: signature.rule ? `${signature.rule.length * 0.55}em` : "45%",
            borderBottom: "1px solid #333333",
            height: "1em",
            verticalAlign: "baseline",
          }}
        />
      </p>
    );
  }

  // A break marker is pagination, not content: it is drawn by the page shell.
  const visible = block.segments.filter((s) => s.kind !== "pageBreak");

  return (
    <p
      style={{
        ...align,
        fontSize: Math.round(fontSize * headingSize),
        fontWeight: style.headingLevel > 0 ? 700 : style.bold ? 700 : 400,
      }}
      data-doc-heading={style.headingLevel > 0 ? style.headingLevel : undefined}
    >
      {visible.map((seg, i) => {
        if (seg.kind === "text") {
          return seg.text.trim() === "" && !style.numbered ? (
            <span key={i}>&nbsp;</span>
          ) : (
            <span key={i} style={segmentStyle(seg, style)}>
              {seg.text}
            </span>
          );
        }
        if (seg.kind === "tab") {
          return (
            <span
              key={i}
              style={{ display: "inline-block", width: "2.5em" }}
              aria-hidden="true"
            />
          );
        }
        if (seg.kind === "lineBreak") return <br key={i} />;
        if (seg.kind === "image") return <ImageView key={i} image={seg.image} />;
        return null;
      })}
    </p>
  );
}

function ImageView({ image }: { image: ImageRef }) {
  return (
    <img
      src={image.src}
      alt={image.altText}
      style={{
        maxWidth: "100%",
        width: px(image.widthPt),
        height: px(image.heightPt),
        objectFit: "contain",
      }}
    />
  );
}

function BlockView({ block }: { block: DocumentBlock }) {
  if (block.kind === "image") return <ImageView image={block.image} />;
  if (block.kind === "paragraph") return <ParagraphView block={block} />;
  const columnCount = block.table.rows[0]?.length ?? 1;
  return (
    <table
      data-doc-table=""
      style={{
        width: "100%",
        borderCollapse: "collapse",
        margin: "8px 0",
        tableLayout: columnCount > 1 ? "fixed" : undefined,
        fontSize: 14,
        color: "#111111",
      }}
    >
      <tbody>
        {block.table.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td
                key={c}
                style={{
                  border: "1px solid #444444",
                  padding: "5px 7px",
                  verticalAlign: "top",
                  width: cell.widthPt ? px(cell.widthPt) : undefined,
                }}
              >
                {cell.blocks.map((inner, i) => (
                  <BlockView key={i} block={inner} />
                ))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One physical page of the document, at the template's own size. */
export function DocumentPageView({
  page,
  model,
}: {
  page: DocumentPage;
  model: DocumentModel;
}) {
  const g = model.geometry;
  return (
    <div
      data-doc-page={page.index + 1}
      style={{
        width: px(g.widthPt),
        minHeight: px(g.heightPt),
        padding: `${px(g.marginTopPt)}px ${px(g.marginRightPt)}px ${px(g.marginBottomPt)}px ${px(g.marginLeftPt)}px`,
        background: "#ffffff",
        color: "#111111",
        boxSizing: "border-box",
        fontFamily: "'Times New Roman', Times, serif",
      }}
    >
      {model.headerText.map((text, i) => (
        <p
          key={`h${i}`}
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#333333",
            borderBottom: "1px solid #dddddd",
            marginBottom: 10,
          }}
        >
          {text}
        </p>
      ))}
      {page.blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
      {model.footerText.map((text, i) => (
        <p
          key={`f${i}`}
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#555555",
            marginTop: 14,
            borderTop: "1px solid #dddddd",
          }}
        >
          {text}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The pane                                                            */
/* ------------------------------------------------------------------ */

export function LiveDocumentReview({
  config,
  values,
  referenceNumber,
  subTypeLabel,
  templateBytes,
  spec,
  templateUrl,
  className,
  compact,
  templatePending,
  templateName,
  onStatusChange,
}: LiveDocumentReviewProps) {
  const { model, status, error } = useLiveDocumentModel(
    {
      config,
      values,
      referenceNumber,
      subTypeLabel,
      templateBytes,
      spec,
      templateUrl,
    },
    180,
    !templatePending,
  );

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const [zoom, setZoom] = useState(0.6);
  const [fit, setFit] = useState<ReviewFit>("manual");
  /** §34 — "Full document view": every page in one continuous scroll. */
  const [allPages, setAllPages] = useState(false);
  /** §34 — optional fullscreen. Absent browser support leaves the UI inert. */
  const [wide, setWide] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<null | "docx" | "pdf">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  const pageCount = model?.pages.length ?? 0;
  // Derived, never stored: a document that is now shorter simply clamps.
  const current = Math.min(page, Math.max(1, pageCount));

  /* ---------------------------------------------------------------- */
  /* Fit Width / Fit Page — measured, never guessed                    */
  /* ---------------------------------------------------------------- */

  const pageWidthPx = px(model?.geometry.widthPt);
  const pageHeightPx = px(model?.geometry.heightPt);
  const [pane, setPane] = useState({ w: 0, h: 0 });

  // The pane's own size, measured — a ResizeObserver when the browser has
  // one, the window resize event otherwise. No polling, no layout thrash.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () =>
      setPane({ w: node.clientWidth, h: node.clientHeight });
    measure();
    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(measure);
      ro.observe(node);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [!!model]);

  // The rendered scale: Fit modes derive it from the pane, manual keeps the
  // notary's own percentage.
  const scale = useMemo(() => {
    if (fit === "manual") return zoom;
    return fitScale(pane.w, pane.h, pageWidthPx, pageHeightPx, fit, zoom);
  }, [fit, zoom, pane.w, pane.h, pageWidthPx, pageHeightPx]);

  // − / + take over from Fit: an explicit percentage IS a manual choice.
  const setManualZoom = (next: number) => {
    setFit("manual");
    setZoom(next);
  };

  const toggleFullscreen = () => {
    const el = sectionRef.current as (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    if (!el) return;
    const doc = el.ownerDocument;
    const d = doc as Document & { webkitFullscreenElement?: Element | null };
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (doc.exitFullscreen?.bind(doc) ?? (doc as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen?.bind(doc))?.();
      setWide(false);
      return;
    }
    const enter = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (typeof enter !== "function") {
      // Optional feature, unsupported browser: say so instead of doing nothing.
      setNotice("Browser-kagu fullscreen ma daboolo — waxay noqonaysaa qaab caadi ah.");
      return;
    }
    void enter.call(el).then(() => setWide(true)).catch(() => setWide(false));
  };

  const scrollToPage = useCallback((target: number) => {
    const holder = scrollRef.current;
    if (!holder) return;
    const node = holder.querySelector(`[data-doc-page="${target}"]`);
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const goTo = (target: number) => {
    const next = Math.min(Math.max(1, target), Math.max(1, pageCount));
    setPage(next);
    scrollToPage(next);
  };

  const handleDocx = async () => {
    setBusy("docx");
    setNotice(null);
    try {
      const { blob, fileName } = await exportDocx({
        config,
        values,
        referenceNumber,
        subTypeLabel,
        templateBytes,
        spec,
        templateUrl,
      });
      downloadBlob(blob, fileName);
      setNotice(`Word la soo saaray: ${fileName}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "DOCX lama soo saari karo.");
    } finally {
      setBusy(null);
    }
  };

  const handlePdf = () => {
    const base = exportFileBaseName({ config, values, referenceNumber, subTypeLabel });
    printDocument({ fileName: `${base}.pdf` });
    setNotice(
      "Fadlan dooro 'Save as PDF' — PDF-ka wuxuu ka yimid isla document-ka la muugayo.",
    );
  };

  const handlePrint = () => {
    printDocument({ fileName: exportFileBaseName({ config, values, referenceNumber, subTypeLabel }) });
  };

  // Narrowed once: the pages are only rendered when a model actually built.
  const readyModel: DocumentModel | null = model && !model.error ? model : null;

  const statusLine = useMemo(() => {
    if (templatePending) return "Waa la soo rarayaa template-kaaga…";
    if (status === "no-template") return "Template looma helin — Live Review ma shaqeyn karto.";
    if (status === "error") return error ?? "Document-ka ma la dhisin.";
    if (status === "loading") return "Waa la cusboonaaayaa…";
    if (model) return `${pageCount} bog${pageCount === 1 ? "" : "yo"}`;
    return "";
  }, [templatePending, status, error, model, pageCount]);

  return (
    <section
      ref={sectionRef}
      className={cn(
        className,
        wide && "fixed inset-0 z-50 overflow-auto bg-background p-4",
      )}
      data-live-review={config.id}
      data-fullscreen={wide ? "true" : undefined}
      aria-label={`Live Document Review — ${config.title}`}
    >
      {/* Toolbar — universal: zoom, pages, DOCX, PDF, print. */}
      <div
        data-no-print=""
        className="neu-raised-sm mb-3 flex flex-wrap items-center gap-2 px-3 py-2"
      >
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{config.title}</p>
            <p className="truncate text-[11px] text-muted-foreground" data-review-status="">
              {statusLine}
            </p>
            {/* Which file is actually on screen: the notary's own template,
                or the registry sample when they uploaded nothing. */}
            <p className="truncate text-[11px] text-muted-foreground" data-review-template="">
              Template: {templateName ?? "Tusaalaha nidaamka"}
            </p>
          </div>
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-md border border-border px-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Yar"
              data-review-zoom="out"
              disabled={scale <= 0.3}
              onClick={() => setManualZoom(Math.max(0.3, Math.round((scale - 0.1) * 10) / 10))}
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="w-10 text-center text-xs tabular-nums" data-review-zoom-value="">
              {Math.round(scale * 100)}%
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Weynii"
              data-review-zoom="in"
              disabled={scale >= 1.6}
              onClick={() => setManualZoom(Math.min(1.6, Math.round((scale + 0.1) * 10) / 10))}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          {/* Fit Width / Fit Page — the pane is measured, so these follow the
              window instead of freezing at whatever it was when pressed. */}
          <div className="flex items-center gap-1 rounded-md border border-border px-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              aria-pressed={fit === "width"}
              data-review-fit="width"
              onClick={() => setFit(fit === "width" ? "manual" : "width")}
            >
              <Ruler className="size-3.5" />
              Cabbir Dhul
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              aria-pressed={fit === "page"}
              data-review-fit="page"
              onClick={() => setFit(fit === "page" ? "manual" : "page")}
            >
              <Square className="size-3.5" />
              Cabbir Bog
            </Button>
          </div>

          {/* Full document view — every page at once, for a quick read of the
              whole deal instead of page-by-page. Printing is unaffected. */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            aria-pressed={allPages}
            data-review-view="all"
            onClick={() => setAllPages((v) => !v)}
          >
            {allPages ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            Dhammaan Bogoyinka
          </Button>

          {/* Optional fullscreen — inert when the browser refuses it. */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={wide ? "Ka bax fullscreen" : "Fullscreen"}
            data-review-fullscreen=""
            onClick={toggleFullscreen}
          >
            {wide ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>

          <div className="flex items-center gap-1 rounded-md border border-border px-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Bog hore"
              data-review-page="prev"
              disabled={current <= 1 || allPages}
              onClick={() => goTo(current - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="w-14 text-center text-xs tabular-nums" data-review-page-value="">
              {pageCount ? `${current} / ${pageCount}` : "—"}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Bog xiga"
              data-review-page="next"
              disabled={current >= pageCount || allPages}
              onClick={() => goTo(current + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          {!compact && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                data-review-action="docx"
                disabled={busy !== null}
                onClick={() => void handleDocx()}
              >
                {busy === "docx" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Soo Saar Word
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                data-review-action="pdf"
                onClick={handlePdf}
              >
                <FileText className="size-3.5" />
                Soo Saar PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                data-review-action="print"
                onClick={handlePrint}
              >
                <Printer className="size-3.5" />
                Daabac
              </Button>
            </>
          )}
        </div>
      </div>

      {/* The document itself — this is what prints and what "Save as PDF"
          captures. Nothing else is printed (see the @media print rules). */}
      <div
        ref={scrollRef}
        className={
          allPages
            ? "neu-inset overflow-auto p-3"
            : "neu-inset max-h-[72vh] overflow-auto p-3"
        }
        data-review-scroll=""
        data-review-all={allPages ? "true" : undefined}
      >
        {!readyModel ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
            {status === "loading" ? (
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <Search className="size-5 text-muted-foreground" aria-hidden="true" />
            )}
            <p className="max-w-xs text-xs text-muted-foreground" data-review-empty="">
              {statusLine}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4" data-print-doc="">
            {readyModel.pages.map((docPage) => (
              <div
                key={docPage.index}
                data-doc-zoom=""
                style={{
                  width: px(readyModel.geometry.widthPt) * scale,
                  height: px(readyModel.geometry.heightPt) * scale,
                }}
              >
                <div
                  style={{
                    width: px(readyModel.geometry.widthPt),
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
                  }}
                >
                  <DocumentPageView page={docPage} model={readyModel} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notice && (
        <p
          data-no-print=""
          className="mt-2 text-xs text-muted-foreground"
          data-review-notice=""
        >
          {notice}
        </p>
      )}
      {readyModel && readyModel.warnings.length > 0 && (
        <details
          data-no-print=""
          className="mt-2 rounded-md border border-pen-orange/40 bg-pen-orange/5 p-2 text-xs"
        >
          <summary className="cursor-pointer text-pen-orange">
            {readyModel.warnings.length} ogo{" "}
            {readyModel.warnings.length === 1 ? "tii" : "tiyo"} oo template-ka ah
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 ps-4">
            {readyModel.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {readyModel?.pagination === "template-breaks+estimated" && (
        <p data-no-print="" className="mt-2 text-[11px] text-muted-foreground">
          Bogommada waa la qiyaasiyay marka loo eego cabbirka bogga ee template-ka; Word-ku
          wuxuu isku habboon karo ayna soo saaraysaa.
        </p>
      )}
      </section>
  );
}

export default LiveDocumentReview;