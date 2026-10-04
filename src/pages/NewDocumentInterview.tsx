import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { RepresentativeGroupingEditor } from "@/components/notary/RepresentativeGroupingEditor";
import { StepperProgress } from "@/components/notary/StepperProgress";
import { NumberSelector } from "@/components/notary/NumberSelector";
import { Label } from "@/components/ui/label";
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
  referenceAnswer,
  setupSectionId,
  setAnswer,
  setPartyAttendance,
  setRepeatableAnswer,
  setRepeatableCount,
  setRepresentativeField,
  subTypeAnswer,
  validateSectionById,
} from "@/lib/notary/engine";
import { validateDocument } from "@/lib/notary/validation";
import { getVisibleFields } from "@/lib/notary/engine";
import { getAnswer } from "@/lib/notary/engine";
import { buildFileBaseName, uniqueBaseName } from "@/lib/notary/archiver";
import { generateDocument } from "@/lib/notary/pipeline";
import {
  effectiveUserTemplate,
  fetchTemplateBytes,
  toTemplateSpec,
  type UserTemplateRecord,
} from "@/lib/notary/userTemplate";
import { deserializeDraft } from "@/lib/notary/engine";
import { makeGetter } from "@/lib/notary/conditions";
import { getPartyRows, getRepresentatives, personChoices, stripSkipMarkers } from "@/lib/notary/formValues";
import { isFieldRequired } from "@/lib/notary/validation";
import { FIELD_SKIPPED } from "@/lib/notary/types";
import { buildHantiReview, type HantiReview } from "@/lib/notary/hantiReview";
import { LiveDocumentReview } from "@/components/notary/LiveDocumentReview";
import type {
  DocumentConfig,
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
  Eye,
  FileDown,
  FileText,
  Loader2,
  Save,
  PenLine,
  Star,
  UserCheck,
  Users,
} from "lucide-react";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Template choice states for the picker.
 *
 * FOLLOW_MY_TEMPLATE — no explicit choice: the notary's default template, or
 * their newest upload (an edit in Word is a NEW upload). This is the starting
 * state, so the live review shows THEIR document, not the sample.
 * REGISTRY_SAMPLE — the notary deliberately asked for the system sample; that
 * choice is real and must stick.
 */
const FOLLOW_MY_TEMPLATE = "";
const REGISTRY_SAMPLE = "__registry__";

/* ------------------------------------------------------------------ */
/* Smart interview step model                                          */
/* ------------------------------------------------------------------ */

type StepKind =
  | {
    kind: "section";
    /**
     * Every section this step renders. A fixed flow step holds several; an
     * ordinary document type holds exactly one, and `section` is that one.
     */
    sections: SectionDef[];
    /** The FIRST section — what the single-section code paths mean. */
    section: SectionDef;
  }
  | { kind: "party-data"; partyDef: PartyDef }
  | { kind: "party-count"; partyDef: PartyDef }
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
    case "party-count":
      return `Wixii ${step.detail.partyDef.label.toLowerCase()} — tirada ayaa marka hore la dooraa.`;
    case "party-status":
      return "Ma Joogaa Heshiiska? Haa = xogta qofka jooga; Maya = wakiil ayaa matalaya (magac + telefoon).";
  }
}

/** One config section: scalar fields + classic (non-attendance) repeaters.
 *  Exported so tests can render the real Step 1 UI through SSR. */
/**
 * KALA IIBSI HANTI — the people-first review.
 *
 * The generic review below lists form fields in the order they were typed.
 * This one answers the questions the notary actually asks before signing:
 * how many sellers, whose family, who represents whom, how many photographs
 * and whose, who signs — and, at the bottom, WHAT IS STILL MISSING.
 *
 * Missing OPTIONAL answers never appear here and never block. Only the
 * REQUIRED ones are listed, by name, under a clear heading.
 *
 * Exported so tests can render it without a browser.
 */
