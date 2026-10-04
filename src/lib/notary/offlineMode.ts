/**
 * OFFLINE MODE (§3) — the switch that decides whether this machine talks to
 * anything beyond itself.
 *
 * The system is offline-first: with the mode ON (the default) the whole app
 * runs from IndexedDB and nothing leaves the computer. Accounts, agreements,
 * templates, drafts, settings and every generated file are local.
 *
 * §54 — notary data must not be sent to the internet without the user asking
 * for it. That is why this flag is ON by default and why nothing in the app
 * may turn it off on its own: only the notary, in Settings, chooses.
 *
 * Turning it OFF is a deliberate, user-initiated opt-in to the cloud sync
 * that still exists in the codebase. Nothing else in the app may reach for
 * the network while the mode is ON.
 */

const OFFLINE_KEY = "notary.offline.v1";

export interface OfflineSettings {
  /** True when the app must work with no internet at all. */
  offline: boolean;
  /**
   * Whether the notary has asked for the cloud copy to be kept in step with
   * the local one. It does nothing while `offline` is true.
   */
  cloudSync: boolean;
}

export const DEFAULT_OFFLINE: OfflineSettings = {
  offline: true,
  cloudSync: false,
};

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    // Locked-down machine: the defaults are used instead of failing.
    return undefined;
  }
}

export function readOfflineSettings(): OfflineSettings {
  const store = safeStorage();
  if (!store) return DEFAULT_OFFLINE;
  try {
    const raw = store.getItem(OFFLINE_KEY);
    if (!raw) return DEFAULT_OFFLINE;
    const parsed = JSON.parse(raw) as Partial<OfflineSettings>;
    return {
      offline: parsed.offline !== false,
      cloudSync: parsed.cloudSync === true,
    };
  } catch {
    return DEFAULT_OFFLINE;
  }
}

export function writeOfflineSettings(next: OfflineSettings): void {
  safeStorage()?.setItem(OFFLINE_KEY, JSON.stringify(next));
}

/**
 * Is the app running local-only right now? Default true: a machine with the
 * flag unset must never assume it may use the network.
 */
export function isOffline(): boolean {
  return readOfflineSettings().offline;
}