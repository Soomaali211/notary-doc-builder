/**
 * LOCAL STORE — the primary database of the offline notary system.
 *
 * §3: the system runs with INTERNET = OFF. Nothing here talks to a cloud, a
 * CDN or a remote API. IndexedDB is the store; when IndexedDB is missing
 * (private browsing, a locked-down machine, the test runner) the very same
 * API is served from memory so the app still works — degraded durability,
 * never a broken app, and never a silent cloud fallback.
 *
 * Design rules this file keeps:
 *   1. EVERYTHING IS LOCAL. There is no remote path in this module.
 *   2. The entity names mirror §32 exactly — a table per entity, never one
 *      blob per document pretending to be a database.
 *   3. A family / group is its OWN entity (§33): a group has a name and
 *      members, it is never a person.
 *   4. A role is NOT stored on the person (§12). `partyRoles` is a separate
 *      table keyed by person id; `familyRelationship` is a person attribute
 *      and never a role.
 *   5. Photos and signatures are independent entities (§36/§37). Nothing in
 *      this file ever compares a photo count, a signature count or a
 *      representative count with a seller count.
 *
 * §41: backup reads through this same API, so a backup is a dump of these
 * tables and a restore is a write back into them.
 */

/**
 * The local database tables (§32). The names are the office's, not the
 * framework's: an Agreement is a final document, a Draft is the same
 * document still being answered.
 */
export const ENTITY_NAMES = [
  "persons",
  "partyRoles",
  "representations",
  "groups",
  "photos",
  "signatures",
  "witnesses",
  "properties",
  "payments",
  "agreements",
  "drafts",
  /**
   * The office's reference high-water marks.
   *
   * These live in the DATABASE, not only in localStorage: §3 says the database
   * is local and a backup carries the references, so a counter that only
   * existed in browser storage could be lost and a deleted document could make
   * the office reissue a number that is already printed on a signed page.
   */
  "counters",
  /**
   * The templates the NOTARY uploaded. §41: a backup carries the office's own
   * templates because they are the office's data — the templates that ship
   * with the program are not data and never enter a backup.
   */
  "templates",
] as const;

export type EntityName = (typeof ENTITY_NAMES)[number];

/** Every stored record carries a stable id and the document it belongs to. */
export interface StoredRecord {
  id: string;
  /** The agreement (or draft) this row belongs to. */
  agreementId: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}



/** The contract both drivers satisfy. Nothing above this knows which is live. */
export interface LocalStoreDriver {
  /** Which implementation answered — surfaced in Settings so the user knows. */
  readonly kind: "indexeddb" | "memory";
  getAll(entity: EntityName): Promise<StoredRecord[]>;
  get(entity: EntityName, id: string): Promise<StoredRecord | undefined>;
  put(entity: EntityName, record: StoredRecord): Promise<StoredRecord>;
  putMany(entity: EntityName, records: StoredRecord[]): Promise<StoredRecord[]>;
  remove(entity: EntityName, id: string): Promise<void>;
  /** `undefined` entity clears the WHOLE database (restore). */
  clear(entity?: EntityName): Promise<void>;
}

export const DB_NAME = "notary-local";
export const DB_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Ids                                                                 */
/* ------------------------------------------------------------------ */

/**
 * A local row id. `crypto.randomUUID` when the platform has it, and a
 * time-plus-counter id when it does not — an id is never invented by a
 * counter alone, so two rows created in the same millisecond cannot collide.
 */
let idCounter = 0;
export function newId(prefix = "r"): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return `${prefix}_${c.randomUUID()}`;
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Memory driver — the guaranteed fallback                             */
/* ------------------------------------------------------------------ */

/**
 * An in-process database with IndexedDB's shape. This is what runs when the
 * machine refuses IndexedDB, and what the tests run against, so the offline
 * behaviour is testable without a browser.
 */
