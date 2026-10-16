/**
 * LACAGAHA — the money the documents already hold, exactly as stored.
 *
 * There is no invented accounting here. Every figure this module returns
 * was typed by the office inside a document's own interview, and every
 * label comes from the document's own config — never written fresh.
 *
 * The `payments` table is the ONLY ledger the office's paid money has;
 * recording a payment there is page work (see Payments.tsx), not magic.
 */
import { getConfig } from "./documents";
import type { LocalAgreement } from "./localModel";

export interface MoneyField {
  fieldId: string;
  /** The label the document's own config prints. */
  label: string;
  /** The answer exactly as stored. */
  value: string;
}

export interface AgreementMoney {
  agreementId: string;
  referenceNumber: string;
  documentTypeTitle: string;
  subTypeLabel: string;
  status: string;
  fields: MoneyField[];
}

function isMethodField(id: string): boolean {
  // The select fields that say HOW the money moves (as stored, free of
  // invention): "sida_lacagta", "habka_bixinta".
  return (
    id === "sida_lacagta" ||
    id === "habka_bixinta" ||
    id === "bixinta_hore"
  );
}

/** Every money answer one agreement holds, with the config's own labels. */
export function agreementMoney(agreement: LocalAgreement): AgreementMoney {
  const cfg = getConfig(agreement.documentType);
  const out: AgreementMoney = {
    agreementId: agreement.id,
    referenceNumber: agreement.referenceNumber,
    documentTypeTitle: agreement.documentTypeTitle,
    subTypeLabel: agreement.subTypeLabel,
    status: agreement.status,
    fields: [],
  };
  if (!cfg) return out;

  let values: Record<string, unknown> = {};
  try {
    values = JSON.parse(agreement.valuesJson ?? "{}") as Record<string, unknown>;
  } catch {
    // An unreadable draft holds no money answer; it must not take the
    // payments page down.
    return out;
  }

  for (const section of cfg.sections) {
    if (Array.isArray((section as { parties?: unknown }).parties)) continue;
    const stored = values[section.id];
    if (!stored || Array.isArray(stored)) continue;
    const row = stored as Record<string, string>;
    for (const field of section.fields ?? []) {
      const isMoney = field.type === "currency" || isMethodField(field.id);
      if (!isMoney) continue;
      const value = (row[field.id] ?? "").trim();
      if (!value) continue;
      out.fields.push({ fieldId: field.id, label: field.label, value });
    }
  }
  return out;
}

/** Every agreement that holds at least one money answer. */
export function agreementsWithMoney(agreements: LocalAgreement[]): AgreementMoney[] {
  return agreements
    .map(agreementMoney)
    .filter((m) => m.fields.length > 0);
}
