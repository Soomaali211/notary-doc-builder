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
import { NumberSelector } from "@/components/notary/NumberSelector";
import { AttendanceEditor } from "@/components/notary/AttendanceEditor";
import { StepperProgress } from "@/components/notary/StepperProgress";
import { getConfig, getSubTypeLabel } from "@/lib/notary/documents";
import {
  addRepeatableItem,
  createRepresentative,
  deleteRepresentative,
  getPartySummary,
  getReviewData,
  getSections,
  linkPartyRepresentative,
  removeRepeatableItem,
  serializeDraft,
  setAnswer,
  setPartyAttendance,
  setRepeatableAnswer,
  setRepeatableCount,
  setRepresentativeField,
  validateSectionById,
} from "@/lib/notary/engine";
import { validateDocument } from "@/lib/notary/validation";
import { getAnswer } from "@/lib/notary/engine";
import { buildFileBaseName } from "@/lib/notary/archiver";
import { generateDocument } from "@/lib/notary/pipeline";
import { deserializeDraft } from "@/lib/notary/engine";
import type {
  AttendanceStatus,
  FormValues,
  PartyDef,
  SectionDef,
} from "@/lib/notary/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  Loader2,
  Save,
  PenLine,
  UserCheck,
  Users,
} from "lucide-react";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/* ------------------------------------------------------------------ */
/* Smart interview step model                                          */
/* ------------------------------------------------------------------ */

type StepKind =
  | { kind: "section"; section: SectionDef }
  | { kind: "count"; partyDef: PartyDef }
  | { kind: "party-data"; partyDef: PartyDef }
  | { kind: "attendance"; partyDef: PartyDef };

interface InterviewStep {
  key: string;
  short: string;
  detail: StepKind;
}

/**
 * Smart Guided Interview: the section list expands into count-first →
 * data → attendance steps for every attendance-enabled party group.
 * Each answer determines what comes next; non-attendance groups (maragyo)
 * keep their classic single-section repeater step.
 */
function buildSteps(sections: SectionDef[]): InterviewStep[] {
  const steps: InterviewStep[] = [];
  for (const section of sections) {
    steps.push({ key: `sec-${section.id}`, short: section.title, detail: { kind: "section", section } });
    for (const partyDef of section.parties ?? []) {
      if (partyDef.attendance) {
        steps.push({ key: `count-${partyDef.id}`, short: `Tirada ${partyDef.label}`, detail: { kind: "count", partyDef } });
        steps.push({ key: `data-${partyDef.id}`, short: partyDef.label, detail: { kind: "party-data", partyDef } });
        steps.push({ key: `att-${partyDef.id}`, short: `Joogitaanka ${partyDef.label}`, detail: { kind: "attendance", partyDef } });
      } else {
        steps.push({ key: `party-${partyDef.id}`, short: partyDef.label, detail: { kind: "party-data", partyDef } });
      }
    }
  }
  return steps;
}

/** Somali description shown under a step title. */
function stepDescription(step: InterviewStep): string {
  switch (step.detail.kind) {
    case "section":
      return step.detail.section.description ?? "";
    case "count":
      return `Dooro tirada ${step.detail.partyDef.label.toLowerCase()} — rows-ka waa si toos ah loo abuuri doonaa.`;
    case "party-data":
      return `Buuxi xogta ${step.detail.partyDef.label.toLowerCase()} — xubin kasta gooni ah.`;
    case "attendance":
      return "Xubin kasta si gaar ah: Jooga, Ma Joogo, ama Wakiil ayaa matalaya.";
  }
}

