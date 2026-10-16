/**
 * WARBIXINADA — real aggregates over what the office actually recorded.
 *
 * Nothing here makes a number up: counts come from the document rows,
 * income comes from the `payments` ledger, and months come from the
 * timestamps the system itself stamped (completedAt / exportedAt /
 * createdAt). Aggregates only — never new "facts".
 */
import type { LocalAgreement, LocalPayment } from "./localModel";

export interface TypeCount {
  documentType: string;
  title: string;
  count: number;
}

/** How many documents of each type the archive holds, biggest first. */
export function countsByType(agreements: LocalAgreement[]): TypeCount[] {
  const map = new Map<string, TypeCount>();
  for (const a of agreements) {
    const entry = map.get(a.documentType) ?? {
      documentType: a.documentType,
      title: a.documentTypeTitle,
      count: 0,
    };
    entry.count += 1;
    map.set(a.documentType, entry);
  }
  return [...map.values()].sort((x, y) => y.count - x.count);
}

export interface MonthCount {
  /** The month the system stamped, "YYYY-MM", exactly as it happened. */
  month: string;
  /** Documents that left the interview this month (completedAt). */
  documents: number;
  /** Money recorded this month (ledger createdAt). */
  income: number;
}

function monthKey(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Documents per month and ledger income per month, newest first. */
export function byMonth(
  agreements: LocalAgreement[],
  payments: LocalPayment[],
): MonthCount[] {
  const map = new Map<string, MonthCount>();
  const month = (m: string): MonthCount => {
    const entry = map.get(m) ?? { month: m, documents: 0, income: 0 };
    map.set(m, entry);
    return entry;
  };
  for (const a of agreements) {
    if (a.status === "draft") continue;
    const m = monthKey(a.completedAt);
    if (!m) continue;
    month(m).documents += 1;
  }
  for (const p of payments) {
    const m = monthKey(p.createdAt);
    if (!m) continue;
    const n = Number(p.amountPaid);
    if (Number.isFinite(n)) month(m).income += n;
  }
  return [...map.values()].sort((x, y) => y.month.localeCompare(x.month));
}

export interface DocumentCsvRow {
  referenceNumber: string;
  documentTypeTitle: string;
  subTypeLabel: string;
  status: string;
  agreementDate: string;
  recordedIncome: string;
}

/** One row per agreement, with the office's recorded payments summed. */
export function documentCsvRows(agreements: LocalAgreement[], payments: LocalPayment[]): DocumentCsvRow[] {
  const incomeByAgreement = new Map<string, number>();
  for (const p of payments) {
    const n = Number(p.amountPaid);
    if (!Number.isFinite(n)) continue;
    incomeByAgreement.set(p.agreementId, (incomeByAgreement.get(p.agreementId) ?? 0) + n);
  }
  return agreements.map((a) => ({
    referenceNumber: a.referenceNumber ?? "",
    documentTypeTitle: a.documentTypeTitle ?? "",
    subTypeLabel: a.subTypeLabel ?? "",
    status: a.status ?? "",
    agreementDate: a.agreementDate ?? "",
    recordedIncome: String(incomeByAgreement.get(a.id) ?? 0),
  }));
}

/** Minimal RFC-4180 CSV: quote everything, escape doubled quotes. */
export function toCsv(rows: Record<string, string>[], header: string[]): string {
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    header.map(escape),
    ...rows.map((r) => header.map((h) => escape(r[h] ?? ""))),
  ];
  return lines.map((cells) => cells.join(",")).join("\r\n");
}
