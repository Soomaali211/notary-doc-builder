import type { DocumentConfig } from "../types";
import { heshiisKiroConfig } from "./heshiisKiro";

/**
 * Document type registry. Future document types (Heshiis Deyn,
 * Wakiilnimo, Kala Iibsi Hanti, Cadayn Cilaaj, Heshiis Shirkadeed …)
 * are registered here — no engine code changes needed.
 */
export const documentConfigs: DocumentConfig[] = [heshiisKiroConfig];

export function getConfig(id: string): DocumentConfig | undefined {
  return documentConfigs.find((c) => c.id === id);
}

export function getSubTypeLabel(
  config: DocumentConfig | undefined,
  value: string,
): string {
  return config?.subTypes.find((s) => s.value === value)?.label ?? value;
}
