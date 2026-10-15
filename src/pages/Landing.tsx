import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
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

const steps = [
  { title: "Choose", note: "Heshiis Kiro → Guri Xaas, Qol Meherad, or Jiingad" },
  { title: "Fill", note: "A guided 10-step interview with dynamic parties" },
  { title: "Verify", note: "Review page with validation in Somali" },
  { title: "Build", note: "DOCX assembled from your own Word template" },
];

const features = [
  {
    icon: PenLine,
    title: "Guided interviews",
    text: "Ten ordered sections, Next/Back navigation, a live progress bar, and conditional questions that only appear when they matter.",
    hl: "hl-blue",
  },
  {
    icon: Layers,
    title: "Dynamic parties",
    text: "Add as many lessors, lessees, and witnesses as the contract needs — nothing is hard-coded, add or remove rows freely.",
    hl: "hl-green",
  },
  {
    icon: FileSignature,
    title: "Your Word template",
    text: "The builder only fills the placeholders in your office's template. The document design stays exactly as you made it.",
    hl: "hl-pink",
  },
  {
    icon: FolderOpen,
    title: "Archive and search",
    text: "Every generated contract is stored with its parties and reference number, ready to open, comment on, or download again.",
    hl: "hl-blue",
  },
  {
    icon: CalendarClock,
    title: "Signing schedule",
    text: "Book signing appointments against a document so the whole team knows when and where each contract gets signed.",
    hl: "hl-green",
  },
  {
    icon: MessagesSquare,
    title: "Team board and comments",
    text: "Post office notices on the shared board and keep the discussion on each contract in its own comment thread.",
    hl: "hl-pink",
  },
];

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();

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
                  Open workspace <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/auth">Log in</Link>
                </Button>
                <Button asChild className="gap-1.5">
                  <Link to="/auth">
                    Get started <ArrowRight className="size-4" />
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
              built for our office team
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Rental contracts,{" "}
              <span className="highlight-sweep">assembled</span> — not retyped.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              Notary Doc Builder turns the office's rental contract into a
              guided interview. Answer the questions once and a finished DOCX
              comes out of your own Word template, archived and searchable for
              the whole team.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth">
                  Open the workspace <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Log in to your account</Link>
              </Button>
            </div>
            <p className="notebook-annotation mt-4 text-xs text-muted-foreground">
              * Internal tool — accounts are for office staff only.
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
                Heshiis Kiro — step 2 of 10
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-muted">
                <div className="h-full w-1/5 rounded bg-primary" />
              </div>
              <p className="mt-6 text-sm font-semibold">Kireeyaha (the lessor)</p>
              <div className="mt-3 space-y-3">
                <div className="rounded border border-border/80 bg-card/70 px-3 py-2 text-sm">
                  Full name <span className="notebook-annotation text-muted-foreground">— Cabdi Xasan</span>
                </div>
                <div className="rounded border border-border/80 bg-card/70 px-3 py-2 text-sm">
                  Phone <span className="notebook-annotation text-muted-foreground">— +252 61 5551234</span>
                </div>
                <div className="rounded border border-border/80 bg-card/70 px-3 py-2 text-sm">
                  ID number <span className="notebook-annotation text-muted-foreground">— ID-8842</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">← Back</span>
                <span className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                  Next →
                </span>
              </div>
              <p className="notebook-annotation mt-4 text-xs text-primary">
                + Add another lessor · + Add a witness
              </p>
            </div>
            <p className="notebook-annotation absolute -bottom-5 right-4 rotate-2 text-sm text-pen-green">
              every placeholder filled ✓
            </p>
          </motion.div>
        </div>
      </section>

      {/* Workflow strip */}
      <section className="border-y border-border/70 bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{s.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight">
          Everything the office needs, <span className="hl-green">in one notebook</span>
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Contracts, scheduling, the archive, and the team's notices live in one
          place. The engine behind it is configuration-driven, so new contract
          types slot in without rewriting the app.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="notebook-page paper-grain rounded-md p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`mb-3 inline-flex items-center justify-center rounded-md px-2 py-1`}>
                <f.icon className={`size-4 ${f.hl === "hl-blue" ? "text-primary" : f.hl === "hl-green" ? "text-pen-green" : "text-pen-purple"}`} />
              </div>
              <p className="font-semibold">{f.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/70 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to build your first contract?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Log in, pick Heshiis Kiro, work through the interview, and the
            finished DOCX is ready to download and archive in minutes.
          </p>
          <Button asChild size="lg" className="mt-6 gap-2">
            <Link to="/auth">
              Get started <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/70 py-6 text-center">
        <p className="notebook-annotation text-xs text-muted-foreground">
          Notary Doc Builder · internal contract assembly for the notary office
        </p>
      </footer>
    </motion.div>
  );
}
