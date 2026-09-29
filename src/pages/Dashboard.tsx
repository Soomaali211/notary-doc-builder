import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { documentConfigs } from "@/lib/notary/documents";
import { formatSomaliDate } from "@/lib/notary/format";
import {
  ArrowRight,
  FileSignature,
  FolderOpen,
  LogOut,
  Plus,
} from "lucide-react";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const documents = useQuery(api.notaryDocuments.listMyDocuments);

  const generated = useMemo(
    () => (documents ?? []).filter((d) => d.status === "generated"),
    [documents],
  );
  const recent = (documents ?? []).slice(0, 5);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="notebook-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="notebook-annotation text-sm text-muted-foreground">
              Xafiiska Nootaayada
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Nootaayada{user?.name ? ` — ${user.name}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/new")}>
              <Plus className="size-4" /> Dukumeenti Cusub
            </Button>
            <Button variant="ghost" className="gap-2" onClick={handleSignOut}>
              <LogOut className="size-4" /> Ka bax
            </Button>
          </div>
        </header>

        {/* Primary cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documentConfigs.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate("/new")}
              className="notebook-page paper-grain rounded-md p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileSignature className="size-5" />
              </div>
              <p className="font-semibold">{c.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{c.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                Bilow <ArrowRight className="size-3.5" />
              </span>
            </button>
          ))}

          <Link
            to="/archive"
            className="notebook-page paper-grain rounded-md p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderOpen className="size-5" />
            </div>
            <p className="font-semibold">Kaydka Heshiisyada</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Raadi, fur, iyo soo deji dukumeentiyadii hore.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Fur kaydka <ArrowRight className="size-3.5" />
            </span>
          </Link>

          <div className="notebook-page paper-grain rounded-md p-5">
            <p className="notebook-annotation text-xs text-muted-foreground">Dukumeentiyadii ugu dambeeyay</p>
            <p className="mt-1 text-3xl font-bold">{generated.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(documents ?? []).length - generated.length} draft weli jira
            </p>
          </div>
        </div>

        {/* Recent documents */}
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Dukumeentiyadii Dhawaan</h2>
            <Link to="/archive" className="text-sm font-medium text-primary hover:underline">
              Dhammaan →
            </Link>
          </div>
          <div className="notebook-page paper-grain rounded-md p-2">
            {recent.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Weli dukumeenti lama abuurin. Ku bilow mid cusub kor ku yaal.
              </p>
            ) : (
              <ul className="divide-y divide-dashed divide-border/70">
                {recent.map((d) => (
                  <li key={d._id}>
                    <Link
                      to={`/archive/${d._id}`}
                      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/50"
                    >
                      <FileSignature className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {d.referenceNumber || "Draft"} · {d.subTypeLabel}
                      </span>
                      <Badge variant={d.status === "generated" ? "default" : "secondary"} className="text-[10px]">
                        {d.status === "generated" ? "La sameeyay" : "Draft"}
                      </Badge>
                      <span className="notebook-annotation hidden text-xs text-muted-foreground sm:inline">
                        {formatSomaliDate(new Date(d.createdAt).toISOString().slice(0, 10))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
