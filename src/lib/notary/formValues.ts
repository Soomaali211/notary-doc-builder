import type {
  DocumentConfig,
  FormValues,
  PartyDef,
  PartyRow,
  SectionDef,
} from "./types";

export function emptySectionValues(section: SectionDef): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of section.fields) {
    record[field.id] = field.default ?? "";
  }
  return record;
}

export function emptyPartyRows(partyDef: PartyDef): PartyRow[] {
  return Array.from({ length: Math.max(1, partyDef.min) }, (_, i) => ({
    id: `${partyDef.id}-${i + 1}-${Math.random().toString(36).slice(2, 8)}`,
    values: Object.fromEntries(partyDef.fields.map((f) => [f.id, f.default ?? ""])),
  }));
}

export function createInitialValues(config: DocumentConfig): FormValues {
  const values: FormValues = {};
  for (const section of config.sections) {
    if (section.parties && section.parties.length > 0) {
      for (const partyDef of section.parties) {
        values[partyDef.id] = emptyPartyRows(partyDef);
      }
    } else {
      values[section.id] = emptySectionValues(section);
    }
  }
  return values;
}

export function getSectionValues(
  values: FormValues,
  sectionId: string,
): Record<string, string> {
  const v = values[sectionId];
  return v && !Array.isArray(v) && typeof v === "object"
    ? (v as Record<string, string>)
    : {};
}

export function getPartyRows(values: FormValues, partyId: string): PartyRow[] {
  const v = values[partyId];
  return Array.isArray(v) ? (v as PartyRow[]) : [];
}

export function updateSectionField(
  values: FormValues,
  sectionId: string,
  fieldId: string,
  value: string,
): FormValues {
  const sectionValues = { ...getSectionValues(values, sectionId) };
  sectionValues[fieldId] = value;
  return { ...values, [sectionId]: sectionValues };
}

export function updatePartyField(
  values: FormValues,
  partyId: string,
  rowIndex: number,
  fieldId: string,
  value: string,
): FormValues {
  const rows = getPartyRows(values, partyId).map((row, i) =>
    i === rowIndex ? { ...row, values: { ...row.values, [fieldId]: value } } : row,
  );
  return { ...values, [partyId]: rows };
}

export function addPartyRow(values: FormValues, partyDef: PartyDef): FormValues {
  const rows = getPartyRows(values, partyDef.id);
  // max 0 or undefined = unlimited
  if (partyDef.max && partyDef.max > 0 && rows.length >= partyDef.max) return values;
  const newRow: PartyRow = {
    id: `${partyDef.id}-${rows.length + 1}-${Math.random().toString(36).slice(2, 8)}`,
    values: Object.fromEntries(partyDef.fields.map((f) => [f.id, f.default ?? ""])),
  };
  return { ...values, [partyDef.id]: [...rows, newRow] };
}

export function removePartyRow(
  values: FormValues,
  partyDef: PartyDef,
  rowIndex: number,
): FormValues {
  const rows = getPartyRows(values, partyDef.id);
  if (rows.length <= partyDef.min) return values;
  return {
    ...values,
    [partyDef.id]: rows.filter((_, i) => i !== rowIndex),
  };
}

/** Build the party summary saved into drafts/archive records. */
export function buildPartySummary(
  config: DocumentConfig,
  values: FormValues,
): { role: string; name: string; phone?: string; idNumber?: string }[] {
  const summary: { role: string; name: string; phone?: string; idNumber?: string }[] = [];
  for (const section of config.sections) {
    for (const partyDef of section.parties ?? []) {
      for (const row of getPartyRows(values, partyDef.id)) {
        const name = (row.values?.[partyDef.fields[0]?.id ?? ""] ?? "").trim();
        if (!name) continue;
        summary.push({
          role: partyDef.singular,
          name,
          phone: row.values?.telefoon || undefined,
          idNumber: row.values?.aqoonsi || undefined,
        });
      }
    }
  }
  return summary;
}
