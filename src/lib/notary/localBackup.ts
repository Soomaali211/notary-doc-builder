/**
 * BACKUP & RESTORE (§41).
 *
 * The office's data is on one computer, so the office keeps its own copy. A
 * backup is ONE file the user downloads: `.notary-backup.json`. Restoring is
 * choosing that file again. No server, no account, no scheduled upload — the
 * user decides when and where the file goes, which is exactly what §54 asks
 * for.
 *
 * What goes in: every agreement, every draft, all metadata, the reference
 * numbers, the settings, and the templates the user has uploaded.
 * What stays out: the built-in office templates. They ship with the program
 * and are not user data; including them would multiply every backup for no
 * gain.
 *
 * The file is a plain, readable JSON document. A notary who loses their
 * machine must be able to open it and know what is inside it.
 */

import {
  ENTITY_NAMES,
  getAllLocal,
  localStore,
  notifyLocal,
  type EntityName,
  type StoredRecord,
} from "./localStore";
import { readSettings, writeSettings, type OfficeSettings } from "./settings";

/** The version of the backup FORMAT, not of the app. */
export const BACKUP_FORMAT = "notary-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_FILE_NAME = ".notary-backup.json";

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** When the backup was taken (ms since the epoch). */
  createdAt: number;
  /** A human date, so the file is readable without opening the app. */
  createdAtLabel: string;
  app: { name: string; version: string };
  counts: Record<string, number>;
  /** One key per entity table. */
  tables: Partial<Record<EntityName, StoredRecord[]>>;
  settings: OfficeSettings;
  /** The office's own reference high-water marks. */
  counters: Record<string, string | null>;
  /** Templates the USER uploaded — the office templates are not data. */
  userTemplates: StoredRecord[];
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

export const COUNTER_KEY_PREFIX = "notary.counters.";

/** Read every reference counter the office has allocated. */
function readCounters(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const store = safeStorage();
  if (!store) return out;
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith(COUNTER_KEY_PREFIX)) {
        out[key.slice(COUNTER_KEY_PREFIX.length)] = store.getItem(key);
      }
    }
  } catch {
    /* A locked-down machine simply backs up no counters. */
  }
  return out;
}

/**
 * Assemble the backup document. Pure enough to be tested: it reads the
 * database and returns a plain object, writing nothing.
 */
export async function buildBackup(): Promise<BackupFile> {
  const tables: Partial<Record<EntityName, StoredRecord[]>> = {};
  const counts: Record<string, number> = {};
  for (const entity of ENTITY_NAMES) {
    const rows = await getAllLocal(entity);
    tables[entity] = rows;
    counts[entity] = rows.length;
  }
  const now = new Date();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now.getTime(),
    createdAtLabel: now.toISOString(),
    app: { name: "Notary Doc Builder", version: "offline" },
    counts,
    tables,
    settings: readSettings(),
    counters: readCounters(),
    userTemplates: tables.templates ?? [],
  };
}

/** Turn a backup into a file the browser can download. */
export function backupBlob(backup: BackupFile): Blob {
  return new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
}

export function downloadBackup(backup: BackupFile): void {
  const blob = backupBlob(backup);
  const url = URL.createObjectURL(blob);
  const a = globalThis.document.createElement("a");
  a.href = url;
  a.download = BACKUP_FILE_NAME;
  globalThis.document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Convenience: build and download in one call. */
export async function exportBackup(): Promise<BackupFile> {
  const backup = await buildBackup();
  downloadBackup(backup);
  return backup;
}

/* ------------------------------------------------------------------ */
/* Restore                                                             */
/* ------------------------------------------------------------------ */

/** Why a file was refused — stated in plain words, never as a stack trace. */
export interface RestoreError {
  message: string;
}

/** Check a parsed JSON value is a backup this program can read. */
export function readBackupFile(input: unknown):
  | { backup: BackupFile; error?: never }
  | { backup?: never; error: RestoreError } {
  const value = input as Partial<BackupFile> | null;
  if (!value || typeof value !== "object") {
    return { error: { message: "Faylku ma aha qaacido duub oo JSON ah." } };
  }
  if (value.format !== BACKUP_FORMAT) {
    return {
      error: {
        message: "Faylkan ma aha backup-ka nidaamka notary-ga.",
      },
    };
  }
  if (typeof value.version !== "number" || value.version > BACKUP_VERSION) {
    return {
      error: {
        message:
          "Backup-ku waa nooca qaabkan ka duul yahay nidaamka hadda — nidaamka waa in la cusboonaysiiyo.",
      },
    };
  }
  if (!value.tables || typeof value.tables !== "object") {
    return { error: { message: "Backup-ku ma laho xogta jirrada." } };
  }
  return { backup: value as BackupFile };
}

/** Parse the text a user picked. Never throws at the user. */
export function parseBackupText(text: string):
  | { backup: BackupFile; error?: never }
  | { backup?: never; error: RestoreError } {
  try {
    return readBackupFile(JSON.parse(text));
  } catch {
    return {
      error: {
        message: "Faylka ma furi karo — kuma aqaadan karo JSON la sheegi karo.",
      },
    };
  }
}

export interface RestoreOptions {
  /**
   * `replace` clears the database first, so what is on the machine is exactly
   * what the file holds. `merge` keeps existing rows and adds/updates the
   * ones the file carries, overwriting on id collision — the safe choice when
   * the office has new work it does not want to lose.
   */
  mode?: "replace" | "merge";
}

/**
 * Write a backup back into the database.
 *
 * `merge` is the default because a restore should never silently destroy
 * agreements that are not in the file. `replace` is offered explicitly, and
 * the caller is responsible for having said so to the user first.
 */
export async function restoreBackup(
  backup: BackupFile,
  options: RestoreOptions = {},
): Promise<Record<string, number>> {
  const mode = options.mode ?? "merge";
  const driver = await localStore();

  if (mode === "replace") {
    await driver.clear();
  }

  const written: Record<string, number> = {};
  for (const entity of ENTITY_NAMES) {
    const rows = backup.tables?.[entity] ?? [];
    for (const row of rows) {
      // A row from an older file has no agreementId; its id is used so the
      // record is still reachable instead of being dropped on the floor.
      await driver.put(entity, {
        ...row,
        id: row.id,
        agreementId: row.agreementId ?? row.id,
      });
    }
    written[entity] = rows.length;
  }

  // Settings and reference counters live outside the tables, so they are put
  // back the same way a new value would be written.
  if (backup.settings) writeSettings(backup.settings);
  for (const [key, value] of Object.entries(backup.counters ?? {})) {
    if (value == null) continue;
    safeStorage()?.setItem(`${COUNTER_KEY_PREFIX}${key}`, value);
  }

  for (const entity of ENTITY_NAMES) notifyLocal(entity);
  return written;
}

/* ------------------------------------------------------------------ */
/* Templates — user uploads stay local too                             */
/* ------------------------------------------------------------------ */

/**
 * The office templates that ship with the program are NOT user data and never
 * enter a backup. The templates the NOTARY uploaded are their data and always
 * do — that is why `templates` is a table of its own, holding only uploads.
 */
export function isUserTemplate(row: StoredRecord): boolean {
  return row.kind === "userTemplate" || Boolean(row.uploadedByUser);
}