/** One config section: scalar fields + classic (non-attendance) repeaters. */
function SectionStep({
  step,
  values,
  validation,
  stepErrors,
  setValues,
}: {
  step: Extract<InterviewStep["detail"], { kind: "section" }>;
  values: FormValues;
  validation: Record<string, import("@/lib/notary/validation").SectionErrors>;
  stepErrors: boolean;
  setValues: (updater: (v: FormValues) => FormValues) => void;
}) {
  const section = step.section;
  return (
    <>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        {section.fields.map((field) => {
          const err = stepErrors
            ? validation[section.id]?.fieldErrors[field.id]
            : undefined;
          return (
            <FieldRenderer
              key={field.id}
              field={field}
              value={getAnswer(values, section.id, field.id)}
              error={err}
              onChange={(value) => setValues((v) => setAnswer(v!, section.id, field.id, value))}
            />
          );
        })}
      </div>

      {/* Non-attendance repeaters (maragyo) render inline as before. */}
      {(section.parties ?? [])
        .filter((p) => !p.attendance)
        .map((partyDef) => (
          <div key={partyDef.id} className="mt-6 border-t border-dashed border-border pt-5">
            <PartyListEditor
              partyDef={partyDef}
              rows={values[partyDef.id] as never}
              errors={
                stepErrors
                  ? Object.fromEntries(
                      (validation[section.id]?.partyErrors[partyDef.id] ?? []).map(
                        (e) => [e.index, e.errors],
                      ),
                    )
                  : undefined
              }
              canAdd={true}
              onFieldChange={(rowIndex, fieldId, value) =>
                setValues((v) => setRepeatableAnswer(v!, partyDef.id, rowIndex, fieldId, value))
              }
              onAdd={() => setValues((v) => addRepeatableItem(v!, partyDef))}
              onRemove={(rowIndex) => setValues((v) => removeRepeatableItem(v!, partyDef, rowIndex))}
            />
          </div>
        ))}
    </>
  );
}

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
  const [saving, setSaving] = useState(false);
  const hydratedRef = useRef(false);
  const savedRef = useRef(false);
  const lastSavedJsonRef = useRef("");

  const config = useMemo(
    () => (document ? getConfig(document.documentType) : undefined),
    [document],
  );

  // load_draft: hydrate once from the stored draft, merged over a fresh
  // template via the engine so every section/party key always exists.
  useEffect(() => {
    if (!config || !document || hydratedRef.current) return;
    hydratedRef.current = true;
    setValues(deserializeDraft(config, document.valuesJson));
    if (document.status !== "draft") {
      savedRef.current = true;
    }
  }, [config, document]);

  const saveDraft = useMutation(api.notaryDocuments.saveDraft);

  const persist = useCallback(
    (next: FormValues) => {
      if (!config || !document) return;
      const json = serializeDraft(next);
      if (json === lastSavedJsonRef.current) return;
      saveDraft({
        documentId: document._id,
        payload: {
          documentType: config.id,
          documentTypeTitle: config.title,
          subType: getAnswer(next, "heshiiska", "sub_type") || document.subType,
          subTypeLabel: getSubTypeLabel(
            config,
            getAnswer(next, "heshiiska", "sub_type") || document.subType,
          ),
          referenceNumber: document.referenceNumber,
          fileBaseName:
            document.fileBaseName ||
            buildFileBaseName(config, document.referenceNumber || "DPN-K-000"),
          parties: getPartySummary(config, next),
          valuesJson: json,
        },
      })
        .then(() => {
          lastSavedJsonRef.current = json;
        })
        .catch(() => undefined);
    },
    [config, document, saveDraft],
  );

  // Autosave (debounced) — skips unchanged payloads to avoid loops.
  useEffect(() => {
    if (!values || !savedRef.current) return;
    const handle = setTimeout(() => persist(values), 800);
    return () => clearTimeout(handle);
  }, [values, persist]);

  // Mark interacted so autosave begins only after real user input.
  useEffect(() => {
    if (values && !savedRef.current) {
      const handle = setTimeout(() => (savedRef.current = true), 1200);
      return () => clearTimeout(handle);
    }
  }, [values]);

  const generateUploadUrl = useMutation(api.notaryDocuments.generateUploadUrl);
  const commitGenerated = useMutation(api.notaryDocuments.commitGenerated);

  const visibleSections: SectionDef[] = useMemo(
    () => (values && config ? getSections(config, values) : []),
    [config, values],
  );
  const steps = useMemo(() => buildSteps(visibleSections), [visibleSections]);
  const totalSteps = steps.length + 1; // + review step
  const isReview = step >= steps.length;
  const currentStep = isReview ? null : steps[step];

  const validation = useMemo(
    () => (values && config ? validateDocument(config, values) : {}),
    [values, config],
  );

  const completedSteps = useMemo(
    () =>
      new Set(
        steps
          .filter((s) => {
            if (s.detail.kind === "section") return !validation[s.detail.section.id];
            if (s.detail.kind === "count") {
              const partyDef = s.detail.partyDef;
              return (values?.[partyDef.id] as unknown[] | undefined)?.length
                ? true
                : false;
            }
            if (s.detail.kind === "party-data" || s.detail.kind === "attendance") {
              const partyDef = s.detail.partyDef;
              const sectionId = visibleSections.find((sec) =>
                (sec.parties ?? []).some((p) => p.id === partyDef.id),
              )?.id;
              return sectionId ? !validation[sectionId] : false;
            }
            return false;
          })
          .map((s) => s.key),
      ),
    [steps, validation, values, visibleSections],
  );

  const handleSaveDraft = () => {
    if (!values) return;
    savedRef.current = true;
    setSaving(true);
    persist(values);
    setTimeout(() => {
      setSaving(false);
      toast.success("Draft-ka waa la kaydiyay. Waqti kasta waad sii wadan kartaa.");
    }, 400);
  };

  /** Validation check for the CURRENT step only (inline, per-step). */
  const currentStepHasErrors = (): boolean => {
    if (!values || !config || !currentStep) return false;
    switch (currentStep.detail.kind) {
      case "section": {
        const errs = validateSectionById(config, values, currentStep.detail.section.id);
        return Boolean(
          errs &&
            (Object.keys(errs.fieldErrors).length ||
              errs.general.length ||
              Object.keys(errs.partyErrors).length),
        );
      }
      case "count": {
        return false; // count always has a value (min enforced by selector)
      }
      case "party-data":
      case "attendance": {
        const partyDef = currentStep.detail.partyDef;
        const sectionId = visibleSections.find((sec) =>
          (sec.parties ?? []).some((p) => p.id === partyDef.id),
        )?.id;
        if (!sectionId) return false;
        const errs = validateSectionById(config, values, sectionId);
        if (!errs) return false;
        const partyErrs = errs.partyErrors[partyDef.id] ?? [];
        const general = errs.general.filter((g) =>
          partyDef.attendance ? true : !g.startsWith("Wakiil"),
        );
        return partyErrs.length > 0 || general.length > 0;
      }
    }
  };

  const tryContinue = () => {
    if (!values || !config) return;
    if (!currentStep) {
      setStepErrors(false);
      handleGenerate();
      return;
    }
    if (currentStepHasErrors()) {
      setStepErrors(true);
      toast.error("Waxaa jira xog aan dhammaystirnayn. Fadlan sax meelaha lagu calaamadeeyay.");
      return;
    }
    setStepErrors(false);
    persist(values);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const handleGenerate = async () => {
    if (!values || !config || !document) return;
    setGenerating(true);
    try {
      const allErrors = validateDocument(config, values);
      const errorSections = Object.keys(allErrors);
      if (errorSections.length > 0) {
        const idx = steps.findIndex((s) => {
          if (s.detail.kind === "section") return s.detail.section.id === errorSections[0];
          if (s.detail.kind === "party-data" || s.detail.kind === "attendance") {
            const pd = s.detail.partyDef;
            return visibleSections.some(
              (sec) =>
                sec.id === errorSections[0] &&
                (sec.parties ?? []).some((p) => p.id === pd.id),
            );
          }
          return false;
        });
        if (idx >= 0) setStep(idx);
        setStepErrors(true);
        toast.error("Weli waxaa jira qalado — fadlan sax.");
        setGenerating(false);
        return;
      }

      // Phase 3: the user-entered reference is the source of truth —
      // it is never auto-incremented.
      const referenceNumber = (
        getAnswer(values, "heshiiska", "reference") ||
        document.referenceNumber ||
        ""
      ).trim();
      if (!referenceNumber) {
        setStep(0);
        setStepErrors(true);
        toast.error("Fadlan geli nambarka tixraaca (Reference Number).");
        setGenerating(false);
        return;
      }

      const subType = getAnswer(values, "heshiiska", "sub_type") || document.subType;
      const subTypeLabel = getSubTypeLabel(config, subType);

      // Full Phase 3 pipeline: validate answers → registry template →
      // validate template → data context → conditions → clauses →
      // repeaters → placeholders → DOCX → validate output → PDF (best effort).
      const out = await generateDocument({
        config,
        values,
        referenceNumber,
        subTypeLabel,
      });

      // Hand the generated DOCX to the user immediately.
      const a = window.document.createElement("a");
      a.href = URL.createObjectURL(out.result.blob);
      a.download = out.result.fileName;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);

      const uploadUrl = await generateUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": DOCX_MIME },
        body: out.result.blob,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };

      await commitGenerated({
        documentId: document._id,
        storageId,
        payload: {
          documentType: config.id,
          documentTypeTitle: config.title,
          subType,
          subTypeLabel,
          referenceNumber,
          fileBaseName: out.result.fileName.replace(/\.docx$/, ""),
          parties: getPartySummary(config, values),
          valuesJson: serializeDraft(values),
        },
        metadata: {
          templateId: out.result.templateId,
          templateVersion: out.result.templateVersion,
          outputDocxPath: out.result.outputDocxPath,
          outputPdfPath: out.result.outputPdfPath,
          fileName: out.result.fileName,
        },
      });

      if (out.warnings.length > 0) {
        toast.message("Dukumeentiga DOCX waa la sameeyay", {
          description: out.warnings.join(" "),
        });
      } else {
        toast.success("Dukumeentiga waa la sameeyay oo la kaydiyay!");
      }
      navigate(`/archive/${document._id}`);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        msg.startsWith("Template Error") || msg.startsWith("Output Error")
          ? msg
          : "Abuuritaanku wuu fashilmay — xogtaada weli way kaydsan tahay. Fadlan isku day mar kale.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const reviewBlocks = isReview && values && config ? getReviewData(config, values) : [];
  const progressPct = Math.round(((step + 1) / totalSteps) * 100);

  if (!document || !config || !values) {
    return (
      <main className="notebook-bg min-h-screen p-6">
        <div className="neu-raised mx-auto max-w-3xl space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (document.status === "generated") {
    return (
      <main className="notebook-bg min-h-screen p-6">
        <div className="neu-raised mx-auto max-w-xl p-8 text-center">
          <Check className="mx-auto size-8 text-pen-green" />
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

  /* ---------------------------------------------------------------- */
  /* Step renderers                                                    */
  /* ---------------------------------------------------------------- */

  const renderCountStep = (partyDef: PartyDef) => {
    const count = ((values[partyDef.id] as unknown[] | undefined) ?? []).length;
    return (
      <div className="space-y-5">
        <div className="neu-inset p-5">
          <p className="text-sm text-muted-foreground">
            Imisa {partyDef.singular} ayaa heshiiska ku jira?
          </p>
          <div className="mt-3">
            <NumberSelector
              value={count}
              min={partyDef.min}
              max={partyDef.max}
              label={partyDef.singular}
              onChange={(next) => setValues((v) => setRepeatableCount(v!, partyDef, next))}
            />
          </div>
          <p className="reveal-enter mt-3 text-xs text-muted-foreground" aria-live="polite">
            {count} {partyDef.singular} waa la abuuray — xogta waa lagu soo bandhigi doonaa tallaabada xigta.
          </p>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="neu-raised-sm flex items-center gap-2 p-3 text-sm">
              <span className="neu-dot flex size-6 items-center justify-center text-[10px] font-bold text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              {partyDef.singular} {i + 1}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPartyDataStep = (partyDef: PartyDef) => {
    const rows = (values[partyDef.id] as FormValues[keyof FormValues]) ?? [];
    const sectionId = visibleSections.find((sec) =>
      (sec.parties ?? []).some((p) => p.id === partyDef.id),
    )?.id;
    const rowErrMap = Object.fromEntries(
      (sectionId ? (validation[sectionId]?.partyErrors[partyDef.id] ?? []) : []).map(
        (e) => [e.index, e.errors],
      ),
    );
    return (
      <PartyListEditor
        partyDef={partyDef}
        rows={rows as never}
        errors={stepErrors ? rowErrMap : undefined}
        canAdd={true}
        onFieldChange={(rowIndex, fieldId, value) =>
          setValues((v) => setRepeatableAnswer(v!, partyDef.id, rowIndex, fieldId, value))
        }
        onAdd={() => setValues((v) => addRepeatableItem(v!, partyDef))}
        onRemove={(rowIndex) => setValues((v) => removeRepeatableItem(v!, partyDef, rowIndex))}
      />
    );
  };

  const renderAttendanceStep = (partyDef: PartyDef) => {
    const sectionId = visibleSections.find((sec) =>
      (sec.parties ?? []).some((p) => p.id === partyDef.id),
    )?.id;
    const rowErrMap = Object.fromEntries(
      (sectionId ? (validation[sectionId]?.partyErrors[partyDef.id] ?? []) : []).map(
        (e) => [e.index, e.errors],
      ),
    );
    return (
      <AttendanceEditor
        partyDef={partyDef}
        values={values}
        errors={stepErrors ? rowErrMap : undefined}
        onSetStatus={(partyId, rowIndex, status: AttendanceStatus) =>
          setValues((v) => setPartyAttendance(v!, partyId, rowIndex, status))
        }
        onLinkRep={(partyId, rowIndex, repId) =>
          setValues((v) => linkPartyRepresentative(v!, partyId, rowIndex, repId))
        }
        onCreateRep={() => setValues((v) => createRepresentative(v!, partyDef))}
        onUpdateRep={(repId, fieldId, value) =>
          setValues((v) => setRepresentativeField(v!, partyDef, repId, fieldId, value))
        }
        onRemoveRep={(repId) => setValues((v) => deleteRepresentative(v!, partyDef, repId))}
      />
    );
  };

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
              {config.title} · {getSubTypeLabel(config, getAnswer(values, "heshiiska", "sub_type") || document.subType)}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {isReview ? "Dib u Eegis & Abuur" : (currentStep?.short ?? "")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="notebook-annotation hidden text-xs text-muted-foreground sm:inline">
              {lastSavedJsonRef.current ? "La kaydiyay ✓" : "Weli lama kaydin"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleSaveDraft}
              disabled={generating}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Draft
            </Button>
            <div className="text-right">
              <span className="highlight-sweep text-sm font-semibold">
                Tallaabada {Math.min(step + 1, totalSteps)}/{totalSteps}
              </span>
              <Progress value={progressPct} className="mt-1 h-1.5 w-40" />
            </div>
          </div>
        </div>

        {/* Compact stepper — mobile/tablet */}
        <div className="mb-5 lg:hidden">
          <StepperProgress
            steps={steps.map((s) => s.short)}
            current={Math.min(step, steps.length - 1)}
            review={isReview}
            reviewLabel="Dib u Eegis"
            completed={new Set(
              steps.map((s) => s.key).filter((k) => completedSteps.has(k)),
            )}
            keys={steps.map((s) => s.key)}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Stepper sidebar — neumorphic, numbered */}
          <nav className="hidden lg:block" aria-label="Tusmada tallaabada">
            <div className="neu-raised sticky top-4 p-3">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <ClipboardList className="size-3.5" /> Tusmada
              </p>
              <ol className="space-y-1">
                {steps.map((s, i) => {
                  const done = completedSteps.has(s.key);
                  const isCurrent = i === step;
                  const clickable = i <= step;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => clickable && setStep(i)}
                        aria-current={isCurrent ? "step" : undefined}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-all ${
                          isCurrent
                            ? "neu-inset glow-primary-sm font-semibold text-primary"
                            : done
                              ? "text-foreground/80 hover:text-foreground"
                              : "cursor-not-allowed text-muted-foreground/50"
                        }`}
                      >
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center text-[10px] font-bold tabular-nums ${
                            done
                              ? "neu-dot-done"
                              : isCurrent
                                ? "neu-dot-active"
                                : "neu-dot text-muted-foreground"
                          }`}
                        >
                          {done ? <Check className="size-3" /> : String(i + 1).padStart(2, "0")}
                        </span>
                        {s.short}
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={() => step >= steps.length && setStep(steps.length)}
                    aria-current={isReview ? "step" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-all ${
                      isReview
                        ? "neu-inset glow-primary-sm font-semibold text-primary"
                        : "cursor-not-allowed text-muted-foreground/50"
                    }`}
                  >
                    <span
                      className={`neu-dot flex size-6 shrink-0 items-center justify-center text-[10px] font-bold ${
                        isReview ? "neu-dot-active" : "text-muted-foreground"
                      }`}
                    >
                      <PenLine className="size-3" />
                    </span>
                    Dib u Eegis
                  </button>
                </li>
              </ol>
            </div>
          </nav>

          {/* Content page */}
          <section
            key={step}
            className="neu-raised step-enter px-6 py-6 sm:px-8"
          >
            {!isReview && currentStep && (
              <>
                <header className="mb-5">
                  <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                    Tallaabada {String(Math.min(step + 1, totalSteps)).padStart(2, "0")}
                  </p>
                  <h2 className="highlight-sweep mt-1 inline-block text-lg font-bold">
                    {currentStep.short}
                  </h2>
                  {stepDescription(currentStep) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stepDescription(currentStep)}
                    </p>
                  )}
                </header>

                {currentStep.detail.kind === "section" && (
                  <SectionStep
                    step={currentStep.detail}
                    values={values}
                    validation={validation}
                    stepErrors={stepErrors}
                    setValues={(updater) =>
                      setValues((v) => (v ? updater(v) : v))
                    }
                  />
                )}

                {currentStep.detail.kind === "count" && renderCountStep(currentStep.detail.partyDef)}
                {currentStep.detail.kind === "party-data" && renderPartyDataStep(currentStep.detail.partyDef)}
                {currentStep.detail.kind === "attendance" && renderAttendanceStep(currentStep.detail.partyDef)}

                {stepErrors && currentStep.detail.kind === "section" && (() => {
                  const section = currentStep.detail.section;
                  return (validation[section.id]?.general ?? []).map((g, i) => (
                    <p key={i} className="mt-4 text-sm font-medium text-destructive">
                      ✗ {g}
                    </p>
                  ));
                })()}
                {stepErrors && currentStep.detail.kind === "attendance" && (() => {
                  const pd = currentStep.detail.partyDef;
                  const secId = visibleSections.find((sec) =>
                    (sec.parties ?? []).some((p) => p.id === pd.id),
                  )?.id;
                  if (!secId) return null;
                  const general = (validation[secId]?.general ?? []).filter(
                    (g) => g.includes("Wakiil") || g.includes("marag"),
                  );
                  return general.map((g, i) => (
                    <p key={i} className="mt-4 text-sm font-medium text-destructive">
                      ✗ {g}
                    </p>
                  ));
                })()}
              </>
            )}

            {isReview && (
              <>
                <header className="mb-5">
                  <h2 className="highlight-sweep inline-block text-lg font-bold">Dib u Eegis</h2>
                  <p className="notebook-annotation mt-1 text-sm text-muted-foreground">
                    Hubi xogta oo dhan — guji "Wax ka beddel" si aad ugu noqoto qayb kasta.
                  </p>
                </header>
                {reviewBlocks.length === 0 && (
                  <p className="text-sm text-muted-foreground">Weli wax xog ah lama buuxin.</p>
                )}
                <div className="space-y-4">
                  {reviewBlocks.map((block) => {
                    const idx = steps.findIndex((s) =>
                      s.detail.kind === "section" ? s.detail.section.id === block.sectionId : false,
                    );
                    const fallbackIdx = visibleSections.findIndex((s) => s.id === block.sectionId);
                    const target = idx >= 0 ? idx : fallbackIdx;
                    return (
                      <div key={block.sectionId} className="neu-inset p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">{block.sectionTitle}</h3>
                          {target >= 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => {
                                setStep(target);
                                setStepErrors(false);
                              }}
                            >
                              Wax ka beddel
                            </Button>
                          )}
                        </div>
                        <ul className="divide-y divide-dashed divide-border/70">
                          {block.rows.map((row, i) => (
                            <li key={i} className="grid grid-cols-[minmax(120px,180px)_1fr] gap-2 py-1.5 text-sm">
                              <span className="font-medium text-muted-foreground">{row.label}</span>
                              <span className="text-foreground">{row.value}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <p className="notebook-annotation mt-3 text-xs text-muted-foreground">
                  Markaad gujiso "Abuur Dukumeenti" waxaa la abuurayaa DOCX ka template-kaaga
                  Word-ka, ka dibna waa la kaydinayaa kaydka.
                </p>
              </>
            )}

            {/* Sticky navigation — floating soft bar */}
            <div className="neu-raised-sm sticky bottom-4 mt-8 flex items-center justify-between gap-2 px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || generating}
                className="gap-2"
              >
                <ArrowLeft className="size-4" /> Dib
              </Button>
              <span className="notebook-annotation text-xs text-muted-foreground">
                {step + 1}/{totalSteps}
              </span>
              {isReview ? (
                <Button
                  type="button"
                  onClick={tryContinue}
                  disabled={generating}
                  className="glow-primary-sm gap-2"
                >
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
                <Button type="button" onClick={tryContinue} className="glow-primary-sm gap-2">
                  Sii wad <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
