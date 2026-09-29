import type {
  DocumentConfig,
  FormValues,
  PartyDef,
  PartyRow,
  SectionDef,
} from "./types";
import { isPartyList } from "./conditions";

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

/** "2026-01-15" → "15 Janaayo 2026" (Somali date formatting). */
export function formatSomaliDate(value: string | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const [, y, m, d] = match;
  const monthIndex = Number(m) - 1;
  if (monthIndex < 0 || monthIndex > 11) return value;
  return `${Number(d)} ${SOMALI_MONTHS[monthIndex]} ${y}`;
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
): string {
  const value = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  if (!value) return "";
  switch (kind) {
    case "date":
      return formatSomaliDate(value);
    case "currency":
      return formatSomaliCurrency(value);
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
