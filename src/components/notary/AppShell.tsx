/**
 * SHELL — 6 tabs, one language toggle, nothing else.
 *
 *   Dukumentiyada | Macaamiisha | Lacagaha | Warbixinada | Dhismaha | Habayn
 *
 * "Dhismaha" is the form builder: the place a type is BORN, so it sits
 * beside the tabs that read the types. Desktop: the tabs sit in the top
 * bar. Phone: the same tabs are a fixed bottom bar. Each page renders its
 * own header (title, one line, one primary action); the shell is only
 * chrome.
 */
import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { LanguageProvider, useLang, type Lang } from "@/lib/lang";
import {
  BarChart3,
  FileText,
  Layers,
  PenLine,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

const TABS = [
  { to: "/documents", labelKey: "tabDocuments", icon: FileText },
  { to: "/clients", labelKey: "tabClients", icon: Users },
  { to: "/payments", labelKey: "tabPayments", icon: Wallet },
  { to: "/reports", labelKey: "tabReports", icon: BarChart3 },
  { to: "/builder", labelKey: "bfNavTab", icon: Layers },
  { to: "/habayn", labelKey: "tabSettings", icon: Settings },
] as const;

/** SO | EN — one language shows at a time. */
function LangToggle() {
  const { lang, setLang } = useLang();
  const options: Lang[] = ["so", "en"];
  return (
    <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={cn(
            "rounded px-2 py-1 font-semibold uppercase transition-colors",
            lang === option
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  /** Page heading — max five words. */
  title?: string;
  /** The page's ONE description line. */
  subtitle?: string;
  /** The page's ONE primary action. */
  action?: React.ReactNode;
}) {
  const { t } = useLang();
  const location = useLocation();
  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/documents" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <PenLine className="size-4" />
            </span>
            DPN Notary
          </Link>
          <div className="flex items-center gap-3">
            {/* Desktop tabs */}
            <nav className="hidden items-center gap-1 sm:flex">
              {TABS.map((tab) => (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive(tab.to)
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(tab.labelKey)}
                </Link>
              ))}
            </nav>
            <LangToggle />
          </div>
        </div>
      </header>

      {/* Page body: title ≤5 words · one line · one primary action · content */}
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:pb-10">
        {(title || action) && (
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {title && <h1 className="truncate">{title}</h1>}
              {subtitle && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}
        {children}
      </main>

      {/* Phone: fixed bottom nav, the same tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background sm:hidden">
        <ul className="mx-auto grid max-w-5xl grid-cols-6">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <Link
                to={tab.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px]",
                  isActive(tab.to)
                    ? "font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                <tab.icon className="size-5" />
                {t(tab.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Export the shell wrapped in the language provider so every page speaks one language. */
export function AppShellWithLang(props: React.ComponentProps<typeof AppShell>) {
  return (
    <LanguageProvider>
      <AppShell {...props} />
    </LanguageProvider>
  );
}
