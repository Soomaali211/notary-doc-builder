import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  FileSignature,
  LayoutDashboard,
  LogOut,
  PenLine,
  ShieldCheck,
  StickyNote,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new", label: "New Document", icon: FileSignature },
  { to: "/archive", label: "Archive", icon: PenLine },
  { to: "/catalog", label: "Catalog", icon: FileSignature },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
  { to: "/board", label: "Team Board", icon: StickyNote },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
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
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="notebook-bg min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border/70 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <PenLine className="size-4" />
            </span>
            Notary Doc Builder
          </Link>
          <div className="flex items-center gap-2">
            {user?.email && (
              <span className="notebook-annotation hidden text-xs text-muted-foreground sm:inline">
                {user.email}
              </span>
            )}
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleSignOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
        {/* Ruled nav strip */}
        <nav className="border-t border-dashed border-border/70">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-1.5">
            {NAV_ITEMS.map((item) => {
              const active =
                location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
            {subtitle && (
              <p className="notebook-annotation mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
