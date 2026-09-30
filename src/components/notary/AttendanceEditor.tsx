import { useState } from "react";
import { Label } from "@/components/ui/label";
import { FieldRenderer } from "./FieldRenderer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Link2, Plus, UserRound, Users, X } from "lucide-react";
import type {
  AttendanceStatus,
  FormValues,
  PartyDef,
} from "@/lib/notary/types";
import {
  getPartyRows,
  getRepresentatives,
  representedByRep,
  representativeNameFor,
} from "@/lib/notary/formValues";
import { ATTENDANCE_OPTIONS } from "@/lib/notary/types";
import {
  ATTENDANCE_UI,
  COMMON,
  type Locale,
  t,
} from "@/lib/notary/labels";

interface AttendanceEditorProps {
  partyDef: PartyDef;
  values: FormValues;
  locale?: Locale;
  disabled?: boolean;
  errors?: Record<number, { fieldId: string; message: string }[]>;
  onSetStatus: (partyId: string, rowIndex: number, status: AttendanceStatus) => void;
  onLinkRep: (partyId: string, rowIndex: number, repId: string | undefined) => void;
  onCreateRep: () => void;
  onUpdateRep: (repId: string, fieldId: string, value: string) => void;
  onRemoveRep: (repId: string) => void;
}

const STATUS_STYLE: Record<
  AttendanceStatus,
  { chip: string; mark: string }
> = {
  jooga: {
    chip: "border-pen-green/60 bg-pen-green/10 text-pen-green",
    mark: "✓",
  },
  ma_joogo: {
    chip: "border-destructive/50 bg-destructive/10 text-destructive",
    mark: "✗",
  },
  wakiil: {
    chip: "border-pen-purple/60 bg-pen-purple/10 text-pen-purple",
    mark: "◉",
  },
};

/**
 * Per-party attendance step: every Kireeye/Kirayste is asked individually
 * (Jooga / Ma Joogo / Wakiil). Representatives are shared: data is
 * entered ONCE per wakiil, then linked to many parties — never duplicated.
 */