export function createMemoryDriver(): LocalStoreDriver {
  const tables = new Map<EntityName, Map<string, StoredRecord>>();
  for (const name of ENTITY_NAMES) tables.set(name, new Map());

  const table = (entity: EntityName): Map<string, StoredRecord> => {
    const t = tables.get(entity);
    if (!t) throw new Error(`Unknown local table: ${entity}`);
    return t;
  };

  return {
    kind: "memory",
    async getAll(entity) {
      return [...table(entity).values()].map((r) => ({ ...r }));
    },
    async get(entity, id) {
      const found = table(entity).get(id);
      return found ? { ...found } : undefined;
    },
    async put(entity, record) {
      const previous = table(entity).get(record.id);
      const next: StoredRecord = {
        ...previous,
        ...record,
        createdAt: previous?.createdAt ?? record.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      table(entity).set(record.id, next);
      return { ...next };
    },
    async putMany(entity, records) {
      const out: StoredRecord[] = [];
      for (const record of records) out.push(await this.put(entity, record));
      return out;
    },
    async remove(entity, id) {
      table(entity).delete(id);
    },
    async clear(entity) {
      if (entity) {
        table(entity).clear();
        return;
      }
      for (const name of ENTITY_NAMES) table(name).clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/* IndexedDB driver                                                    */
/* ------------------------------------------------------------------ */

function hasIndexedDb(): boolean {
  try {
    return typeof globalThis.indexedDB !== "undefined" && globalThis.indexedDB !== null;
  } catch {
    return false;
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

/** Open (and if needed create) the local database. */
export function openIndexedDb(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = globalThis.indexedDB.open(name, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const entity of ENTITY_NAMES) {
        if (!db.objectStoreNames.contains(entity)) {
          db.createObjectStore(entity, { keyPath: "id" });
        }
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("IndexedDB could not be opened"));
    open.onblocked = () => reject(new Error("IndexedDB is blocked by another tab"));
  });
}

function tx(
  db: IDBDatabase,
  entity: EntityName,
  mode: IDBTransactionMode,
): { store: IDBObjectStore; done: Promise<void> } {
  const transaction = db.transaction(entity, mode);
  return {
    store: transaction.objectStore(entity),
    done: new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    }),
  };
}

export function createIndexedDbDriver(db: IDBDatabase): LocalStoreDriver {
  return {
    kind: "indexeddb",
    async getAll(entity) {
      const { store, done } = tx(db, entity, "readonly");
      const rows = await request(store.getAll() as IDBRequest<StoredRecord[]>);
      await done;
      return rows;
    },
    async get(entity, id) {
      const { store, done } = tx(db, entity, "readonly");
      const row = await request(store.get(id) as IDBRequest<StoredRecord | undefined>);
      await done;
      return row;
    },
    async put(entity, record) {
      const { store, done } = tx(db, entity, "readwrite");
      const previous = await request(store.get(record.id) as IDBRequest<StoredRecord | undefined>);
      const next: StoredRecord = {
        ...previous,
        ...record,
        createdAt: previous?.createdAt ?? record.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      store.put(next);
      await done;
      return next;
    },
    async putMany(entity, records) {
      const out: StoredRecord[] = [];
      for (const record of records) out.push(await this.put(entity, record));
      return out;
    },
    async remove(entity, id) {
      const { store, done } = tx(db, entity, "readwrite");
      store.delete(id);
      await done;
    },
    async clear(entity) {
      if (entity) {
        const { store, done } = tx(db, entity, "readwrite");
        store.clear();
        await done;
        return;
      }
      for (const name of ENTITY_NAMES) {
        const { store, done } = tx(db, name, "readwrite");
        store.clear();
        await done;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* The singleton                                                       */
/* ------------------------------------------------------------------ */

let driverPromise: Promise<LocalStoreDriver> | null = null;
/** Set by the tests so each test starts from an empty machine. */
let override: LocalStoreDriver | null = null;

/**
 * Open the local database ONCE. If IndexedDB cannot be opened the memory
 * driver takes over — the offline promise is "the app works", and a silent
 * cloud round-trip is never an acceptable way to keep that promise.
 */
export function localStore(): Promise<LocalStoreDriver> {
  if (override) return Promise.resolve(override);
  if (!driverPromise) {
    driverPromise = (async () => {
      if (!hasIndexedDb()) return createMemoryDriver();
      try {
        const db = await openIndexedDb();
        return createIndexedDbDriver(db);
      } catch (err) {
        console.warn(
          "[localStore] IndexedDB is unavailable — running on the in-memory store:",
          err instanceof Error ? err.message : err,
        );
        return createMemoryDriver();
      }
    })();
  }
  return driverPromise;
}

/** Replace the live store (tests). Pass `null` to go back to the real one. */
export function setLocalStoreOverride(next: LocalStoreDriver | null): void {
  override = next;
  lastRead.clear();
}

/** Test helper: a fresh, empty local database. */
export function useMemoryLocalStore(): LocalStoreDriver {
  const driver = createMemoryDriver();
  override = driver;
  return driver;
}

/* ------------------------------------------------------------------ */
/* Last-read snapshot                                                  */
/* ------------------------------------------------------------------ */

/**
 * The most recent successful read of every table. A page mounted later — a
 * route change, a second visit, a server-side render — can start from this
 * instead of “loading”, the way the browser keeps the database warm between
 * visits. Every read refreshes it and every write refreshes the table it
 * touched; a store override clears it so a test never inherits a snapshot.
 */
const lastRead = new Map<EntityName, StoredRecord[]>();

/** The last successful read of a table, synchronously — or nothing yet. */
export function peekAllLocal<T extends StoredRecord>(
  entity: EntityName,
): T[] | undefined {
  const cached = lastRead.get(entity);
  return cached === undefined ? undefined : ([...cached] as T[]);
}

/** Fire-and-forget refresh of one table's snapshot (after a write). */
function refreshSnapshot(entity: EntityName): void {
  void localStore()
    .then((driver) => driver.getAll(entity))
    .then((rows) => lastRead.set(entity, rows))
    .catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Change notification                                                 */
/* ------------------------------------------------------------------ */

type Listener = (entity: EntityName) => void;
const listeners = new Set<Listener>();

/** Subscribe to every local write. The UI hooks use this to stay live. */
export function subscribeLocal(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocal(entity: EntityName): void {
  for (const listener of listeners) listener(entity);
}

/** A write that also tells the UI something moved. */
export async function putLocal(
  entity: EntityName,
  record: StoredRecord,
): Promise<StoredRecord> {
  const driver = await localStore();
  const saved = await driver.put(entity, record);
  notifyLocal(entity);
  refreshSnapshot(entity);
  return saved;
}

export async function removeLocal(entity: EntityName, id: string): Promise<void> {
  const driver = await localStore();
  await driver.remove(entity, id);
  notifyLocal(entity);
  refreshSnapshot(entity);
}

export async function getAllLocal<T extends StoredRecord>(
  entity: EntityName,
): Promise<T[]> {
  const driver = await localStore();
  const rows = (await driver.getAll(entity)) as T[];
  lastRead.set(entity, rows.slice());
  return rows;
}

export async function getLocal<T extends StoredRecord>(
  entity: EntityName,
  id: string,
): Promise<T | undefined> {
  const driver = await localStore();
  return (await driver.get(entity, id)) as T | undefined;
}