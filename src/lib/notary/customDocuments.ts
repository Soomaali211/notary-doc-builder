/**
 * THE FORM BUILDER's data layer — document types the office builds ITSELF.
 *
 * A custom type is a real DocumentConfig: sections ("subgroups"), fields,
 * sub-types and the placeholder tokens its Word template uses. It is stored
 * in the local database (`customDocTypes`) and registered into the runtime
 * registry, so the picker, the catalog, the template manager, the interview
 * and the generation pipeline treat it exactly like the shipped types.
 *
 * The design rules this module keeps:
 *   1. Everything is LOCAL (§3) — the same store, the same backup.
 *   2. Ids are derived from the office's own labels (slugified) and made
 *      unique inside the type — the technical names are never typed twice.
 *   3. Every field automatically exposes ONE {{TOKEN}} so the office can
 *      design its Word template against a stable, copyable list.
 *   4. A setup section is appended automatically so the interview, the
 *      reference allocation and the archive always have the same home for
 *      the reference number and the document date.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentConfig, FieldType, SelectOption } from "./types";
import { registerRuntimeConfigs } from "./documents";
import {
  getAllLocal,
  peekAllLocal,
  putLocal,
  removeLocal,
  subscribeLocal,
  type EntityName,
  type StoredRecord,
} from "./localStore";

/** The local table the builder's output lives in. */
export const CUSTOM_DOC_TYPE_ENTITY: EntityName = "customDocTypes";

/** One stored custom document type: its config, serialized. */
export interface CustomDocTypeRecord extends StoredRecord {
  kind: "customDocType";
  title: string;
  description: string;
  /** The full DocumentConfig of this type, JSON. */
  configJson: string;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Builder form state (what the office edits)                          */
/* ------------------------------------------------------------------ */

/** One field the office edits in the builder. */
export interface BuilderField {
  /** Technical id, kept stable once derived. Empty = derive from label. */
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** select options, plain labels. */
  options: string[];
}

/** One section ("qayb-hoose") of the form. */
export interface BuilderSection {
  title: string;
  fields: BuilderField[];
}

/** The whole builder form for one document type. */
export interface BuilderForm {
  title: string;
  description: string;
  /**
   * The office's own reference prefix, e.g. "DPN-DN". Non-empty means the
   * interview hands out sequential references for this type, exactly the
   * way the built-ins do.
   */
  referencePrefix: string;
  /** Whether the picker's step 2 offers sub-types (Dhul Banaan-style). */
  acceptSubTypes: boolean;
  subTypes: string[];
  sections: BuilderSection[];
}

/** The field types the builder offers, in display order. */
export const BUILDER_FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "currency",
  "date",
  "phone",
  "email",
  "select",
  "yes_no",
];

