import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/components/notary/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { documentConfigs, upcomingDocumentTypes } from "@/lib/notary/documents";
import { Search } from "lucide-react";

/**
 * Catalog: browse every document type the office supports, with upcoming
 * types shown as clearly-marked coming-soon entries.
 */
export default function Catalog() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();

  const live = useMemo(() => {
    return documentConfigs.filter(
      (c) =>
        !query ||
        c.title.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.subTypes.some((s) => s.label.toLowerCase().includes(query)),
    );
  }, [query]);

  const upcoming = useMemo(() => {
    return upcomingDocumentTypes.filter(
      (c) =>
        !query ||
        c.title.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query),
    );
  }, [query]);

  return (
    <AppShell
      title="Document Catalog"
      subtitle="Every contract type the office supports — ready types first, planned ones below."
    >
      <div className="notebook-page paper-grain rounded-md p-4">
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the catalog…"
            className="bg-card/80 pl-8"
          />
        </div>
      </div>

      {/* Ready types */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Ready to use
        </h2>
        {live.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ready types match your search.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate("/new")}
                className={`notebook-page paper-grain rounded-md p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  i % 3 === 1 ? "border-t-4 border-t-primary/60" : i % 3 === 2 ? "border-t-4 border-t-pen-green/50" : "border-t-4 border-t-pen-orange/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.title}</p>
                  <Badge className="hl-green text-[10px]">Ready</Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{c.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.subTypes.map((s) => (
                    <Badge key={s.value} variant="outline" className="text-[10px]">
                      {s.label}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Planned types */}
      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Coming soon
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No planned types match your search.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((c) => (
              <div
                key={c.id}
                className="rounded-md border border-dashed border-border/80 p-5 opacity-70"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.title}</p>
                  <Badge variant="secondary" className="text-[10px]">Planned</Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{c.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="notebook-annotation mt-8 text-xs text-muted-foreground">
        * The engine is configuration-driven: enabling a planned type is a data
        change, not a code change — which is why the catalog can grow safely.
      </p>
    </AppShell>
  );
}
