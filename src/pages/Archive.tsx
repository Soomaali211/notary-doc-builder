import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import { Search, FileText, FolderOpen, CalendarRange } from "lucide-react";

/**
 * Kaydka Heshiisyada (the archive): every document the office has built —
 * searchable by reference number, party name, or sub-type, filterable by
 * document type and status.
 */
export default function Archive() {
  const documents = useQuery(api.notaryDocuments.listMyDocuments);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  // Phase 3H — date-range filter (inclusive on both ends).
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtered = useMemo(() => {
    if (!documents) return [];
    const query = q.trim().toLowerCase();
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return documents.filter((d) => {
      if (typeFilter !== "all" && d.documentType !== typeFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (fromTs !== null && d.createdAt < fromTs) return false;
      if (toTs !== null && d.createdAt > toTs) return false;
      if (!query) return true;
      const haystack = [
        d.referenceNumber,
        d.subTypeLabel,
        d.documentTypeTitle,
        d.fileBaseName,
        ...d.parties.map((p) => `${p.name} ${p.phone ?? ""} ${p.idNumber ?? ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
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
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="generated">Generated</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
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
        {!documents && <p className="text-sm text-muted-foreground">Loading…</p>}
        {documents && filtered.length === 0 && (
          <div className="notebook-page paper-grain rounded-md p-10 text-center">
            <FolderOpen className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Nothing found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search, or build a new document.
            </p>
            <Button className="mt-4" onClick={() => navigate("/new")}>
              New document
            </Button>
          </div>
        )}
        {filtered.map((d) => {
          const cfg = getConfig(d.documentType);
          return (
            <Link
              key={d._id}
              to={`/archive/${d._id}`}
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
                      variant={d.status === "generated" ? "default" : "secondary"}
                      className="text-[11px]"
                    >
                      {d.status === "generated" ? "Generated" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {getSubTypeLabel(cfg, d.subType)} ·{" "}
                    {d.parties.slice(0, 3).map((p) => p.name).join(", ")}
                    {d.parties.length > 3 ? ` +${d.parties.length - 3}` : ""}
                  </p>
                </div>
                <span className="notebook-annotation text-xs text-muted-foreground">
                  {new Date(d.createdAt).toLocaleDateString("en-GB", {
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
