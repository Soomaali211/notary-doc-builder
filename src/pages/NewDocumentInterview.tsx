import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FieldRenderer } from "@/components/notary/FieldRenderer";
import { PartyListEditor } from "@/components/notary/PartyListEditor";
import { PartyStatusEditor } from "@/components/notary/PartyStatusEditor";
import { StepperProgress } from "@/components/notary/StepperProgress";
import { SetupField } from "@/components/notary/SetupField";
import { SetupSummaryCard } from "@/components/notary/SetupSummaryCard";
import {
  buildConditionalWorkflow,
  isSetupComplete,
  readAgreementSetup,
} from "@/lib/notary/agreementSetup";
import { getConfig, getSubTypeLabel } from "@/lib/notary/documents";
import {
  addRepeatableItem,
  createRepresentative,
  deleteRepresentative,
  ensurePartyRepresentative,
  getPartySummary,
  getReviewData,
  getSections,
  linkPartyRepresentative,
  removeRepeatableItem,
  serializeDraft,
  setAnswer,
  setPartyAttendance,
  setRepeatableAnswer,
  setRepresentativeField,
  validateSectionById,
} from "@/lib/notary/engine";
import { validateDocument } from "@/lib/notary/validation";
import { getVisibleFields } from "@/lib/notary/engine";
import { getAnswer } from "@/lib/notary/engine";
import { buildFileBaseName } from "@/lib/notary/archiver";
import { generateDocument } from "@/lib/notary/pipeline";
import { deserializeDraft } from "@/lib/notary/engine";
import { makeGetter } from "@/lib/notary/conditions";
import { getPartyRows, getRepresentatives, stripSkipMarkers } from "@/lib/notary/formValues";
import { isFieldRequired } from "@/lib/notary/validation";
import { FIELD_SKIPPED } from "@/lib/notary/types";
import type {
  FieldDef,
  FormValues,
  PartyDef,
  SectionDef,
} from "@/lib/notary/types";
import {
  AlertTriangle,
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
  | { kind: "party-data"; partyDef: PartyDef }
  | { kind: "party-status"; partyDef: PartyDef };

interface InterviewStep {
  key: string;
  short: string;
  detail: StepKind;
}

/**
 * Smart Guided Interview — CONDITIONAL workflow (config-driven).
 * Step 1 "Dejinta Heshiiska" answers drive which steps exist: the
 * Deebaaji/Damiinka sections carry visibleWhen rules in the config, and
 * single/multiple party modes expand into one person or a dynamic list.
 * No fixed step list is ever rendered (#14/#16).
 */

/** Somali description shown under a step title. */
function stepDescription(step: InterviewStep): string {
  switch (step.detail.kind) {
    case "section":
      return step.detail.section.description ?? "";
    case "party-data":
      return `Buuxi xogta ${step.detail.partyDef.label.toLowerCase()} — xubin kasta gooni ah.`;
    case "party-status":
      return "Ma Joogaa Heshiiska? Haa = xogta qofka jooga; Maya = wakiil ayaa matalaya (magac + telefoon).";
  }
}

/** One config section: scalar fields + classic (non-attendance) repeaters.
 *  Exported so tests can render the real Step 1 UI through SSR. */
export function SectionStep({
  step,
  values,
  validation,
  stepErrors,
  setValues,
  config,
  setupSummarySlot,
  onSetupValues,
}: {
  step: Extract<InterviewStep["detail"], { kind: "section" }>;
  values: FormValues;
  validation: Record<string, import("@/lib/notary/validation").SectionErrors>;
  stepErrors: boolean;
  setValues: (updater: (v: FormValues) => FormValues) => void;
  config: NonNullable<ReturnType<typeof getConfig>>;
  /** Only set for Step 1: renders the live summary card once complete. */
  setupSummarySlot?: React.ReactNode;
  /** Only set for Step 1: guarded setter for setup-driven answers. */
  onSetupValues?: (next: FormValues) => void;
}) {
  const section = step.section;
  // Step 1 (Dejinta Heshiiska): setup controls drive the whole workflow.
  const isSetup = section.id === "heshiiska";
  const setupFields = isSetup
    ? ["sub_type", "kireeye_mode", "kirayste_mode", "muddada_nooca", "deebaaji_haa", "damiin_haa"]
    : [];
  const landlordDef = config.sections
    .flatMap((s) => s.parties ?? [])
    .find((p) => p.id === "kireeyayaal")!;
  const tenantDef = config.sections
    .flatMap((s) => s.parties ?? [])
    .find((p) => p.id === "kiraystayaal")!;

  return (
    <>
      {isSetup ? (
        <div className="space-y-6">
          {/* Conditional fields on Step 1 (start/end dates) update IMMEDIATELY
              with the muddada choice: getVisibleFields re-evaluates on every
              values change — Kiro Furan hides End Date, Xidhan shows it, no
              page refresh or re-entry needed. */}
          {getVisibleFields(section, values)
            .filter((f) => setupFields.includes(f.id) || f.visibleWhen)
            .map((field) => {
              // visibleWhen fields on Step 1 (e.g. open/closed dates) use the
              // standard renderer; setup choices use the rich setup cards.
              if (field.visibleWhen) {
                return (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={getAnswer(values, section.id, field.id)}
                    error={
                      stepErrors ? validation[section.id]?.fieldErrors[field.id] : undefined
                    }
                    onChange={(value) => setValues((v) => setAnswer(v!, section.id, field.id, value))}
                  />
                );
              }
              return (
                <SetupField
                  key={field.id}
                  field={field}
                  values={values}
                  sectionId={section.id}
                  landlordDef={landlordDef}
                  tenantDef={tenantDef}
                  errors={stepErrors ? validation[section.id] : undefined}
                  onValues={(next) => (onSetupValues ? onSetupValues(next) : setValues(() => next))}
                />
              );
            })}
          {/* reference/dates/textarea-style remaining fields */}
          {section.fields
            .filter((f) => !setupFields.includes(f.id) && !f.visibleWhen)
            .filter((f) => getVisibleFields(section, values).some((vf) => vf.id === f.id))
            .map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={getAnswer(values, section.id, field.id)}
                error={stepErrors ? validation[section.id]?.fieldErrors[field.id] : undefined}
                onChange={(value) => setValues((v) => setAnswer(v!, section.id, field.id, value))}
              />
            ))}
          {setupSummarySlot}
        </div>
      ) : (
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          {/* Conditional fields (e.g. bank details only for Bank Transfer)
              update immediately: getVisibleFields re-evaluates per render —
              UI visibility stays aligned with validation. */}
          {getVisibleFields(section, values).map((field) => {
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
      )}

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
  /** #15 — pending Step 1 change that hides a section holding entered data. */
  const [hiddenDataChoice, setHiddenDataChoice] = useState<null | {
    sectionId: string;
    label: string;
    next: FormValues;
  }>(null);
  /**
   * Guided form — pre-check before leaving a step: what is missing,
   * optional-empty, or skipped. The user decides "Buuxi hadda" or
   * "Skip oo sii wad"; required fields always block (never auto-skip).
   */
  const [guidedChoice, setGuidedChoice] = useState<null | {
    fields: { label: string; status: "required-missing" | "optional-empty" | "skipped" }[];
  }>(null);
  /** Steps the user already chose "Skip oo sii wad" for — no re-prompt. */
  const confirmedStepsRef = useRef<Set<string>>(new Set());
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

  // Conditional workflow: derived from Step 1 answers + config visibility.
  const steps: InterviewStep[] = useMemo(() => {
    if (!values || !config) return [];
    const byId = new Map(visibleSections.map((s) => [s.id, s]));
    const out: InterviewStep[] = [];
    for (const s of buildConditionalWorkflow(config, values)) {
      if (s.detail.kind === "section") {
        const section = byId.get(s.detail.sectionId);
        if (section) out.push({ key: s.key, short: s.short, detail: { kind: "section", section } });
      } else {
        out.push(s as InterviewStep);
      }
    }
    return out;
  }, [config, values, visibleSections]);

  const setup = useMemo(
    () => (values ? readAgreementSetup(values) : null),
    [values],
  );
  const setupComplete = setup ? isSetupComplete(setup) : false;

  /**
   * #15 — Step 1 change guard: when a setup answer hides a section that
   * already holds entered data, ask before touching the draft. Visibility
   * (workflow) and stored draft data stay separate concerns: "Hay xogta"
   * hides the step but keeps the data; "Ka saar" clears that section.
   */
  const guardedSetValues = (next: FormValues) => {
    if (!config) return setValues(next);
    const get = (key: "deebaaji" | "damiinka") => {
      const v = next[key];
      return v && !Array.isArray(v) ? (v as Record<string, string>) : {};
    };
    const current = values ?? next;

    // Which sections would the NEW answers hide?
    const hiding: { key: "deebaaji" | "damiinka"; sectionId: string; label: string }[] = [];
    if (getAnswer(next, "heshiiska", "deebaaji_haa") === "no") {
      hiding.push({ key: "deebaaji", sectionId: "deebaaji", label: "Deebaajiga" });
    }
    if (getAnswer(next, "heshiiska", "damiin_haa") === "no") {
      hiding.push({ key: "damiinka", sectionId: "damiinka", label: "Damiinka" });
    }
    // Any answer change that hides a populated section → confirm first.
    const anyPopulated = hiding.find((h) => {
      const cur = current[h.key] as Record<string, string> | undefined;
      return cur && Object.values(cur).some((x) => (x ?? "").trim() !== "");
    });
    if (anyPopulated) {
      setHiddenDataChoice({
        sectionId: anyPopulated.sectionId,
        label: anyPopulated.label,
        next,
      });
      return;
    }

    // Duration change Xidhan → Furan: End Date becomes hidden. If a date was
    // already entered, confirm before touching the draft — never silent.
    if (
      getAnswer(next, "heshiiska", "muddada_nooca") !== "xidhan" &&
      getAnswer(current, "heshiiska", "muddada_nooca") === "xidhan" &&
      (getAnswer(current, "heshiiska", "taariikhda_dhammaadka") ?? "").trim() !== ""
    ) {
      setHiddenDataChoice({
        sectionId: "heshiiska:muddada",
        label: "Taariikhda Dhammaadka",
        next,
      });
      return;
    }
    setValues(next);
  };

  const applyHiddenDataChoice = (mode: "keep" | "clear" | "cancel") => {
    if (!hiddenDataChoice) return;
    const { next, sectionId } = hiddenDataChoice;
    if (mode === "cancel") {
      setHiddenDataChoice(null);
      return;
    }
    if (mode === "clear") {
      let cleared: FormValues = next;
      if (sectionId === "deebaaji") {
        cleared = { ...next, deebaaji: { lacagta_deebaajiga: "", shuruudaha_deebaajiga: "" } };
      } else if (sectionId === "damiinka") {
        cleared = {
          ...next,
          damiinka: {
            damiin_magac: "",
            damiin_telefoon: "",
            damiin_aqoonsi: "",
            damiin_cinwaan: "",
          },
        };
      } else if (sectionId === "heshiiska:muddada") {
        // "Ka saar" for the duration change empties BOTH hidden date fields
        // (start date is also hidden under Furan); stored draft data only.
        cleared = {
          ...next,
          heshiiska: {
            ...((next.heshiiska as Record<string, string>) ?? {}),
            taariikhda_bilowga: "",
            taariikhda_dhammaadka: "",
          },
        };
      }
      setValues(cleared);
    } else {
      setValues(next); // keep data in draft, step stays hidden
    }
    setHiddenDataChoice(null);
  };
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
            if (s.detail.kind === "party-data" || s.detail.kind === "party-status") {
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
      case "party-data":
      case "party-status": {
        // Step 2 owns data + presence + wakiil TOGETHER: full party errors
        // (identity AND the Ma-Joogaa choice) plus rep-related generals.
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

  /**
   * Guided form — what is missing on the CURRENT step, split by status:
   *  – required-missing: blocks navigation until filled (or business rule)
   *  – optional-empty: shown in the summary, never blocks
   *  – skipped: explicitly skipped, shown for transparency
   * "Not applicable" (hidden conditional fields) is NEVER included —
   * N/A ≠ empty. Entirely-empty rows beyond the party minimum are ignored,
   * mirroring the validator.
   */
  const collectStepGuidance = () => {
    if (!values || !config || !currentStep) return null;
    const fields: { label: string; status: "required-missing" | "optional-empty" | "skipped" }[] = [];
    const get = makeGetter(values);
    const isReq = (field: FieldDef) => isFieldRequired(field, values, get);

    const step = currentStep.detail;
    if (step.kind === "section") {
      const sectionId = step.section.id;
      for (const field of getVisibleFields(step.section, values)) {
        const v = getAnswer(values, sectionId, field.id);
        if (v === FIELD_SKIPPED) {
          fields.push({ label: field.label, status: "skipped" });
        } else if (v.trim() === "") {
          fields.push({
            label: field.label,
            status: isReq(field) ? "required-missing" : "optional-empty",
          });
        }
      }
    } else if (step.kind === "party-data") {
      const partyDef = step.partyDef;
      getPartyRows(values, partyDef.id).forEach((row, rowIndex) => {
        const rowHasAny = Object.values(row.values ?? {}).some((x) => (x ?? "").trim() !== "");
        if (!rowHasAny && rowIndex >= partyDef.min) return; // ignored empty row
        for (const field of partyDef.fields) {
          const raw = row.values?.[field.id] ?? "";
          if (raw === FIELD_SKIPPED) {
            fields.push({ label: `${partyDef.singular} ${rowIndex + 1}: ${field.label}`, status: "skipped" });
          } else if (raw.trim() === "") {
            fields.push({
              label: `${partyDef.singular} ${rowIndex + 1}: ${field.label}`,
              status: isReq(field) ? "required-missing" : "optional-empty",
            });
          }
        }
      });
    } else if (step.kind === "party-status") {
      // Step 2 — status-aware gaps: the Ma Joogaa? choice, identity fields
      // per state (telefoon/aqoonsi/cinwaan only for jooga), and the linked
      // wakiil's required fields when Maya. N/A fields are NEVER listed.
      const partyDef = step.partyDef;
      const reps = getRepresentatives(values, partyDef);
      getPartyRows(values, partyDef.id).forEach((row, rowIndex) => {
        const status = row.attendance?.status;
        const base = `${partyDef.singular} ${rowIndex + 1}`;
        if (!status) {
          fields.push({ label: `${base}: Ma Joogaa Heshiiska?`, status: "required-missing" });
        }
        for (const field of partyDef.fields) {
          if (field.showOnlyWhenRowStatus && field.showOnlyWhenRowStatus !== status) continue;
          const raw = row.values?.[field.id] ?? "";
          const required = isReq(field) || field.requiredWhenRowStatus === status;
          if (raw === FIELD_SKIPPED) {
            fields.push({ label: `${base}: ${field.label}`, status: "skipped" });
          } else if (raw.trim() === "") {
            fields.push({
              label: `${base}: ${field.label}`,
              status: required ? "required-missing" : "optional-empty",
            });
          }
        }
        if (status === "wakiil") {
          const rep = reps.find((r) => r.id === row.attendance?.representativeId);
          if (!rep) {
            fields.push({ label: `${base}: Wakiilka matalaya`, status: "required-missing" });
          } else {
            for (const field of partyDef.representativeFields ?? []) {
              if (field.optional) continue;
              if ((rep.values?.[field.id] ?? "").trim() === "") {
                fields.push({ label: `${base}: ${field.label}`, status: "required-missing" });
              }
            }
          }
        }
      });
    } else {
      return null;
    }
    return fields.length > 0 ? { fields } : null;
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
    // Guided pre-check (CASE B/C/D): required-missing blocks; optional/skip
    // items get an informed choice — "Buuxi hadda" or "Skip oo sii wad".
    const guidance = collectStepGuidance();
    const hasBlocking = guidance?.fields.some((f) => f.status === "required-missing") ?? false;
    if (guidance && (hasBlocking || !confirmedStepsRef.current.has(currentStep.key))) {
      setGuidedChoice(guidance);
      if (hasBlocking) setStepErrors(true);
      return;
    }
    setStepErrors(false);
    persist(values);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  /** Guided choice: continue with the skipped/optional gaps as they are. */
  const applyGuidedChoice = (mode: "fill" | "skip") => {
    if (guidedChoice) {
      if (mode === "skip" && currentStep) {
        confirmedStepsRef.current.add(currentStep.key);
      } else {
        confirmedStepsRef.current.delete(currentStep?.key ?? "");
      }
    }
    setGuidedChoice(null);
    if (mode !== "skip") return; // stay on the step to fill
    setStepErrors(false);
    persist(values!);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  /** Guided form — does this step hold any explicit skip markers (⚠)? */
  const hasStepSkips = (s: InterviewStep): boolean => {
    if (!values) return false;
    const d = s.detail;
    if (d.kind === "section") {
      return d.section.fields.some(
        (f) => getAnswer(values, d.section.id, f.id) === FIELD_SKIPPED,
      );
    }
    if (d.kind === "party-data" || d.kind === "party-status") {
      return getPartyRows(values, d.partyDef.id).some((row) =>
        Object.values(row.values ?? {}).some((v) => v === FIELD_SKIPPED),
      );
    }
    return false;
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
          if (s.detail.kind === "party-data" || s.detail.kind === "party-status") {
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
      // Skip markers are stripped first: a skipped field renders like any
      // other empty optional value (template fallback), never a marker.
      const out = await generateDocument({
        config,
        values: stripSkipMarkers(config, values),
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
          parties: getPartySummary(config, stripSkipMarkers(config, values)),
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

  /** Step 2 — presence switch: Haa (jooga) / Maya (wakiil ayaa matalaya). */
  const withPresence = (
    v: FormValues,
    partyDef: PartyDef,
    rowIndex: number,
    present: boolean,
  ): FormValues => {
    const before = getPartyRows(v, partyDef.id);
    const prevRepId = before[rowIndex]?.attendance?.representativeId;
    let next = setPartyAttendance(v, partyDef.id, rowIndex, present ? "jooga" : "wakiil");
    if (!present) {
      // Maya: guarantee a LINKED wakiil so the inline inputs have a real
      // storage target (reuse an unlinked rep first — shared wakiil).
      return ensurePartyRepresentative(next, partyDef, partyDef.id, rowIndex);
    }
    // Haa: drop this row's auto wakiil when NO other row shares it — leaves
    // no orphan rep behind (validation would demand a link nobody uses).
    if (prevRepId) {
      const shared = before.some(
        (r, i) => i !== rowIndex && r.attendance?.representativeId === prevRepId,
      );
      const exists = getRepresentatives(next, partyDef).some((r) => r.id === prevRepId);
      if (exists && !shared) next = deleteRepresentative(next, partyDef, prevRepId);
    }
    return next;
  };

  /** Step 2 — new wakiil: created AND linked to this row in one action. */
  const createAndLinkRep = (v: FormValues, partyDef: PartyDef, rowIndex: number): FormValues => {
    const next = createRepresentative(v, partyDef);
    const reps = getRepresentatives(next, partyDef);
    const created = reps[reps.length - 1];
    return created ? linkPartyRepresentative(next, partyDef.id, rowIndex, created.id) : next;
  };

  const renderPartyStatusStep = (partyDef: PartyDef) => {
    const sectionId = visibleSections.find((sec) =>
      (sec.parties ?? []).some((p) => p.id === partyDef.id),
    )?.id;
    const rowErrMap = Object.fromEntries(
      (sectionId ? (validation[sectionId]?.partyErrors[partyDef.id] ?? []) : []).map(
        (e) => [e.index, e.errors],
      ),
    );
    return (
      <PartyStatusEditor
        partyDef={partyDef}
        values={values}
        errors={stepErrors ? rowErrMap : undefined}
        onFieldChange={(rowIndex, fieldId, value) =>
          setValues((v) => setRepeatableAnswer(v!, partyDef.id, rowIndex, fieldId, value))
        }
        onPresence={(rowIndex, present) =>
          setValues((v) => withPresence(v!, partyDef, rowIndex, present))
        }
        onLinkRep={(rowIndex, repId) =>
          setValues((v) => linkPartyRepresentative(v!, partyDef.id, rowIndex, repId))
        }
        onCreateRep={(rowIndex) => setValues((v) => createAndLinkRep(v!, partyDef, rowIndex))}
        onUpdateRep={(repId, fieldId, value) =>
          setValues((v) => setRepresentativeField(v!, partyDef, repId, fieldId, value))
        }
        onRemoveRep={(repId) => setValues((v) => deleteRepresentative(v!, partyDef, repId))}
      />
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
                        {/* Guided form: ⚠ = incomplete/skipped fields — visible
                            but never blocking (req #11). */}
                        {done && hasStepSkips(s) && (
                          <span
                            title="Waxaa jira fields la skip-gareeyay"
                            className="ml-auto text-pen-orange"
                            aria-label="Waxaa jira fields la skip-gareeyay"
                          >
                            ⚠
                          </span>
                        )}
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
                    config={config}
                    setValues={(updater) =>
                      setValues((v) => (v ? updater(v) : v))
                    }
                    setupSummarySlot={
                      setup && setupComplete ? (
                        <SetupSummaryCard
                          config={config}
                          setup={setup}
                          complete={setupComplete}
                          onEdit={() => setStep(0)}
                          onContinue={() => setStep(1)}
                        />
                      ) : undefined
                    }
                    onSetupValues={guardedSetValues}
                  />
                )}

                {currentStep.detail.kind === "party-data" && renderPartyDataStep(currentStep.detail.partyDef)}
                {currentStep.detail.kind === "party-status" && renderPartyStatusStep(currentStep.detail.partyDef)}

                {stepErrors && currentStep.detail.kind === "section" && (() => {
                  const section = currentStep.detail.section;
                  return (validation[section.id]?.general ?? []).map((g, i) => (
                    <p key={i} className="mt-4 text-sm font-medium text-destructive">
                      ✗ {g}
                    </p>
                  ));
                })()}
                {stepErrors && currentStep.detail.kind === "party-status" && (() => {
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

      {/* #15 — Step 1 change: section about to be hidden holds data. */}
      <AlertDialog
        open={hiddenDataChoice !== null}
        onOpenChange={(open) => !open && setHiddenDataChoice(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hiddenDataChoice?.label} waxaa laga saarayaa workflow-ga
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hiddenDataChoice?.sectionId === "heshiiska:muddada" ? (
                <>
                  Waxaad Kiro Xidhan u beddelayso Kiro Furan. Taariikhda Dhammaadka hadda
                  heshiiska kuma khusayso. Ma rabtaa inaad ka saarto xogta Taariikhda
                  Dhammaadka draft-ka?
                </>
              ) : (
                <>
                  Ma rabtaa inaad xogtii {hiddenDataChoice?.label} ka saarto draft-ka? Haddii
                  aad hayso, xogtu way kaydsan tahay laakiin tallaabadu lama muuqin doono.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => applyHiddenDataChoice("clear")}
            >
              Ka saar
            </AlertDialogAction>
            <AlertDialogAction onClick={() => applyHiddenDataChoice("keep")}>
              Hay xogta draft-ka
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => applyHiddenDataChoice("cancel")}>
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Guided form — pre-check summary before leaving a step. The user
          decides: fill now, or continue with optional/skippable gaps.
          Required-missing items always block (never auto-skipped). */}
      <AlertDialog
        open={guidedChoice !== null}
        onOpenChange={(open) => !open && setGuidedChoice(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-pen-orange" />
              Qaar ka mid ah xogta weli lama buuxin
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1.5">
                {guidedChoice?.fields.map((f) => (
                  <p key={f.label} className="text-[13px] leading-5">
                    {f.status === "required-missing" ? (
                      <span className="font-medium text-destructive">• {f.label} — waa waajib</span>
                    ) : f.status === "skipped" ? (
                      <span className="text-muted-foreground">— {f.label} — Skipped</span>
                    ) : (
                      <span className="text-muted-foreground">⚠ {f.label} — Madhan (Optional)</span>
                    )}
                  </p>
                ))}
                {guidedChoice?.fields.some((f) => f.status === "required-missing") && (
                  <p className="pt-1 text-[13px] font-medium text-foreground">
                    Fadlan buuxi xogta waajibka ah ka hor intaadan sii wadin.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Dib ugu noqo oo buuxi</AlertDialogCancel>
            <AlertDialogAction
              disabled={guidedChoice?.fields.some((f) => f.status === "required-missing")}
              onClick={() => applyGuidedChoice("skip")}
            >
              Skip oo sii wad
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
