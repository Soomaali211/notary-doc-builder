import type {
  CurrencyFormatConfig,
  DocumentConfig,
  DocumentFormatConfig,
  FormValues,
  PartyDef,
  PartyRow,
  SectionDef,
} from "./types";
import { isPartyList } from "./conditions";
import { formatCurrencyWordsSomali } from "./somaliNumbers";

const SOMALI_MONTHS = [
  "Janaayo",
  "Febraayo",
  "Maarso",
  "Abriil",
  "Maajo",
  "Juun",
  "Luulyo",
  "Agosto",
  "Sebtembar",
  "Oktoobar",
  "Nofembar",
  "Diseembar",
];

export type SomaliDateFormat = "D MMMM YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";

/** "2026-03-16" → "Maarso" (month name only, Somali). */
export function formatSomaliMonth(value: string | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return "";
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return "";
  return SOMALI_MONTHS[monthIndex];
}

/**
 * "2026-01-15" → "15 Janaayo 2026" by default; the format is configurable
 * per document type (e.g. "29/09/2026" with "DD/MM/YYYY").
 */
export function formatSomaliDate(
  value: string | undefined,
  format: SomaliDateFormat = "D MMMM YYYY",
): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const [, y, m, d] = match;
  const monthIndex = Number(m) - 1;
  if (monthIndex < 0 || monthIndex > 11) return value;
  switch (format) {
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "YYYY-MM-DD":
      return `${y}-${m}-${d}`;
    default:
      return `${Number(d)} ${SOMALI_MONTHS[monthIndex]} ${y}`;
  }
}

/** 35000 → "35,000 USD" (Somali currency formatting, USD/M). */
export function formatSomaliCurrency(value: string | number | undefined): string {
  if (value === undefined || value === "" || value === null) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const formatted = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${formatted} USD`;
}

export function formatSomaliNumber(value: string | number | undefined): string {
  if (value === undefined || value === "" || value === null) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Currency rendering driven by the document's format config:
 *   mode "symbol" → $500 · mode "code" → 500 USD · mode "words" → Shan Boqol oo Dollar.
 */
export function formatCurrencyValue(
  value: string | number | undefined,
  cfg?: CurrencyFormatConfig,
): string {
  if (value === undefined || value === "" || value === null) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const mode = cfg?.mode ?? "code";
  if (mode === "words") {
    return formatCurrencyWordsSomali(n, cfg?.wordsUnit ?? "Dollar");
  }
  const formatted = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (mode === "symbol") return `${cfg?.symbol ?? "$"}${formatted}`;
  return `${formatted} ${cfg?.code ?? "USD"}`;
}

/** yes / no / "" → "Haa" / "Maya" / "". */
export function formatYesNo(value: string | undefined): string {
  if (value === "yes") return "Haa";
  if (value === "no") return "Maya";
  return "";
}

/** Join an array skipping empties. */
export function joinNonEmpty(parts: string[], separator = ", "): string {
  return parts.filter((p) => p.trim().length > 0).join(separator);
}

/** Build a "[Name — phone — ID]" style row for a party. */
export function describePartyRow(
  row: PartyRow,
  fields: { id: string; label: string }[],
): string {
  const parts = fields.map((f) => row.values?.[f.id] ?? "").filter(Boolean);
  return joinNonEmpty(parts, " — ");
}

/** Format a mapped value according to its FormatKind. */
export function formatValueByKind(
  raw: unknown,
  kind: string | undefined,
  formatConfig?: DocumentFormatConfig,
): string {
  const value = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  if (!value) return "";
  switch (kind) {
    case "date":
      return formatSomaliDate(value, formatConfig?.dateFormat);
    case "month":
      return formatSomaliMonth(value);
    case "currency":
      return formatCurrencyValue(value, formatConfig?.currency);
    case "currency_words":
      return formatCurrencyValue(value, {
        mode: "words",
        wordsUnit: formatConfig?.currency?.wordsUnit,
      });
    case "number":
      return formatSomaliNumber(value);
    case "yesno":
      return formatYesNo(value);
    default:
      return value;
  }
}

/** Resolve a mapping key ("section.field" or "party.field") to a raw value. */
export function resolveKey(formValues: FormValues, key: string): unknown {
  const [sectionId, fieldId] = key.split(".");
  if (fieldId == null) return formValues[sectionId];
  const sectionValue = formValues[sectionId];
  if (isPartyList(sectionValue)) {
    const fieldKey = key.split(".")[1] ?? "";
    return sectionValue.map((r) => r.values?.[fieldKey] ?? "");
  }
  if (sectionValue && typeof sectionValue === "object") {
    return (sectionValue as Record<string, string>)[fieldId];
  }
  return undefined;
}

/** All section defs + party defs flattened, for lookups. */
export function allSections(config: DocumentConfig): SectionDef[] {
  return config.sections;
}

export function allParties(config: DocumentConfig): PartyDef[] {
  return config.sections.flatMap((s) => s.parties ?? []);
}

export function findSection(config: DocumentConfig, id: string) {
  return config.sections.find((s) => s.id === id);
}
