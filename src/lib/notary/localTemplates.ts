/**
 * LOCAL TEMPLATE STORE.
 *
 * §3 — templates are local. A Word template uploaded by the office used to
 * live in cloud file storage behind a URL the app fetched. On an offline
 * machine that fetch is the first thing that fails, and a notary who cannot
 * open their own template cannot work. So the BYTES live here, in the same
 * IndexedDB database as the agreements, and the template picker reads them
 * from disk.
 *
 * §41 — the office's uploaded templates are the office's data, so they are in
 * the backup. The templates that ship with the program are NOT data and never
 * enter one.
 *
 * The template's DESIGN is never touched here. This module stores bytes and
 * the scanned {{PLACEHOLDER}} list, and nothing else — the same contract the
 * cloud version had.
 */

import { getAllLocal, putLocal, type StoredRecord } from "./localStore";
import type { UserTemplateRecord } from "./userTemplate";

/**
 * A template row as it is stored locally. It carries the SAME fields the
 * cloud record had, plus the bytes themselves.
 */
export interface LocalTemplateRow extends StoredRecord {
  kind: "userTemplate";
  /** A stable local id, used exactly where `_id` was used before. */
  _id: string;
  _creationTime: number;
  documentType: string;
  subtype?: string;
  name: string;
  fileName: string;
  sizeBytes: number;
  /** The .docx bytes, base64 — never uploaded, never fetched. */
  bytesBase64: string;
  placeholdersJson?: string;
  warningsJson?: string;
  isDefault: boolean;
  status: "active" | "retired";
  createdAt: number;
  updatedAt: number;
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Chunked so a large template does not blow the argument limit.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

export interface SaveTemplateInput {
  documentType: string;
  subtype?: string;
  name: string;
  fileName: string;
  bytes: ArrayBuffer;
  placeholders?: string[];
  warnings?: string[];
  isDefault?: boolean;
}

/**
 * Save an uploaded template locally.
 *
 * An upload is a NEW row, never an overwrite: the office edits a template
 * in Word and uploads again, and the newest upload becomes the revision in
 * force while the earlier ones stay on disk. A template that is already the
 * default stops being the default when a newer one arrives for the same
 * document type — the newest upload wins.
 */
export async function saveTemplateLocal(
  input: SaveTemplateInput,
): Promise<LocalTemplateRow> {
  const now = Date.now();
  const id = `tpl_${now.toString(36)}_${Math.floor(now % 9973).toString(36)}`;
  const existing = (await listTemplatesLocal()).filter(
    (t) => t.documentType === input.documentType && t.status === "active",
  );

  // One default per document type, and it is always the newest upload.
  for (const other of existing) {
    if (other.isDefault) {
      await putLocal("templates", { ...other, isDefault: false } as LocalTemplateRow);
    }
  }

  const row: LocalTemplateRow = {
    kind: "userTemplate",
    id,
    agreementId: input.documentType,
    _id: id,
    _creationTime: now,
    documentType: input.documentType,
    subtype: input.subtype,
    name: input.name,
    fileName: input.fileName,
    sizeBytes: input.bytes.byteLength,
    bytesBase64: bytesToBase64(input.bytes),
    placeholdersJson: JSON.stringify(input.placeholders ?? []),
    warningsJson: JSON.stringify(input.warnings ?? []),
    isDefault: input.isDefault ?? true,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  return (await putLocal("templates", row)) as LocalTemplateRow;
}

/** Every uploaded template, newest first. */
export async function listTemplatesLocal(
  documentType?: string,
): Promise<LocalTemplateRow[]> {
  const rows = await getAllLocal<LocalTemplateRow>("templates");
  return rows
    .filter((r) => (documentType ? r.documentType === documentType : true))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/**
 * The template's bytes, read from this machine. The cloud version fetched a
 * URL; this one cannot fail because there is no network in the path.
 */
export async function templateBytesLocal(
  templateId: string,
): Promise<ArrayBuffer> {
  const rows = await getAllLocal<LocalTemplateRow>("templates");
  const row = rows.find((r) => r._id === templateId);
  if (!row) throw new Error("Template-ka lama helin.");
  return base64ToBytes(row.bytesBase64);
}

/** Retire a template. Nothing is deleted: it may already be on a document. */
export async function retireTemplateLocal(templateId: string): Promise<void> {
  const rows = await getAllLocal<LocalTemplateRow>("templates");
  const row = rows.find((r) => r._id === templateId);
  if (!row) return;
  await putLocal("templates", {
    ...row,
    status: "retired",
    isDefault: false,
  } as LocalTemplateRow);
}

/** Promote a template to default — an explicit choice by the office. */
export async function makeDefaultTemplateLocal(templateId: string): Promise<void> {
  const rows = await getAllLocal<LocalTemplateRow>("templates");
  const target = rows.find((r) => r._id === templateId);
  if (!target) return;
  for (const row of rows) {
    if (row.documentType !== target.documentType) continue;
    await putLocal("templates", {
      ...row,
      isDefault: row._id === templateId,
    } as LocalTemplateRow);
  }
}

/** A local row in the shape the rest of the app already consumes. */
export function asUserTemplateRecord(row: LocalTemplateRow): UserTemplateRecord {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    documentType: row.documentType,
    subtype: row.subtype,
    name: row.name,
    fileName: row.fileName,
    storageId: row.id,
    sizeBytes: row.sizeBytes,
    placeholdersJson: row.placeholdersJson,
    warningsJson: row.warningsJson,
    isDefault: row.isDefault,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}