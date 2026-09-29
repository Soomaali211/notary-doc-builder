import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/notary/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getConfig } from "@/lib/notary/documents";
import { Trash2, XCircle, CheckCircle2 } from "lucide-react";

/**
 * Admin area. This tool is used by one internal office team, so the admin
 * surface is trusted rather than role-gated: it shows everything happening
 * across the workspace and allows cleanup actions.
 */
export default function Admin() {
  const allDocs = useQuery(api.notaryDocuments.listAllDocuments);
  const allAppts = useQuery(api.notaryAppointments.listAll);
  const posts = useQuery(api.notaryPosts.list);
  const adminDeleteDraft = useMutation(api.notaryDocuments.adminDeleteDraft);
  const adminSetStatus = useMutation(api.notaryAppointments.adminSetStatus);
  const removePost = useMutation(api.notaryPosts.remove);
  const removeComment = useMutation(api.notaryComments.remove);

  const drafts = (allDocs ?? []).filter((d) => d.status === "draft");
  const generated = (allDocs ?? []).filter((d) => d.status === "generated");

  return (
    <AppShell
      title="Admin"
      subtitle="Workspace-wide overview — documents, bookings, board posts and comments."
    >
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Documents</p>
          <p className="mt-1 text-2xl font-bold">{(allDocs ?? []).length}</p>
          <p className="text-xs text-muted-foreground">{generated.length} generated · {drafts.length} drafts</p>
        </div>
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Appointments</p>
          <p className="mt-1 text-2xl font-bold">{(allAppts ?? []).length}</p>
          <p className="text-xs text-muted-foreground">
            {(allAppts ?? []).filter((a) => a.status === "scheduled").length} upcoming
          </p>
        </div>
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Board posts</p>
          <p className="mt-1 text-2xl font-bold">{(posts ?? []).length}</p>
        </div>
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Types live</p>
          <p className="mt-1 text-2xl font-bold">1</p>
          <p className="text-xs text-muted-foreground">5 planned</p>
        </div>
      </div>

      {/* All documents */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">All documents</h2>
        <div className="notebook-page paper-grain rounded-md p-2">
          {!allDocs && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {allDocs && allDocs.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No documents in the workspace yet.</p>
          )}
          <ul className="divide-y divide-dashed divide-border/70">
            {(allDocs ?? []).map((d) => (
              <li key={d._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span className="text-sm">
                  <span className="font-semibold">{d.referenceNumber || "(draft)"}</span>
                  <span className="ml-2 text-muted-foreground">
                    {getConfig(d.documentType)?.title ?? d.documentTypeTitle} · {d.subTypeLabel}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={d.status === "generated" ? "default" : "secondary"} className="text-[10px]">
                    {d.status === "generated" ? "Generated" : "Draft"}
                  </Badge>
                  {d.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        adminDeleteDraft({ documentId: d._id }).catch(() =>
                          toast.error("Tirtiriddu way fashilantay."),
                        );
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* All appointments */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">All appointments</h2>
        <div className="notebook-page paper-grain rounded-md p-2">
          {allAppts && allAppts.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No appointments booked yet.</p>
          )}
          <ul className="divide-y divide-dashed divide-border/70">
            {(allAppts ?? []).slice(0, 30).map((a) => (
              <li key={a._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span className="text-sm">
                  <span className="font-semibold">{a.title}</span>
                  <span className="notebook-annotation ml-2 text-xs text-muted-foreground">
                    {a.date} · {a.time}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => adminSetStatus({ id: a._id, status: "completed" })}
                  >
                    <CheckCircle2 className="size-3.5 text-pen-green" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => adminSetStatus({ id: a._id, status: "cancelled" })}
                  >
                    <XCircle className="size-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Moderation */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Board moderation</h2>
        <div className="notebook-page paper-grain rounded-md p-2">
          {posts && posts.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No posts to moderate.</p>
          )}
          <ul className="divide-y divide-dashed divide-border/70">
            {(posts ?? []).slice(0, 20).map((p) => (
              <li key={p._id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0 truncate text-sm">
                  <span className="font-semibold">{p.title}</span>
                  <span className="notebook-annotation ml-2 text-xs text-muted-foreground">— {p.authorName}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => removePost({ id: p._id })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <p className="notebook-annotation mt-3 text-xs text-muted-foreground">
          * Comments are moderated from each document's detail page.
        </p>
      </section>
    </AppShell>
  );
}
