import { Button } from "@/components/ui/button";
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
import type { PartyDef, PartyRow } from "@/lib/notary/types";
import { Plus, Trash2, Users } from "lucide-react";

interface PartyListEditorProps {
  partyDef: PartyDef;
  rows: PartyRow[];
  errors?: Record<number, { fieldId: string; message: string }[]>;
  disabled?: boolean;
  /** Whether the repeater can accept another row (max/unlimited aware). */
  canAdd: boolean;
  onFieldChange: (rowIndex: number, fieldId: string, value: string) => void;
  onAdd: () => void;
  onRemove: (rowIndex: number) => void;
  /**
   * People already entered elsewhere in the form, for fields of type
   * "person". The value stored is the person's ID — the real link — so a
   * photograph, a signature line or a representation edge never re-asks for
   * a name the notary has already typed.
   *
   * Undefined for a document with no person fields (Heshiis Kiro), which is
   * why the editor behaves exactly as before without it.
   */
  personChoices?: { value: string; label: string }[];
}

export function PartyListEditor({
  partyDef,
  rows,
  errors,
  disabled,
  canAdd,
  onFieldChange,
  onAdd,
  onRemove,
  personChoices,
}: PartyListEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={disabled || !canAdd}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          Ku dar {partyDef.singular}
        </Button>
      </div>

      {rows.map((row, index) => {
        const rowErrors = errors?.[index];
        const name = (row.values?.[partyDef.fields[0]?.id ?? ""] ?? "").trim();
        const canRemove = rows.length > partyDef.min;
        const att = row.attendance;
        return (
          <div key={row.id} className="neu-raised-sm p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px]">
                  {index + 1}
                </span>
                {name || `${partyDef.singular} ${index + 1}`}
              </span>
              <div className="flex items-center gap-2">
                {/* Attendance chip — clear status at a glance */}
                {att?.status === "jooga" && (
                  <span className="rounded-full border border-pen-green/60 bg-pen-green/10 px-2 py-0.5 text-[10px] font-semibold text-pen-green">
                    ✓ Jooga
                  </span>
                )}
                {att?.status === "ma_joogo" && (
                  <span className="rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    ✗ Ma Joogo
                  </span>
                )}
                {att?.status === "wakiil" && (
                  <span className="rounded-full border border-pen-purple/60 bg-pen-purple/10 px-2 py-0.5 text-[10px] font-semibold text-pen-purple">
                    ◉ Wakiil
                  </span>
                )}
                {canRemove && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xaqiiji tirtirida</AlertDialogTitle>
                        <AlertDialogDescription>
                          Ma tirtirayn doontaa{" "}
                          <strong>{name || `${partyDef.singular} ${index + 1}`}</strong>?
                          Xogta la geliyay qaybtan waa la baabi'inayaa.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Jooji</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() => onRemove(index)}
                        >
                          Haa, tirtir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {partyDef.fields.map((field) => {
                const fieldError = rowErrors?.find((e) => e.fieldId === field.id);
                // A follow-up that belongs to THIS row only: it appears when
                // the answer it depends on is given, and disappears when it
                // is not. Blank counts as "not answered", so nothing is shown
                // for a row nobody has touched yet.
                const dep = field.showWhenRowValueAnyOf;
                if (dep) {
                  const given = (row.values?.[dep.field] ?? "").trim();
                  if (!dep.values.includes(given)) return null;
                }
                // The plural rule: with several people in this list the
                // document speaks in plurals, so per-person gender is not
                // asked — of anyone.
                if (field.hideWhenListHasMany && rows.length > 1) return null;
                return (
                  <FieldRenderer
                    key={field.id}
                    field={{ ...field, colSpan: field.colSpan ?? 1 }}
                    value={row.values?.[field.id] ?? ""}
                    error={fieldError?.message}
                    disabled={disabled}
                    {...(field.type === "person" && personChoices
                      ? { personOptions: personChoices }
                      : {})}
                    onChange={(value) => onFieldChange(index, field.id, value)}
                  />
                );
              })}
            </div>
            {rowErrors && rowErrors.length > 0 && (
              <p className="mt-2 text-xs text-destructive">
                {partyDef.singular} {index + 1}: wuxuu u baahan yahay xog buuxda.
              </p>
            )}
          </div>
        );
      })}

      {rows.length < partyDef.min && (
        <p className="text-xs text-destructive">
          {partyDef.label}: ugu yaraan {partyDef.min} waa loo baahan yahay.
        </p>
      )}
    </div>
  );
}
