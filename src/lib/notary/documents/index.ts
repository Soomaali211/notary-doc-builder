import type { DocumentConfig } from "../types";
import { heshiisKiroConfig } from "./heshiisKiro";
import { kalaIiibsiHantiConfig } from "./kalaIiibsiHanti";

/**
 * Document type registry. Future document types (Heshiis Deyn,
 * Wakiilnimo, Kala Iibsi Hanti, Cadayn Cilaaj, Heshiis Shirkadeed …)
 * are registered here — no engine code changes needed.
 */
export const documentConfigs: DocumentConfig[] = [
  heshiisKiroConfig,
  kalaIiibsiHantiConfig,
];

export function getConfig(id: string): DocumentConfig | undefined {
  return documentConfigs.find((c) => c.id === id);
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
