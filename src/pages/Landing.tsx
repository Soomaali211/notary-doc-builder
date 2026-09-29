import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  CheckCircle2,
  FileSignature,
  FolderOpen,
  Layers,
  PenLine,
  ShieldCheck,
} from "lucide-react";

const steps = [
  { title: "Dooro", note: "Heshiis Kiro → Guri Xaas / Qol / Jiingad" },
  { title: "Buuxi", note: "Waraysi 10-tallaabood ah, xisbiyo dynamic" },
  { title: "Xaqiiji", note: "Dib u eegis + validation Somali" },
  { title: "Abuur", note: "DOCX ka template-kaada Word" },
];

const features = [
  {
    icon: PenLine,
    title: "Waraysi Hagid ah",
    text: "Sections la kala soocay, Next/Back, progress indicator, iyo conditional questions (Deebaaji, Damiin).",
  },
  {
    icon: Layers,
    title: "Xisbiyo Dynamic ah",
    text: "Ku dar Kireeye, Kirayste, iyo Marag — tiradooda ma noqonayo mid hard-coded ah.",
  },
  {
    icon: FileSignature,
    title: "Word Template-kaada",
    text: "System-ku kaliya wuxuu buuxinayaa {{PLACEHOLDERS}}-ka template-kaaga — design-ka waa midkaaga.",
  },
  {
    icon: FolderOpen,
    title: "Kayd & Raadin",
    text: "Dukumeenti kasta waa la kaydiyaa: raadi, filter, fur, iyo soo deji markasta.",
  },
  {
    icon: ShieldCheck,
    title: "Xaqiijin & Badbaadin",
    text: "Validation Somali, safe file naming, iyo xogtaada luma ma doorto generation fashilmo.",
  },
  {
    icon: CheckCircle2,
    title: "Heshiis Kiro",
    text: "Guri Xaas, Qol Meherad, Jiingad — dhammaan shuruudaha Phase 1.",
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
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PenLine className="size-4" />
          </span>
          Nootaayada
        </span>
        <nav className="flex items-center gap-2">
          {!isLoading && isAuthenticated ? (
            <Button asChild className="gap-1.5">
              <Link to="/dashboard">
                Dashboard <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/auth">Soo gal</Link>
              </Button>
              <Button asChild className="gap-1.5">
                <Link to="/auth">
                  Bilow <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="notebook-annotation inline-block -rotate-1 rounded bg-highlight/30 px-2 py-0.5 text-sm">
              phase 1 — heshiis kiro
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Heshiisyada kiro ee{" "}
              <span className="highlight-sweep">nuqul la'aan</span> —
              buuxi, abuur, kaydi.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              Nootaayada waa system assembly dukumeenti oo u shaqeeya sida
              Docassemble — laakiin si gaar ah loogu habeeyey samaynta iyo
              kaydinta heshiisyada xafiiska nootaayada.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth">
                  Bilow Heshiis Kiro <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Xafiiska — soo gal</Link>
              </Button>
            </div>
            <p className="notebook-annotation mt-4 text-xs text-muted-foreground">
              * Word template-ka waxaa iska leh xafiiska — system-ku wuxuu kaliya
              buuxinayaa placeholders-ka.
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
                Heshiis Kiro — tallaabada 2/10
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-muted">
                <div className="h-full w-1/5 rounded bg-primary" />
              </div>
              <p className="mt-6 text-sm font-semibold">Kireeyaha</p>
              <div className="mt-3 space-y-3">
                <div className="rounded border border-border/80 bg-card/70 px-3 py-2 text-sm">
                  Magaca Buuxa <span className="notebook-annotation text-muted-foreground">— Cabdi Xasan</span>
                </div>
                <div className="rounded border border-border/80 bg-card/70 px-3 py-2 text-sm">
                  Telefoon <span className="notebook-annotation text-muted-foreground">— +252 61 5551234</span>
                </div>
                <div className="rounded border border-border/80 bg-card/70 px-3 py-2 text-sm">
                  Aqoonsi <span className="notebook-annotation text-muted-foreground">— ID-8842</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">← Back</span>
                <span className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                  Next →
                </span>
              </div>
              <p className="notebook-annotation mt-4 text-xs text-muted-foreground">
                + Ku dar Kireeye · + Ku dar Marag
              </p>
            </div>
            <p className="notebook-annotation absolute -bottom-5 right-4 rotate-2 text-sm text-primary">
              waa mid dhab ah oo buuxa! ✓
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
          Sida <span className="highlight-sweep">nidaamku</span> u shaqeeyo
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Engine-ku waa configuration-driven: document type kasta (Heshiis Deyn,
          Wakiilnimo, Kala Iibsi Hanti…) wuxuu noqon karaa config cusub —
          code-ka engine-ka lama bedelin.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="notebook-page paper-grain rounded-md p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <f.icon className="size-4" />
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
            Diyaar tahay inaad abuurto heshiiska ugu horreeya?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Ku bilow xafiiska — dooro Heshiis Kiro, buuxi waraysiga, iyo DOCX-ga
            waa la abuuraa si toos ah.
          </p>
          <Button asChild size="lg" className="mt-6 gap-2">
            <Link to="/auth">
              Gal xafiiska <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/70 py-6 text-center">
        <p className="notebook-annotation text-xs text-muted-foreground">
          Nootaayada — Document Assembly for Notaries · Phase 1 MVP
        </p>
      </footer>
    </motion.div>
  );
}
