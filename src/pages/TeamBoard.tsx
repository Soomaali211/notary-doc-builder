import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShellWithLang } from "@/components/notary/AppShell";
import { useLang } from "@/lib/lang";
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
  const { t } = useLang();
  const posts = useQuery(api.notaryPosts.list);
  const create = useMutation(api.notaryPosts.create);
  const remove = useMutation(api.notaryPosts.remove);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error(t("tbMissing"));
      return;
    }
    setSubmitting(true);
    try {
      await create({ title, body });
      toast.success(t("tbToastOk"));
      setTitle("");
      setBody("");
    } catch {
      toast.error(t("tbToastFail"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShellWithLang title={t("tbTitle")} subtitle={t("tbSub")}>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Posts */}
        <section className="columns-1 gap-4 sm:columns-2 [&>*]:mb-4">
          {!posts && <p className="text-sm text-muted-foreground">{t("tbLoading")}</p>}
          {posts && posts.length === 0 && (
            <div className="notebook-page paper-grain rounded-md p-8 text-center">
              <StickyNote className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{t("tbEmpty")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("tbEmptyHint")}
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
          <h2 className="mb-3 text-sm font-semibold">{t("tbPin")}</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">{t("tbFieldTitle")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("tbTitlePlaceholder")}
                className="bg-card/80"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">{t("tbFieldMessage")}</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder={t("tbMessagePlaceholder")}
                className="bg-card/80"
              />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? t("tbPosting") : t("tbPost")}
            </Button>
          </div>
        </section>
      </div>
    </AppShellWithLang>
  );
}
