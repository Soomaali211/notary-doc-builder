import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShellWithLang } from "@/components/notary/AppShell";
import { useLang } from "@/lib/lang";
import { getConfig, documentConfigs } from "@/lib/notary/documents";
import { useCustomDocumentConfigs } from "@/lib/notary/customDocuments";
import { knownPlaceholderNames } from "@/lib/notary/dataContext";
import {
  scanTemplateTokens,
  type TemplateTokenReport,
  type UserTemplateRecord,
} from "@/lib/notary/userTemplate";
import {
  asUserTemplateRecord,
  listTemplatesLocal,
  makeDefaultTemplateLocal,
  retireTemplateLocal,
  saveTemplateLocal,
} from "@/lib/notary/localTemplates";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Star,
  Trash2,
} from "lucide-react";
import {
  TEMPLATE_FILE_NAME,
  buildHeshiisKiroTemplateBlob,
} from "@/lib/notary/templateBuilder";
import {
  TEMPLATE_FILE_NAME_V2,
  buildHeshiisKiroTemplateV2Blob,
} from "@/lib/notary/templateBuilderV2";
import {
  HANTI_STARTER_TEMPLATES,
  fetchHantiStarterBytes,
  type HantiStarterTemplate,
} from "@/lib/notary/hantiTemplate";

