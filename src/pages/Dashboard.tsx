import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router";
import { AppShell } from "@/components/notary/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { documentConfigs } from "@/lib/notary/documents";
import { useLocalAgreements } from "@/lib/notary/localHooks";
import { filterAgreements } from "@/lib/notary/localRepository";
import { formatSomaliDate } from "@/lib/notary/format";
import { exportBackup } from "@/lib/notary/localBackup";
import { documentStatusLabel, isFinishedStatus } from "@/lib/notary/documentStatus";
import {
  ArrowRight,
  CalendarClock,
  FileSignature,
  FileUp,
  FolderOpen,
  Info,
  MessagesSquare,
  PenLine,
  Search as SearchIcon,
  Settings as SettingsIcon,
  ShieldCheck,
  HardDriveDownload,
} from "lucide-react";

/**
 * §3 — the Dashboard IS Home. Every entry the office named is a card here:
 * New Document, Drafts, Saved Documents, Archive, Search, Settings, About.
 */
const AREAS = [
  {
    to: "/new",
    icon: FileSignature,
    title: "New Document",
    text: "Start a guided interview and build a fresh document.",
    color: "text-primary",
  },
  {
    to: "/archive?status=draft",
    icon: PenLine,
    title: "Drafts",
    text: "Resume an interview you started and left half-answered.",
    color: "text-pen-orange",
  },
  {
    to: "/archive",
    icon: FolderOpen,
    title: "Document Archive",
    text: "Every document you built — searchable and downloadable.",
    color: "text-pen-green",
  },
  {
    to: "/catalog",
    icon: FileSignature,
    title: "Saved Documents",
    text: "Every document type, ready and planned.",
    color: "text-pen-green",
  },
  {
    to: "/schedule",
    icon: CalendarClock,
    title: "Schedule",
    text: "Book signing appointments against your documents.",
    color: "text-pen-orange",
  },
  {
    to: "/templates",
    icon: FileUp,
    title: "Templates",
    text: "Upload your own Word template and manage placeholders.",
    color: "text-pen-purple",
  },
  {
    to: "/settings",
    icon: SettingsIcon,
    title: "Settings",
    text: "Office information and export preferences.",
    color: "text-pen-purple",
  },
  {
    to: "/admin",
    icon: ShieldCheck,
    title: "Admin",
    text: "Workspace-wide overview and cleanup controls.",
    color: "text-pen-red",
  },
  {
    to: "/board",
    icon: MessagesSquare,
    title: "Team Board",
    text: "Read and post office notices for everyone.",
    color: "text-pen-purple",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  /**
   * §3 — Home reads the office's OWN database. Nothing is fetched, so the
   * counts and the search below are correct with the internet switched off.
   * Appointments are a team/cloud feature and are not part of the offline
   * promise, so they simply read as empty rather than failing.
   */
  const { documents } = useLocalAgreements();

  /** §43 — search from Home, not only from inside the archive. */
  const [query, setQuery] = useState("");

  const generated = useMemo(
    () => (documents ?? []).filter((d) => d.status === "generated" || d.status === "archived"),
    [documents],
  );
  /** §3 Drafts + §71 empty state: an untouched interview is a draft. */
  const drafts = useMemo(
    () => (documents ?? []).filter((d) => d.status === "draft" || d.status === "completed"),
    [documents],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // §39 — the same local search the archive uses, so Home and the archive
    // can never disagree about what a reference number means.
    return filterAgreements(documents, q).slice(0, 8);
  }, [documents, query]);

  const recent = documents.slice(0, 5);

  return (
    <AppShell title="Home" subtitle="Halkan aad ka bilowdo — document cusub, draft, ama raadi.">
      {/* Stat strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Documents la sameeyay</p>
          <p className="mt-1 text-2xl font-bold">{generated.length}</p>
        </div>
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Drafts in progress</p>
          <p className="mt-1 text-2xl font-bold">{drafts.length}</p>
        </div>
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Kaydiyo (Archive)</p>
          <p className="mt-1 text-2xl font-bold">{documents.length}</p>
        </div>
      </div>

      {/* §3 — Search, available from Home. */}
      <div className="notebook-page paper-grain mt-4 rounded-md p-4">
        <label
          htmlFor="home-search"
          className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          <SearchIcon className="size-3.5" /> Raadi
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="home-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="DPN/MG/… · Ruun Xassan · Kala Iibsi Hanti"
            className="bg-card/80"
          />
          <Button
            variant="outline"
            onClick={() => navigate(`/archive?q=${encodeURIComponent(query.trim())}`)}
            disabled={!query.trim()}
          >
            Raadi kaydka
          </Button>
        </div>
        {query.trim() !== "" && (
          <ul className="mt-3 divide-y divide-dashed divide-border/70">
            {matches.length === 0 && (
              <li className="py-3 text-xs text-muted-foreground">
                Laman xarun la raadiyo — hubi tirrada tixraaca ama magaca.
              </li>
            )}
            {matches.map((d) => (
              <li key={d.id}>
                <Link
                  to={`/archive/${d.id}`}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <FileSignature className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {d.referenceNumber || "Draft"} · {d.subTypeLabel}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {documentStatusLabel(d.status)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Area cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="notebook-page paper-grain rounded-md p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted/60">
              <a.icon className={`size-5 ${a.color}`} />
            </div>
            <p className="font-semibold">{a.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{a.text}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open <ArrowRight className="size-3.5" />
            </span>
          </Link>
        ))}

        {/* Quick start card for each ready document type */}
        {documentConfigs.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => navigate("/new")}
            className="notebook-page paper-grain rounded-md border-t-4 border-t-primary/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="font-semibold">{c.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{c.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Start now <ArrowRight className="size-3.5" />
            </span>
          </button>
        ))}
      </div>

      {/* §3 About — what the system is, stated honestly. */}
      <section className="notebook-page paper-grain mt-6 rounded-md p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Info className="size-4 text-primary" /> About
        </h2>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
          DPN Notary waa nidaam diyaarinta heshiisyada iyo cadaymaha. Sidee halkan ku
          muuqato, sidaas ayay u muuqataa Word-ka, PDF-ka iyo daabaca — hal model, hal
          xaqiiqo. Qoraalka sharci ayaa had iyo jeer ku jira template-kaaga Word-ka; nidaamku
          wuxuu buuxinayaa xogta kaliya, marnaba wuu qorayaa eray cusub.
        </p>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* §3 Drafts — an unfinished interview is resumable, so it links
            straight back into the interview, never to a read-only view. */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Drafts</h2>
            <Link
              to="/archive?status=draft"
              className="text-xs font-medium text-primary hover:underline"
            >
              Dhammaan →
            </Link>
          </div>
          <div className="notebook-page paper-grain rounded-md p-2">
            {drafts.length === 0 ? (
              <p
                className="p-6 text-center text-sm text-muted-foreground"
                data-empty="drafts"
              >
                Ma jiraan drafts.
              </p>
            ) : (
              <ul className="divide-y divide-dashed divide-border/70">
                {drafts.slice(0, 6).map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/documents/${d.id}`}
                      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/50"
                    >
                      <PenLine className="size-4 shrink-0 text-pen-orange" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {d.referenceNumber || "Draft"} · {d.subTypeLabel}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {documentStatusLabel(d.status)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Recent documents */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent documents</h2>
            <Link to="/archive" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="notebook-page paper-grain rounded-md p-2">
            {recent.length === 0 ? (
              <p
                className="p-6 text-center text-sm text-muted-foreground"
                data-empty="documents"
              >
                Dooro nooca document-ka si aad u bilowdo.
              </p>
            ) : (
              <ul className="divide-y divide-dashed divide-border/70">
                {recent.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/archive/${d.id}`}
                      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/50"
                    >
                      <FileSignature className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {d.referenceNumber || "Draft"} · {d.subTypeLabel}
                      </span>
                      <Badge
                        variant={isFinishedStatus(d.status) ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {documentStatusLabel(d.status)}
                      </Badge>
                      <span className="notebook-annotation hidden text-xs text-muted-foreground sm:inline">
                        {formatSomaliDate(new Date(d.createdAt ?? 0).toISOString().slice(0, 10))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Backup — §41. The office keeps its own copy of everything, on
            this machine, and downloads it as ONE file. */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Backup &amp; Restore</h2>
            <Link to="/settings" className="text-xs font-medium text-primary hover:underline">
              Settings →
            </Link>
          </div>
          <div className="notebook-page paper-grain rounded-md p-4">
            <p className="text-xs leading-5 text-muted-foreground">
              Nidaamku wuxuu ka shaqeeyaa internet la'aan. Hayso nuqul amaar-amar
              suurtogal ah: <strong className="text-foreground">.notary-backup.json</strong>{" "}
              wuxuu ku jiraa dhammaan heshiisyada, drafts, tixraacyada, settings-ka iyo
              templates-kaaga.
            </p>
            <Button
              variant="outline"
              className="mt-3 gap-2"
              onClick={async () => {
                try {
                  const backup = await exportBackup();
                  toast.success(
                    `Backup waa la soo saaray — ${backup.counts.agreements ?? 0} heshiis, ${
                      backup.counts.drafts ?? 0
                    } draft.`,
                  );
                } catch (err) {
                  console.error(err);
                  toast.error("Backup-ku lama sameeyn karin — isku day mar kale.");
                }
              }}
            >
              <HardDriveDownload className="size-4" /> Backup Database
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
