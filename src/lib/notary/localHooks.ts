/**
 * LOCAL HOOKS — the reactive layer over the local database.
 *
 * These replace the Convex `useQuery` calls the pages used to make. The
 * shape is deliberately familiar (data, loading, and a refetch), but the
 * source is the machine in front of the user: no socket, no subscription, no
 * network call. When the internet is off these behave exactly as they do when
 * it is on, because there was never a connection to lose.
 *
 * A write anywhere in the app re-reads the table it touched, so two pages
 * open at once stay consistent without a server.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAllLocal,
  subscribeLocal,
  type EntityName,
  type StoredRecord,
} from "./localStore";
import { filterAgreements, listAgreements } from "./localRepository";
import type { LocalAgreement } from "./localModel";

/**
 * Read one table and keep it current.
 *
 * `tables` lists every table that should force a re-read when it changes, so
 * a page that shows a person list also refreshes when a photo is attached.
 */
export function useLocalTable<T extends StoredRecord>(
  entity: EntityName,
  tables: EntityName[] = [entity],
): { rows: T[]; loading: boolean; reload: () => void } {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const reload = useCallback(() => {
    let cancelled = false;
    getAllLocal<T>(entity)
      .then((result) => {
        if (cancelled || !mounted.current) return;
        setRows(result);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || !mounted.current) return;
        console.error(`[localStore] ${entity} could not be read:`, err);
        setRows([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entity]);

  useEffect(() => {
    mounted.current = true;
    const cancel = reload();
    const unsubscribe = subscribeLocal((changed) => {
      if (tables.includes(changed)) reload();
    });
    return () => {
      mounted.current = false;
      cancel?.();
      unsubscribe();
    };
    // `tables` is a literal at every call site; depending on its contents
    // would re-open the database on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, reload]);

  return { rows, loading, reload };
}

/**
 * Every agreement and draft, newest change first. This is what Home, the
 * archive and the search box read.
 */
export function useLocalAgreements(): {
  documents: LocalAgreement[];
  loading: boolean;
  reload: () => void;
} {
  const [documents, setDocuments] = useState<LocalAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const reload = useCallback(() => {
    let cancelled = false;
    listAgreements()
      .then((rows) => {
        if (cancelled || !mounted.current) return;
        setDocuments(rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || !mounted.current) return;
        console.error("[localStore] documents could not be read:", err);
        setDocuments([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    const cancel = reload();
    const unsubscribe = subscribeLocal((changed) => {
      if (changed === "agreements" || changed === "drafts") reload();
    });
    return () => {
      mounted.current = false;
      cancel?.();
      unsubscribe();
    };
  }, [reload]);

  return { documents, loading, reload };
}

/** One agreement by id, kept current while the user edits it. */
export function useLocalAgreement(
  id: string | undefined,
): { document: LocalAgreement | undefined; loading: boolean } {
  const { documents, loading } = useLocalAgreements();
  const document = useMemo(
    () => documents.find((d) => d.id === id),
    [documents, id],
  );
  return { document, loading };
}

/* ------------------------------------------------------------------ */
/* Search (§39) — a filter over the local agreements                   */
/* ------------------------------------------------------------------ */

/**
 * The documents a search returns. The query is matched on the machine
 * against the stored rows, so it works with the network off and never asks a
 * server for anything.
 */
export function useLocalSearch(query: string): {
  results: LocalAgreement[];
  documents: LocalAgreement[];
  loading: boolean;
} {
  const { documents, loading } = useLocalAgreements();
  const results = useMemo(
    () => filterAgreements(documents, query),
    [documents, query],
  );
  return { results, documents, loading };
}