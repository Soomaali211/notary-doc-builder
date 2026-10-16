/**
 * LACAGAHA — the payments page.
 *
 * Two real things and only two:
 *   1. The money the DOCUMENTS already hold — every figure and label comes
 *      from the stored answers and the document's own config.
 *   2. The `payments` ledger — recorded here, for real, one row per
 *      payment. "Dakhli" on the front page reads this same table.
 */
import { useMemo, useState } from "react";
import { AppShellWithLang } from "@/components/notary/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLang } from "@/lib/lang";
import { useLocalTable, useLocalAgreements } from "@/lib/notary/localHooks";
import { putLocal } from "@/lib/notary/localStore";
import {
  agreementsWithMoney,
  type AgreementMoney,
} from "@/lib/notary/financials";
import type { LocalPayment } from "@/lib/notary/localModel";
import { cn } from "@/lib/utils";
import { Banknote, Coins, HandCoins, Wallet } from "lucide-react";

/** New payments rows get a clear, unique id. */
function newPaymentId(agreementId: string): string {
  return `pay_${agreementId}_${Date.parse(new Date().toISOString())}_${Math.floor(
    Math.random() * 1000,
  )}`;
}

export default function Payments() {
  const { t } = useLang();
  const { documents, loading } = useLocalAgreements();
  const { rows: paymentRows, loading: paymentsLoading } = useLocalTable<LocalPayment>("payments");

  const money = useMemo(() => agreementsWithMoney(documents), [documents]);

  const stats = useMemo(() => {
    let income = 0;
    for (const row of paymentRows) {
      const n = Number(row.amountPaid);
      if (Number.isFinite(n)) income += n;
    }
    return {
      income,
      recorded: paymentRows.length,
      docs: money.length,
    };
  }, [paymentRows, money]);

  // --- Recording a payment, into the real ledger ---------------------
  const [payAgreementId, setPayAgreementId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [paySavedAt, setPaySavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = money.find((m) => m.agreementId === payAgreementId) ?? null;

  const recordPayment = async () => {
    const amount = Number(payAmount.trim());
    if (!selected) {
      setPayError(t("payPickDoc"));
      return;
    }
    if (!payAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setPayError(t("payBadAmount"));
      return;
    }
    setPayError(null);
    setSaving(true);
    try {
      // The price the DOCUMENT holds (when it holds one) goes on the row,
      // exactly as stored — never guessed.
      const priceField = selected.fields.find((f) => f.fieldId === "qiimaha_guud");
      const totalPrice = priceField?.value;
      const total = totalPrice !== undefined ? Number(totalPrice) : undefined;
      const balance =
        total !== undefined && Number.isFinite(total)
          ? String(total - amount)
          : undefined;
      const row: LocalPayment = {
        id: newPaymentId(selected.agreementId),
        agreementId: selected.agreementId,
        kind: "payment",
        totalPrice,
        amountPaid: String(amount),
        balance,
        // "si_buuxda" | "qayb_aad_ah" — plain arithmetic, as stated.
        state:
          balance !== undefined && Number(balance) <= 0 ? "si_buuxda" : "qayb_aad_ah",
        notes: payNotes.trim() || undefined,
        createdAt: Date.now(),
      };
      await putLocal("payments", row);
      setPayAmount("");
      setPayNotes("");
      setPaySavedAt(Date.now());
    } catch (err) {
      console.error("[payments] could not be recorded:", err);
      setPayError(t("paySaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // Reference lookup for the ledger rows
  const docById = useMemo(() => {
    const map = new Map<string, AgreementMoney>();
    for (const m of money) map.set(m.agreementId, m);
    return map;
  }, [money]);

  return (
    <AppShellWithLang title={t("payTitle")} subtitle={t("paySub")}>
      {/* Four counts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statIncome")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.income}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("payRecorded")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.recorded}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("payDocsWithMoney")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.docs}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("payDocsTotal")}</p>
          <p className="mt-1 text-lg font-semibold">{documents.length}</p>
        </div>
      </div>

      {/* Recording a payment — writes the real ledger */}
      <div className="notebook-page mt-6 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <HandCoins className="size-4 text-primary" />
          <p className="text-sm font-medium">{t("payRecordTitle")}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("payRecordHint")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[3fr_1fr_2fr_auto]">
          <Select
            value={payAgreementId}
            onValueChange={(v) => {
              setPayAgreementId(v);
              setPayError(null);
            }}
          >
            <SelectTrigger className="bg-card">
              <SelectValue placeholder={t("payPickDoc")} />
            </SelectTrigger>
            <SelectContent>
              {money.map((m) => (
                <SelectItem key={m.agreementId} value={m.agreementId}>
                  {m.referenceNumber || m.documentTypeTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="0"
            value={payAmount}
            onChange={(e) => {
              setPayAmount(e.target.value);
              setPayError(null);
            }}
            placeholder={t("payAmountPlaceholder")}
            className="bg-card"
          />
          <Input
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
            placeholder={t("payNotesPlaceholder")}
            className="bg-card"
          />
          <Button size="sm" onClick={recordPayment} disabled={saving}>
            {t("payRecord")}
          </Button>
        </div>
        {payError && <p className="mt-2 text-sm text-destructive">{payError}</p>}
        {!payError && paySavedAt && (
          <p className="mt-2 text-sm text-primary">{t("paySaved")}</p>
        )}
      </div>

      {/* The ledger itself */}
      <div className="mt-6 space-y-2">
        {!paymentsLoading && paymentRows.length === 0 && (
          <div className="notebook-page rounded-lg p-10 text-center" data-empty="payments">
            <Wallet className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">{t("payLedgerEmpty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("payLedgerEmptyHint")}</p>
          </div>
        )}
        {paymentRows.map((p) => {
          const doc = docById.get(p.agreementId);
          return (
            <div key={p.id} className="notebook-page rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Coins className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {doc?.referenceNumber ?? p.agreementId}
                </span>
                <span className="ml-auto text-sm font-semibold">
                  {p.amountPaid ?? "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {doc?.documentTypeTitle ?? ""}
                {doc?.subTypeLabel ? ` · ${doc.subTypeLabel}` : ""}
                {p.totalPrice ? ` · ${t("payTotal")}: ${p.totalPrice}` : ""}
                {p.balance ? ` · ${t("payBalance")}: ${p.balance}` : ""}
                {p.notes ? ` · ${p.notes}` : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* The money the documents already hold */}
      <div className="mt-6 space-y-2">
        {!loading && money.length === 0 && (
          <div className="notebook-page rounded-lg p-6 text-center">
            <Banknote className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{t("payNoDocMoney")}</p>
          </div>
        )}
        {money.map((m) => (
          <div key={m.agreementId} className={cn("notebook-page rounded-lg p-4")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {m.referenceNumber || m.documentTypeTitle}
              </span>
              <span className="text-xs text-muted-foreground">
                {m.subTypeLabel || m.documentTypeTitle}
              </span>
            </div>
            <div className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {m.fields.map((f) => (
                <div key={f.fieldId} className="flex gap-2">
                  <span className="text-muted-foreground">{f.label}:</span>
                  <span className="font-medium">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShellWithLang>
  );
}
