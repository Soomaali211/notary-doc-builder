import { useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/notary/AppShell";
import { getConfig, documentConfigs } from "@/lib/notary/documents";
import { knownPlaceholderNames } from "@/lib/notary/dataContext";
import {
  scanTemplateTokens,
  type TemplateTokenReport,
  type UserTemplateRecord,
} from "@/lib/notary/userTemplate";
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

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function Templates() {
  const [docType, setDocType] = useState("heshiis_kiro");
  const config = getConfig(docType);
  const templates = useQuery(api.notaryTemplates.listMyTemplates, {
    documentType: docType,
  });
  const uploadUrl = useMutation(api.notaryTemplates.generateTemplateUploadUrl);
  const save = useMutation(api.notaryTemplates.saveTemplate);
  const setDefault = useMutation(api.notaryTemplates.setDefaultTemplate);
  const remove = useMutation(api.notaryTemplates.deleteTemplate);

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
      toast.success("Template-ka nidaamka waa la soo celiyay — furi Word-ka si aad u edisto.");
    } catch (err) {
      console.error(err);
      toast.error("Template-ka lama soo celin karo — isku day mar kale.");
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
      toast.success("Template-ka v2 waa la soo celiyay — qodobado sharciyeed buuxa.");
    } catch (err) {
      console.error(err);
      toast.error("Template-ka v2 lama soo celin karo — isku day mar kale.");
    } finally {
      setBuildingV2(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!config) return;
    if (!/\.docx$/i.test(file.name)) {
      toast.error("Kaliya faylasha Word (.docx) ayaa la oggol yahay.");
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

      const url = await uploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": DOCX_MIME },
        body: bytes,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };

      await save({
        documentType: docType,
        name: file.name.replace(/\.docx$/i, ""),
        fileName: file.name,
        storageId: storageId as never,
        sizeBytes: file.size,
        placeholdersJson: JSON.stringify(report.tokens),
        warningsJson: JSON.stringify([
          ...report.unknown.map((u) => `Placeholder aan la aqoon: {{${u}}}`),
          ...report.syntaxErrors,
        ]),
      });
      toast.success("Template-ka waa la soo geliyay oo la kaydiyay!");
    } catch (err) {
      console.error(err);
      toast.error("Soo gelidda template-ka wuu fashilmay — isku day mar kale.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AppShell title="Template Manager" subtitle="Word template-yadaada — adigaa wareejiya qaab-dhismeedka.">
      <div className="space-y-6">
        {/* Document type picker */}
        <div className="neu-raised p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Nooca Dukumeentiga
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {documentConfigs.map((c) => (
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
              <h2 className="text-base font-bold">Soo geli Word Template (.docx)</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Template-ka waa iska leh USER-KA: qaabka, font-ka, logo-ga,
                sharciga iyo saxiixada — dhammaan waxay ku jiraan faylkaaga.
                System-ku wuxuu kaliya akhriyaa placeholder-yada{" "}
                <code className="rounded bg-muted px-1">{"{{SIDAAN}}"}</code> oo
                xogta buuxinayaa.
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
                Dooro .docx
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
                      {r.canGenerate
                        ? "Template-ku waafaqaa nidaamka — document-ka waa la buuxin karaa."
                        : "Template-ku ma waafaqno nidaamka — qaladahan la saxo template-ka."}
                    </p>

                    {/* Structural problems — the only blocking ones */}
                    {(r.invalidConditionals.length > 0 ||
                      r.invalidRepeaters.length > 0) && (
                      <div className="text-destructive">
                        <p className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="size-4" /> Qalado qaab-dhismeed ah:
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
                        ⚠ Template-ku wuxuu leeyahay placeholder aan system-ku
                        aqoon: <strong>{r.unknown.join(", ")}</strong> —
                        generation ma joojinayo, token-kii ayaa document-ka ka
                        saaraysa.
                      </p>
                    )}

                    {/* Aliases — old names that still resolve */}
                    {r.aliasMappings.length > 0 && (
                      <p className="text-muted-foreground">
                        Magacyo duub ah oo hadda la heli karo:{" "}
                        {r.aliasMappings
                          .map((m) => `${m.token} → ${m.canonical}`)
                          .join(", ")}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-pen-green/10 px-2 py-0.5 font-semibold text-pen-green">
                        La aqoonsan: {r.recognized.length}
                      </span>
                      {r.aliasMappings.length > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                          Alias: {r.aliasMappings.length}
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                        Ma aqoon: {r.unknown.length}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                        Isticmaal ma san: {r.unused.length}
                      </span>
                    </div>

                    {r.unused.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-semibold">
                          Magacyo system-ku yaqaan laakiin template-ku isticmaali
                          maaha ({r.unused.length})
                        </summary>
                        <p className="mt-2 leading-relaxed">
                          Tan waa xoog gaar ah oo aad qaad karo: haddii aad u
                          isticmaasho, template-ka ayaa la buuxinayaa.{" "}
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
            Template-ka v2 — Heshiis Kiro (qoraal sharciyeed){" "}
            <span className="ml-1 rounded-full bg-pen-green/10 px-2 py-0.5 text-[10px] font-semibold text-pen-green">
              WAA LA TAAGEERAA
            </span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Waa <strong>heshiis nootaayo oo dhab ah</strong>: qoraal continuous,
            qodobado sharciyeed (1., 2., 3. …), saxiixaho iyo maragyo — miis
            xog ma jiro. Qoraalka joogtada ah waa qoraal sharci; xogga
            isbedbedesha waxay ku dhex jirtaa <code className="rounded bg-muted px-1">{"{{PLACEHOLDER}}"}</code>{" "}
            token-yada canonical-ka, oo la ilaaliyo.
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
            Soo celi heshiis_kiro_template_v2.docx
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Furi Word-ka, qaab-dhismeedka, font-ka, logo-ga, sharciga iyo meelaha
            saxiixada adigaa beddelaysaa — placeholder-yadana <strong>haba seyn</strong>.
          </p>
        </div>
        )}

        {/* Starter template builder — the user's Word template starts here */}
        {config?.id === "heshiis_kiro" && (
        <div className="neu-raised p-6">
          <h2 className="text-base font-bold">Template-ka nidaamka v1 (miis xog leh)</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            System-ku wuxuu abuuraa Word .docx template-ka La{" "}
            <code className="rounded bg-muted px-1">{TEMPLATE_FILE_NAME}</code>{" "}
            oo leh placeholder-yada canonical-ka. Ka dibna ADIGA ayaa Word-ka
            furaya, qaabka, font-ka, logo-ga, sharciga iyo meelaha saxiixada
            aad beddelaysaa — placeholder-yadana <strong>haba seyn</strong>.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 gap-2"
            disabled={building}
            onClick={() => void downloadStarter()}
          >
            {building ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Soo celi heshiis_kiro_template.docx
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Marka aad Word-ka ku edit-gareeyo, ku kaydi magac cusub (tusaale{" "}
            <code className="bg-muted px-1">heshiis_kiro_template_final.docx</code>) oo
            soo geli Template Manager-ka — user-kayga waa la ilaaliyaa, lama
            beddelin.
          </p>
        </div>
        )}

        {/* Available placeholder reference */}
        {config && (
          <details className="neu-raised p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Placeholder-yada la heli karo ({knownNames.size})
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
              Repeat blocks:{" "}
              {(config.repeatBlocks ?? []).map((b, i) => (
                <span key={b.blockId}>
                  {i > 0 && ", "}
                  <code className="bg-muted px-1">
                    {`{{#${b.blockId}}}…{{/${b.blockId}}}`}
                  </code>
                </span>
              ))}
              . Conditionals:{" "}
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
          {templates === undefined && <Skeleton className="h-24 w-full" />}
          {templates?.length === 0 && (
            <p className="neu-inset p-4 text-sm text-muted-foreground">
              Weli template lama soo gelin. Soo geli .docx aad sameysay si aad u
              isticmaasho generation-ka.
            </p>
          )}
          {(templates ?? []).map((t: UserTemplateRecord) => {
            const unknown = JSON.parse(t.warningsJson ?? "[]") as string[];
            return (
              <div key={t._id} className="neu-raised flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {t.name}
                    {t.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pen-green/10 px-2 py-0.5 text-[11px] font-semibold text-pen-green">
                        <Star className="size-3" /> Default
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.fileName} · {(t.sizeBytes / 1024).toFixed(0)} KB
                  </p>
                  {unknown.length > 0 && (
                    <p className="mt-1 text-xs text-pen-orange">
                      ⚠ {unknown.length} warning: {unknown[0]}
                      {unknown.length > 1 ? " …" : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!t.isDefault && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        setDefault({ templateId: t._id as never })
                          .then(() => toast.success("Template-ka default waa loo dhigay."))
                          .catch(() => toast.error("Lama dhejin karo — isku day mar kale."))
                      }
                    >
                      <Star className="size-3.5" /> Default
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() =>
                      remove({ templateId: t._id as never })
                        .then(() => toast.success("Template-ka waa la tirtiray."))
                        .catch(() => toast.error("Lama tirtirin — isku day mar kale."))
                    }
                  >
                    <Trash2 className="size-3.5" /> Tirtir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Template-yada hore lama beddelo oo lama overwrite-gareyn — mar kasta
          oo aad soo gelisid, record cusub ayaa la abuuraa.{" "}
          <Link to="/dashboard" className="font-medium text-primary hover:underline">
            ← Dashboard
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