export function HantiReviewSummary({
  review,
  onEditSection,
}: {
  review: HantiReview;
  onEditSection?: (sectionId: string) => void;
}) {
  // A block key maps back to the section it came from, so "Wax ka beddel"
  // lands the notary where the answers were typed.
  const sectionFor: Record<string, string> = {
    sellers: "iibiyaha",
    groups: "kooxaha",
    // Representatives live inside the party steps now — the wakiil is
    // declared in the same card as "Ma Joogaa Heshiiska?". There is no
    // separate wakiil section to send the notary back to.
    representatives: "iibiyaha",
    photos: "sawirrada",
    signatories: "saxeexayaasha",
    buyers: "iibsadaha",
    witnesses: "maragyada",
    property: "hantida_dhul_banaan",
    certificates: "shaxadaha",
    payment: "qiimaha",
  };

  return (
    <div className="neu-raised mb-6 p-4">
      <h3 className="text-sm font-bold">Waxa Hantida ku Jira</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Tirada dadka, sawirrada iyo saxeexyadu waa tiro madax-bannaan — lama
        xiriirin tirada iibiyayaasha.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {review.blocks.map((block) => (
          <div key={block.key} className="neu-inset p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold">{block.title}</h4>
              {block.count && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {block.count}
                </span>
              )}
            </div>
            {block.lines.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">—</p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {block.lines.slice(0, 6).map((line, i) => (
                  <li key={`${block.key}-${i}`} className="text-[11px] leading-tight">
                    <span className="text-muted-foreground">{line.label}:</span>{" "}
                    <span className="font-medium">{line.value || "—"}</span>
                  </li>
                ))}
                {block.lines.length > 6 && (
                  <li className="text-[11px] text-muted-foreground">
                    … iyo {block.lines.length - 6} kale
                  </li>
                )}
              </ul>
            )}
            {onEditSection && sectionFor[block.key] && (
              <button
                type="button"
                onClick={() => onEditSection(sectionFor[block.key])}
                className="mt-2 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
              >
                Wax ka beddel
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Only REQUIRED gaps are listed. An optional field the notary left
          blank is not a problem and is deliberately absent from this list. */}
      {review.missing.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <h4 className="text-xs font-bold text-destructive">
            Waxa MAQAN (waajibka ah):
          </h4>
          <ul className="mt-1 space-y-0.5">
            {review.missing.map((m, i) => (
              <li key={`${m.path}-${i}`} className="text-[11px] text-destructive">
                {m.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {review.ready && (
        <p className="mt-3 text-xs font-medium text-primary">
          Dhammaan xogta waajibka ah waa buuxiyay — diyaar ma ah in la abuuro.
        </p>
      )}
    </div>
  );
}

/**
 * The party list whose count is asked by this exact section field, if any.
 *
 * Returns undefined for every ordinary field, and for every document type
 * that does not declare `countFrom` — so the wiring is inert everywhere it
 * was not asked for, including all of Heshiis Kiro.
 */
function countTargetFor(
  config: DocumentConfig,
  sectionId: string,
  fieldId: string,
): PartyDef | undefined {
  const path = `${sectionId}.${fieldId}`;
  return config.sections
    .flatMap((s) => s.parties ?? [])
    .find((p) => p.countFrom === path);
}

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
  /**
   * The section to render. The prop keeps its historical `step` name and
   * `{ kind, section }` shape so every existing caller — including the
   * shared UI-render tests — is unaffected; a fixed flow step simply renders
   * once per section it holds.
   */
  step: { kind: "section"; section: SectionDef; stepTitle?: string };
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
  const flowTitle = step.stepTitle;
  // Step 1 (Dejinta Heshiiska): setup controls drive the whole workflow.
  // The rich setup cards belong to the rental document only — a document
  // type whose setup section is named differently renders its plain fields.
  const isSetup = section.id === setupSectionId(config);
  const setupFields = isSetup
    ? ["sub_type", "kireeye_mode", "kirayste_mode", "muddada_nooca", "deebaaji_haa", "damiin_haa"]
    : [];
  const allParties = config.sections.flatMap((s) => s.parties ?? []);
  // Every card that names a party list, whatever the document calls it:
  // Heshiis Kiro's Kireeye/Kirayste plus Kala Iibsi Hanti's Iibiye/Iibsade.
  // The count wording is READ from the config too — the label of the field
  // that carries `countFrom` ("Tirada Iibiyayaasha") minus its "Tirada "
  // prefix — so no Somali plural is spelled out here in code.
  const partyDefsByField = new Map<string, { def: PartyDef; countLabel: string; countFieldId: string }>();
  // Count fields owned by a card: the inline [-] n [+] selector next to the
  // card STORES the number, so the plain renderer must not draw a second box
  // for the same figure. Kiro declares no partyModeTarget, so it owns nothing.
  const ownedCountFields = new Set<string>();
  for (const f of section.fields) {
    const def = f.partyModeTarget ? allParties.find((p) => p.id === f.partyModeTarget) : undefined;
    if (!def) continue;
    const [countSection, countField] = (def.countFrom ?? "").split(".");
    const countDef = config.sections
      .flatMap((s) => s.fields)
      .find((cf) => countSection && cf.id === countField);
    const countLabel = (countDef?.label ?? def.label).replace(/^Tirada\s+/i, "");
    partyDefsByField.set(f.id, { def, countLabel, countFieldId: countField ?? "" });
    if (countField) ownedCountFields.add(countField);
  }
  // Resolved defensively: a document type without these groups (e.g. Kala
  // Iibsi Hanti) must never crash the setup renderer.
  const landlordDef = allParties.find((p) => p.id === "kireeyayaal");
  const tenantDef = allParties.find((p) => p.id === "kiraystayaal");

  return (
    <>
      {flowTitle && (
        <p className="mb-4 border-l-2 border-primary/40 pl-3 text-sm font-semibold text-primary">
          {flowTitle}
        </p>
      )}
      {isSetup ? (
        <div className="space-y-6">
          {/* Conditional fields on Step 1 (start/end dates) update IMMEDIATELY
              with the muddada choice: getVisibleFields re-evaluates on every
              values change — Kiro Furan hides End Date, Xidhan shows it, no
              page refresh or re-entry needed. */}
          {getVisibleFields(section, values)
            .filter((f) => (setupFields.includes(f.id) || f.setupCard) && !ownedCountFields.has(f.id))
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
              const mode = partyDefsByField.get(field.id);
              // Kiro names its two party choices by id (declared, not guessed);
              // any other document names the list in `partyModeTarget`.
              const chosenDef = mode?.def ??
                (field.id === "kireeye_mode" ? landlordDef :
                 field.id === "kirayste_mode" ? tenantDef : undefined);
              const chosenCountLabel =
                mode?.countLabel ??
                (field.id === "kireeye_mode" ? "Kireeyayaasha" :
                 field.id === "kirayste_mode" ? "Kiraystayaasha" : undefined);
              return (
                <SetupField
                  key={field.id}
                  field={field}
                  values={values}
                  sectionId={section.id}
                  partyDef={chosenDef}
                  countLabel={chosenCountLabel}
                  countFieldId={mode?.countFieldId}
                  errors={stepErrors ? validation[section.id] : undefined}
                  onValues={(next) => (onSetupValues ? onSetupValues(next) : setValues(() => next))}
                />
              );
            })}
          {/* reference/dates/textarea-style remaining fields */}
          {section.fields
            .filter((f) => !(setupFields.includes(f.id) || f.setupCard) && !ownedCountFields.has(f.id))
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
            // A count asked HERE (PartyDef.countFrom) is the single source of
            // truth for that list: writing the number resizes the rows too,
            // so the notary never answers "how many sellers?" a second time
            // and the two answers can never disagree.
            const counted = countTargetFor(config, section.id, field.id);
            return (
              <FieldRenderer
                key={field.id}
                field={field}
                value={getAnswer(values, section.id, field.id)}
                error={err}
                onChange={(value) =>
                  setValues((v) => {
                    const next = setAnswer(v!, section.id, field.id, value);
                    return counted
                      ? setRepeatableCount(next, counted, Number(value) || 0)
                      : next;
                  })
                }
              />
            );
          })}
        </div>
      )}

      {/* Non-attendance repeaters render inline — UNLESS the list already has
          its own workflow step, in which case rendering it here too would show
          the notary the same editor twice. `renderInline: false` is the
          document's way of saying "once, please"; a document that omits it
          (Heshiis Kiro) is unchanged. */}
      {(section.parties ?? [])
        .filter((p) => !p.attendance && p.renderInline !== false)
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

  // Reference allocation — documents that declare a `referenceFormat`.
  // Kala Iibsi Dhul Banaan prints "Ref/Dpn/MG/001/01/26", and the user must
  // never type it: the notary_counters table hands out a strictly sequential
  // serial (never reused, never random) once per draft. Heshiis Kiro
  // declares no referenceFormat, keeps its own reference field, and this
  // effect never runs for it.
  const nextReference = useMutation(api.notaryDocuments.nextReference);
  const allocatedReferenceRef = useRef(false);
  useEffect(() => {
    if (!config?.referenceFormat || !values || allocatedReferenceRef.current) return;
    if (referenceAnswer(config, values).trim()) return;
    allocatedReferenceRef.current = true;
    nextReference({ prefix: config.referencePrefix })
      .then((reference) =>
        setValues((v) => (v ? setAnswer(v, setupSectionId(config), "reference", reference) : v)),
      )
      .catch(() => {
        // Keep the draft usable — the user can still type nothing and the
        // Generate step reports a missing reference instead of inventing one.
        allocatedReferenceRef.current = false;
      });
  }, [config, values, nextReference]);

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
          subType: subTypeAnswer(config, next) || document.subType,
          subTypeLabel: getSubTypeLabel(
            config,
            subTypeAnswer(config, next) || document.subType,
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

  /* -------------------------------------------------------------- */
  /* Phase Document Generation — user template + generation state    */
  /* -------------------------------------------------------------- */

  // The user's OWN Word templates (Template Manager). Empty selection →
  // the registry sample template is used.
  const myTemplates = useQuery(
    api.notaryTemplates.listMyTemplates,
    document ? { documentType: document.documentType } : "skip",
  );
  const [pickedTemplateId, setPickedTemplateId] = useState<string>(FOLLOW_MY_TEMPLATE);
  /**
   * The template THIS document is generated and previewed with.
   *
   * The office owns its template, so their own file is what must appear: an
   * explicit choice wins, otherwise the template marked default, otherwise
   * the newest upload (an edit in Word is a NEW upload, and the newest one
   * is the revision in force). The registry sample is used only when the
   * office has uploaded nothing, or when the notary explicitly asks for it.
   */
  const selectedTemplate = useMemo(
    () =>
      pickedTemplateId === REGISTRY_SAMPLE
        ? undefined
        : effectiveUserTemplate(
            myTemplates ?? [],
            pickedTemplateId === FOLLOW_MY_TEMPLATE ? undefined : pickedTemplateId,
          ),
    [myTemplates, pickedTemplateId],
  );
  const selectedTemplateId = selectedTemplate?._id ?? "";
  const templateUrl = useQuery(
    api.notaryTemplates.getTemplateUrl,
    selectedTemplate ? { templateId: selectedTemplate._id as Id<"notary_templates"> } : "skip",
  );
  /** Their template exists but its bytes have not arrived yet: WAIT, never
      fall back to the sample — a preview of the wrong file is worse. */
  const templatePending = !!selectedTemplate && !templateUrl;
  const selectedTemplateSpec = useMemo(
    () => (selectedTemplate ? toTemplateSpec(selectedTemplate) : undefined),
    [selectedTemplate],
  );

  /** [Preview] state — the generated document TEXT before final commit. */
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);

  /** Generation error card — data is never lost; [Try Again] re-runs. */
  const [generationError, setGenerationError] = useState<string | null>(null);

  /** No-overwrite: session-wide issued file names (unique -2, -3 …). */
  const issuedFileNamesRef = useRef<Set<string>>(new Set());

  /** Set when the user opens an edit from REVIEW — Next returns to review. */
  const editReturnRef = useRef(false);

  // Auto-selection is DERIVED, not latched: when the notary uploads an
  // edited template it becomes the default and therefore the one previewed —
  // the interview follows it without the notary touching the picker. An
  // explicit choice is never overridden.

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
        // A step may carry SEVERAL sections (a fixed flow step), or exactly
        // one (every other document type). A step whose sections have all
        // been hidden simply does not appear.
        const sections = s.detail.sectionIds
          .map((id) => byId.get(id))
          .filter((x): x is SectionDef => x !== undefined);
        if (sections.length > 0)
          out.push({
            key: s.key,
            short: s.short,
            detail: { kind: "section", sections, section: sections[0] },
          });
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
  // Hoisted out of the JSX so the narrowing survives into the .map() below.
  const flowSections =
    currentStep?.detail.kind === "section" ? currentStep.detail.sections : null;

  const validation = useMemo(
    () => (values && config ? validateDocument(config, values) : {}),
    [values, config],
  );

  /* -------------------------------------------------------------- */
  /* Review → step navigation (VALIDATION before generate)           */
  /* -------------------------------------------------------------- */

  /**
   * Map a review block (sectionId) to the workflow step the user edits it
   * in. Party sections (Kireeyaha/Kiraystaha) have NO section step — their
   * data lives in the combined party-status step; Maragyada lives in its
   * party-data step. Falls back to the section step, then -1.
   */
  const stepTargetForSection = useCallback(
    (sectionId: string): number => {
      const section = visibleSections.find((s) => s.id === sectionId);
      const partyId = section?.parties?.[0]?.id;
      return steps.findIndex((s) => {
        if (
          partyId &&
          (s.detail.kind === "party-status" ||
            s.detail.kind === "party-data" ||
            s.detail.kind === "party-count")
        ) {
          return s.detail.partyDef.id === partyId;
        }
        return s.detail.kind === "section" && s.detail.section.id === sectionId;
      });
    },
    [steps, visibleSections],
  );

  /**
   * Missing REQUIRED data before generate — field + step + reason.
   * Optional/skipped fields NEVER appear here (the validator only reports
   * required violations), so they can never block generation.
   */
  const missingRequired = useMemo(() => {
    if (!values || !config) return [];
    const out: { label: string; stepName: string; stepIndex: number; reason: string }[] = [];
    const stepName = (idx: number) => (idx >= 0 ? `Tallaabada ${idx + 1}: ${steps[idx]?.short ?? ""}` : "");
    for (const [sectionId, errs] of Object.entries(validation)) {
      const section = config.sections.find((s) => s.id === sectionId);
      const idx = stepTargetForSection(sectionId);
      const name = stepName(idx);
      for (const [fieldId, message] of Object.entries(errs.fieldErrors)) {
        const label = section?.fields.find((f) => f.id === fieldId)?.label ?? fieldId;
        out.push({ label, stepName: name, stepIndex: idx, reason: message });
      }
      for (const [partyId, partyErrs] of Object.entries(errs.partyErrors)) {
        const partyDef = section?.parties?.find((p) => p.id === partyId);
        for (const pe of partyErrs) {
          for (const e of pe.errors) {
            const fieldLabel =
              e.fieldId === "attendance"
                ? "Ma Joogaa Heshiiska?"
                : (partyDef?.fields.find((f) => f.id === e.fieldId)?.label ??
                    partyDef?.representativeFields?.find((f) => f.id === e.fieldId)?.label ??
                    e.fieldId);
            out.push({
              label: `${partyDef?.singular ?? partyId} ${pe.index + 1}: ${fieldLabel}`,
              stepName: name,
              stepIndex: idx,
              reason: e.message,
            });
          }
        }
      }
      for (const g of errs.general) {
        out.push({ label: g, stepName: name, stepIndex: idx, reason: section?.title ?? sectionId });
      }
    }
    return out;
  }, [config, steps, stepTargetForSection, validation, values]);

  const completedSteps = useMemo(
    () =>
      new Set(
        steps
          .filter((s) => {
            if (s.detail.kind === "section") return !validation[s.detail.section.id];
            if (s.detail.kind === "party-count") {
              // A count step is complete as soon as the rows it created
              // pass the group's own rules.
              const partyDef = s.detail.partyDef;
              const sectionId = visibleSections.find((sec) =>
                (sec.parties ?? []).some((p) => p.id === partyDef.id),
              )?.id;
              return sectionId ? !validation[sectionId] : false;
            }
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
      case "party-status":
      case "party-count": {
        if (currentStep.detail.kind === "party-count") return false; // count itself is never invalid
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
    } else if (step.kind === "party-count") {
      return null;
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
      // party-count — nothing to fill, the step only picks a number.
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
    // KALA IIBSI HANTI — navigation is NON-BLOCKING. An unfinished step shows
    // a warning and the notary still moves on: he must be able to keep an
    // incomplete draft and come back to it. The one thing that still stops is
    // signing a document that is missing something the office cannot draft
    // around, and that is checked at generation time, not at every step.
    //
    // GATED ON DOCUMENT TYPE — Heshiis Kiro keeps its blocking behaviour, which
    // its own tests and its signed rental depend on.
    const nonBlocking = config?.id === "kala_iibsi_hanti";
    if (!nonBlocking && currentStepHasErrors()) {
      setStepErrors(true);
      toast.error("Waxaa jira xog aan dhammaystirnayn. Fadlan sax meelaha lagu calaamadeeyay.");
      return;
    }
    // Review edit flow: the user jumped here from "Wax ka beddel" — once
    // the step validates, return straight back to the review page where
    // the updated form state is re-read (Review = FINAL FORM STATE).
    if (editReturnRef.current) {
      editReturnRef.current = false;
      setStepErrors(false);
      persist(values);
      setStep(steps.length);
      return;
    }
    // Guided pre-check (CASE B/C/D): required-missing blocks; optional/skip
    // items get an informed choice — "Buuxi hadda" or "Skip oo sii wad".
    const guidance = collectStepGuidance();
    // The same gate: a required-missing gap warns for Hanti and stops for Kiro.
    const hasBlocking =
      !nonBlocking &&
      (guidance?.fields.some((f) => f.status === "required-missing") ?? false);
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
    if (d.kind === "party-data" || d.kind === "party-status" || d.kind === "party-count") {
      return getPartyRows(values, d.partyDef.id).some((row) =>
        Object.values(row.values ?? {}).some((v) => v === FIELD_SKIPPED),
      );
    }
    return false;
  };

  const handleGenerate = async () => {
    if (!values || !config || !document) return;
    setGenerating(true);
    setGenerationError(null);
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
        referenceAnswer(config, values) ||
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

      const subType = subTypeAnswer(config, values) || document.subType;
      const subTypeLabel = getSubTypeLabel(config, subType);

      // Phase Document Generation — the USER'S OWN template wins. Its bytes
      // are fetched from file storage; the pipeline validates the
      // placeholders against the FINAL FORM STATE and fills them without
      // touching the user's design. No user template → registry template.
      let userBytes: ArrayBuffer | undefined;
      let userSpec;
      if (selectedTemplate) {
        if (!templateUrl) {
          throw new Error("Template-kaaga weli waa la soo rarayaa — isku day mar kale.");
        }
        userBytes = await fetchTemplateBytes(templateUrl);
        userSpec = selectedTemplateSpec;
      }

      // Full Phase 3 pipeline: validate answers → template (user or
      // registry) → validate template → data context → conditions →
      // clauses → repeaters → placeholders → DOCX → validate output →
      // PDF (best effort). Skip markers are stripped first: a skipped
      // field renders like any other empty optional value (template
      // fallback), never a marker.
      const out = await generateDocument({
        config,
        values: stripSkipMarkers(config, values),
        referenceNumber,
        subTypeLabel,
        templateBytes: userBytes,
        spec: userSpec,
        issuedFileNames: issuedFileNamesRef.current,
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
      // Document-ka lama samayn karin — form state-ku weli wuu jiraa;
      // [Try Again] wuxuu ku noqdaa isla xogtaas.
      setGenerationError(
        msg.startsWith("Template Error") || msg.startsWith("Output Error")
          ? msg
          : msg || "Abuuritaanku wuu fashilmay.",
      );
      toast.error(
        msg.startsWith("Template Error") || msg.startsWith("Output Error")
          ? msg
          : "Document-ka lama samayn karin — xogtaada way kaydsan tahay. Isku day mar kale.",
      );
    } finally {
      setGenerating(false);
    }
  };

  /**
   * [Preview] — run the REAL generation pipeline against the selected
   * template and show the resulting document text, WITHOUT committing or
   * downloading. The user sees exactly what their template produces from
   * the final form state before pressing Generate.
   */
  const runPreview = async () => {
    if (!values || !config || !document) return;
    setPreviewLoading(true);
    try {
      const referenceNumber =
        (referenceAnswer(config, values) || document.referenceNumber || "PREVIEW").trim() ||
        "PREVIEW";
      let userBytes: ArrayBuffer | undefined;
      let userSpec;
      if (selectedTemplate) {
        if (!templateUrl) {
          throw new Error("Template-kaaga weli waa la soo rarayaa — isku day mar kale.");
        }
        userBytes = await fetchTemplateBytes(templateUrl);
        userSpec = selectedTemplateSpec;
      }
      const out = await generateDocument({
        config,
        values: stripSkipMarkers(config, values),
        referenceNumber,
        subTypeLabel: getSubTypeLabel(
          config,
          subTypeAnswer(config, values) || document.subType,
        ),
        templateBytes: userBytes,
        spec: userSpec,
      });
      // The dialog renders the SAME universal Live Document Review the right
      // hand pane uses; running the pipeline first only surfaces the template
      // and output validation warnings for the chosen template.
      setPreviewWarnings([
        ...(out.templateValidation?.issues
          .filter((i) => i.level === "warning")
          .map((i) => i.message) ?? []),
        ...out.warnings,
      ]);
      setPreviewOpen(true);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg || "Preview-gu wuu fashilmay — isku day mar kale.");
    } finally {
      setPreviewLoading(false);
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

  /**
   * Representative GROUPING — the checkbox panel.
   *
   * Ticking a person links them to that representative (one stored record,
   * one reference per person). Unticking only drops THIS person's link; the
   * representative and every other person they cover are untouched. A
   * present person is never linkable — the panel disables them, and this
   * guard keeps that true even if state arrives from a draft.
   */
  const toggleRepMember = (
    v: FormValues,
    partyDef: PartyDef,
    repId: string,
    rowIndex: number,
    member: boolean,
  ): FormValues => {
    const rows = (v[partyDef.id] ?? []) as import("@/lib/notary/types").PartyRow[];
    if (rows[rowIndex]?.attendance?.status === "jooga") return v;
    if (member) return linkPartyRepresentative(v, partyDef.id, rowIndex, repId);
    // Drop this link, keep the person on the list as absent.
    return setPartyAttendance(v, partyDef.id, rowIndex, "ma_joogo");
  };

  /** New, empty representative — not yet attached to anybody. */
  const createEmptyRep = (v: FormValues, partyDef: PartyDef): FormValues =>
    createRepresentative(v, partyDef);

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

  /** The grouping panel itself — one checkbox per person per wakiil. */
  const renderRepGrouping = (partyDef: PartyDef) => (
    <RepresentativeGroupingEditor
      partyDef={partyDef}
      values={values}
      onTogglePerson={(repId, rowIndex, member) =>
        setValues((v) => toggleRepMember(v!, partyDef, repId, rowIndex, member))
      }
      onCreateRep={() => setValues((v) => createEmptyRep(v!, partyDef))}
      onUpdateRep={(repId, fieldId, value) =>
        setValues((v) => setRepresentativeField(v!, partyDef, repId, fieldId, value))
      }
      onRemoveRep={(repId) => setValues((v) => deleteRepresentative(v!, partyDef, repId))}
    />
  );

  /**
   * "Tirada …?" — the count step. Writes the chosen number straight into
   * the group's row list (count-first, no repeated question later).
   */
  const renderPartyCountStep = (partyDef: PartyDef) => {
    const rows = (values[partyDef.id] as FormValues[keyof FormValues]) ?? [];
    const count = Array.isArray(rows) ? rows.length : 0;
    return (
      <div className="neu-inset p-4">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" />
          Tirada {partyDef.label}
        </Label>
        {partyDef.description && (
          <p className="text-xs text-muted-foreground">{partyDef.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Tirada {partyDef.label} ee aad dooranayso:
          </span>
          <NumberSelector
            // Starts at the list's own minimum. An OPTIONAL list (the
            // photographs, the signature lines, the certificates) therefore
            // opens at zero, not at a phantom "1" that would read as
            // "one of these per seller".
            value={Math.max(partyDef.min, count)}
            min={partyDef.min}
            {...(partyDef.max ? { max: partyDef.max } : {})}
            label={partyDef.singular}
            onChange={(next) =>
              setValues((v) => setRepeatableCount(v!, partyDef, next))
            }
          />
        </div>
      </div>
    );
  };

  /**
 * The party list whose count is asked by this exact setup field, if any.
 *
 * Returns undefined for every ordinary field, and for every document type
 * that does not declare `countFrom` — so the wiring is inert everywhere it
 * was not asked for, including all of Heshiis Kiro.
 */

/**
 * Options for every "person" field of one party list.
 *
 * Built ONCE per render from the people already entered anywhere in the form,
 * so a photograph, a signature line and a representation edge all offer the
 * SAME list and the name is never typed twice. A field with no `personSource`
 * declares nothing and is unaffected.
   */
  const personChoicesFor = (
    values: FormValues | undefined,
    partyDef: PartyDef,
  ): { value: string; label: string }[] | undefined => {
    const sources = partyDef.fields
      .map((f) => f.personSource)
      .filter((s): s is string => Boolean(s));
    if (sources.length === 0) return undefined;
    if (!values) return [];
    const merged: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const source of sources) {
      for (const choice of personChoices(values, source)) {
        if (seen.has(choice.value)) continue;
        seen.add(choice.value);
        merged.push(choice);
      }
    }
    return merged;
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
        personChoices={personChoicesFor(values, partyDef)}
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
      <div className="mx-auto max-w-[1600px] px-4 pt-6">
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
              {config.title} · {getSubTypeLabel(config, subTypeAnswer(config, values) || document.subType)}
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

        {/* Two panes: the interview on the left, the LIVE DOCUMENT REVIEW on
            the right. The review is the same universal component for every
            document type — it needs no per-type code and no Generate click. */}
        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_minmax(380px,42%)]">
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
                    // The review page is always reachable (read-only): it is
                    // where the missing-data summary + template choice live.
                    onClick={() => setStep(steps.length)}
                    aria-current={isReview ? "step" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-all ${
                      isReview
                        ? "neu-inset glow-primary-sm font-semibold text-primary"
                        : "text-foreground/80 hover:text-foreground"
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

                {flowSections &&
                  flowSections.map((section) => (
                    <div key={section.id}>
                      <SectionStep
                        step={{
                          kind: "section",
                          section,
                          ...(flowSections.length > 1 ? { stepTitle: currentStep!.short } : {}),
                        }}
                        values={values}
                        validation={validation}
                        stepErrors={stepErrors}
                        config={config}
                        setValues={(updater) =>
                          setValues((v) => (v ? updater(v) : v))
                        }
                        setupSummarySlot={
                          setup && setupComplete && section === flowSections[0] ? (
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
                      {/* Attendance lists (the buyers) collect identity AND
                          presence AND representation in the same place. In a
                          fixed flow they belong to the step, not to a step of
                          their own — otherwise the notary would be shown the
                          buyers twice. */}
                      {(section.parties ?? [])
                        .filter((p) => p.attendance)
                        .map((partyDef) => (
                          <div key={partyDef.id} className="mt-6 border-t border-dashed border-border pt-5">
                            {renderPartyStatusStep(partyDef)}
                          </div>
                        ))}
                    </div>
                  ))}

                {currentStep.detail.kind === "party-count" &&
                  renderPartyCountStep(currentStep.detail.partyDef)}
                {currentStep.detail.kind === "party-data" && renderPartyDataStep(currentStep.detail.partyDef)}
                {currentStep.detail.kind === "party-status" && (
                  <>
                    {renderPartyStatusStep(currentStep.detail.partyDef)}
                    <div className="mt-4">{renderRepGrouping(currentStep.detail.partyDef)}</div>
                  </>
                )}

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
                {/* KALA IIBSI HANTI — the notary reads a sale by PEOPLE, not
                    by form fields: how many sellers, whose family, who
                    stands for whom, how many photographs and whose, who signs.
                    That summary is built by hantiReview and shown above the
                    generic field-by-field list below.

                    Gated on the document type, so Heshiis Kiro never reaches
                    this code path and its review is byte-identical. */}
                {config?.id === "kala_iibsi_hanti" && values && (
                  <HantiReviewSummary
                    review={buildHantiReview(config, values)}
                    onEditSection={(sectionId) => {
                      const target = stepTargetForSection(sectionId);
                      if (target >= 0) {
                        editReturnRef.current = true;
                        setStep(target);
                        setStepErrors(false);
                      }
                    }}
                  />
                )}
                {reviewBlocks.length === 0 && (
                  <p className="text-sm text-muted-foreground">Weli wax xog ah lama buuxin.</p>
                )}
                <div className="space-y-4">
                  {reviewBlocks.map((block) => {
                    // Party sections (Kireeyaha/Kiraystaha/Maragyada) have no
                    // section step — edit lands in their party-status/data step.
                    const target = stepTargetForSection(block.sectionId);
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
                                editReturnRef.current = true; // Next returns to review
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

                {/* VALIDATION — missing REQUIRED data (field + step + reason).
                    Optional/skipped fields never appear here and never block. */}
                {missingRequired.length > 0 && (
                  <div className="neu-raised mt-6 border-l-4 border-destructive p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-destructive">
                      <AlertTriangle className="size-4" />
                      Qaar ka mid ah xogta muhiimka ah weli lama buuxin.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {missingRequired.map((m, i) => (
                        <li
                          key={`${m.label}-${i}`}
                          className="neu-inset flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">⚠ {m.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.stepName}
                              {m.reason && m.reason !== m.label ? ` — ${m.reason}` : ""}
                            </p>
                          </div>
                          {m.stepIndex >= 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => {
                                editReturnRef.current = true;
                                setStep(m.stepIndex);
                                setStepErrors(false);
                              }}
                            >
                              Wax ka beddel
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Optional / skipped fields ma xannibaan generation-ka — kaliya xogta waajibka ah ayaa joojisa.
                    </p>
                  </div>
                )}

                {/* SELECT WORD TEMPLATE — the user's own design wins. */}
                <div className="neu-raised mt-6 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">Dooro Word Template</h3>
                    <a
                      href="/templates"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      + Soo geli / Maaree template-yada
                    </a>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Template-ka waa iska leh USER-KA — system-ku wuxuu kaliya buuxinayaa
                    placeholder-yada, isaga oo ilaalinaya qaab-dhismeedkaaga.
                  </p>
                  <div className="mt-3 space-y-2">
                    {(myTemplates ?? []).length === 0 && (
                      <div className="neu-inset p-3 text-xs text-muted-foreground">
                        <p>
                          Weli template user ah lama soo gelin — tusaalaha registry-ga ayaa la
                          isticmaalayaa.
                        </p>
                        <p className="mt-1.5">
                          Ma qaab isu la yeelo?{" "}
                          <a href="/templates" className="font-medium text-primary hover:underline">
                            Soo celi heshiis_kiro_template.docx
                          </a>{" "}
                          ka Template Manager, ku qaab-dhismeed Word, kadibna soo geli.
                        </p>
                      </div>
                    )}
                    {(myTemplates ?? []).map((t) => (
                      <label
                        key={t._id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                          selectedTemplateId === t._id
                            ? "neu-inset font-semibold text-primary"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="word-template"
                          className="accent-primary"
                          checked={selectedTemplateId === t._id}
                          onChange={() => setPickedTemplateId(t._id)}
                        />
                        <span className="min-w-0 flex-1 truncate">{t.name}</span>
                        {t.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-pen-green/10 px-2 py-0.5 text-[10px] font-semibold text-pen-green">
                            <Star className="size-3" /> Default
                          </span>
                        )}
                      </label>
                    ))}
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                        pickedTemplateId === REGISTRY_SAMPLE ||
                        (pickedTemplateId === FOLLOW_MY_TEMPLATE &&
                          (myTemplates ?? []).length === 0)
                          ? "neu-inset font-semibold text-primary"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="word-template"
                        className="accent-primary"
                        checked={
                          pickedTemplateId === REGISTRY_SAMPLE ||
                          ((myTemplates ?? []).length === 0 &&
                            pickedTemplateId === FOLLOW_MY_TEMPLATE)
                        }
                        onChange={() => setPickedTemplateId(REGISTRY_SAMPLE)}
                      />
                      <span>Tusaalaha nidaamka (registry)</span>
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => void runPreview()}
                      disabled={previewLoading || generating}
                    >
                      {previewLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                      Preview
                    </Button>
                  </div>
                </div>

                {/* GENERATION ERROR — data preserved, retry available. */}
                {generationError && (
                  <div className="neu-raised mt-6 border-l-4 border-destructive p-4">
                    <p className="text-sm font-bold text-destructive">
                      Document-ka lama samayn karin.
                    </p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {generationError}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Xogtaada way kaydsan tahay — sax qalada haddii jiro oo isku day mar kale.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="gap-2"
                        onClick={tryContinue}
                        disabled={generating}
                      >
                        {generating ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FileDown className="size-4" />
                        )}
                        Try Again
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setGenerationError(null)}
                      >
                        Xir
                      </Button>
                    </div>
                  </div>
                )}
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
                  disabled={generating || missingRequired.length > 0}
                  className="glow-primary-sm gap-2"
                  title={
                    missingRequired.length > 0
                      ? "Xog muhiim ah weli lama buuxin — eeg liiska xogta maqan."
                      : undefined
                  }
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

          {/* Universal Live Document Review — same data, same template, same
              rules as the DOCX/PDF/print surfaces. Renders from the first
              keystroke, so the notary never has to generate to see it. */}
          <aside
            className="lg:col-span-2 xl:sticky xl:top-4 xl:col-span-1"
            aria-label="Live Document Review"
          >
            <LiveDocumentReview
              key={`${config.id}:${selectedTemplateId}`}
              config={config}
              values={values}
              referenceNumber={referenceAnswer(config, values) || document.referenceNumber}
              subTypeLabel={getSubTypeLabel(
                config,
                subTypeAnswer(config, values) || document.subType,
              )}
              spec={selectedTemplateSpec}
              templateUrl={templateUrl ?? undefined}
              templatePending={templatePending}
              templateName={selectedTemplate?.name ?? null}
            />
          </aside>
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

      {/* [Preview] — the generated document text from the user's own
          template + the FINAL FORM STATE, before any commit. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Preview — Dukumeentiga la abuuray</DialogTitle>
            <DialogDescription>
              Isla template-ka Word-kaaga WADADAAGA, isla xogta, isla qaab-dhismeedka —
              sida uu Live Review-ka ahaa midigga kuugu muuqdo.
            </DialogDescription>
          </DialogHeader>
          <LiveDocumentReview
            config={config}
            values={values}
            referenceNumber={referenceAnswer(config, values) || document.referenceNumber}
            subTypeLabel={getSubTypeLabel(
              config,
              subTypeAnswer(config, values) || document.subType,
            )}
            spec={selectedTemplateSpec}
            templateUrl={templateUrl ?? undefined}
            templatePending={templatePending}
            templateName={selectedTemplate?.name ?? null}
          />
          {previewWarnings.length > 0 && (
            <p className="text-xs text-pen-orange">⚠ {previewWarnings.join(" · ")}</p>
          )}
        </DialogContent>
      </Dialog>

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
