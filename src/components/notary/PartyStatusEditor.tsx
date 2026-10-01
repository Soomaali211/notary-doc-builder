import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldRenderer } from "./FieldRenderer";
import { cn } from "@/lib/utils";
import { UserPlus, Users, X } from "lucide-react";
import type { AttendanceStatus, FormValues, PartyDef, PartyRow } from "@/lib/notary/types";
import { getRepresentatives, representedByRep } from "@/lib/notary/formValues";
import { validateField } from "@/lib/notary/validation";

interface PartyStatusEditorProps {
  partyDef: PartyDef;
  values: FormValues;
  errors?: Record<number, { fieldId: string; message: string }[]>;
  disabled?: boolean;
  onFieldChange: (rowIndex: number, fieldId: string, value: string) => void;
  /** Ma Joogaa Heshiiska? — Haa (jooga) / Maya (wakiil ayaa matalaya). */
  onPresence: (rowIndex: number, present: boolean) => void;
  onLinkRep: (rowIndex: number, repId: string) => void;
  onCreateRep: (rowIndex: number) => void;
  onUpdateRep: (repId: string, fieldId: string, value: string) => void;
  onRemoveRep: (repId: string) => void;
}

const STATUS_CHIP: Record<AttendanceStatus, { cls: string; mark: string; label: string }> = {
  jooga: { cls: "border-pen-green/60 bg-pen-green/10 text-pen-green", mark: "✓", label: "Jooga" },
  ma_joogo: { cls: "border-destructive/50 bg-destructive/10 text-destructive", mark: "✗", label: "Ma Joogo" },
  wakiil: { cls: "border-pen-purple/60 bg-pen-purple/10 text-pen-purple", mark: "◉", label: "Wakiil" },
};

/**
 * Step 2 — "Xogta iyo Xaaladda Kireeyaha/Kiraystaha".
 *
 * One card per party (count comes from Step 1 — never re-asked here):
 *   Ma Joogaa Heshiiska?  [Haa] [Maya]
 *   – Haa  → Magaca qofka * + Telefoonka qofka *
 *   – Maya → Magaca qofka * + QAYBTA WAKIILKA (Magaca + Telefoonka
 *            Wakiilka — REAL input fields bound to the shared wakiil row)
 *
 * Storage stays in the existing form state: row.values + row.attendance
 * (jooga | ma_joogo | wakiil) and the wakiilo_* representative list, so
 * shared representatives keep working (one Wakiil serves many parties).
 */
