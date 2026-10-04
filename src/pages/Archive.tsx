import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/components/notary/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { documentConfigs, getConfig, getSubTypeLabel } from "@/lib/notary/documents";
import { useLocalAgreements } from "@/lib/notary/localHooks";
import {
  agreementNames,
  agreementProperty,
  agreementSides,
  searchHaystack,
} from "@/lib/notary/localRepository";
import { DOCUMENT_STATUSES, documentStatusLabel } from "@/lib/notary/documentStatus";
import { Search, FileText, FolderOpen, CalendarRange } from "lucide-react";

/**
 * Kaydka Heshiisyada (the archive): every document the office has built —
 * searchable by reference number, party name, or sub-type, filterable by
 * document type and status.
 */
export default function Archive() {
  /**
   * §3/§39 — the archive is a LOCAL table. The search below runs on this
   * machine, so it answers with the network off and cannot fail because of it.
   */
  const { documents, loading } = useLocalAgreements();
  const navigate = useNavigate();
  // §3 Home links straight into a filtered archive (?q=… / ?status=…).
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(params.get("status") ?? "all");
  // Phase 3H — date-range filter (inclusive on both ends).
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // A later ?q=/?status= (another Home click) updates the open archive.
  useEffect(() => {
    const nextQ = params.get("q");
    const nextStatus = params.get("status");
    if (nextQ !== null) setQ(nextQ);
    if (nextStatus !== null) setStatusFilter(nextStatus);
  }, [params]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return documents.filter((d) => {
      if (typeFilter !== "all" && d.documentType !== typeFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (fromTs !== null && (d.createdAt ?? 0) < fromTs) return false;
      if (toTs !== null && (d.createdAt ?? 0) > toTs) return false;
      if (!query) return true;
      // §39 — reference, name, document type, property, date, buyer, seller.
      // The haystack is built from the stored row, so an edited draft is
      // searched as it stands now, never as it stood when the index was made.
      return searchHaystack(d).includes(query);
    });
  }, [documents, q, typeFilter, statusFilter, fromDate, toDate]);

  return (
    <AppShell
      title="Archive"
      subtitle="Kaydka Heshiisyada — every contract, searchable and downloadable."
    >
      {/* Filters */}
      <div className="notebook-page paper-grain rounded-md p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by reference number, party name, or sub-type…"
              className="bg-card/80 pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full bg-card/80 sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All document types</SelectItem>
              {documentConfigs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full bg-card/80 sm:w-44">
              <SelectValue />
            </SelectTrigger><SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {/* §44 — the office's four statuses, and no others. */}
                {DOCUMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {documentStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
          </Select>
        </div>
        {/* Date range (created between … and …) */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange className="size-3.5" /> La abuuray u dhexeeya:
          </span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40 bg-card/80"
            aria-label="Taariikhda bilowga"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40 bg-card/80"
            aria-label="Taariikhda dhammaadka"
          />
          {(fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="mt-6 space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Waa la soo rarayaa…</p>}
        {!loading && filtered.length === 0 && (
          <div className="notebook-page paper-grain rounded-md p-10 text-center" data-empty="archive">
            <FolderOpen className="mx-auto size-8 text-muted-foreground" />
            {/* §71 — an empty archive and a filtered-to-nothing archive are
                different situations and must not say the same thing. */}
            {documents.length === 0 ? (
              <>
                <p className="mt-3 font-medium">Ma jiraan documents.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dooro nooca document-ka si aad u bilowdo.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 font-medium">Nothing found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search, or build a new document.
                </p>
              </>
            )}
            <Button className="mt-4" onClick={() => navigate("/new")}>
              New document
            </Button>
          </div>
        )}
        {filtered.map((d) => {
          const cfg = getConfig(d.documentType);
          return (
            <Link
              key={d.id}
              to={`/archive/${d.id}`}
              className="notebook-page paper-grain block rounded-md p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{d.referenceNumber || "(draft)"}</span>
                    <Badge variant="outline" className="text-[11px]">
                      {cfg?.title ?? d.documentType}
                    </Badge>
                    <Badge
                      variant={d.status === "generated" || d.status === "archived" ? "default" : "secondary"}
                      className="text-[11px]"
                    >
                      {documentStatusLabel(d.status)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {getSubTypeLabel(cfg, d.subType)} ·{" "}
                    {agreementNames(d).slice(0, 3).join(", ")}
                    {agreementNames(d).length > 3
                      ? ` +${agreementNames(d).length - 3}`
                      : ""}
                  </p>
                </div>
                <span className="notebook-annotation text-xs text-muted-foreground">
                  {new Date(d.createdAt ?? 0).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