export default function Templates() {
  // The office's own types are uploadable exactly like the built-ins.
  const customTypes = useCustomDocumentConfigs().configs;
  const { t } = useLang();
  const [docType, setDocType] = useState("heshiis_kiro");
  const config = getConfig(docType);
  /**
   * §3 — templates live on THIS machine. The office's own .docx bytes are
   * read from the local database, so a template always opens even with the
   * internet switched off. Nothing here is uploaded anywhere (§54).
   */
  const [templates, setTemplates] = useState<UserTemplateRecord[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const refreshTemplates = useCallback(async () => {
    const rows = await listTemplatesLocal(docType);
    setTemplates(rows.map(asUserTemplateRecord));
    setLoadingTemplates(false);
  }, [docType]);
  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastReport, setLastReport] = useState<
    { name: string; report: TemplateTokenReport } | null
  >(null);

  const knownNames = config ? knownPlaceholderNames(config) : new Set<string>();

  /**
   * [Soo celi template-ka nidaamka] — the system BUILDS the starter .docx
   * (real Word file, canonical placeholders) and hands it to the user, who
   * then owns the design. The file is written with a fresh name, so an
   * edited template is never overwritten.
   */
  const [building, setBuilding] = useState(false);
  const downloadStarter = async () => {
    setBuilding(true);
    try {
      const blob = await buildHeshiisKiroTemplateBlob();
      const a = window.document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = TEMPLATE_FILE_NAME;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(t("tplToastStarterOk"));
    } catch (err) {
      console.error(err);
      toast.error(t("tplToastStarterFail"));
    } finally {
      setBuilding(false);
    }
  };

  /** v2 — the legal-document starter (continuous clauses, no data tables). */
  const [buildingV2, setBuildingV2] = useState(false);
  const downloadStarterV2 = async () => {
    setBuildingV2(true);
    try {
      const blob = await buildHeshiisKiroTemplateV2Blob();
      const a = window.document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = TEMPLATE_FILE_NAME_V2;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(t("tplToastV2Ok"));
    } catch (err) {
      console.error(err);
      toast.error(t("tplToastStarterFail"));
    } finally {
      setBuildingV2(false);
    }
  };

  /**
   * KALA IIBSI HANTI — the starter IS the office's own .docx, served
   * byte-for-byte from this machine (nothing generated, no wording invented).
   * The user edits it in Word and re-uploads it above.
   */
  const [buildingHanti, setBuildingHanti] = useState<string | null>(null);
  const downloadHantiStarter = async (starter: HantiStarterTemplate) => {
    setBuildingHanti(starter.subtype);
    try {
      const bytes = await fetchHantiStarterBytes(starter);
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const a = window.document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = starter.downloadName;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(
        `${starter.label}${t("tplHantiMid")}`,
      );
    } catch (err) {
      console.error(err);
      toast.error(t("tplToastStarterFail"));
    } finally {
      setBuildingHanti(null);
    }
  };

  /**
   * CADAYN CILAAJ — the starter IS the system template generated from the
   * office's scan (public/templates/cadayn_cilaaj/cilaaj.docx), served
   * byte-for-byte from this machine. The user edits it in Word — keeping
   * the {{PLACEHOLDER}} tokens — and re-uploads it above; the newest
   * upload becomes the template in force, exactly like every other type.
   */
  const CILAAJ_STARTER = {
    label: "Cadayn Cilaaj — Cadayn Masuuliyad Qaadis Bukaan",
    path: "/templates/cadayn_cilaaj/cilaaj.docx",
    downloadName: "cadayn_cilaaj_template.docx",
  };
  const [buildingCilaaj, setBuildingCilaaj] = useState(false);
  const downloadCilaajStarter = async () => {
    setBuildingCilaaj(true);
    try {
      const response = await fetch(CILAAJ_STARTER.path);
      if (!response.ok) {
        throw new Error(`Cilaaj template ma helnin (${response.status})`);
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength === 0) {
        throw new Error("Cilaaj template madhan yahay.");
      }
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const a = window.document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = CILAAJ_STARTER.downloadName;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(
        t("tplToastCilaajOk"),
      );
    } catch (err) {
      console.error(err);
      toast.error(t("tplToastStarterFail"));
    } finally {
      setBuildingCilaaj(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!config) return;
    if (!/\.docx$/i.test(file.name)) {
      toast.error(t("tplToastOnlyDocx"));
      return;
    }
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      // Placeholder recognition: scan the user's OWN template against the
      // config's known names. Unknown → warning (never blocks); broken
      // structure → error the user fixes in their file.
      const report = await scanTemplateTokens(bytes, config);
      setLastReport({ name: file.name, report });

      // The bytes are stored ON this machine. An upload is a NEW record, so
      // an earlier template is never overwritten — the newest one is the
      // revision in force.
      await saveTemplateLocal({
        documentType: docType,
        name: file.name.replace(/\.docx$/i, ""),
        fileName: file.name,
        bytes,
        placeholders: report.tokens,
        warnings: [
          ...report.unknown.map((u) => `${t("tplUnknownStored")}${u}}}`),
          ...report.syntaxErrors,
        ],
      });
      await refreshTemplates();
      toast.success(t("tplToastUploadOk"));
    } catch (err) {
      console.error(err);
      toast.error(t("tplToastUploadFail"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AppShellWithLang title={t("tplTitle")} subtitle={t("tplSub")}>
      <div className="space-y-6">
        {/* Document type picker */}
        <div className="neu-raised p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("tplDocType")}
            </p>
            <a
              href="/builder"
              className="text-xs font-medium text-primary hover:underline"
            >
              + {t("bfTitle")}
            </a>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...documentConfigs, ...customTypes].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setDocType(c.id)}
                className={`rounded-full px-3 py-1.5 text-sm transition-all ${
                  c.id === docType
                    ? "neu-inset font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>

        {/* Upload card */}
        <div className="neu-raised p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">{t("tplUploadTitle")}</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {t("tplUploadHintA")}{" "}
                <code className="rounded bg-muted px-1">{"{{SIDAAN}}"}</code>
                {t("tplUploadHintB")}
              </p>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
              <Button
                type="button"
                className="glow-primary-sm gap-2"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileUp className="size-4" />
                )}
                {t("tplChooseFile")}
              </Button>
            </div>
          </div>

          {/* Template Compatibility Validator — report of the last upload */}
          {lastReport && (
            <div className="neu-inset mt-4 space-y-3 p-4 text-sm">
              <p className="font-semibold">{lastReport.name}</p>
              {(() => {
                const r = lastReport.report.report;
                return (
                  <>
                    <p
                      className={`flex items-center gap-1.5 font-medium ${
                        r.canGenerate ? "text-pen-green" : "text-destructive"
                      }`}
                    >
                      {r.canGenerate ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <AlertTriangle className="size-4" />
                      )}
                      {r.canGenerate ? t("tplReportOk") : t("tplReportBad")}
                    </p>

                    {/* Structural problems — the only blocking ones */}
                    {(r.invalidConditionals.length > 0 ||
                      r.invalidRepeaters.length > 0) && (
                      <div className="text-destructive">
                        <p className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="size-4" /> {t("tplStructErrors")}
                        </p>
                        <ul className="ml-6 list-disc">
                          {[...r.invalidConditionals, ...r.invalidRepeaters].map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Unknown names — warning, stripped not fatal */}
                    {r.unknown.length > 0 && (
                      <p className="text-pen-orange">
                        {t("tplUnknownWarnA")}
                        <strong>{r.unknown.join(", ")}</strong>
                        {t("tplUnknownWarnB")}
                      </p>
                    )}

                    {/* Aliases — old names that still resolve */}
                    {r.aliasMappings.length > 0 && (
                      <p className="text-muted-foreground">
                        {t("tplAliases")}{" "}
                        {r.aliasMappings
                          .map((m) => `${m.token} → ${m.canonical}`)
                          .join(", ")}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-pen-green/10 px-2 py-0.5 font-semibold text-pen-green">
                        {t("tplRecognized")}: {r.recognized.length}
                      </span>
                      {r.aliasMappings.length > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                          {t("tplAlias")}: {r.aliasMappings.length}
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                        {t("tplUnknown")}: {r.unknown.length}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                        {t("tplUnused")}: {r.unused.length}
                      </span>
                    </div>

                    {r.unused.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-semibold">
                          {t("tplUnusedSummaryA")}{r.unused.length})
                        </summary>
                        <p className="mt-2 leading-relaxed">
                          {t("tplUnusedHint")}{" "}
                          {r.unused.map((u) => u.token).join(" · ")}
                        </p>
                      </details>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* v2 — the legal-document starter, modelled on the real notary sample.
            Heshiis Kiro only: the starter is built from THAT document's
            wording, so it is never offered for another document type. */}
        {config?.id === "heshiis_kiro" && (
        <div className="neu-raised border-primary/40 p-6">
          <h2 className="text-base font-bold">
            {t("tplV2Title")}{" "}
            <span className="ml-1 rounded-full bg-pen-green/10 px-2 py-0.5 text-[10px] font-semibold text-pen-green">
              {t("tplV2Badge")}
            </span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("tplV2HintA")}
            <strong>heshiis nootaayo oo dhab ah</strong>: qoraal continuous,
            qodobado sharciyeed, saxiixaho iyo maragyo — miis xog ma jiro.
            Qoraalka joogtada ah waa qoraal sharci; xogga isbedbedesha waxay ku
            dhex jirtaa <code className="rounded bg-muted px-1">{"{{PLACEHOLDER}}"}</code>{" "}
            {t("tplV2HintB")}
          </p>
          <Button
            type="button"
            className="glow-primary-sm mt-3 gap-2"
            disabled={buildingV2}
            onClick={() => void downloadStarterV2()}
          >
            {buildingV2 ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t("tplDl")} heshiis_kiro_template_v2.docx
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("tplV2Tail")}<strong>{t("tplDontBreak")}</strong>.
          </p>
        </div>
        )}

        {/* Starter template builder — the user's Word template starts here */}
        {config?.id === "heshiis_kiro" && (
        <div className="neu-raised p-6">
          <h2 className="text-base font-bold">{t("tplV1Title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("tplV1HintA")}{" "}
            <code className="rounded bg-muted px-1">{TEMPLATE_FILE_NAME}</code>{" "}
            {t("tplV1HintB")}<strong>{t("tplDontBreak")}</strong>.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 gap-2"
            disabled={building}
            onClick={() => void downloadStarter()}
          >
            {building ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t("tplDl")} heshiis_kiro_template.docx
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("tplV1Tail")}{" "}
            <code className="bg-muted px-1">heshiis_kiro_template_final.docx</code>
            {t("tplV1TailB")}
          </p>
        </div>
        )}

        {/* KALA IIBSI HANTI — the office's OWN templates, verbatim.
            Only the three subtypes that have a real office file are offered;
            Hanti Kale has NO scan and NO template (open decision) and is
            therefore deliberately absent. */}
        {config?.id === "kala_iibsi_hanti" && (
        <div className="neu-raised border-primary/40 p-6">
          <h2 className="text-base font-bold">
            {t("tplHantiTitle")}{" "}
            <span className="ml-1 rounded-full bg-pen-green/10 px-2 py-0.5 text-[10px] font-semibold text-pen-green">
              {t("tplHantiBadge")}
            </span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("tplHantiHint")}{" "}
            <code className="rounded bg-muted px-1">{"{{PLACEHOLDER}}"}</code>{" "}
            <strong>{t("tplDontBreak")}</strong>
            {t("tplHantiHintB")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {HANTI_STARTER_TEMPLATES.map((starter) => (
              <Button
                key={starter.subtype}
                type="button"
                variant="outline"
                className="gap-2"
                disabled={buildingHanti !== null}
                onClick={() => void downloadHantiStarter(starter)}
              >
                {buildingHanti === starter.subtype ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {t("tplDl")} {starter.downloadName}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("tplHantiTail")}
          </p>
        </div>
        )}

        {/* CADAYN CILAAJ — the office's scan-based template, verbatim.
            One file, no sub-types: download, edit in Word, re-upload. */}
        {config?.id === "cadayn_cilaaj" && (
        <div className="neu-raised border-primary/40 p-6">
          <h2 className="text-base font-bold">
            {t("tplCilaajTitle")}{" "}
            <span className="ml-1 rounded-full bg-pen-green/10 px-2 py-0.5 text-[10px] font-semibold text-pen-green">
              {t("tplCilaajBadge")}
            </span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("tplCilaajHint")}{" "}
            <code className="rounded bg-muted px-1">{"{{PLACEHOLDER}}"}</code>{" "}
            <strong>{t("tplDontBreak")}</strong>
            {t("tplCilaajHintB")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 gap-2"
            disabled={buildingCilaaj}
            onClick={() => void downloadCilaajStarter()}
          >
            {buildingCilaaj ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t("tplDl")} {CILAAJ_STARTER.downloadName}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("tplCilaajTail")}
          </p>
        </div>
        )}

        {/* Available placeholder reference */}
        {config && (
          <details className="neu-raised p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              {t("tplPlaceholdersA")}{knownNames.size})
            </summary>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...knownNames]
                .filter((n) => !n.startsWith("#") && !n.startsWith("/"))
                .sort()
                .map((n) => (
                  <code
                    key={n}
                    className="rounded bg-muted/70 px-1.5 py-0.5 text-[11px] text-foreground/80"
                  >
                    {n.startsWith("IF:") ? `{{${n}}}` : `{{${n}}}`}
                  </code>
                ))}
            </div>            <p className="mt-3 text-xs text-muted-foreground">
              {t("tplRepeatBlocks")}{" "}
              {(config.repeatBlocks ?? []).map((b, i) => (
                <span key={b.blockId}>
                  {i > 0 && ", "}
                  <code className="bg-muted px-1">
                    {`{{#${b.blockId}}}…{{/${b.blockId}}}`}
                  </code>
                </span>
              ))}
              . {t("tplConditionals")}{" "}
              {Object.keys(config.conditionFlags ?? {})
                .slice(0, 3)
                .map((f, i) => (
                  <span key={f}>
                    {i > 0 && ", "}
                    <code className="bg-muted px-1">{`{{IF:${f}}}…{{END:${f}}}`}</code>
                  </span>
                ))}
              .
            </p>
          </details>
        )}

        {/* Template list */}
        <div className="space-y-3">
          {loadingTemplates && <Skeleton className="h-24 w-full" />}
          {!loadingTemplates && templates.length === 0 && (
            <p className="neu-inset p-4 text-sm text-muted-foreground">
              {t("tplListEmpty")}
            </p>
          )}
          {templates.map((tmpl) => {
            const unknown = JSON.parse(tmpl.warningsJson ?? "[]") as string[];
            return (
              <div key={tmpl._id} className="neu-raised flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {tmpl.name}
                    {tmpl.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pen-green/10 px-2 py-0.5 text-[11px] font-semibold text-pen-green">
                        <Star className="size-3" /> {t("tplDefault")}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tmpl.fileName} · {(tmpl.sizeBytes / 1024).toFixed(0)} KB
                  </p>
                  {unknown.length > 0 && (
                    <p className="mt-1 text-xs text-pen-orange">
                      ⚠ {unknown.length}{t("tplWarnCount")}{unknown[0]}
                      {unknown.length > 1 ? " …" : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!tmpl.isDefault && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={async () => {
                        try {
                          await makeDefaultTemplateLocal(tmpl._id);
                          await refreshTemplates();
                          toast.success(t("tplSetDefaultOk"));
                        } catch (err) {
                          console.error(err);
                          toast.error(t("tplSetDefaultFail"));
                        }
                      }}
                    >
                      <Star className="size-3.5" /> {t("tplDefault")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={async () => {
                      try {
                        await retireTemplateLocal(tmpl._id);
                        await refreshTemplates();
                        toast.success(t("tplDeleteOk"));
                      } catch (err) {
                        console.error(err);
                        toast.error(t("tplDeleteFail"));
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" /> {t("tplDelete")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          {t("tplFooter")}{" "}
          <Link to="/documents" className="font-medium text-primary hover:underline">
            {t("tplBackLink")}
          </Link>
        </p>
      </div>
    </AppShellWithLang>
  );
}
