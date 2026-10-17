import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang";
import {
  ArrowRight,
  CalendarClock,
  FileSignature,
  FolderOpen,
  Layers,
  MessagesSquare,
  PenLine,
  ShieldCheck,
} from "lucide-react";

const STEP_KEYS = ["ldStepChoose", "ldStepFill", "ldStepVerify", "ldStepBuild"] as const;
const STEP_NOTE_KEYS = [
  "ldStepChooseNote",
  "ldStepFillNote",
  "ldStepVerifyNote",
  "ldStepBuildNote",
] as const;

const FEATURES = [
  { icon: PenLine, tKey: "ldF1Title", dKey: "ldF1Text", hl: "hl-blue" },
  { icon: Layers, tKey: "ldF2Title", dKey: "ldF2Text", hl: "hl-green" },
  { icon: FileSignature, tKey: "ldF3Title", dKey: "ldF3Text", hl: "hl-pink" },
  { icon: FolderOpen, tKey: "ldF4Title", dKey: "ldF4Text", hl: "hl-blue" },
  { icon: CalendarClock, tKey: "ldF5Title", dKey: "ldF5Text", hl: "hl-green" },
  { icon: MessagesSquare, tKey: "ldF6Title", dKey: "ldF6Text", hl: "hl-pink" },
] as const;

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLang();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="notebook-bg min-h-screen"
    >
      {/* Nav */}
      <header className="border-b border-border/70 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <PenLine className="size-4" />
            </span>
            Notary Doc Builder
          </span>
          <nav className="flex items-center gap-2">
            {!isLoading && isAuthenticated ? (
              <Button asChild className="gap-1.5">
                <Link to="/documents">
                  {t("ldOpenWorkspace")} <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/auth">{t("ldLogin")}</Link>
                </Button>
                <Button asChild className="gap-1.5">
                  <Link to="/auth">
                    {t("ldGetStarted")} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="notebook-annotation inline-block -rotate-1 rounded bg-highlight/40 px-2 py-0.5 text-sm">
              {t("ldBuiltFor")}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {t("ldHeroA")}{" "}
              <span className="highlight-sweep">{t("ldHeroHighlight")}</span>{t("ldHeroB")}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              {t("ldHeroParagraph")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth">
                  {t("ldHeroCta")} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">{t("ldHeroCtaLogin")}</Link>
              </Button>
            </div>
            <p className="notebook-annotation mt-4 text-xs text-muted-foreground">
              {t("ldInternalNote")}
            </p>
          </div>

          {/* Notebook mock */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="relative"
          >
            <div className="notebook-page paper-grain spiral-edge rounded-md p-6 sm:p-8">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t("ldStepLabel")}
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-muted">
                <div className="h-full w-1/5 rounded bg-primary" />
              </div>
              <p className="mt-6 text-sm font-semibold">{t("ldMockLessor")}</p>
              <div className="mt-3 space-y-3">
                <div className="rounded border border-border/80 bg-card/70 px-3 py-2 text-sm">
                  {t("ldMockFullname")} <span className="notebook-annotation text-muted-foreground">— Cabdi Xasan</span>
                </div>
                <div className="rounded border border-border/80 bg-card/70 px-3 py-2 text-sm">
                  {t("ldMockPhone")} <span className="notebook-annotation text-muted-foreground">— +252 61 5551234</span>
                </div>
                <div className="rounded border border-border/80 bg-card/70 px-3 py-2 text-sm">
                  {t("ldMockId")} <span className="notebook-annotation text-muted-foreground">— ID-8842</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("ldMockBack")}</span>
                <span className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                  {t("ldMockNext")}
                </span>
              </div>
              <p className="notebook-annotation mt-4 text-xs text-primary">
                {t("ldMockAdd")}
              </p>
            </div>
            <p className="notebook-annotation absolute -bottom-5 right-4 rotate-2 text-sm text-pen-green">
              {t("ldMockFilled")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Workflow strip */}
      <section className="border-y border-border/70 bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-4">
          {STEP_KEYS.map((key, i) => (
            <div key={key} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{t(key)}</p>
                <p className="text-xs leading-5 text-muted-foreground">{t(STEP_NOTE_KEYS[i])}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight">
          {t("ldFeaturesTitleA")} <span className="hl-green">{t("ldFeaturesTitleB")}</span>
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("ldFeaturesSub")}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.tKey}
              className="notebook-page paper-grain rounded-md p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`mb-3 inline-flex items-center justify-center rounded-md px-2 py-1`}>
                <f.icon className={`size-4 ${f.hl === "hl-blue" ? "text-primary" : f.hl === "hl-green" ? "text-pen-green" : "text-pen-purple"}`} />
              </div>
              <p className="font-semibold">{t(f.tKey)}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(f.dKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/70 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("ldCtaTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {t("ldCtaSub")}
          </p>
          <Button asChild size="lg" className="mt-6 gap-2">
            <Link to="/auth">
              {t("ldGetStarted")} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/70 py-6 text-center">
        <p className="notebook-annotation text-xs text-muted-foreground">
          {t("ldFooter")}
        </p>
      </footer>
    </motion.div>
  );
}
