import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DatabaseBackup,
  FileSignature,
  FileUp,
  LayoutDashboard,
  PenLine,
  Settings as SettingsIcon,
} from "lucide-react";

/**
 * §3 — the navigation of an OFFLINE notary system.
 *
 * Everything here runs on this machine. The cloud-era pages (Schedule, Team
 * Board, Admin, Sign out) are not part of the offline promise — they need a
 * server that an offline machine does not have — so they are removed rather
 * than left as links that fail. Backup replaces Admin: on a machine that holds
 * the only copy of the office's work, the user's own backup is the thing that
 * matters, and it gets a place in the bar for that reason.
 */
const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/new", label: "Heshiis Cusub", icon: FileSignature },
  { to: "/archive", label: "Kaydka Heshiisyada", icon: PenLine },
  { to: "/catalog", label: "Catalog", icon: FileSignature },
  { to: "/templates", label: "Templates", icon: FileUp },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const location = useLocation();

  return (
    <div className="notebook-bg min-h-screen">
      {/* Soft top bar */}
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span className="neu-raised-sm glow-primary-sm flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <PenLine className="size-4" />
            </span>
            Notary Doc Builder
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/settings#backup">
                <DatabaseBackup className="size-4" /> Backup
              </Link>
            </Button>
          </div>
        </div>
        {/* Raised nav pills */}
        <nav>
          <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 pb-3">
            {NAV_ITEMS.map((item) => {
              const active =
                location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
                    active
                      ? "neu-inset-sm glow-primary-sm font-semibold text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {title && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
