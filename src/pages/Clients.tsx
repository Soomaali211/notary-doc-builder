/**
 * MACAAMIISHA — the clients page.
 *
 * Four counts · search over the stored names · the client list with the
 * documents each person appears in. Read-only: the office records clients
 * where they are recorded today — inside the document's own interview.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AppShellWithLang } from "@/components/notary/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/lang";
import { useLocalAgreements } from "@/lib/notary/localHooks";
import {
  clientsFromAgreements,
  groupCount,
  peopleCount,
  type ClientEntry,
} from "@/lib/notary/clients";
import { cn } from "@/lib/utils";
import { Phone, Users } from "lucide-react";

/** Where one appearance links: a filed document to the archive, else the interview. */
function appearanceTo(status: string, id: string): string {
  return status === "generated" || status === "archived" ? `/archive/${id}` : `/documents/${id}`;
}

function ClientRow({ entry }: { entry: ClientEntry }) {
  const { t } = useLang();
  const first = entry.appearances[0];
  return (
    <div className="notebook-page rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{entry.name}</span>
        {entry.isGroup && <Badge variant="outline" className="text-[11px]">{t("groupBadge")}</Badge>}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="size-3" />
          {entry.phone || "—"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {entry.appearances.slice(0, 5).map((a, i) => (
          <Link
            key={`${a.agreementId}:${a.roleLabel}:${i}`}
            to={appearanceTo(a.status, a.agreementId)}
            className="truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {a.roleLabel} · {a.referenceNumber || a.documentTypeTitle}
          </Link>
        ))}
        {entry.appearances.length > 5 && (
          <span className="text-xs text-muted-foreground">
            +{entry.appearances.length - 5}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Clients() {
  const { t } = useLang();
  const { documents, loading } = useLocalAgreements();
  const [query, setQuery] = useState("");

  const entries = useMemo(() => clientsFromAgreements(documents), [documents]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.phone && e.phone.toLowerCase().includes(q)) ||
        e.appearances.some(
          (a) =>
            (a.referenceNumber ?? "").toLowerCase().includes(q) ||
            a.documentTypeTitle.toLowerCase().includes(q),
        ),
    );
  }, [entries, q]);

  const stats = useMemo(
    () => ({
      people: peopleCount(entries),
      groups: groupCount(entries),
      records: entries.reduce((sum, e) => sum + e.appearances.length, 0),
      docs: new Set(entries.flatMap((e) => e.appearances.map((a) => a.agreementId))).size,
    }),
    [entries],
  );

  return (
    <AppShellWithLang title={t("clientTitle")} subtitle={t("clientSub")}>
      {/* Four counts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statPeople")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.people}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statGroups")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.groups}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statRoleRecords")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.records}</p>
        </div>
        <div className="notebook-page rounded-lg p-4">
          <p className="text-xs text-muted-foreground">{t("statDocs")}</p>
          <p className="mt-1 text-lg font-semibold">{stats.docs}</p>
        </div>
      </div>

      {/* Search over the stored names */}
      <div className="mt-6">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("clientSearchPlaceholder")}
          className="bg-card"
        />
      </div>

      {/* The client list itself */}
      <div className="mt-4 space-y-2">
        {loading && <p className="text-sm text-muted-foreground">…</p>}
        {!loading && filtered.length === 0 && (
          <div
            className={cn("notebook-page rounded-lg p-10 text-center")}
            data-empty="clients"
          >
            <Users className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              {entries.length === 0 ? t("clientEmpty") : t("noClientSearchMatch")}
            </p>
            {entries.length === 0 && (
              <p className="mt-1 text-sm text-muted-foreground">{t("clientEmptyHint")}</p>
            )}
          </div>
        )}
        {!loading &&
          filtered.map((entry) => <ClientRow key={entry.key} entry={entry} />)}
      </div>
    </AppShellWithLang>
  );
}
