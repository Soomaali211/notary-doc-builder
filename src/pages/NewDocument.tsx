import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { documentConfigs } from "@/lib/notary/documents";
import { cn } from "@/lib/utils";
import { ArrowRight, FileSignature, Loader2 } from "lucide-react";

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
    <main className="notebook-bg min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <p className="notebook-annotation text-sm text-muted-foreground">Dukumeenti cusub</p>
        <h1 className="text-3xl font-bold tracking-tight">Doorto Nooca Dukumeentiga</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Marka hore nooca, kadibna sub-type-ka — kadib waxaad geli doontaa waraysi hagid ah.
        </p>

        {/* Step 1: document type */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            1. Nooca
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documentConfigs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setTypeId(c.id);
                  setSubType(null);
                }}
                className={cn(
                  "notebook-page paper-grain group rounded-md p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                  typeId === c.id && "ring-2 ring-primary",
                )}
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileSignature className="size-5" />
                </div>
                <p className="font-semibold">{c.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{c.description}</p>
              </button>
            ))}

            {/* Future document types preview (disabled) */}
            {["Heshiis Deyn", "Heshiis Wakiilnimo", "Kala Iibsi Hanti"].map((name) => (
              <div
                key={name}
                className="rounded-md border border-dashed border-border/80 p-5 opacity-60"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileSignature className="size-5" />
                </div>
                <p className="font-semibold">{name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mustaqbalka — weli lama hirgelin
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Step 2: sub-type */}
        {config && (
          <section className="mt-10">
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              2. Sub-Type
            </h2>
            <div className="flex flex-wrap gap-3">
              {config.subTypes.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSubType(s.value)}
                  className={cn(
                    "notebook-page paper-grain rounded-md px-5 py-3 text-sm font-medium transition-all hover:-translate-y-0.5",
                    subType === s.value && "ring-2 ring-primary",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <Button onClick={start} disabled={!subType || creating} className="gap-2">
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> La diyaarinayo…
                  </>
                ) : (
                  <>
                    Bilow Waraysiga <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
