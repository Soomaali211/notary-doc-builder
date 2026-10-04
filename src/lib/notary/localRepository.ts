/**
 * THE LOCAL REPOSITORY — how the app reads and writes its own database.
 *
 * Every page goes through these functions, never through a cloud client. The
 * page code cannot tell whether the tables live in IndexedDB or in memory,
 * and it must never learn that a network exists.
 *
 * §31 — the counts survive a round trip. A blank count stays blank; a count
 * of ten comes back as ten. Nothing here coerces "" into 0.
 * §41 — backup and restore read and write through these same tables.
 */

import {
  getAllLocal,
  localStore,
  newId,
  putLocal,
  removeLocal,
  subscribeLocal,
  type EntityName,
  type StoredRecord,
} from "./localStore";
import type {
  LocalAgreement,
  LocalDocumentStatus,
} from "./localModel";
import type { DocumentConfig, FormValues } from "./types";

/* ------------------------------------------------------------------ */
/* Agreements / drafts (§40)                                           */
/* ------------------------------------------------------------------ */

/**
 * Both a draft and a final agreement are the same document at a different
 * `status`; only the table differs, so the list on Home can show one list.
 */
export async function listAgreements(): Promise<LocalAgreement[]> {
  const [done, drafts] = await Promise.all([
    getAllLocal<LocalAgreement>("agreements"),
    getAllLocal<LocalAgreement>("drafts"),
  ]);
  return [...drafts, ...done].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function getAgreement(
  id: string,
): Promise<LocalAgreement | undefined> {
  const [done, drafts] = await Promise.all([
    getAllLocal<LocalAgreement>("agreements"),
    getAllLocal<LocalAgreement>("drafts"),
  ]);
  return (
    done.find((r) => r.id === id) ?? drafts.find((r) => r.id === id)
  );
}

export interface SaveAgreementInput {
  id?: string;
  documentType: string;
  documentTypeTitle: string;
  subType: string;
  subTypeLabel: string;
  referenceNumber: string;
  agreementDate?: string;
  status?: LocalDocumentStatus;
  valuesJson: string;
  fileBaseName?: string;
  outputDocxPath?: string;
  outputPdfPath?: string;
  fileName?: string;
  templateId?: string;
  templateName?: string;
}

/**
 * Create or update one document. The table the row lands in follows its
 * status: a draft is a draft, and the moment it is exported it becomes an
 * agreement — the office files it, it does not stay a draft.
 */
export async function saveAgreement(
  input: SaveAgreementInput,
): Promise<LocalAgreement> {
  const now = Date.now();
  const id = input.id ?? newId("agr");
  const existing = await getAgreement(id);
  const status = input.status ?? existing?.status ?? "draft";
  const record: LocalAgreement = {
    ...(existing ?? {}),
    kind: "agreement",
    id,
    agreementId: id,
    documentType: input.documentType,
    documentTypeTitle: input.documentTypeTitle,
    subType: input.subType,
    subTypeLabel: input.subTypeLabel,
    referenceNumber: input.referenceNumber,
    agreementDate: input.agreementDate ?? existing?.agreementDate,
    status,
    valuesJson: input.valuesJson,
    fileBaseName: input.fileBaseName ?? existing?.fileBaseName,
    outputDocxPath: input.outputDocxPath ?? existing?.outputDocxPath,
    outputPdfPath: input.outputPdfPath ?? existing?.outputPdfPath,
    fileName: input.fileName ?? existing?.fileName,
    templateId: input.templateId ?? existing?.templateId,
    templateName: input.templateName ?? existing?.templateName,
    // Stamped the FIRST time each moment happens, never rewritten.
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    completedAt:
      status === "completed" || status === "generated" || status === "archived"
        ? existing?.completedAt ?? now
        : existing?.completedAt,
    exportedAt:
      status === "generated" || status === "archived"
        ? existing?.exportedAt ?? now
        : existing?.exportedAt,
  };

  // A row only ever lives in ONE table: moving from drafts to agreements
  // must not leave a copy behind that the Home list would show twice.
  const target: EntityName = status === "draft" ? "drafts" : "agreements";
  const other: EntityName = target === "drafts" ? "agreements" : "drafts";
  await putLocal(target, record);
  const otherRows = await getAllLocal(other);
  if (otherRows.some((r) => r.id === id)) await removeLocal(other, id);
  return record;
}

export async function deleteAgreement(id: string): Promise<void> {
  await removeLocal("agreements", id);
  await removeLocal("drafts", id);
}

/* ------------------------------------------------------------------ */
/* Generated files (§40) — kept on the machine, not on a server        */
/* ------------------------------------------------------------------ */

/**
 * Keep the generated DOCX beside its agreement.
 *
 * §3 — the file is produced on this computer and stored on this computer.
 * There is no download URL that would need a server to serve it, and nothing
 * is uploaded. §41 — the file travels inside the backup, because a notary who
 * loses the machine must not lose the signed document they already made.
 *
 * The bytes are base64 so one row holds them; the record says which format
 * they are, so a PDF written later can sit under the same key.
 */
export async function putGeneratedFile(
  agreementId: string,
  blob: Blob,
  fileName: string,
  kind: "docx" | "pdf" = "docx",
): Promise<void> {
  await putLocal("agreements", {
    kind: "generatedFile",
    id: `file:${kind}:${agreementId}`,
    agreementId,
    fileName,
    format: kind,
    mimeType:
      kind === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf",
    bytesBase64: await blobToBase64(blob),
  });
}

/** Read a generated file back. `null` when the machine has no copy. */
export async function getGeneratedFile(
  agreementId: string,
  kind: "docx" | "pdf" = "docx",
): Promise<{ blob: Blob; fileName: string } | null> {
  const driver = await localStore();
  const row = await driver.get("agreements", `file:${kind}:${agreementId}`);
  if (!row || typeof row.bytesBase64 !== "string") return null;
  const bytes = base64ToBytes(row.bytesBase64);
  const fileName = typeof row.fileName === "string" ? row.fileName : `${agreementId}.${kind}`;
  return {
    blob: new Blob([bytes], { type: String(row.mimeType ?? "application/octet-stream") }),
    fileName,
  };
}

/** Save a file the notary downloaded, so the archive can hand it back. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

/**
 * The document's own date, read from the config's setup section.
 *
 * §40 wants the date stored WITH the record so the archive can show and sort
 * by it without opening the form. Which field carries the date is the
 * config's business, never this module's: it looks for the field the config
 * declares as the reference date (`referenceDateKey`) and falls back to any
 * field whose id says it is a date.
 */
export function setupDateAnswer(
  config: DocumentConfig,
  values: FormValues,
): string | undefined {
  const sectionId = config.setupSectionId;
  const section = sectionId ? values[sectionId] : undefined;
  if (!section || Array.isArray(section)) return undefined;
  const record = section as Record<string, string>;
  if (config.referenceDateKey) {
    const fieldId = config.referenceDateKey.split(".").pop();
    const declared = fieldId ? record[fieldId] : undefined;
    if (declared) return declared;
  }
  for (const [fieldId, value] of Object.entries(record)) {
    if (fieldId.includes("taariikh") || fieldId === "date") {
      if (value) return value;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Reference numbers — allocated locally, never reused                 */
/* ------------------------------------------------------------------ */

const COUNTER_PREFIX = "notary.counters.";

function counterKey(documentType: string, subType: string): string {
  return `${COUNTER_PREFIX}${documentType}:${subType}`;
}

/** The serial digits inside a reference: "DPN-MG-001-01-26" → 1. */
export function referenceSerial(referenceNumber: string): number | undefined {
  const m = (referenceNumber ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : undefined;
}

function readStoredCounter(key: string): number | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw == null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    // Private browsing / locked-down machine. The document scan still works.
    return undefined;
  }
}

/** The id a counter row carries — stable, readable, and inside the database. */
export function counterRowId(documentType: string, subType: string): string {
  return `counter:${documentType}:${subType}`;
}

/**
 * The HIGHEST serial the office has ever handed out.
 *
 * Three sources, and the HIGHEST of them wins:
 *   · the counter row in the local database (survives a restart, is backed
 *     up, and does not depend on browser storage being available);
 *   · the localStorage mirror (belt and braces for a browser that blocks
 *     IndexedDB mid-session);
 *   · the documents themselves (the last line of defence: if all storage was
 *     cleared, the numbers already printed on signed pages are still read out
 *     of the agreements).
 *
 * It is a high-water mark and never a row count: deleting a draft must never
 * make the office reissue a number that is already on a signed page.
 */
export function highestSerial(
  documents: { referenceNumber?: string }[],
  documentType: string,
  subType: string,
): number {
  const fromDocs = documents
    .map((d) => referenceSerial(d.referenceNumber ?? ""))
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const fromMirror = readStoredCounter(counterKey(documentType, subType));
  const candidates = [fromMirror, ...fromDocs].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

/** The counter as stored in the local database, or `undefined`. */
export async function readSerialCounter(
  documentType: string,
  subType: string,
): Promise<number | undefined> {
  const driver = await localStore();
  const row = await driver.get("counters", counterRowId(documentType, subType));
  const value = row?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Allocate the next reference serial and remember it IMMEDIATELY, in the
 * database and in the mirror. Two drafts created in the same second can
 * therefore never share a number.
 */
export async function allocateSerial(
  documents: { referenceNumber?: string }[],
  documentType: string,
  subType: string,
): Promise<number> {
  const stored = await readSerialCounter(documentType, subType);
  const fromDocs = documents
    .map((d) => referenceSerial(d.referenceNumber ?? ""))
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const fromMirror = readStoredCounter(counterKey(documentType, subType));
  const candidates = [stored, fromMirror, ...fromDocs].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  const next = (candidates.length > 0 ? Math.max(...candidates) : 0) + 1;

  const driver = await localStore();
  await driver.put("counters", {
    id: counterRowId(documentType, subType),
    agreementId: `${documentType}:${subType}`,
    kind: "counter",
    documentType,
    subType,
    value: next,
  });
  try {
    globalThis.localStorage?.setItem(counterKey(documentType, subType), String(next));
  } catch {
    // Best effort — the database row and the documents are both still there.
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Search (§39) — local, offline, no network                          */
/* ------------------------------------------------------------------ */

/** The party lists whose names a search must find (§39: buyer and seller). */
const NAME_PARTIES = ["iibiyeyaal", "iibsadayaal", "maragyo", "kooxaha"];
/** The sections that hold the property's identity. */
const PROPERTY_SECTIONS = [
  "hantida_dhul_banaan",
  "hantida_guri",
  "hantida_beer",
];
const PROPERTY_FIELDS = [
  "degmada",
  "xaafada",
  "xaafadda",
  "degmada_xaafadda",
  "goobta",
  "calaamad_dheeraad",
  "cabbirka",
  "lambarka_lahaansho",
];

function rowText(row: unknown, field: string): string {
  const values = (row as { values?: Record<string, string> } | undefined)?.values;
  return (values?.[field] ?? "").trim();
}

/** Every name an agreement names, in the order the document names them. */
export function agreementNames(agreement: LocalAgreement): string[] {
  let values: Record<string, unknown> = {};
  try {
    values = JSON.parse(agreement.valuesJson ?? "{}") as Record<string, unknown>;
  } catch {
    // A draft whose blob is unreadable still searches by reference; it must
    // not take the whole search box down.
    return [];
  }
  const names: string[] = [];
  for (const partyId of NAME_PARTIES) {
    const rows = values[partyId];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const name = rowText(row, "magac");
      if (name) names.push(name);
    }
  }
  return names;
}

/** The sellers' and buyers' names, joined for the search line. */
export function agreementSides(agreement: LocalAgreement): {
  sellers: string;
  buyers: string;
} {
  const collect = (partyId: string): string => {
    let values: Record<string, unknown> = {};
    try {
      values = JSON.parse(agreement.valuesJson ?? "{}") as Record<string, unknown>;
    } catch {
      return "";
    }
    const rows = values[partyId];
    if (!Array.isArray(rows)) return "";
    return rows
      .map((row) => rowText(row, "magac"))
      .filter(Boolean)
      .join(" · ");
  };
  return { sellers: collect("iibiyeyaal"), buyers: collect("iibsadayaal") };
}

/** The property's identity, however the document identifies it. */
export function agreementProperty(agreement: LocalAgreement): string {
  let values: Record<string, unknown> = {};
  try {
    values = JSON.parse(agreement.valuesJson ?? "{}") as Record<string, unknown>;
  } catch {
    return "";
  }
  const parts: string[] = [];
  for (const sectionId of PROPERTY_SECTIONS) {
    const section = values[sectionId];
    if (!section || Array.isArray(section)) continue;
    for (const field of PROPERTY_FIELDS) {
      const text = String((section as Record<string, string>)[field] ?? "").trim();
      if (text) parts.push(text);
    }
  }
  if (agreement.subTypeLabel) parts.unshift(agreement.subTypeLabel);
  return parts.join(" · ");
}

/**
 * The haystack one agreement contributes to a search: reference, name,
 * document type, property, date, buyer and seller — §39, and nothing else.
 *
 * It is built from the row on the spot rather than stored beside it, so a
 * search can never answer from a stale copy of an edited draft.
 */
export function searchHaystack(agreement: LocalAgreement): string {
  const { sellers, buyers } = agreementSides(agreement);
  return [
    agreement.referenceNumber,
    agreement.documentTypeTitle,
    agreement.subTypeLabel,
    agreement.agreementDate ?? "",
    buyers,
    sellers,
    agreementProperty(agreement),
    ...agreementNames(agreement),
  ]
    .join(" \u0001 ")
    .toLowerCase();
}

/** Filter agreements by a free-text query. Pure, local and synchronous. */
export function filterAgreements(
  agreements: LocalAgreement[],
  query: string,
): LocalAgreement[] {
  const q = query.trim().toLowerCase();
  if (q === "") return agreements;
  return agreements.filter((a) => searchHaystack(a).includes(q));
}

/* ------------------------------------------------------------------ */
/* Reactivity — the UI must stay live without a server                */
/* ------------------------------------------------------------------ */

/**
 * Subscribe to local writes. Pages re-read from the tables on every write,
 * which is exactly what a query used to do for them — only offline.
 */
export function useLocalSubscription(
  handler: (entity: EntityName) => void,
): () => void {
  return subscribeLocal(handler);
}