/** The empty form a brand-new type starts from. */
export function emptyBuilderForm(): BuilderForm {
  return {
    title: "",
    description: "",
    referencePrefix: "",
    acceptSubTypes: false,
    subTypes: [],
    sections: [
      {
        title: "",
        fields: [
          { id: "", label: "", type: "text", required: true, options: [] },
        ],
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Deriving the config                                                 */
/* ------------------------------------------------------------------ */

/** Label → technical id: "Magaca Macmiilka" → "magaca_macmiilka". */
export function slugifyLabel(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug;
}

/** The {{TOKEN}} a field exposes to its Word template. */
export function fieldToken(fieldId: string): string {
  return fieldId.toUpperCase();
}

/** Reserve an id inside one namespace, numbered on collision. */
function unique(candidate: string, used: Set<string>): string {
  let name = candidate;
  let n = 2;
  while (used.has(name)) {
    name = `${candidate}_${n}`;
    n += 1;
  }
  used.add(name);
  return name;
}

/** The setup section's ids can never be reused by a builder field. */
const RESERVED_IDS = new Set(["reference", "taariikhda_heshiiska", "heshiiska"]);

/**
 * Build the DocumentConfig the engine + pipeline run on.
 *
 * `form.sections` are the office's OWN subgroups; a setup section is
 * appended so the reference and the document date always have a home.
 */
export function buildCustomConfig(
  form: BuilderForm,
  existingId?: string,
): DocumentConfig {
  const title = form.title.trim();
  if (!title) throw new Error("The type title is required.");

  const subTypes: SelectOption[] = form.acceptSubTypes
    ? form.subTypes
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => ({
          value: slugifyLabel(label) || label.toLowerCase(),
          label,
        }))
    : [];

  // Field ids share ONE namespace (each token must resolve to one value);
  // section ids have their own.
  const usedFieldIds = new Set<string>(RESERVED_IDS);
  const usedSectionIds = new Set<string>(RESERVED_IDS);

  const userSections = form.sections
    .map((s, si) => {
      const sectionTitle = s.title.trim() || `Qayb ${si + 1}`;
      const fields = s.fields
        .filter((f) => f.label.trim() !== "")
        .map((f) => {
          const id = unique(
            slugifyLabel(f.id) || slugifyLabel(f.label) || "field",
            usedFieldIds,
          );
          const options = f.options
            .map((label) => label.trim())
            .filter(Boolean)
            .map((label) => ({
              value: slugifyLabel(label) || label.toLowerCase(),
              label,
            }));
          return {
            id,
            type: f.type,
            label: f.label.trim(),
            ...(f.required ? {} : { optional: true }),
            ...(options.length > 0 ? { options } : {}),
          };
        });
      return {
        id: unique(slugifyLabel(sectionTitle) || `qayb_${si + 1}`, usedSectionIds),
        title: sectionTitle,
        fields,
      };
    })
    .filter((s) => s.fields.length > 0);

  const setupFields = [
    {
      id: "reference",
      type: "text" as FieldType,
      label: "Nambarka Tixraaca",
      optional: true,
    },
    {
      id: "taariikhda_heshiiska",
      type: "date" as FieldType,
      label: "Taariikhda Heshiiska",
      required: true,
    },
  ];

  const sectionsOut: DocumentConfig["sections"] = [
    ...userSections,
    { id: "heshiiska", title: "Heshiiska", fields: setupFields },
  ];

  // One {{TOKEN}} per field — the stable names the office types in Word.
  // The FORMAT follows the field type so dates print as dates and money as
  // money, exactly like the built-ins' own mapping tables.
  const formatFor = (type: FieldType): "currency" | "date" | "number" | undefined =>
    type === "currency" ? "currency" : type === "date" ? "date" : type === "number" ? "number" : undefined;
  const placeholders = [
    ...userSections.flatMap((section) =>
      section.fields.map((field) => ({
        placeholder: fieldToken(field.id),
        mapping: {
          key: `${section.id}.${field.id}`,
          ...(formatFor(field.type) ? { format: formatFor(field.type)! } : {}),
        },
      })),
    ),
    { placeholder: "REFERENCE_NUMBER", mapping: { key: "heshiiska.reference" } },
    {
      placeholder: "TAARIIKHA_HESHIISKA",
      mapping: { key: "heshiiska.taariikhda_heshiiska", format: "date" as const },
    },
  ];

  const referencePrefix = form.referencePrefix.trim();

  return {
    id: existingId?.trim() || slugifyLabel(title),
    title,
    description: form.description.trim() || title,
    subTypes,
    fileNamePrefix: fileNamePrefixFromTitle(title),
    templatePath: "",
    referencePrefix,
    // A declared prefix turns on the office's own reference allocation —
    // identical mechanics to the built-ins (no reference ticks once).
    ...(referencePrefix ? { referenceFormat: `${referencePrefix}-{serial}` } : {}),
    referenceDateKey: "heshiiska.taariikhda_heshiiska",
    sections: sectionsOut,
    placeholders,
    clauses: [],
    requiresWitness: false,
  };
}

/** "Heshiis Deyn Gaar" → "Heshiis-Deyn-Gaar". */
export function fileNamePrefixFromTitle(title: string): string {
  const words = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  const caps = words.map(
    (w) => (w[0]?.toUpperCase() ?? "") + w.slice(1),
  );
  return caps.join("-") || "Heshiis";
}

/** Trim/normalize the UI form before it is saved. No-op on clean input. */
export function normalizeBuilderForm(form: BuilderForm): BuilderForm {
  return {
    ...form,
    title: form.title.trim(),
    description: form.description.trim(),
    referencePrefix: form.referencePrefix.trim().toUpperCase(),
    subTypes: form.subTypes.map((label) => label.trim()),
    sections: form.sections.map((s) => ({
      title: s.title.trim(),
      fields: s.fields.map((f) => ({
        ...f,
        label: f.label.trim(),
        options: f.options.map((label) => label.trim()).filter(Boolean),
      })),
    })),
  };
}

/**
 * Validation errors the builder shows BEFORE saving. `existingIds` is the
 * union of built-in + already-saved ids, so a rename cannot silently clash.
 */
export function validateBuilderForm(
  form: BuilderForm,
  existingIds: string[],
  editingId?: string,
): string[] {
  const errors: string[] = [];
  if (!form.title.trim()) errors.push("Cinwaanka nooca waa waajib.");
  const slug = slugifyLabel(form.title);
  if (slug && existingIds.includes(slug) && slug !== editingId) {
    errors.push("Nooc kale oo slaag-kiisa ahba horeba wuu jiro.");
  }
  if (
    form.acceptSubTypes &&
    form.subTypes.filter((label) => label.trim()).length === 0
  ) {
    errors.push("Xir doorashada nooyada, ama ku dar mid ka mid ah.");
  }
  const meaningful = form.sections.filter((s) =>
    s.fields.some((f) => f.label.trim() !== ""),
  );
  if (meaningful.length === 0) {
    errors.push("Hal Qayb oo ugu yaraan ayaa waajib ah.");
  }
  if (form.sections.length !== meaningful.length) {
    // Empty sections silently disappear; tell the office once.
    errors.push("Qaybaha banaan lama kaydinayo.");
  }
  return errors;
}

/* ------------------------------------------------------------------ */
/* Reading back: stored row → config + builder form                    */
/* ------------------------------------------------------------------ */

/** Parse a stored row's config JSON — never throws into the caller. */
export function deserializeCustomConfig(
  record: CustomDocTypeRecord,
): DocumentConfig | undefined {
  try {
    return JSON.parse(record.configJson) as DocumentConfig;
  } catch {
    return undefined;
  }
}

/** Invert buildCustomConfig for editing: a saved config → the builder form. */
export function builderFormFromConfig(config: DocumentConfig): BuilderForm {
  const userSections = config.sections.filter((s) => s.id !== "heshiiska");
  return {
    title: config.title,
    description: config.description,
    referencePrefix: config.referencePrefix ?? "",
    acceptSubTypes: config.subTypes.length > 0,
    subTypes: config.subTypes.map((s) => s.label),
    sections: userSections.map((s) => ({
      title: s.title,
      fields: s.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: !f.optional,
        options: f.options?.map((o) => o.label) ?? [],
      })),
    })),
  };
}

