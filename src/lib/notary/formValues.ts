import type {
  DocumentConfig,
  FormValues,
  PartyDef,
  PartyRow,
  SectionDef,
} from "./types";
import { representativesKeyFor } from "./types";

/* ------------------------------------------------------------------ */
/* Draft migration (back-compat)                                       */
/* ------------------------------------------------------------------ */

/**
 * Migrate pre–Step-1 drafts to the current config:
 *  – old `deebaaji.deebaaji_jira` → `heshiiska.deebaaji_haa`
 *  – old `lacagta.damiin_jira` → `heshiiska.damiin_haa`
 * Old data is preserved (never deleted); the setup answers simply point
 * at where the data already lives. Visibility rules read the new keys.
 */
export function migrateDraftValues(values: FormValues): FormValues {
  const heshiiska = { ...getSectionValues(values, "heshiiska") };
  const deebaaji = { ...getSectionValues(values, "deebaaji") };
  const lacagta = { ...getSectionValues(values, "lacagta") };

  // Old drafts stored the deposit decision on the Deebaaji section; the
  // new Step 1 question (heshiiska.deebaaji_haa) drives visibility now.
  if (heshiiska.deebaaji_haa === undefined && deebaaji.deebaaji_jira !== undefined) {
    if (deebaaji.deebaaji_jira !== "") heshiiska.deebaaji_haa = deebaaji.deebaaji_jira;
  }
  // Old drafts asked for the guarantor inside Lacagta.
  if (heshiiska.damiin_haa === undefined && lacagta.damiin_jira !== undefined) {
    if (lacagta.damiin_jira !== "") heshiiska.damiin_haa = lacagta.damiin_jira;
  }
  // Legacy damiin_jira / deebaaji_jira values are kept in place (data is
  // never silently dropped) but are no longer referenced by the config.
  if (lacagta.damiin_jira !== undefined) delete lacagta.damiin_jira;
  if (deebaaji.deebaaji_jira !== undefined) delete deebaaji.deebaaji_jira;

  return {
    ...values,
    heshiiska: heshiiska,
    ...(deebaaji.deebaaji_jira !== undefined || lacagta.damiin_jira !== undefined
      ? { deebaaji, lacagta }
      : {}),
  } as FormValues;
}

/* ------------------------------------------------------------------ */
/* Fresh templates                                                     */
/* ------------------------------------------------------------------ */

export function emptySectionValues(section: SectionDef): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of section.fields) {
    record[field.id] = field.default ?? "";
  }
  return record;
}

/** Build one empty party row (optionally carrying an attendance default). */
export function emptyPartyRow(partyDef: PartyDef): PartyRow {
  return {
    id: `${partyDef.id}-${Math.random().toString(36).slice(2, 8)}`,
    values: Object.fromEntries(partyDef.fields.map((f) => [f.id, f.default ?? ""])),
  };
}

export function emptyPartyRows(partyDef: PartyDef): PartyRow[] {
  return Array.from({ length: Math.max(1, partyDef.min) }, () => emptyPartyRow(partyDef));
}

/** Apply draft migration, then merge over a fresh template. */
export function createValuesFromDraft(config: DocumentConfig, json?: string | null): FormValues {
  const migrated = migrateDraftValues(safeParseDraft(json));
  return mergeWithFresh(config, migrated);
}

function safeParseDraft(json: string | null | undefined): FormValues {
  if (!json || json === "{}") return {} as FormValues;
  try {
    const parsed = JSON.parse(json) as FormValues;
    return parsed && typeof parsed === "object" ? parsed : ({} as FormValues);
  } catch {
    return {} as FormValues;
  }
}

function mergeWithFresh(config: DocumentConfig, stored: FormValues): FormValues {
  const fresh = createInitialValues(config);
  return { ...fresh, ...stored };
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

/* ------------------------------------------------------------------ */
/* Accessors                                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Mutators (existing API preserved)                                   */
/* ------------------------------------------------------------------ */

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
  return { ...values, [partyDef.id]: [...rows, emptyPartyRow(partyDef)] };
}

