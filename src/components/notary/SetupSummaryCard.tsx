import { Button } from "@/components/ui/button";
import { Check, Pencil } from "lucide-react";
import type { AgreementSetup } from "@/lib/notary/agreementSetup";
import { setupSummaryRows } from "@/lib/notary/agreementSetup";
import type { DocumentConfig } from "@/lib/notary/types";

interface SetupSummaryCardProps {
  config: DocumentConfig;
  setup: AgreementSetup;
  complete: boolean;
  onEdit: () => void;
  onContinue: () => void;
}

/**
 * Step 1 summary — shown once every setup question is answered:
 * decisions at a glance with "Wax ka beddel" / "Sii wad" actions.
 */
export function SetupSummaryCard({
  config,
  setup,
  complete,
  onEdit,
  onContinue,
}: SetupSummaryCardProps) {
  const rows = setupSummaryRows(config, setup);
  return (
    <div className="neu-raised reveal-enter p-5" aria-live="polite">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="neu-dot-active flex size-7 items-center justify-center rounded-full">
            <Check className="size-3.5" />
          </span>
          <h3 className="text-sm font-bold tracking-wide uppercase">Dejinta Heshiiska</h3>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onEdit}>
            <Pencil className="size-3" /> Wax ka beddel
          </Button>
          {complete && (
            <Button type="button" size="sm" className="glow-primary-sm h-7 gap-1 px-2 text-xs" onClick={onContinue}>
              Sii wad <span aria-hidden>→</span>
            </Button>
          )}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1.5">
            <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
