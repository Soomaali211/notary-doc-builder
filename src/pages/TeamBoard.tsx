import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/notary/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Trash2 } from "lucide-react";

/**
 * Internal team board: short posts any team member can publish and read —
 * office notices, client notes, template change announcements.
 */
export default function TeamBoard() {
  const posts = useQuery(api.notaryPosts.list);
  const create = useMutation(api.notaryPosts.create);
  const remove = useMutation(api.notaryPosts.remove);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Fadlan buuxi cinwaanka iyo fariinta.");
      return;
    }
    setSubmitting(true);
    try {
      await create({ title, body });
      toast.success("Post-ka waa la daabacay!");
      setTitle("");
      setBody("");
    } catch {
      toast.error("Post-ka lama daabacin — fadlan isku day mar kale.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Team Board"
      subtitle="Notices and short updates for the whole office — pinned like notes on the corkboard."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Posts */}
        <section className="columns-1 gap-4 sm:columns-2 [&>*]:mb-4">
          {!posts && <p className="text-sm text-muted-foreground">Loading…</p>}
          {posts && posts.length === 0 && (
            <div className="notebook-page paper-grain rounded-md p-8 text-center">
              <StickyNote className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No posts yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Be the first to pin a note to the board.
              </p>
            </div>
          )}
          {(posts ?? []).map((p, i) => (
            <article
              key={p._id}
              className={`notebook-page paper-grain break-inside-avoid rounded-md p-5 ${
                i % 3 === 1 ? "rotate-[0.4deg]" : i % 3 === 2 ? "-rotate-[0.4deg]" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-6">{p.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={() => remove({ id: p._id })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">{p.body}</p>
              <p className="notebook-annotation mt-3 text-xs text-muted-foreground">
                — {p.authorName} ·{" "}
                {new Date(p.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </article>
          ))}
        </section>

        {/* New post */}
        <section className="notebook-page paper-grain h-fit rounded-md p-5">
          <h2 className="mb-3 text-sm font-semibold">Pin a new note</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Template updated, client visiting…"
                className="bg-card/80"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Message *</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Write the notice for the team…"
                className="bg-card/80"
              />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? "Posting…" : "Post to board"}
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
