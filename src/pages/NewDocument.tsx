import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/notary/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { documentConfigs, upcomingDocumentTypes } from "@/lib/notary/documents";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";

/** Step one of the workflow: pick a document type, then a sub-type. */
export default function NewDocument() {
  const navigate = useNavigate();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [subType, setSubType] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const createDraft = useMutation(api.notaryDocuments.createDraft);
  const config = documentConfigs.find((c) => c.id === typeId) ?? null;

  const start = async () => {
    if (!config || !subType) return;
    setCreating(true);
    try {
      const sub = config.subTypes.find((s) => s.value === subType);
      const id = await createDraft({
        documentType: config.id,
        documentTypeTitle: config.title,
        subType: sub!.value,
        subTypeLabel: sub!.label,
      });
      navigate(`/documents/${id}`);
    } catch {
      toast.error("Lama abuuri karin draft — fadlan isku day mar kale.");
      setCreating(false);
    }
  };

  return (
    <AppShell
      title="New Document"
      subtitle="Dooro nooca heshiiska, kadibna nooca hoose — su'aalaha waxay la socdaan doorashadaada."
    >
      {/* Step 1: document type — radio cards */}
      <section aria-label="1 · Nooca Heshiiska">
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          1 · Nooca Heshiiska
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Nooca Heshiiska">
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
                  "notebook-page paper-grain group relative rounded-md p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring",
                  selected && "ring-2 ring-primary shadow-md",
                  !selected && i % 3 === 1 && "border-t-4 border-t-pen-green/50",
                  !selected && i % 3 === 2 && "border-t-4 border-t-pen-orange/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.title}</p>
                  {selected ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  ) : (
                    <Badge className="hl-green text-[10px]">Ready</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{c.description}</p>
              </button>
            );
          })}
          {upcomingDocumentTypes.slice(0, 2).map((c) => (
            <div
              key={c.id}
              className="rounded-md border border-dashed border-border/80 p-5 opacity-60"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{c.title}</p>
                <Badge variant="secondary" className="text-[10px]">Planned</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Weli lama dhisin — eeg catalog-ka si aad u aragto waxa imanaya.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Step 2: sub-type */}
      {config && (
        <section className="mt-10" aria-label="2 · Nooca Kirada">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            2 · Nooca Kirada
          </h2>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Nooca Kirada">
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
                    "notebook-page paper-grain flex min-h-11 items-center gap-2 rounded-md px-5 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring",
                    selected && "ring-2 ring-primary shadow-sm",
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
              Markaad bilowdo waxaa lagu hagayaa tallaabada tallaabada — tirada xubnaha, xogta,
              joogitaanka iyo wakiillada.
            </p>
            <Button onClick={start} disabled={!subType || creating} className="gap-2">
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Diyaarinaya…
                </>
              ) : (
                <>
                  Bilow Su'aalaha <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </section>
      )}
    </AppShell>
  );
}
