/**
 * WARBIXINADA — the reports page.
 *
 * Real aggregates only: counts by document type, documents finished and
 * money recorded per month, and a CSV download of the archive. Every
 * number traces to a stored row; nothing is estimated or invented.
 */
import { useMemo } from "react";
import { AppShellWithLang } from "@/components/notary/AppShell";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/lang";
import {
  useLocalAgreements,
  useLocalTable,
} from "@/lib/notary/localHooks";
import type { LocalPayment } from "@/lib/notary/localModel";
import {
  byMonth,
  countsByType,
  documentCsvRows,
  toCsv,
} from "@/lib/notary/reports";
import { CalendarDays, Download, FileSpreadsheet } from "lucide-react";

export default function Reports() {
  const { t } = useLang();
  const { documents, loading } = useLocalAgreements();
  const { rows: payments, loading: paymentsLoading } = useLocalTable<LocalPayment>("payments");

  const stats = useMemo(() => {
    const pending = documents.filter((d) => d.status === "completed").length;
    const verified = documents.filter(
      (d) => d.status === "generated" || d.status === "archived",
    ).length;
    let income = 0;
    // Whatever phase has been recorded through the ledger — every numeric
    // added exactly once.
    for (const p of payments) {
      const n = Number(p.amountPaid);
      if (Number.isFinite(n)) income += n;
    }
    return { total: documents.length, pending, verified, income };
  }, [documents, payments]);

  const types = useMemo(() => countsByType(documents), [documents]);
  const months = useMemo(() => byMonth(documents, payments), [documents, payments]);

  const downloadCsv = () => {
    const csv = toCsv(
      documentCsvRows(documents, payments).map((r) => r as unknown as Record<string, string>),
      [
        "referenceNumber",
        "documentTypeTitle",
        "subTypeLabel",
        "status",
        "agreementDate",
        "recordedIncome",
      ],
    );
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notary-documents-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShellWithLang
      title={t("repTitle")}
      subtitle={t("repSub")}
      action={
        <Button size="sm" variant="secondary" onClick={downloadCsv}>
          <Download className="size-4" /> {t("exportCsv")}
        </Button>
      }
    >
      {/* Four counts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statDocs")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.total}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statPending")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.pending}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statVerified")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.verified}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statIncome")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.income}</p>
        </div>
      </div>

      {/* By document type */}
      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm font-medium">
          <FileSpreadsheet className="size-4 text-primary" /> {t("repByType")}
        </p>
        <div className="mt-3 space-y-2">
          {!loading && types.length === 0 && (
            <div className="notebook-page rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("repEmpty")}</p>
            </div>
          )}
          {types.map((tc) => (
            <div key={tc.documentType} className="notebook-page flex items-center gap-3 rounded-lg p-4">
              <span className="text-sm font-medium">{tc.title}</span>
              <span className="ml-auto text-sm font-semibold">{tc.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By month */}
      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="size-4 text-primary" /> {t("repByMonth")}
        </p>
        <div className="mt-3 space-y-2">
          {!paymentsLoading && months.length === 0 && (
            <div className="notebook-page rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("repEmpty")}</p>
            </div>
          )}
          {months.map((m) => (
            <div key={m.month} className="notebook-page flex flex-wrap items-center gap-3 rounded-lg p-4">
              <span className="text-sm font-medium">{m.month}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {t("repMonthDocs")}: <span className="font-semibold">{m.documents}</span>
                {" · "}
                {t("statIncome")}: <span className="font-semibold">{m.income}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppShellWithLang>
  );
}