export function PartyStatusEditor({
  partyDef,
  values,
  errors,
  disabled,
  onFieldChange,
  onPresence,
  onLinkRep,
  onCreateRep,
  onUpdateRep,
  onRemoveRep,
}: PartyStatusEditorProps) {
  const rows = (Array.isArray(values[partyDef.id]) ? values[partyDef.id] : []) as PartyRow[];
  const reps = getRepresentatives(values, partyDef);
  // The inline wakiil inputs mirror the first two representative fields
  // (magac + telefoon) — the rest stay optional in the config.
  const repInlineFields = (partyDef.representativeFields ?? []).filter(
    (f) => f.id === "magac" || f.id === "telefoon",
  );

  return (
    <div className="space-y-3">
      <div>
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" />
          {partyDef.label}
          <span className="notebook-annotation text-[11px] font-normal text-muted-foreground">
            {rows.length} la diiwaangeliyay
          </span>
        </Label>
        {partyDef.description && (
          <p className="text-xs text-muted-foreground">{partyDef.description}</p>
        )}
      </div>

      {rows.map((row, index) => {
        const status = row.attendance?.status;
        const present = status === "jooga";
        const absent = status === "ma_joogo" || status === "wakiil";
        const linkedRepId = row.attendance?.representativeId;
        const linkedRep = reps.find((r) => r.id === linkedRepId);
        const rowErrors = errors?.[index];
        const attError = rowErrors?.find((e) => e.fieldId === "attendance");
        const name = (row.values?.[partyDef.fields[0]?.id ?? ""] ?? "").trim();
        const title = name || `${partyDef.singular} ${index + 1}`;

        // A field shown only in another state (e.g. Telefoon under Maya) is
        // N/A: never rendered, never validated (req #11). A field required
        // for THIS status (Telefoon under Haa) shows its * indicator.
        const visibleFields = partyDef.fields
          .filter((f) => !f.showOnlyWhenRowStatus || f.showOnlyWhenRowStatus === status)
          .map((f) =>
            f.requiredWhenRowStatus && f.requiredWhenRowStatus === status
              ? { ...f, optional: false, validation: { ...(f.validation ?? {}), required: true } }
              : f,
          );

        // Rep picker hides empty unused rows; the linked one always shows.
        const pickableReps = reps.filter((rep) => {
          if (rep.id === linkedRepId) return true;
          const hasData = Object.values(rep.values ?? {}).some((v) => (v ?? "").trim() !== "");
          return hasData || representedByRep(values, partyDef, rep.id).length > 0;
        });
        const showRepPicker = pickableReps.length > 1;
        const sharedNames = linkedRep
          ? representedByRep(values, partyDef, linkedRep.id).filter((n) => n !== title)
          : [];

        return (
          <div key={row.id} className="neu-raised-sm p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px]">
                  {index + 1}
                </span>
                {title}
              </span>
              {status && (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    STATUS_CHIP[status].cls,
                  )}
                >
                  {STATUS_CHIP[status].mark} {STATUS_CHIP[status].label}
                </span>
              )}
            </div>

            {/* Ma Joogaa Heshiiska? — explicit Haa / Maya choice. */}
            <p className="mb-2 text-[13px] font-medium">Ma Joogaa Heshiiska?</p>
            <div
              role="radiogroup"
              aria-label={`Ma Joogaa Heshiiska? — ${title}`}
              className="grid grid-cols-2 gap-2.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={present}
                disabled={disabled}
                onClick={() => onPresence(index, true)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent px-2 py-2 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring",
                  present
                    ? "neu-inset glow-primary-sm border-pen-green/60 text-pen-green"
                    : "neu-raised text-foreground/80 hover:text-foreground",
                )}
              >
                <span>✓ Haa</span>
                <span className="text-[10px] leading-3 opacity-80">Wuu joogaa — xogtiisa</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={absent}
                disabled={disabled}
                onClick={() => onPresence(index, false)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent px-2 py-2 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring",
                  absent
                    ? "neu-inset glow-primary-sm border-pen-purple/60 text-pen-purple"
                    : "neu-raised text-foreground/80 hover:text-foreground",
                )}
              >
                <span>✗ Maya</span>
                <span className="text-[10px] leading-3 opacity-80">Wakiil ayaa matalaya</span>
              </button>
            </div>
            {attError && <p className="mt-2 text-xs text-destructive">✗ {attError.message}</p>}

            {/* Identity fields — status-aware visibility. */}
            <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {visibleFields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={{ ...field, colSpan: field.colSpan ?? 1 }}
                  value={row.values?.[field.id] ?? ""}
                  error={rowErrors?.find((e) => e.fieldId === field.id)?.message}
                  disabled={disabled}
                  onChange={(value) => onFieldChange(index, field.id, value)}
                />
              ))}
            </div>

            {/* QAYBTA WAKIILKA — ONLY when Maya. Real inputs, shared reps. */}
            {absent && (
              <div className="reveal-enter mt-3 rounded-lg border border-dashed border-pen-purple/40 bg-pen-purple/5 p-3">
                <p className="text-xs font-semibold tracking-wide text-pen-purple uppercase">
                  Qaybta Wakiilka
                </p>

                {showRepPicker && (
                  <div className="mt-2 space-y-1.5">
                    {pickableReps.map((rep, repIdx) => {
                      const repName = (
                        rep.values?.[partyDef.representativeFields?.[0]?.id ?? "magac"] ?? ""
                      ).trim();
                      const checked = linkedRepId === rep.id;
                      const repShared = representedByRep(values, partyDef, rep.id).filter(
                        (n) => n !== title,
                      );
                      return (
                        <div key={rep.id} className="flex items-center gap-1.5">
                          <label
                            className={cn(
                              "flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-all",
                              checked
                                ? "glow-primary-sm border-pen-purple/60 bg-pen-purple/10 font-medium"
                                : "neu-raised-sm border-transparent hover:text-foreground",
                            )}
                          >
                            <input
                              type="radio"
                              name={`rep-${row.id}`}
                              checked={checked}
                              disabled={disabled}
                              onChange={() => onLinkRep(index, rep.id)}
                              className="size-3.5 accent-[var(--pen-purple)]"
                            />
                            <span>{repName || `Wakiil ${repIdx + 1}`}</span>
                            {checked && repShared.length > 0 && (
                              <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                                la wadaagay: {repShared.join(", ")}
                              </span>
                            )}
                          </label>
                          <button
                            type="button"
                            aria-label={`Tirtir ${repName || `Wakiil ${repIdx + 1}`}`}
                            disabled={disabled}
                            onClick={() => onRemoveRep(rep.id)}
                            className="flex size-6 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {linkedRep ? (
                  <div className="mt-2 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    {repInlineFields.map((field) => (
                      <FieldRenderer
                        key={field.id}
                        field={{ ...field, colSpan: field.colSpan ?? 1 }}
                        value={linkedRep.values?.[field.id] ?? ""}
                        error={
                          validateField(field, linkedRep.values?.[field.id] ?? "") ?? undefined
                        }
                        disabled={disabled}
                        onChange={(value) => onUpdateRep(linkedRep.id, field.id, value)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-destructive">
                    Dooro wakiil ama samee mid cusub.
                  </p>
                )}

                {sharedNames.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Wakiilkan wuxuu kaloo matalayaa: {sharedNames.join(", ")}
                  </p>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onCreateRep(index)}
                  className="mt-2 h-7 gap-1 px-2 text-xs"
                >
                  <UserPlus className="size-3.5" /> Wakiil Cusub
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