/**
 * The copyable token list of a saved type — what the office types in Word
 * ({{TOKEN}}) and what the template manager finds in the uploaded file.
 */
export function tokenList(config: DocumentConfig): { token: string; label: string }[] {
  return config.placeholders.map((p) => ({
    token: p.placeholder.toUpperCase(),
    label: p.mapping.key,
  }));
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

function newLocalId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

/** Save (or update) a custom type; returns the row id. */
export async function saveCustomDocType(
  form: BuilderForm,
  editingId?: string,
): Promise<string> {
  const config = buildCustomConfig(
    normalizeBuilderForm(form),
    editingId ?? slugifyLabel(form.title),
  );
  const now = Date.now();
  const id = editingId ?? newLocalId("customDoc");
  const row: CustomDocTypeRecord = {
    id,
    agreementId: "",
    kind: "customDocType",
    title: config.title,
    description: config.description,
    configJson: JSON.stringify(config),
    createdAt: now,
    updatedAt: now,
  };
  await putLocal(CUSTOM_DOC_TYPE_ENTITY, row);
  return id;
}

/** Delete a custom type. Its drafts keep their stored subTypeLabel — data. */
export async function deleteCustomDocType(rowId: string): Promise<void> {
  await removeLocal(CUSTOM_DOC_TYPE_ENTITY, rowId);
}

/* ------------------------------------------------------------------ */
/* Hydration — one hook, every screen                                  */
/* ------------------------------------------------------------------ */

export interface UseCustomDocumentConfigs {
  configs: DocumentConfig[];
  rows: CustomDocTypeRecord[];
  loading: boolean;
  reload: () => void;
}

/**
 * READ the custom types and register them, reactively.
 *
 * The moment a type is saved (or deleted) every screen that reads this hook
 * re-renders — the picker, the catalog, the template manager, the builder —
 * and the runtime registry is refreshed, so `getConfig` resolves a custom
 * type for the interview and the pipeline without any extra wiring.
 */
export function useCustomDocumentConfigs(): UseCustomDocumentConfigs {
  const [rows, setRows] = useState<CustomDocTypeRecord[] | undefined>(() =>
    peekAllLocal<CustomDocTypeRecord>(CUSTOM_DOC_TYPE_ENTITY),
  );

  const reload = useCallback(() => {
    let cancelled = false;
    getAllLocal<CustomDocTypeRecord>(CUSTOM_DOC_TYPE_ENTITY)
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((err) => {
        console.error("[customDocTypes] could not be read:", err);
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = reload();
    const unsubscribe = subscribeLocal((changed) => {
      if (changed === CUSTOM_DOC_TYPE_ENTITY) reload();
    });
    return () => {
      cancel?.();
      unsubscribe();
    };
  }, [reload]);

  const list = rows ?? [];
  const configs = useMemo(
    () =>
      list
        .map(deserializeCustomConfig)
        .filter((c): c is DocumentConfig => Boolean(c)),
    [list],
  );

  // Keep the sync registry in step with what this component read.
  useEffect(() => {
    registerRuntimeConfigs(configs);
  }, [configs]);

  return { configs, rows: list, loading: rows === undefined, reload };
}
