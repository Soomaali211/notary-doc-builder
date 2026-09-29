import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/notary/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getConfig, getSubTypeLabel } from "@/lib/notary/documents";
import { formatSomaliDate } from "@/lib/notary/format";
import {
  ArrowLeft,
  Download,
  FileText,
  MessagesSquare,
  Send,
  Trash2,
  Users,
} from "lucide-react";

function DocumentDetailView({ docId }: { docId: string }) {
  const document = useQuery(api.notaryDocuments.getDocument, {
    documentId: docId as Id<"notary_documents">,
  });
  const docxUrl = useQuery(api.notaryDocuments.getDocxUrl, {
    documentId: docId as Id<"notary_documents">,
  });
  const comments = useQuery(api.notaryComments.listByDocument, {
    documentId: docId as Id<"notary_documents">,
  });
  const addComment = useMutation(api.notaryComments.add);
  const removeComment = useMutation(api.notaryComments.remove);
  const navigate = useNavigate();

  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting] = useState(false);

  if (!document) {
    return (
      <AppShell title="Document">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
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

  const postComment = async () => {
    if (!commentBody.trim()) return;
    setPosting(true);
    try {
      await addComment({
        documentId: document._id,
        body: commentBody,
      });
      setCommentBody("");
    } catch {
      // surfaced via Convex error; keep it simple here
    } finally {
      setPosting(false);
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
                  Created {formatSomaliDate(new Date(document.createdAt).toISOString().slice(0, 10))} ·
                  Updated {formatSomaliDate(new Date(document.updatedAt).toISOString().slice(0, 10))}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={document.status === "generated" ? "default" : "secondary"}>
                  {document.status === "generated" ? "Generated" : "Draft"}
                </Badge>
                {document.status === "generated" && docxUrl && (
                  <a
                    href={docxUrl}
                    download={`${document.fileBaseName}.docx`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="size-4" /> Download DOCX
                  </a>
                )}
                {document.status === "draft" && (
                  <Button size="sm" onClick={() => navigate(`/documents/${document._id}`)}>
                    Resume interview
                  </Button>
                )}
              </div>
            </div>

            {/* Parties */}
            <div className="mt-6 border-t border-dashed border-border pt-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" /> Parties
              </h3>
              {document.parties.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not recorded yet.</p>
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

        {/* Side column: comments */}
        <div className="space-y-6">
          <section className="notebook-page paper-grain rounded-md p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MessagesSquare className="size-4 text-primary" /> Comments
            </h3>

            {!comments && <p className="text-sm text-muted-foreground">Loading…</p>}
            {comments && comments.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No comments yet — start the discussion about this contract.
              </p>
            )}
            <ul className="space-y-3">
              {(comments ?? []).map((c) => (
                <li key={c._id} className="rounded border border-border/70 bg-card/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="notebook-annotation text-xs text-primary">{c.authorName}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-destructive hover:text-destructive"
                      onClick={() => removeComment({ id: c._id })}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                  <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{c.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex gap-2 border-t border-dashed border-border pt-4">
              <Input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment…"
                className="bg-card/80"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && commentBody.trim()) {
                    e.preventDefault();
                    postComment();
                  }
                }}
              />
              <Button size="icon" onClick={postComment} disabled={posting || !commentBody.trim()}>
                <Send className="size-4" />
              </Button>
            </div>
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
