import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import { Search, FileText, FolderOpen } from "lucide-react";

export default function Archive() {
  const documents = useQuery(api.notaryDocuments.listMyDocuments);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const configs = useMemo(() => documentConfigs, []);

  const filtered = useMemo(() => {
    if (!documents) return [];
    const query = q.trim().toLowerCase();
    return documents.filter((d) => {
      if (typeFilter !== "all" && d.documentType !== typeFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
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
  }, [documents, q, typeFilter, statusFilter]);

  return (
    <main className="notebook-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="notebook-annotation text-sm text-muted-foreground">Nootaayada</p>
        <h1 className="text-3xl font-bold tracking-tight">Kaydka Heshiisyada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dhammaan dukumeentiyada la sameeyay — raadi, filter iyo fur.
        </p>

        {/* Filters (notebook index card) */}
        <div className="notebook-page paper-grain mt-6 rounded-md p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Raadi nambarka tixraaca, magaca xisbi, sub-type…"
                className="pl-8 bg-card/80"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-card/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Dhammaan Noocyada</SelectItem>
                {configs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-card/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Dhammaan Xaaladaha</SelectItem>
                <SelectItem value="generated">La sameeyay</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        <div className="mt-6 space-y-3">
          {!documents && <p className="text-sm text-muted-foreground">La soo shubayayo…</p>}
          {documents && filtered.length === 0 && (
            <div className="notebook-page paper-grain rounded-md p-10 text-center">
              <FolderOpen className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Waxba lama helin</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Isku day raadin kale ama abuur dukumeenti cusub.
              </p>
              <Button className="mt-4" onClick={() => navigate("/new")}>
                Dukumeenti Cusub
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
                      <span className="font-semibold">{d.referenceNumber || "(aan la qeexin)"}</span>
                      <Badge
                        variant="outline"
                        className="text-[11px]"
                      >
                        {cfg?.title ?? d.documentType}
                      </Badge>
                      <Badge
                        variant={d.status === "generated" ? "default" : "secondary"}
                        className="text-[11px]"
                      >
                        {d.status === "generated" ? "La sameeyay" : "Draft"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {getSubTypeLabel(cfg, d.subType)} ·{" "}
                      {d.parties.slice(0, 3).map((p) => p.name).join(", ")}
                      {d.parties.length > 3 ? ` +${d.parties.length - 3}` : ""}
                    </p>
                  </div>
                  <span className="notebook-annotation text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString("so-SO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
