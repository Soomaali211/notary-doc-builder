import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldRenderer } from "@/components/notary/FieldRenderer";
import { PartyListEditor } from "@/components/notary/PartyListEditor";
import { getConfig, getSubTypeLabel } from "@/lib/notary/documents";
import { evaluateCondition, makeGetter } from "@/lib/notary/conditions";
import {
  addPartyRow,
  buildPartySummary,
  createInitialValues,
  getPartyRows,
  getSectionValues,
  removePartyRow,
  updatePartyField,
  updateSectionField,
} from "@/lib/notary/formValues";
import { collectFilledValues, validateDocument } from "@/lib/notary/validation";
import { buildFileBaseName, fillTemplate } from "@/lib/notary/template";
import type { FormValues, SectionDef } from "@/lib/notary/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  Loader2,
  PenLine,
} from "lucide-react";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function NewDocumentInterview() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const document = useQuery(api.notaryDocuments.getDocument, {
    documentId: docId as Id<"notary_documents">,
  });

  const [values, setValues] = useState<FormValues | null>(null);
  const [step, setStep] = useState(0);
  const [stepErrors, setStepErrors] = useState(false);
  const [generating, setGenerating] = useState(false);
  const hydratedRef = useRef(false);
  const savedRef = useRef(false);

  const config = useMemo(
    () => (document ? getConfig(document.documentType) : undefined),
    [document],
  );

  // Hydrate once from the draft (or initialize fresh values). Stored
  // drafts are merged over a fresh template so every section/party key
  // always exists even if the config grew since the draft was saved.
  useEffect(() => {
    if (!config || !document || hydratedRef.current) return;
    hydratedRef.current = true;
    const fresh = createInitialValues(config);
    if (document.valuesJson && document.valuesJson !== "{}") {
      try {
        const parsed = JSON.parse(document.valuesJson) as FormValues;
        if (parsed && typeof parsed === "object") {
          setValues({ ...fresh, ...parsed });
          return;
        }
      } catch {
        // fall through to fresh values
      }
    }
    setValues(fresh);
  }, [config, document]);

  const saveDraft = useMutation(api.notaryDocuments.saveDraft);
  const lastSavedJsonRef = useRef<string>("");

  // Autosave (debounced) — user data is never lost. Skips saves when the
  // serialized values are unchanged so the reactive query refetch that
  // follows a save cannot re-trigger another save (no loops).
  useEffect(() => {
    if (!values || !config || !document || !savedRef.current) return;
    const json = JSON.stringify(values);
    if (json === lastSavedJsonRef.current) return;
    const handle = setTimeout(() => {
      saveDraft({
        documentId: document._id,
        payload: {
          documentType: config.id,
          documentTypeTitle: config.title,
          subType: getSectionValues(values, "heshiiska").sub_type || document.subType,
          subTypeLabel:
            getSubTypeLabel(config, getSectionValues(values, "heshiiska").sub_type || document.subType),
          referenceNumber: document.referenceNumber,
          fileBaseName:
            document.fileBaseName || buildFileBaseName(config, document.referenceNumber || "DPN-K-000"),
          parties: buildPartySummary(config, values),
          valuesJson: json,
        },
      })
        .then(() => {
          lastSavedJsonRef.current = json;
        })
        .catch(() => undefined);
    }, 800);
    return () => clearTimeout(handle);
  }, [values, config, document, saveDraft]);

  const nextReference = useMutation(api.notaryDocuments.nextReference);
  const generateUploadUrl = useMutation(api.notaryDocuments.generateUploadUrl);
  const commitGenerated = useMutation(api.notaryDocuments.commitGenerated);

  const steps: SectionDef[] = config?.sections ?? [];
  const totalSteps = steps.length + 1; // + review step
  const isReview = step === steps.length;

  const get = useMemo(
    () => (values ? makeGetter(values) : () => undefined),
    [values],
  );

  const visibleFields = useCallback(
    (section: SectionDef) => {
      if (!section.fields) return [];
      return section.fields.filter(
        (f) => !("visibleWhen" in f) || evaluateCondition(f.visibleWhen, get),
      );
    },
    [get],
  );

  const validation = useMemo(
    () => (values && config ? validateDocument(config, values) : {}),
    [values, config],
  );

  const sectionHasErrors = useCallback(
    (sectionId: string) => validation[sectionId] !== undefined,
    [validation],
  );

  // Enable autosave only after the user has interacted (avoid empty overwrites).
  useEffect(() => {
    if (values && !savedRef.current) {
      const handle = setTimeout(() => (savedRef.current = true), 1200);
      return () => clearTimeout(handle);
    }
  }, [values]);

  if (!document || !config || !values) {
    return (
      <main className="notebook-bg min-h-screen p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (document.status === "generated") {
    return (
      <main className="min-h-screen p-6">
        <div className="notebook-page paper-grain mx-auto max-w-xl rounded-md p-8 text-center">
          <Check className="mx-auto size-8 text-primary" />
          <h1 className="mt-3 text-xl font-semibold">Dukumeentigan horey loo sameeyay</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Waxaa lagu kaydiyay kaydka heshiisyada.
          </p>
          <Button className="mt-5" onClick={() => navigate(`/archive/${document._id}`)}>
            Fur Kaydka
          </Button>
        </div>
      </main>
    );
  }

  const currentSection = isReview ? null : steps[step];

  const tryContinue = () => {
    if (!currentSection) {
      setStepErrors(false);
      handleGenerate();
      return;
    }
    const errs = validateDocument(config, values)[currentSection.id];
    if (errs && (Object.keys(errs.fieldErrors).length || errs.general.length || Object.keys(errs.partyErrors).length)) {
      setStepErrors(true);
      toast.error("Fadlan sax qaladaha ka hor intaadan sii wadin.");
      return;
    }
    setStepErrors(false);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const allErrors = validateDocument(config, values);
      const errorSections = Object.keys(allErrors);
      if (errorSections.length > 0) {
        const idx = steps.findIndex((s) => s.id === errorSections[0]);
        if (idx >= 0) setStep(idx);
        setStepErrors(true);
        toast.error("Weli waxaa jira qalado — fadlan sax.");
        setGenerating(false);
        return;
      }

      // 1. Reference number (sequential per user).
      const referenceNumber =
        document.referenceNumber || (await nextReference({ prefix: config.referencePrefix }));

      // 2. Fill the user's Word template.
      const templateRes = await fetch(config.templatePath);
      if (!templateRes.ok) throw new Error("Template lama helin");
      const templateBytes = await templateRes.arrayBuffer();
      const blob = await fillTemplate(templateBytes, config, values);

      // 3. Immediate browser download (output/Kiro/ is mirrored by browser).
      const baseName = buildFileBaseName(config, referenceNumber);
      const a = window.document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${baseName}.docx`;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);

      // 4. Upload + commit (rollback-safe: draft survives any failure below).
      const uploadUrl = await generateUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": DOCX_MIME },
        body: blob,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };

      await commitGenerated({
        documentId: document._id,
        storageId,
        payload: {
          documentType: config.id,
          documentTypeTitle: config.title,
          subType: getSectionValues(values, "heshiiska").sub_type || document.subType,
          subTypeLabel: getSubTypeLabel(
            config,
            getSectionValues(values, "heshiiska").sub_type || document.subType,
          ),
          referenceNumber,
          fileBaseName: baseName,
          parties: buildPartySummary(config, values),
          valuesJson: JSON.stringify(values),
        },
      });

      toast.success("Dukumeentiga waa la sameeyay oo la kaydiyay!");
      navigate(`/archive/${document._id}`);
    } catch (err) {
      console.error(err);
      toast.error(
        "Abuuritaanku wuu fashilmay — xogtaada weli way kaydsan tahay. Fadlan isku day mar kale.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const filledSummary = isReview ? collectFilledValues(config, values) : [];
  const progressPct = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <main className="notebook-bg min-h-screen pb-24">
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <button
          type="button"
          onClick={() => navigate("/new")}
          className="mb-3 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          ← Notary Doc Builder / New Document
        </button>
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="notebook-annotation text-sm text-muted-foreground">
              {config.title} · {getSubTypeLabel(config, getSectionValues(values, "heshiiska").sub_type || document.subType)}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {isReview ? "Dib u Eegis & Abuur" : (currentSection?.title ?? "")}
            </h1>
          </div>
          <div className="text-right">
            <span className="highlight-sweep text-sm font-semibold">
              Tallaabada {Math.min(step + 1, totalSteps)}/{totalSteps}
            </span>
            <Progress value={progressPct} className="mt-1 h-1.5 w-40" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Section index (notebook tabs) */}
          <nav className="hidden lg:block">
            <div className="notebook-page paper-grain rounded-md p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <ClipboardList className="size-3.5" /> Tusmada
              </p>
              <ol className="space-y-0.5">
                {steps.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => i <= step && setStep(i)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors ${
                        i === step
                          ? "bg-primary/10 font-semibold text-primary"
                          : i < step
                            ? "text-foreground/70 hover:bg-muted"
                            : "cursor-not-allowed text-muted-foreground/60"
                      }`}
                    >
                      <span
                        className={`flex size-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                          i < step
                            ? "border-primary bg-primary text-primary-foreground"
                            : i === step
                              ? "border-primary text-primary"
                              : "border-border text-muted-foreground"
                        }`}
                      >
                        {i < step ? <Check className="size-2.5" /> : i + 1}
                      </span>
                      {s.title}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => step >= steps.length && setStep(steps.length)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${
                      isReview
                        ? "bg-primary/10 font-semibold text-primary"
                        : "cursor-not-allowed text-muted-foreground/60"
                    }`}
                  >
                    <PenLine className="size-3.5" /> Dib u Eegis
                  </button>
                </li>
              </ol>
            </div>
          </nav>

          {/* Content page */}
          <section className="notebook-page paper-grain spiral-edge rounded-md px-6 py-6 sm:px-8">
            {!isReview && currentSection && (
              <>
                <header className="mb-5">
                  <h2 className="highlight-sweep inline-block text-lg font-bold">
                    {currentSection.title}
                  </h2>
                  {currentSection.description && (
                    <p className="notebook-annotation mt-1 text-sm text-muted-foreground">
                      {currentSection.description}
                    </p>
                  )}
                </header>

                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  {visibleFields(currentSection).map((field) => {
                    const err = stepErrors
                      ? validation[currentSection.id]?.fieldErrors[field.id]
                      : undefined;
                    return (
                      <FieldRenderer
                        key={field.id}
                        field={field}
                        value={getSectionValues(values, currentSection.id)[field.id] ?? ""}
                        error={err}
                        onChange={(value) =>
                          setValues((v) =>
                            updateSectionField(v!, currentSection.id, field.id, value),
                          )
                        }
                      />
                    );
                  })}
                </div>

                {(currentSection.parties ?? []).map((partyDef) => {
                  const rows = getPartyRows(values, partyDef.id);
                  const rowErrMap = Object.fromEntries(
                    (validation[currentSection.id]?.partyErrors[partyDef.id] ?? []).map(
                      (e) => [e.index, e.errors],
                    ),
                  );
                  return (
                    <div key={partyDef.id} className="mt-6 border-t border-dashed border-border pt-5">
                      <PartyListEditor
                        partyDef={partyDef}
                        rows={rows}
                        errors={stepErrors ? rowErrMap : undefined}
                        onFieldChange={(rowIndex, fieldId, value) =>
                          setValues((v) =>
                            updatePartyField(v!, partyDef.id, rowIndex, fieldId, value),
                          )
                        }
                        onAdd={() => setValues((v) => addPartyRow(v!, partyDef))}
                        onRemove={(rowIndex) =>
                          setValues((v) => removePartyRow(v!, partyDef, rowIndex))
                        }
                      />
                    </div>
                  );
                })}

                {stepErrors && validation[currentSection.id]?.general.map((g, i) => (
                  <p key={i} className="mt-4 text-sm font-medium text-destructive">
                    ✗ {g}
                  </p>
                ))}
              </>
            )}

            {isReview && (
              <>
                <header className="mb-5">
                  <h2 className="highlight-sweep inline-block text-lg font-bold">
                    Dib u Eegis
                  </h2>
                  <p className="notebook-annotation mt-1 text-sm text-muted-foreground">
                    Hubi xogta oo dhan ka hor intaadan abuurto dukumeentiga.
                  </p>
                </header>
                <div className="rounded-md border border-border/70 bg-card/60 p-4">
                  {filledSummary.length === 0 && (
                    <p className="text-sm text-muted-foreground">Weli wax xog ah lama buuxin.</p>
                  )}
                  <ul className="divide-y divide-dashed divide-border/70">
                    {filledSummary.map((row, i) => (
                      <li key={i} className="grid grid-cols-[minmax(120px,180px)_1fr] gap-2 py-1.5 text-sm">
                        <span className="font-medium text-muted-foreground">{row.label}</span>
                        <span className="text-foreground">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="notebook-annotation mt-3 text-xs text-muted-foreground">
                  Markaad gujiso "Abuur Dukumeenti" waxaa la abuurayaa DOCX ka template-kaaga
                  Word-ka, ka dibna waa la kaydinayaa kaydka.
                </p>
              </>
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between border-t border-dashed border-border pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || generating}
                className="gap-2"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              <span className="notebook-annotation text-xs text-muted-foreground">
                {step + 1}/{totalSteps}
              </span>
              {isReview ? (
                <Button type="button" onClick={tryContinue} disabled={generating} className="gap-2">
                  {generating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> La abuurayo…
                    </>
                  ) : (
                    <>
                      <FileText className="size-4" /> Abuur Dukumeenti
                    </>
                  )}
                </Button>
              ) : (
                <Button type="button" onClick={tryContinue} className="gap-2">
                  Next <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
