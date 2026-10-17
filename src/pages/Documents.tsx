/**
 * DUKUMENTIYADA — the front page.
 *
 * Four counts · search · the office's three states · the common archive
 * · reference verification. One primary action: "Dukumenti cusub".
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AppShellWithLang } from "@/components/notary/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLang } from "@/lib/lang";
import { useLocalAgreements, useLocalTable } from "@/lib/notary/localHooks";
import { getConfig, getSubTypeLabel } from "@/lib/notary/documents";
import { searchHaystack, agreementNames } from "@/lib/notary/localRepository";
import type { LocalAgreement } from "@/lib/notary/localModel";
import { cn } from "@/lib/utils";
import { CircleQuestionMark, FileText, Plus, ShieldCheck } from "lucide-react";

/**
 * The office's three states, and only these three badges exist anywhere:
 *   Qabyo          → stored "draft"       (interview in progress)
 *   Sugaya         → stored "completed"   (finished, not yet exported)
 *   La xaqiijiyay  → stored "generated" or "archived"
 */
type StatusGroup = "draft" | "completed" | "verified";

function statusGroup(status: string): StatusGroup {
  if (status === "draft") return "draft";
  if (status === "completed") return "completed";
  return "verified";
}

/** The badge and the filter chip share the same three keys — nothing else. */
function statusKey(group: StatusGroup): string {
  return group === "draft" ? "statusDraft" : group === "completed" ? "statusPending" : "statusVerified";
}

const GROUPS: (StatusGroup | "all")[] = ["all", "draft", "completed", "verified"];

function StatusBadge({ group }: { group: StatusGroup }) {
  const { t } = useLang();
  return (
    <Badge
      variant={group === "verified" ? "default" : group === "completed" ? "secondary" : "outline"}
      className="text-[11px]"
    >
      {t(statusKey(group))}
    </Badge>
  );
}

export default function Documents() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { documents, loading } = useLocalAgreements();
  const { rows: paymentRows } = useLocalTable("payments");

  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  // Filter: Dhammaan | Qabyo | Sugaya | La xaqiijiyay — nothing else exists.
  const [group, setGroup] = useState<StatusGroup | "all">("all");

  const [refInput, setRefInput] = useState("");
  const [refResult, setRefResult] = useState<"idle" | "hit" | "miss" | "empty">("idle");
  const [refHit, setRefHit] = useState<LocalAgreement | null>(null);

  /** §39 — the same local haystack search the archive has always used. */
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (group !== "all" && statusGroup(d.status) !== group) return false;
      if (!q) return true;
      return searchHaystack(d).includes(q);
    });
  }, [documents, group, q]);

  const stats = useMemo(() => {
    const pending = documents.filter((d) => d.status === "completed").length;
    const verified = documents.filter(
      (d) => d.status === "generated" || d.status === "archived",
    ).length;
    // Dakhli reads the payments table: every numeric amount paid, added once.
    let income = 0;
    for (const row of paymentRows) {
      const n = Number(row.amountPaid);
      if (Number.isFinite(n)) income += n;
    }
    return { total: documents.length, pending, verified, income };
  }, [documents, paymentRows]);

  const verify = () => {
    const needle = refInput.trim().toLowerCase();
    setRefInput("");
    if (!needle) {
      setRefResult("empty");
      setRefHit(null);
      return;
    }
    const hit =
      documents.find(
        (d) => (d.referenceNumber ?? "").trim().toLowerCase() === needle,
      ) ??
      documents.find((d) => searchHaystack(d).includes(needle));
    setRefHit(hit ?? null);
    setRefResult(hit ? "hit" : "miss");
  };

  return (
    <AppShellWithLang
      title={t("docTitle")}
      subtitle={t("docSub")}
      action={
        <Button size="sm" onClick={() => navigate("/new")}>
          <Plus className="size-4" /> {t("newDocument")}
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
          <p className="text-xs text-muted-foreground">{t("statIncome")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.income}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statVerified")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.verified}</p>
        </div>
      </div>

      {/* Search + the three-state filter */}
      <div className="mt-6 space-y-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="bg-card"
        />
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs transition-colors",
                group === g
                  ? "border-primary bg-accent font-medium text-accent-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {g === "all" ? t("filterAll") : t(statusKey(g))}
            </button>
          ))}
        </div>
      </div>

      {/* The archive list itself */}
      <div className="mt-4 space-y-2">
        {loading && <p className="text-sm text-muted-foreground">…</p>}
        {!loading && filtered.length === 0 && (
          <div className="notebook-page rounded-lg p-10 text-center" data-empty="documents">
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              {documents.length === 0 ? t("docEmpty") : t("noSearchMatch")}
            </p>
            {documents.length === 0 && (
              <p className="mt-1 text-sm text-muted-foreground">{t("docEmptyHint")}</p>
            )}
          </div>
        )}
        {filtered.map((d) => {
          const cfg = getConfig(d.documentType);
          const names = agreementNames(d).slice(0, 3);
          // A draft still belongs to the interview; a finished document belongs
          // to the filed archive.
          const to =
            statusGroup(d.status) === "verified" ? `/archive/${d.id}` : `/documents/${d.id}`;
          return (
            <Link
              key={d.id}
              to={to}
              className="notebook-page flex items-center gap-3 rounded-lg p-4 transition-colors hover:bg-accent/40"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {d.referenceNumber || "—"}
                  </span>
                  <StatusBadge group={statusGroup(d.status)} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {cfg?.title ?? d.documentType}
                  {d.subTypeLabel ? ` · ${getSubTypeLabel(cfg, d.subType)}` : ""}
                  {names.length > 0 ? ` · ${names.join(", ")}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Reference verification */}
      <div className="notebook-page mt-6 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="size-4 text-primary" /> {t("verifyTitle")}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={t("verifyIdledHint")} className="text-muted-foreground">
                <CircleQuestionMark className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("verifyIdledHint")}</TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={refInput}
            onChange={(e) => {
              setRefInput(e.target.value);
              setRefResult("idle");
            }}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder={t("verifyPlaceholder")}
            className="bg-card"
          />
          <Button variant="secondary" size="sm" onClick={verify}>
            {t("verifyGo")}
          </Button>
        </div>
        {refResult !== "idle" && (
          <p
            className={cn(
              "mt-3 text-sm",
              refResult === "hit" ? "text-primary" : "text-muted-foreground",
            )}
          >
            {refResult === "empty" ? (
              t("verifyIdledHint")
            ) : refResult === "hit" && refHit ? (
              <>
                {t("verifyFound")} — {refHit.referenceNumber}
              </>
            ) : (
              t("verifyNotFound")
            )}
          </p>
        )}
      </div>
    </AppShellWithLang>
  );
}
