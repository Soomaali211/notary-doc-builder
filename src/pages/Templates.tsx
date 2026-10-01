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
  FileUp,
  Loader2,
  Star,
  Trash2,
} from "lucide-react";

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

          {/* Scan report of the last upload */}
          {lastReport && (
            <div className="neu-inset mt-4 space-y-2 p-4 text-sm">
              <p className="font-semibold">{lastReport.name}</p>
              {lastReport.report.syntaxErrors.length > 0 && (
                <div className="text-destructive">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="size-4" /> Qalado syntax ah (waa in lagu saxo template-ka):
                  </p>
                  <ul className="ml-6 list-disc">
                    {lastReport.report.syntaxErrors.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lastReport.report.unknown.length > 0 && (
                <p className="text-pen-orange">
                  ⚠ Placeholder aan la aqoon (waa la saari doonaa):{" "}
                  {lastReport.report.unknown.map((u) => `{{${u}}}`).join(", ")}
                </p>
              )}
              <p className="flex items-center gap-1.5 text-pen-green">
                <CheckCircle2 className="size-4" />
                Placeholder-yada la aqoonsan: {lastReport.report.recognized.length}
              </p>
            </div>
          )}
        </div>

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
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
             Repeat blocks: <code className="bg-muted px-1">{"{{#KIREYEYAYAAL}}…{{/KIREYEYAYAAL}}"}</code>, {" "}
              <code className="bg-muted px-1">{"{{#KIRAYSTAYAAL}}…{{/KIRAYSTAYAAL}}"}</code>, {" "}
              <code className="bg-muted px-1">{"{{#WAKIILO_KIREEYAYAAL}}…{{/WAKIILO_KIREEYAYAAL}}"}</code>, {" "}
              <code className="bg-muted px-1">{"{{#MARAGYO}}…{{/MARAGYO}}"}</code>. Conditionals:{" "}
              <code className="bg-muted px-1">{"{{IF:DEEBAAJI_HAA}}…{{END:DEEBAAJI_HAA}}"}</code>.
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
