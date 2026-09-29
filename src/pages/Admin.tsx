import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/notary/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getConfig } from "@/lib/notary/documents";
import {
  loadTemplate,
  registryTemplates,
} from "@/lib/notary/registry";
import {
  buildDataContext,
  validateTemplate,
  type TemplateValidationResult,
} from "@/lib/notary/template";
import type { FormValues } from "@/lib/notary/types";
import { Trash2, XCircle, CheckCircle2, ShieldCheck } from "lucide-react";

/**
 * Sample office data used only to build the template-validation context.
 * It proves every configured placeholder has a mapping — it never reaches
 * the archive and never generates a document.
 */
const SAMPLE_VALUES: FormValues = {
  heshiiska: {
    reference: "DPN/K/001",
    taariikhda_heshiiska: "2026-09-29",
    sub_type: "guri_xaas",
    taariikhda_bilowga: "2026-10-01",
    taariikhda_dhammaadka: "2027-09-30",
    shuruudaha_gaarka_ah: "",
  },
  kireeyayaal: [
    { id: "s1", values: { magac: "Cabdi Xasan", telefoon: "+252 61 5551234", aqoonsi: "ID-8842", cinwaan: "Hodan", faahfaahin_dheeraad: "" } },
  ],
  kiraystayaal: [
    { id: "s2", values: { magac: "Xuseen Maxamed", telefoon: "+252 63 4447777", aqoonsi: "ID-1177", cinwaan: "", faahfaahin_dheeraad: "" } },
  ],
  guriga: { nooca_guriga: "guri_xaas", goobta: "Hodan, Muqdisho", cinwaanka_guriga: "Wadada 21ka", sharraxaad: "", qolada: "" },
  lacagta: { qiimaha_bil_ka: "500", habka_bixinta: "mobile", taariikhda_bixinta: "1aad ee bil kasta", bixinta_hore: "muqadin", damiin_jira: "yes", faahfaahin_lacagta: "" },
  deebaaji: { deebaaji_jira: "yes", lacagta_deebaajiga: "25", shuruudaha_deebaajiga: "Meter-ka biyaha." },
  damiinka: { damiin_magac: "Maxamed Nuur", damiin_telefoon: "+252 61 1112223", damiin_aqoonsi: "ID-5566", damiin_cinwaan: "" },
  ogaysiinta: { mudada_ogaysiinta: "30 maalmood", shuruudaha_joojinta: "30 maalmood ka hor.", faahfaahin_ogaysiinta: "" },
  maragyo: [{ id: "s3", values: { magac: "Asha Omar", telefoon: "", aqoonsi: "", cinwaan: "" } }],
  dheeraad: { shuruudo_dheeraad: "" },
};

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

  // Phase 3I — template validation screen.
  const templates = registryTemplates();
  const [templateId, setTemplateId] = useState(templates[0]?.templateId ?? "");
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<TemplateValidationResult | null>(null);

  const runValidation = async () => {
    const spec = templates.find((t) => t.templateId === templateId);
    const cfg = spec ? getConfig(spec.documentType) : undefined;
    if (!spec || !cfg) {
      toast.error("Fadlan dooro template sax ah.");
      return;
    }
    setValidating(true);
    try {
      const ctx = buildDataContext(cfg, SAMPLE_VALUES);
      const bytes = await loadTemplate(spec); // registry path → public fetch
      setValidation(await validateTemplate(spec.templateId, spec.filePath, bytes, ctx));
    } catch (e) {
      toast.error((e as Error).message || "Template-ka lama akhriyi karo.");
      setValidation(null);
    } finally {
      setValidating(false);
    }
  };

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

      {/* Template validation (Phase 3I) */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" /> Template validation
        </h2>
        <div className="notebook-page paper-grain space-y-4 rounded-md p-4">
          <p className="text-xs text-muted-foreground">
            Hubi in template-ka Word uu sax yahay ka hor generation: placeholders syntax,
            mappings la heli karo, IF/ENDIF iyo BLOCK markers balanced. Xog tijaabo ah ayaa
            la isticmaalaa — wax lama kaydin.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setValidation(null); }}>
              <SelectTrigger className="w-full bg-card/80 sm:w-72">
                <SelectValue placeholder="Dooro template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.templateId} value={t.templateId}>
                    {t.name} · V{t.version} ({t.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={runValidation} disabled={validating || !templateId}>
              {validating ? "Hubinaya…" : "Hubi template-ka"}
            </Button>
          </div>

          {validation && (
            <div className="space-y-2 border-t border-dashed border-border pt-3">
              <div className="flex items-center gap-2">
                <Badge variant={validation.valid ? "default" : "destructive"}>
                  {validation.valid ? "Sax — diyaar" : "Qalado jira"}
                </Badge>
                <span className="font-mono text-[11px] text-muted-foreground">{validation.templatePath}</span>
              </div>
              <ul className="space-y-1">
                {validation.checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pen-green" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <span>
                      {c.label}
                      {c.detail && (
                        <span className="ml-1 text-xs text-muted-foreground">— {c.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

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
