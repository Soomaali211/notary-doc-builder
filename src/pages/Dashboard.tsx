import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/notary/AppShell";
import { Badge } from "@/components/ui/badge";
import { documentConfigs } from "@/lib/notary/documents";
import { formatSomaliDate } from "@/lib/notary/format";
import {
  ArrowRight,
  CalendarClock,
  FileSignature,
  FileUp,
  FolderOpen,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react";

const AREAS = [
  {
    to: "/new",
    icon: FileSignature,
    title: "New Document",
    text: "Start a guided interview and build a fresh rental contract.",
    color: "text-primary",
  },
  {
    to: "/catalog",
    icon: FolderOpen,
    title: "Catalog",
    text: "Browse every document type, ready and planned.",
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
    to: "/board",
    icon: MessagesSquare,
    title: "Team Board",
    text: "Read and post office notices for everyone.",
    color: "text-pen-purple",
  },
  {
    to: "/templates",
    icon: FileUp,
    title: "Templates",
    text: "Upload your own Word template and manage placeholders.",
    color: "text-pen-purple",
  },
  {
    to: "/admin",
    icon: ShieldCheck,
    title: "Admin",
    text: "Workspace-wide overview and cleanup controls.",
    color: "text-pen-red",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const documents = useQuery(api.notaryDocuments.listMyDocuments);
  const appointments = useQuery(api.notaryAppointments.listMine);

  const generated = useMemo(
    () => (documents ?? []).filter((d) => d.status === "generated"),
    [documents],
  );
  const upcoming = useMemo(
    () =>
      (appointments ?? [])
        .filter((a) => a.status === "scheduled")
        .slice(0, 3),
    [appointments],
  );
  const recent = (documents ?? []).slice(0, 5);

  return (
    <AppShell title="Welcome back" subtitle="Your workspace at a glance.">
      {/* Stat strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Contracts generated</p>
          <p className="mt-1 text-2xl font-bold">{generated.length}</p>
        </div>
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Drafts in progress</p>
          <p className="mt-1 text-2xl font-bold">{(documents ?? []).length - generated.length}</p>
        </div>
        <div className="notebook-page paper-grain rounded-md p-4">
          <p className="notebook-annotation text-xs text-muted-foreground">Upcoming signings</p>
          <p className="mt-1 text-2xl font-bold">
            {(appointments ?? []).filter((a) => a.status === "scheduled").length}
          </p>
        </div>
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

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
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
              <p className="p-6 text-center text-sm text-muted-foreground">
                No documents yet. Start one from the cards above.
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
                        {d.status === "generated" ? "Generated" : "Draft"}
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

        {/* Upcoming signings */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Upcoming signings</h2>
            <Link to="/schedule" className="text-xs font-medium text-primary hover:underline">
              Schedule →
            </Link>
          </div>
          <div className="notebook-page paper-grain rounded-md p-2">
            {upcoming.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nothing booked yet. Book a signing from the Schedule page.
              </p>
            ) : (
              <ul className="divide-y divide-dashed divide-border/70">
                {upcoming.map((a) => (
                  <li key={a._id} className="flex items-center gap-3 px-3 py-3">
                    <CalendarClock className="size-4 shrink-0 text-pen-orange" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                    <span className="notebook-annotation text-xs text-muted-foreground">
                      {a.date} · {a.time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
