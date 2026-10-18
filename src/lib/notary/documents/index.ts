import type { DocumentConfig } from "../types";
import { heshiisKiroConfig } from "./heshiisKiro";
import { kalaIiibsiHantiConfig } from "./kalaIiibsiHanti";
import { cadaynCilaajConfig } from "./cadaynCilaaj";

/**
 * Document type registry. Future document types (Heshiis Deyn,
 * Wakiilnimo, Kala Iibsi Hanti, Cadayn Cilaaj, Heshiis Shirkadeed …)
 * are registered here — no engine code changes needed.
 */
export const documentConfigs: DocumentConfig[] = [
  heshiisKiroConfig,
  kalaIiibsiHantiConfig,
  cadaynCilaajConfig,
];

/**
 * CONFIGS built at RUNTIME by the office (the form builder's output).
 *
 * The built-ins above are code; the office's own types live in the local
 * database and are registered here once the store has been read. Every
 * reader below — getConfig, the catalog, the picker, the template manager —
 * sees them the same way it sees the built-ins. Nothing anywhere hard-codes
 * "which ids are allowed" beyond each document's OWN data.
 */
let runtimeConfigs: DocumentConfig[] = [];

export function registerRuntimeConfigs(list: DocumentConfig[]): void {
  runtimeConfigs = list;
}

export function allDocumentConfigs(): DocumentConfig[] {
  // An EDITED built-in (runtime overlay, same id) ships exactly one card:
  // the runtime copy wins, the shipped copy silently steps aside.
  const runtimeIds = new Set(runtimeConfigs.map((c) => c.id));
  return [...runtimeConfigs, ...documentConfigs.filter((c) => !runtimeIds.has(c.id))];
}

export function getConfig(id: string): DocumentConfig | undefined {
  return (
    runtimeConfigs.find((c) => c.id === id) ??
    documentConfigs.find((c) => c.id === id)
  );
}

export function getSubTypeLabel(
  config: DocumentConfig | undefined,
  value: string,
): string {
  return config?.subTypes.find((s) => s.value === value)?.label ?? value;
}

/** A catalog entry for a document type that is planned but not built yet. */
export interface CatalogEntry {
  id: string;
  title: string;
  description: string;
}

/**
 * Planned document types shown in the catalog as "coming soon". Each one
 * becomes a real catalog card the moment its config is registered above.
 */
export const upcomingDocumentTypes: CatalogEntry[] = [
  {
    id: "heshiis_deyn",
    title: "Heshiis Deyn",
    description:
      "Lacag deyn oo u dhaxeeya laba xisbi — qorshe bixinta, damiinka, iyo casharada.",
  },
  {
    id: "heshiis_wakiilnimo",
    title: "Heshiis Wakiilnimo",
    description:
      "Awood-siin wakiil oo rasmi ah — xuduudaha wakiilka, mudada, iyo xaddidaadaha.",
  },
  {
    id: "cadayn_cilaaj",
    title: "Cadayn Cilaaj",
    description:
      "Cadayn rasmi ah oo cilaaj — maragyada, xaqiijinta nootaaye, iyo taariikhaha.",
  },
  {
    id: "heshiis_shirkadeed",
    title: "Heshiis Shirkadeed",
    description:
      "Heshiisyo u dhexeeya shirkado — shuruudaha, waajibaadka, iyo xallinta khilaafyada.",
  },
];
