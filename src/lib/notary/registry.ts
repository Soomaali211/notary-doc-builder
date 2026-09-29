/**
 * Phase 3A — Template Registry & Template Loader
 *
 * The registry is the ONLY trusted source of template paths (security:
 * no path traversal, no arbitrary template paths — every lookup resolves
 * through the config-declared registry). Word templates are designed by
 * the notary office; the app never designs or restyles them — it only
 * fills placeholders. Selection is automatic by (document_type, subtype)
 * and config-driven: no hard-coded template paths in the pipeline.
 */

import type { DocumentConfig, FormValues, TemplateSpec } from "./types";
import { documentConfigs, getConfig, getSubTypeLabel } from "./documents";

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

/**
 * Materialize the registry from config data. `templates` entries may omit
 * bookkeeping fields; the registry fills them in. The active spec for a
 * (documentType, subtype) is the highest-version non-retired entry.
 */
export function registryTemplates(): TemplateSpec[] {
  const specs: TemplateSpec[] = [];
  for (const config of documentConfigs) {
    for (const t of config.templates ?? []) {
      specs.push({
        ...t,
        name: t.name || getSubTypeLabel(config, t.subtype),
        status: t.status ?? "active",
        createdAt: t.createdAt ?? 0,
        updatedAt: t.updatedAt ?? t.createdAt ?? 0,
      });
    }
  }
  return specs;
}

/**
 * get_template(): resolve the active template for a document type + subtype.
 * Returns undefined when no template is registered (validation reports it).
 */
export function getTemplate(
  documentType: string,
  subtype: string,
): TemplateSpec | undefined {
  const candidates = registryTemplates()
    .filter(
      (t) =>
        t.documentType === documentType &&
        t.subtype === subtype &&
        t.status !== "retired",
    )
    .sort((a, b) => b.version - a.version);
  return candidates[0];
}

/** get_template_by_id(): exact lookup (used by archive / metadata screens). */
export function getTemplateById(templateId: string): TemplateSpec | undefined {
  return registryTemplates().find((t) => t.templateId === templateId);
}

/**
 * Automatic selection used by the generation pipeline: reads the user's
 * chosen sub-type from the answers (heshiiska.sub_type) — config-driven,
 * never hard-coded. Falls back to the document type's only template when
 * the config declares exactly one.
 */
export function selectTemplate(
  config: DocumentConfig,
  values: FormValues,
): TemplateSpec | undefined {
  const subTypeRaw = values["heshiiska"];
  const subType =
    subTypeRaw && !Array.isArray(subTypeRaw)
      ? String((subTypeRaw as Record<string, string>)["sub_type"] ?? "")
      : "";
  if (subType) {
    const found = getTemplate(config.id, subType);
    if (found) return found;
  }
  const specs = (config.templates ?? []).filter((t) => t.status !== "retired");
  return specs.length === 1
    ? { ...specs[0], name: specs[0].name || getSubTypeLabel(config, specs[0].subtype) }
    : undefined;
}

/** All templates of one document type (for the Admin validate screen). */
export function templatesForDocumentType(documentType: string): TemplateSpec[] {
  return registryTemplates().filter((t) => t.documentType === documentType);
}

/* ------------------------------------------------------------------ */
/* Template Loader                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fetch the template bytes from its registered public path.
 * The path always comes from the registry — caller-supplied paths are
 * rejected so user input can never point at arbitrary files.
 */
export async function loadTemplate(
  spec: TemplateSpec,
): Promise<ArrayBuffer> {
  if (!spec.filePath.startsWith("/templates/")) {
    throw new Error("Template path must come from the trusted registry.");
  }
  const res = await fetch(spec.filePath);
  if (!res.ok) {
    throw new Error(`Template lama helin: ${spec.filePath}`);
  }
  return await res.arrayBuffer();
}

/** Load by document type + subtype in one step (pipeline convenience). */
export async function loadTemplateFor(
  config: DocumentConfig,
  values: FormValues,
): Promise<{ spec: TemplateSpec; bytes: ArrayBuffer }> {
  const spec = selectTemplate(config, values);
  if (!spec) {
    throw new Error(
      `Template loo diiwaangelinayo nooca "${config.id}" lama helin (subtype maqan ama aan la diiwaangelin).`,
    );
  }
  const bytes = await loadTemplate(spec);
  return { spec, bytes };
}

/** Convenience re-export so pages import registry + config from one place. */
export { getConfig };
