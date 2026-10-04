/**
 * THE FINAL DOCUMENT ACTION BAR (§52).
 *
 * On the review screen every one of these is a DIFFERENT decision, so each
 * gets its own clearly labelled button:
 *
 *   Back            — the previous step. Never discards an answer (§5).
 *   Save Draft      — keep the work and stay here.
 *   Edit            — go back and change an answer. Nothing is lost.
 *   Confirm         — "this is the document I approve". A statement, not a
 *                     download: until the notary presses it, nothing is final.
 *   Generate DOCX   — the Word file (§26).
 *   Soo Saar PDF    — the operating system's own print-to-PDF (§25/§28).
 *                     Fast and exact: what comes out is what the printer
 *                     would have produced.
 *   PDF dhaqaaq ah  — the local generator's own .pdf file, with no dialog
 *                     and no page setup to guess (§27).
 *   Home            — back to Home, through the unsaved-changes gate (§5).
 *
 * The two PDF buttons are separate on purpose. Both produce a PDF from the
 * SAME approved document; they differ only in how the file is made, and the
 * user chooses. Neither is presented as the only way.
 *
 * Everything on this bar works with the internet switched off.
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCheck,
  Download,
  FileText,
  Home,
  Loader2,
  Pencil,
  Printer,
  Save,
} from "lucide-react";

export interface DocumentActionBarProps {
  /** Step 0 — Back is unavailable and says so rather than doing nothing. */
  onBack: () => void;
  canGoBack: boolean;
  onSaveDraft: () => void;
  onEdit: () => void;
  onConfirm: () => void;
  onGenerateDocx: () => void;
  onPrintPdf: () => void;
  onLocalPdf: () => void;
  onHome: () => void;
  /** "1/6" — where the notary is. */
  position: string;
  busy: boolean;
  saving: boolean;
  /** The document is approved — Confirm says so instead of asking again. */
  confirmed: boolean;
  /** Something is genuinely missing and must be filled in first. */
  blockedReason?: string;
}

export function DocumentActionBar({
  onBack,
  canGoBack,
  onSaveDraft,
  onEdit,
  onConfirm,
  onGenerateDocx,
  onPrintPdf,
  onLocalPdf,
  onHome,
  position,
  busy,
  saving,
  confirmed,
  blockedReason,
}: DocumentActionBarProps) {
  const disabled = busy;

  return (
    <div
      className="neu-raised-sm sticky bottom-4 z-20 flex flex-wrap items-center gap-2 px-4 py-3"
      data-document-action-bar=""
      aria-label="Hawlaha dukumeentiga"
    >
      {/* Back / position — the step indicator lives between the two
          directions, so the bar reads as one control, not a row of buttons. */}
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={!canGoBack || disabled}
        className="gap-2"
        data-action="back"
      >
        <ArrowLeft className="size-4" /> Dib
      </Button>
      <span className="notebook-annotation px-1 text-xs text-muted-foreground tabular-nums">
        {position}
      </span>

      {/* Save / Edit / Confirm — the three statements about the work. */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onSaveDraft}
          disabled={disabled}
          className="gap-2"
          data-action="save-draft"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Kaydi Draft
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onEdit}
          disabled={disabled}
          className="gap-2"
          data-action="edit"
        >
          <Pencil className="size-4" /> Wax ka beddel
        </Button>
        <Button
          type="button"
          variant={confirmed ? "outline" : "secondary"}
          onClick={onConfirm}
          disabled={disabled || Boolean(blockedReason)}
          title={blockedReason}
          className="gap-2"
          data-action="confirm"
        >
          <CheckCheck className="size-4" />
          {confirmed ? "Waa la xaqiijiyay" : "Xaqiiji"}
        </Button>
      </div>

      {/* The outputs — grouped so "make me a file" is visually one thing. */}
      <div className="ms-auto flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onGenerateDocx}
          disabled={disabled || Boolean(blockedReason)}
          title={blockedReason}
          className="gap-2"
          data-action="generate-docx"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Abuur DOCX
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onPrintPdf}
          disabled={disabled}
          className="gap-2"
          data-action="pdf-print"
        >
          <Printer className="size-4" /> Soo Saar PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onLocalPdf}
          disabled={disabled || Boolean(blockedReason)}
          title={blockedReason}
          className="gap-2"
          data-action="pdf-local"
        >
          <FileText className="size-4" /> PDF dhaqaaq ah
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onHome}
          disabled={disabled}
          className="gap-2"
          data-action="home"
        >
          <Home className="size-4" /> Home
        </Button>
      </div>

      {blockedReason ? (
        <p
          className="w-full text-xs font-medium text-destructive"
          data-action-blocked-reason=""
          role="status"
        >
          {blockedReason}
        </p>
      ) : (
        <p
          className={cn(
            "w-full text-xs text-muted-foreground",
            confirmed && "font-medium text-pen-green",
          )}
          data-action-confirmed={confirmed ? "" : undefined}
        >
          {confirmed
            ? "Dukumeentiga waa la xaqiijiyay — marka aad codsato, isla kan ayuu noqdaa."
            : "Kahor intaadan soo saarin, xaqiiji dukumeentiga."}
        </p>
      )}
    </div>
  );
}

export default DocumentActionBar;