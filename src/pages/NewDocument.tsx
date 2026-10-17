import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { saveAgreement } from "@/lib/notary/localRepository";
import { AppShellWithLang } from "@/components/notary/AppShell";
import { useLang } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { documentConfigs, upcomingDocumentTypes } from "@/lib/notary/documents";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";

/** Step one of the workflow: pick a document type, then a sub-type. */
export default function NewDocument() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [subType, setSubType] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const config = documentConfigs.find((c) => c.id === typeId) ?? null;

  /**
   * §3 — the draft is created in the LOCAL database. There is no account to
   * sign into and no server to wait for, so the interview opens the moment
   * the row exists.
   */
  const start = async (pickedId?: string) => {
    const effectiveId = pickedId ?? typeId;
    const config = documentConfigs.find((c) => c.id === effectiveId) ?? null;
    if (!config || (!subType && config.subTypes.length > 0)) return;
    setCreating(true);
    try {
      // A type with NO sub-types (Cadayn Cilaaj) creates its draft the
      // moment the type is picked — there is no Step 2 for it. The label
      // still comes from the type's own identity, never a guessed value.
      const sub =
        config.subTypes.find((s) => s.value === subType) ??
        ({ value: "", label: config.title } as (typeof config.subTypes)[number]);
      const created = await saveAgreement({
        documentType: config.id,
        documentTypeTitle: config.title,
        subType: sub.value,
        subTypeLabel: sub.label,
        // The reference is allocated once the interview knows the document's
        // date; until then the draft simply has none.
        referenceNumber: "",
        status: "draft",
        valuesJson: "{}",
      });
      navigate(`/documents/${created.id}`);
    } catch (err) {
      console.error("[localStore] draft could not be created:", err);
      toast.error(t("ndCreateFail"));
      setCreating(false);
    }
  };

  return (
    <AppShellWithLang title={t("ndTitle")} subtitle={t("ndSub")}>
      {/* Step 1: document type — radio cards */}
      <section aria-label={t("ndStep1")}>
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("ndStep1")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label={t("ndStep1")}>
          {documentConfigs.map((c, i) => {
            const selected = typeId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setTypeId(c.id);
                  setSubType(null);
                }}
                className={cn(
                  "neu-raised group relative p-5 text-left transition-lift focus-visible:outline-2 focus-visible:outline-ring",
                  selected && "glow-primary -translate-y-0.5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.title}</p>
                  {selected ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  ) : (
                    <Badge className="hl-green text-[10px]">{t("ndReady")}</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{c.description}</p>
                {/* A type with NO sub-types starts immediately — no Step 2
                    exists for it, so its card IS its start button. */}
                {c.subTypes.length === 0 && (
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={creating}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTypeId(c.id);
                      start(c.id);
                    }}
                  >
                    {t("ndStartNow")}
                  </Button>
                )}
              </button>
            );
          })}
          {upcomingDocumentTypes.slice(0, 2).map((c) => (
            <div key={c.id} className="neu-inset p-5 opacity-60">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{c.title}</p>
                <Badge variant="secondary" className="text-[10px]">{t("ndPlanned")}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("ndPlannedNote")}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Step 2: sub-type — skipped entirely for types with no sub-types
          (Cadayn Cilaaj): their Start button lives on the type card itself. */}
      {config && config.subTypes.length > 0 && (
        <section className="mt-10" aria-label={t("ndStep2Rental")}>
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {config.id === "heshiis_kiro" ? t("ndStep2Rental") : t("ndStep2Property")}
          </h2>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={config.id === "heshiis_kiro" ? t("ndStep2Rental") : t("ndStep2Property")}>
            {config.subTypes.map((s) => {
              const selected = subType === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSubType(s.value)}
                  className={cn(
                    "neu-raised-sm flex min-h-11 items-center gap-2 px-5 py-3 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring",
                    selected && "glow-primary-sm text-primary",
                  )}
                >
                  {selected && <Sparkles className="size-3.5 text-primary" />}
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <p className="notebook-annotation text-xs text-muted-foreground">
              {t("ndInterviewHint")}
            </p>
            <Button onClick={() => start()} disabled={!subType || creating} className="gap-2">
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {t("ndPreparing")}
                </>
              ) : (
                <>
                  {t("ndStartInterview")} <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </section>
      )}
    </AppShellWithLang>
  );
}