export function removePartyRow(
  values: FormValues,
  partyDef: PartyDef,
  rowIndex: number,
): FormValues {
  const rows = getPartyRows(values, partyDef.id);
  if (rows.length <= partyDef.min) return values;
  const removed = rows[rowIndex];
  const next = rows.filter((_, i) => i !== rowIndex);
  let out: FormValues = { ...values, [partyDef.id]: next };
  // Drop representative links pointing at a removed row (keep integrity).
  if (removed) {
    out = detachRepresentative(out, removed.id);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Phase Revision — count-first number selector                        */
/* ------------------------------------------------------------------ */

/**
 * setPartyCount(): grow/shrink a party list to exactly `count` rows.
 * Growing appends fresh rows; shrinking keeps the FIRST rows (the user
 * fills them in order) and detaches any representative links of the
 * removed ones. Respects `max`/`min` bounds.
 */
export function setPartyCount(
  values: FormValues,
  partyDef: PartyDef,
  count: number,
): FormValues {
  const bounded = Math.max(
    partyDef.min,
    partyDef.max && partyDef.max > 0 ? Math.min(count, partyDef.max) : count,
  );
  const rows = getPartyRows(values, partyDef.id);
  if (bounded === rows.length) return values;

  if (bounded > rows.length) {
    const added = Array.from({ length: bounded - rows.length }, () => emptyPartyRow(partyDef));
    return { ...values, [partyDef.id]: [...rows, ...added] };
  }

  const kept = rows.slice(0, bounded);
  const removedIds = new Set(rows.slice(bounded).map((r) => r.id));
  let out: FormValues = { ...values, [partyDef.id]: kept };
  for (const id of removedIds) {
    out = detachRepresentative(out, id);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Phase Revision — attendance & representative model                  */
/* ------------------------------------------------------------------ */

/** Representatives (wakiillo) of one attendance-enabled group. */
export function getRepresentatives(
  values: FormValues,
  partyDef: PartyDef,
): PartyRow[] {
  return getPartyRows(values, representativesKeyFor(partyDef));
}

/** Create an empty representative row for a group. */
export function addRepresentative(values: FormValues, partyDef: PartyDef): FormValues {
  const key = representativesKeyFor(partyDef);
  const reps = getRepresentatives(values, partyDef);
  const row: PartyRow = {
    id: `${key}-${Math.random().toString(36).slice(2, 8)}`,
    values: Object.fromEntries(
      (partyDef.representativeFields ?? []).map((f) => [f.id, f.default ?? ""]),
    ),
  };
  return { ...values, [key]: [...reps, row] };
}

/** Update one representative field. */
export function updateRepresentativeField(
  values: FormValues,
  partyDef: PartyDef,
  repId: string,
  fieldId: string,
  value: string,
): FormValues {
  const key = representativesKeyFor(partyDef);
  const reps = getRepresentatives(values, partyDef).map((r) =>
    r.id === repId ? { ...r, values: { ...r.values, [fieldId]: value } } : r,
  );
  return { ...values, [key]: reps };
}

/** Remove a representative and detach every party link pointing at it. */
export function removeRepresentative(
  values: FormValues,
  partyDef: PartyDef,
  repId: string,
): FormValues {
  const key = representativesKeyFor(partyDef);
  const reps = getRepresentatives(values, partyDef).filter((r) => r.id !== repId);
  const rows = getPartyRows(values, partyDef.id).map((r) =>
    r.attendance?.representativeId === repId
      ? { ...r, attendance: { status: "wakiil" as const } }
      : r,
  );
  return { ...values, [key]: reps, [partyDef.id]: rows };
}

/** Set one party's attendance status (clears the rep link unless wakiil). */
export function setAttendanceStatus(
  values: FormValues,
  partyId: string,
  rowIndex: number,
  status: "jooga" | "ma_joogo" | "wakiil",
): FormValues {
  const rows = getPartyRows(values, partyId).map((row, i) =>
    i === rowIndex
      ? {
          ...row,
          attendance:
            status === "wakiil"
              ? { status }
              : { status },
        }
      : row,
  );
  return { ...values, [partyId]: rows };
}

/**
 * Assign (or re-assign) one party to a representative — the shared
 * PartyRepresentative relationship. One rep may serve many parties;
 * the party keeps its attendance status "wakiil".
 */
export function assignRepresentative(
  values: FormValues,
  partyId: string,
  rowIndex: number,
  representativeId: string | undefined,
): FormValues {
  const rows = getPartyRows(values, partyId).map((row, i) =>
    i === rowIndex
      ? {
          ...row,
          attendance: {
            status: "wakiil" as const,
            ...(representativeId ? { representativeId } : {}),
          },
        }
      : row,
  );
  return { ...values, [partyId]: rows };
}

/** Clear every rep link pointing at a removed row id (party rows only). */
export function detachRepresentative(values: FormValues, representativeId: string): FormValues {
  let out = values;
  for (const [key, v] of Object.entries(values)) {
    if (!Array.isArray(v)) continue;
    const rows = v as PartyRow[];
    const changed = rows.some(
      (r) => r.attendance?.representativeId === representativeId,
    );
    if (changed) {
      out = {
        ...out,
        [key]: rows.map((r) =>
          r.attendance?.representativeId === representativeId
            ? { ...r, attendance: { status: "wakiil" as const } }
            : r,
        ),
      };
    }
  }
  return out;
}

/** Name of the representative linked to one party row (empty when none). */
export function representativeNameFor(
  values: FormValues,
  partyDef: PartyDef,
  row: PartyRow,
): string {
  const repId = row.attendance?.representativeId;
  if (!repId) return "";
  const rep = getRepresentatives(values, partyDef).find((r) => r.id === repId);
  const nameField = partyDef.representativeFields?.[0]?.id ?? "magac";
  return (rep?.values?.[nameField] ?? "").trim();
}

/** Names of the parties one representative acts for ("Matalaya: …"). */
export function representedByRep(
  values: FormValues,
  partyDef: PartyDef,
  repId: string,
): string[] {
  const nameField = partyDef.fields[0]?.id ?? "magac";
  return getPartyRows(values, partyDef.id)
    .filter((r) => r.attendance?.representativeId === repId)
    .map((r, i) => (r.values?.[nameField] ?? "").trim() || `${partyDef.singular} ${i + 1}`)
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Party summary (drafts + archive)                                    */
/* ------------------------------------------------------------------ */

/** Build the party summary saved into drafts/archive records. */
export function buildPartySummary(
  config: DocumentConfig,
  values: FormValues,
): {
  role: string;
  name: string;
  phone?: string;
  idNumber?: string;
  attendance?: "jooga" | "ma_joogo" | "wakiil";
  representative?: string;
  representing?: string;
}[] {
  const summary: {
    role: string;
    name: string;
    phone?: string;
    idNumber?: string;
    attendance?: "jooga" | "ma_joogo" | "wakiil";
    representative?: string;
    representing?: string;
  }[] = [];
  for (const section of config.sections) {
    for (const partyDef of section.parties ?? []) {
      for (const row of getPartyRows(values, partyDef.id)) {
        const name = (row.values?.[partyDef.fields[0]?.id ?? ""] ?? "").trim();
        if (!name) continue;
        const att = row.attendance;
        const repName =
          att?.status === "wakiil" ? representativeNameFor(values, partyDef, row) : undefined;
        summary.push({
          role: partyDef.singular,
          name,
          phone: row.values?.telefoon || undefined,
          idNumber: row.values?.aqoonsi || undefined,
          ...(partyDef.attendance && att ? { attendance: att.status } : {}),
          ...(repName ? { representative: repName } : {}),
        });
      }
      // Representative summary rows — who they act for.
      if (partyDef.attendance) {
        for (const rep of getRepresentatives(values, partyDef)) {
          const nameField = partyDef.representativeFields?.[0]?.id ?? "magac";
          const repName = (rep.values?.[nameField] ?? "").trim();
          if (!repName) continue;
          const representing = representedByRep(values, partyDef, rep.id);
          if (representing.length === 0) continue;
          summary.push({
            role: "Wakiil",
            name: repName,
            phone: rep.values?.telefoon || undefined,
            idNumber: rep.values?.aqoonsi || undefined,
            representing: representing.join(", "),
          });
        }
      }
    }
  }
  return summary;
}
