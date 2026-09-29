import { useQuery } from "convex/react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getConfig, getSubTypeLabel } from "@/lib/notary/documents";
import { formatSomaliDate } from "@/lib/notary/format";
import {
  ArrowLeft,
  Download,
  FileText,
  Users,
} from "lucide-react";

function DocumentDetailView({ docId }: { docId: string }) {
  const document = useQuery(api.notaryDocuments.getDocument, {
    documentId: docId as Id<"notary_documents">,
  });
  const docxUrl = useQuery(api.notaryDocuments.getDocxUrl, {
    documentId: docId as Id<"notary_documents">,
  });
  const navigate = useNavigate();

  if (!document) {
    return (
      <main className="notebook-bg min-h-screen p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
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

  return (
    <main className="notebook-bg min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1.5"
          onClick={() => navigate("/archive")}
        >
          <ArrowLeft className="size-4" /> Kaydka
        </Button>

        {/* Header card */}
        <div className="notebook-page paper-grain rounded-md p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="notebook-annotation text-sm text-muted-foreground">
                {config?.title ?? document.documentTypeTitle} ·{" "}
                {getSubTypeLabel(config, document.subType)}
              </p>
              <h1 className="highlight-sweep inline-block text-2xl font-bold">
                {document.referenceNumber || "(aan la qeexin)"}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                La sameeyay: {formatSomaliDate(new Date(document.createdAt).toISOString().slice(0, 10))} ·
                {" "}La cusboonaysiiyay: {formatSomaliDate(new Date(document.updatedAt).toISOString().slice(0, 10))}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={document.status === "generated" ? "default" : "secondary"}>
                {document.status === "generated" ? "La sameeyay" : "Draft"}
              </Badge>
              {document.status === "generated" && (
                <a
                  href={docxUrl ?? undefined}
                  download={`${document.fileBaseName}.docx`}
                  className={
                    docxUrl
                      ? "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      : "hidden"
                  }
                >
                  <Download className="size-4" /> Soo deji DOCX
                </a>
              )}
              {document.status === "draft" && (
                <Button size="sm" onClick={() => navigate(`/documents/${document._id}`)}>
                  Sii wad Waraysiga
                  </Button>
              )}
            </div>
          </div>

          {/* Parties */}
          <div className="mt-6 border-t border-dashed border-border pt-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" /> Xisbiyada (Parties)
            </h2>
            {document.parties.length === 0 ? (
              <p className="text-sm text-muted-foreground">Weli lama diiwaangalin.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {document.parties.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded border border-border/70 bg-card/60 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="text-xs font-semibold text-primary uppercase">{p.role}</span>
                      <span className="ml-2 font-medium">{p.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[p.phone, p.idNumber].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Stored values */}
        <Card className="mt-6 border-border/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" /> Xogta Dukumeentiga
            </CardTitle>
            <CardDescription>Xogta la kaydiyay ee heshiiskan.</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function DocumentDetailPage() {
  const { docId } = useParams<{ docId: string }>();
  if (!docId) {
    return (
      <main className="notebook-bg min-h-screen p-6 text-center text-sm text-muted-foreground">
        DocId lama helin.
      </main>
    );
  }
  return <DocumentDetailView docId={docId} />;
}