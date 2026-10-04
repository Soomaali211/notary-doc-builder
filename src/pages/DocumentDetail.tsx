import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/notary/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getConfig, getSubTypeLabel } from "@/lib/notary/documents";
import { getTemplateById } from "@/lib/notary/registry";
import { formatSomaliDate } from "@/lib/notary/format";
import { documentStatusLabel, isFinishedStatus } from "@/lib/notary/documentStatus";
import { useLocalAgreement } from "@/lib/notary/localHooks";
import { agreementNames, agreementSides, getGeneratedFile, saveAgreement } from "@/lib/notary/localRepository";
import { downloadBlob } from "@/lib/notary/documentExport";
import {
  Archive,
  ArrowLeft,
  CopyPlus,
  Download,
  FileDown,
  FileText,
  HardDrive,
  Users,
} from "lucide-react";

function DocumentDetailView({ docId }: { docId: string }) {
  /**
   * §3 — the document is read from THIS machine, and so are its files. There
   * is no download URL to fetch: the generated DOCX and PDF are stored beside
   * the agreement, so they open with the network switched off.
   */
  const { document, loading } = useLocalAgreement(docId);
  const navigate = useNavigate();

  /**
   * §32 — the parties are derived from the stored answers rather than kept
   * as a second copy that could drift. One answer, one rendering.
   */
  const partyNames = document ? agreementNames(document) : [];
  const sides = document ? agreementSides(document) : { sellers: "", buyers: "" };

  const downloadGenerated = async (kind: "docx" | "pdf") => {
    if (!document) return;
    const file = await getGeneratedFile(document.id, kind);
    if (!file) {
      toast.error(
        `Faylka ${kind.toUpperCase()} ma jiro halkan. Soo saar document-ga mar kale oo halkan ayuu ku soo qaadan doonaa.`,
      );
      return;
    }
    downloadBlob(file.blob, file.fileName);
  };

  if (loading) {
    return (
      <AppShell title="Document">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!document) {
    return (
      <AppShell title="Document">
        <p className="text-sm text-muted-foreground" data-empty="document">
          Dukumeentigan lama helin. Wuxuu noqon karaa in la tirtiray, ama in kale ayaa
          lagu qaldamay.
        </p>
      </AppShell>
    );
  }

  const config = getConfig(document.documentType);
  const values = (() => {
    try {
      return JSON.parse(document.valuesJson) as Record<string, Record<string, string>>;
    } catch {
      return {};
    }
  })();

  // The template this document was made from, by name where the office gave
  // one. The id alone would show a code, not a template the notary recognises.
  const templateInfo = document.templateId ? getTemplateById(document.templateId) : undefined;

  /**
   * Regeneration NEVER overwrites: the finished document is copied into a
   * NEW draft, so the version that was already signed stays exactly as it is.
   */
  const regenerate = async () => {
    try {
      const copy = await saveAgreement({
        documentType: document.documentType,
        documentTypeTitle: document.documentTypeTitle,
        subType: document.subType,
        subTypeLabel: document.subTypeLabel,
        referenceNumber: "",
        status: "draft",
        valuesJson: document.valuesJson,
      });
      toast.success("Waa la nuquliyay — version cusub oo draft ah ayaa diyaar.");
      navigate(`/documents/${copy.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Nuqulidda waa fashilantay.");
    }
  };

  const archiveNow = async () => {
    try {
      await saveAgreement({
        id: document.id,
        documentType: document.documentType,
        documentTypeTitle: document.documentTypeTitle,
        subType: document.subType,
        subTypeLabel: document.subTypeLabel,
        referenceNumber: document.referenceNumber,
        status: "archived",
        valuesJson: document.valuesJson,
      });
      toast.success("Dukumeentiga waa la kaydiyay kaydka.");
    } catch (e) {
      console.error(e);
      toast.error("Kaydinta waa fashilantay.");
    }
  };

  return (
    <AppShell title={document.referenceNumber || "Document"} subtitle={document.subTypeLabel}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Header card */}
          <div className="notebook-page paper-grain rounded-md p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="notebook-annotation text-sm text-muted-foreground">
                  {config?.title ?? document.documentTypeTitle} ·{" "}
                  {getSubTypeLabel(config, document.subType)}
                </p>
                <h2 className="highlight-sweep mt-1 inline-block text-2xl font-bold">
                  {document.referenceNumber || "(reference pending)"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {formatSomaliDate(new Date(document.createdAt ?? 0).toISOString().slice(0, 10))} ·
                  Updated {formatSomaliDate(new Date(document.updatedAt ?? 0).toISOString().slice(0, 10))}
                </p>
                {/* §69 — the audit trail: the four moments, each shown only
                    once it has actually happened. A moment that has not
                    occurred reads "—", never a guess. */}
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  {(
                    [
                      ["La abuuray", document.createdAt],
                      ["Wax la beddelay", document.updatedAt],
                      ["Waa la dhammaystiray", document.completedAt],
                      ["Waa la soo saaray", document.exportedAt],
                    ] as const
                  ).map(([label, at]) => (
                    <div key={label} className="flex gap-1">
                      <dt>{label}:</dt>
                      <dd className="font-medium text-foreground">
                        {at
                          ? new Date(at).toLocaleString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={isFinishedStatus(document.status) ? "default" : "secondary"}>
                  {documentStatusLabel(document.status)}
                </Badge>
                {document.templateId && (
                  <p className="text-right text-[11px] text-muted-foreground">
                    Template:{" "}
                    <span className="font-medium text-foreground">
                      {document.templateName ?? templateInfo?.name ?? document.templateId}
                    </span>
                  </p>
                )}
                {/* The generated files live on THIS machine, so both buttons
                    are real downloads \u2014 no URL, no server. */}
                {isFinishedStatus(document.status) && (
                  <>
                    <Button size="sm" onClick={() => void downloadGenerated("docx")}>
                      <Download className="size-4" /> DOCX
                    </Button>
                    {document.outputPdfPath && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void downloadGenerated("pdf")}
                      >
                        <FileDown className="size-4" /> PDF
                      </Button>
                    )}
                  </>
                )}
                {document.status === "draft" && (
                  <Button size="sm" onClick={() => navigate(`/documents/${document.id}`)}>
                    Resume interview
                  </Button>
                )}
                {(document.status === "generated" || document.status === "archived") && (
                  <Button size="sm" variant="outline" onClick={regenerate}>
                    <CopyPlus className="size-4" /> Regenerate as draft
                  </Button>
                )}
                {document.status === "generated" && (
                  <Button size="sm" variant="ghost" onClick={archiveNow}>
                    <Archive className="size-4" /> Save to archive
                  </Button>
                )}
              </div>
            </div>

            {/* Parties — §32/§39. Read out of the stored answers, so the
                list here can never disagree with the form the notary filled. */}
            <div className="mt-6 border-t border-dashed border-border pt-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" /> Parties
              </h3>
              {partyNames.length === 0 ? (
                <p className="text-sm text-muted-foreground">Weli lama diiwaangelin.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["Iibiyayaasha", sides.sellers],
                      ["Iibsadayaasha", sides.buyers],
                    ] as const
                  ).map(([label, names]) => (
                    <div
                      key={label}
                      className="rounded border border-border/70 bg-card/60 px-3 py-2 text-sm"
                    >
                      <p className="text-xs font-semibold text-primary uppercase">{label}</p>
                      <p className="mt-1 leading-6">{names || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* Stored values */}
          <div className="notebook-page paper-grain rounded-md p-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-primary" /> Stored answers
            </h3>
            <ul className="divide-y divide-dashed divide-border/70">
              {Object.entries(values).flatMap(([sectionId, fields]) =>
                Object.entries(fields ?? {}).map(([fieldId, value]) => (
                  <li
                    key={`${sectionId}.${fieldId}`}
                    className="grid grid-cols-[minmax(120px,220px)_1fr] gap-2 py-1.5 text-sm"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {sectionId}.{fieldId}
                    </span>
                    <span>{value || "—"}</span>
                  </li>
                )),
              )}
            </ul>
          </div>
        </div>

        {/* Side column — §3. Comments were a cloud feature and are not part
            of the offline promise, so they are absent rather than
            half-working. */}
        <div className="space-y-6">
          <section className="notebook-page paper-grain rounded-md p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <HardDrive className="size-4 text-primary" /> Faylaha maxalliga ah
            </h3>
            <p className="text-xs leading-5 text-muted-foreground">
              Dukumeentiga, drafts-ka iyo faylaha la soo saaray waxay ku jiraan
              computer-gaan oo keliya — internet la’aan. Soo saar nuqul
              <strong className="text-foreground"> .notary-backup.json</strong> oo
              Settings-ka, si xogtu had iyo jeer ugu jirato.
            </p>
            <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
              {(
                [
                  ["DOCX", document.outputDocxPath],
                  ["PDF", document.outputPdfPath],
                ] as const
              ).map(([label, path]) => (
                <div key={label} className="flex gap-1">
                  <dt>{label}:</dt>
                  <dd className="font-medium text-foreground">{path || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>


          <Link
            to="/archive"
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" /> Back to archive
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

export default function DocumentDetailPage() {
  const { docId } = useParams<{ docId: string }>();
  if (!docId) {
    return (
      <AppShell title="Document">
        <p className="text-sm text-muted-foreground">No document id in the address.</p>
      </AppShell>
    );
  }
  return <DocumentDetailView docId={docId} />;
}