export function AttendanceEditor({
  partyDef,
  values,
  locale = "so",
  disabled,
  errors,
  onSetStatus,
  onLinkRep,
  onCreateRep,
  onUpdateRep,
  onRemoveRep,
}: AttendanceEditorProps) {
  const rows = getPartyRows(values, partyDef.id);
  const reps = getRepresentatives(values, partyDef);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Party cards — one decision per party */}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row, index) => {
          const status = row.attendance?.status;
          const rowErr = errors?.[index]?.find((e) => e.fieldId === "attendance");
          const linkedRepName =
            status === "wakiil" ? representativeNameFor(values, partyDef, row) : "";
          const partyName =
            (row.values?.[partyDef.fields[0]?.id ?? ""] ?? "").trim() ||
            `${partyDef.singular} ${index + 1}`;
          return (
            <div
              key={row.id}
              className={cn(
                "notebook-page paper-grain rounded-md p-4 transition-shadow hover:shadow-sm",
                rowErr && "ring-1 ring-destructive/50",
              )}
              style={{ borderLeft: "3px solid var(--rule)" }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px]">
                    {index + 1}
                  </span>
                  {partyName}
                </span>
                {status && (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      STATUS_STYLE[status].chip,
                    )}
                  >
                    {STATUS_STYLE[status].mark}{" "}
                    {t(ATTENDANCE_OPTIONS.find((o) => o.value === status)!.label, locale)}
                  </span>
                )}
              </div>

              {/* Segmented radio cards */}
              <div
                role="radiogroup"
                aria-label={`${ATTENDANCE_UI.chooseStatus.en} — ${partyName}`}
                className="grid grid-cols-3 gap-1.5"
              >
                {ATTENDANCE_OPTIONS.map((opt) => {
                  const active = status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={disabled}
                      onClick={() => onSetStatus(partyDef.id, index, opt.value)}
                      className={cn(
                        "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-2 text-center transition-all focus-visible:outline-2 focus-visible:outline-ring",
                        active
                          ? STATUS_STYLE[opt.value].chip + " shadow-sm"
                          : "border-border bg-card/70 text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span className="text-sm font-semibold">
                        {STATUS_STYLE[opt.value].mark} {t(opt.label, locale)}
                      </span>
                      <span className="text-[10px] leading-3 opacity-80">
                        {t(opt.hint, locale)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Representative picker (only when wakiil) */}
              {status === "wakiil" && (
                <div className="mt-3 space-y-2 rounded-md border border-dashed border-pen-purple/40 bg-pen-purple/5 p-3">
                  <Label className="text-xs font-semibold text-pen-purple">
                    {t(ATTENDANCE_UI.chooseRep, locale)} — {partyName}
                  </Label>
                  {reps.length > 0 && (
                    <div className="space-y-1.5">
                      {reps.map((rep) => {
                        const repName =
                          (rep.values?.[partyDef.representativeFields?.[0]?.id ?? "magac"] ?? "").trim();
                        const checked = row.attendance?.representativeId === rep.id;
                        return (
                          <label
                            key={rep.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                              checked
                                ? "border-pen-purple bg-pen-purple/10 font-medium"
                                : "border-border bg-card/70 hover:bg-muted",
                            )}
                          >
                            <input
                              type="radio"
                              name={`rep-${row.id}`}
                              checked={checked}
                              onChange={() => onLinkRep(partyDef.id, index, rep.id)}
                              disabled={disabled}
                              className="size-3.5 accent-[var(--pen-purple)]"
                            />
                            {repName || "(wakiil aan magac lahayn)"}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {reps.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t(ATTENDANCE_UI.noReps, locale)}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={onCreateRep}
                    className="h-7 gap-1 text-xs"
                  >
                    <Plus className="size-3.5" /> {t(ATTENDANCE_UI.newRep, locale)}
                  </Button>
                  {linkedRepName && (
                    <p className="flex items-center gap-1 text-xs text-pen-purple">
                      <Link2 className="size-3.5" /> {linkedRepName}
                    </p>
                  )}
                  {rowErr && <p className="text-xs text-destructive">✗ {rowErr.message}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Shared representatives — entered once, linked to many */}
      <div className="rounded-md border border-border/70 bg-card/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-primary" />
            Wakiillada {partyDef.label}
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onCreateRep}
            className="h-7 gap-1 text-xs"
          >
            <Plus className="size-3.5" /> {t(ATTENDANCE_UI.newRep, locale)}
          </Button>
        </div>

        {reps.length === 0 && (
          <p className="text-sm text-muted-foreground">{t(ATTENDANCE_UI.noReps, locale)}</p>
        )}

        <div className="space-y-3">
          {reps.map((rep, repIdx) => {
            const nameField = partyDef.representativeFields?.[0]?.id ?? "magac";
            const repName = (rep.values?.[nameField] ?? "").trim();
            const representing = representedByRep(values, partyDef, rep.id);
            const isOpen = expanded === rep.id;
            return (
              <div
                key={rep.id}
                className="rounded-md border border-border bg-background/60 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-pen-purple/10 text-pen-purple">
                      <UserRound className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        Wakiil {String.fromCharCode(65 + repIdx)}
                        {repName && <span className="ml-1.5 font-normal text-muted-foreground">— {repName}</span>}
                      </p>
                      {representing.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-pen-purple">
                            {t(ATTENDANCE_UI.representing, locale)}:
                          </span>{" "}
                          {representing.join(", ")}
                        </p>
                      ) : (
                        <p className="text-xs text-pen-orange">{t(ATTENDANCE_UI.unlinked, locale)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => setExpanded(isOpen ? null : rep.id)}
                      className="h-7 px-2 text-xs"
                    >
                      {isOpen ? "Xir" : "Xogta"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t(COMMON.removeConfirm, locale)}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t(COMMON.removeQuestion(repName || "wakiilkan"), locale)}
                            Xiriiradaha xubnaha la tirtirayaa (xubintu weli way joogtaa).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t(COMMON.cancel, locale)}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => onRemoveRep(rep.id)}
                          >
                            {t(COMMON.yesRemove, locale)}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 grid gap-x-4 gap-y-3 border-t border-dashed border-border pt-3 sm:grid-cols-2">
                    {(partyDef.representativeFields ?? []).map((field) => (
                      <FieldRenderer
                        key={field.id}
                        field={{ ...field, colSpan: field.colSpan ?? 1 }}
                        value={rep.values?.[field.id] ?? ""}
                        disabled={disabled}
                        onChange={(value) => onUpdateRep(rep.id, field.id, value)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Relationship summary — clear visual mapping */}
      {reps.some((r) => representedByRep(values, partyDef, r.id).length > 0) && (
        <div className="rounded-md border border-pen-green/40 bg-pen-green/5 p-3">
          {reps
            .map((r) => ({ rep: r, parties: representedByRep(values, partyDef, r.id) }))
            .filter(({ parties }) => parties.length > 0)
            .map(({ rep, parties }) => (
              <p key={rep.id} className="flex items-start gap-1.5 text-xs">
                <Check className="mt-0.5 size-3.5 shrink-0 text-pen-green" />
                <span>
                  <strong className="text-pen-green">Wakiil:</strong>{" "}
                  {(rep.values?.[partyDef.representativeFields?.[0]?.id ?? "magac"] ?? "").trim()} —{" "}
                  {t(ATTENDANCE_UI.representing, locale)} {parties.join(", ")}
                </span>
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

/** Where a party list is missing rows entirely (e.g. count = 0). */
export function attendanceGroupEmpty(partyDef: PartyDef, values: FormValues): boolean {
  return getPartyRows(values, partyDef.id).length === 0;
}
