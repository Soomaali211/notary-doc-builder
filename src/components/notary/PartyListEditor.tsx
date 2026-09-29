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
        return (
          <div
            key={row.id}
            className="notebook-page paper-grain rounded-md p-4"
            style={{ borderLeft: "3px solid var(--rule)" }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px]">
                  {index + 1}
                </span>
                {name || `${partyDef.singular} ${index + 1}`}
              </span>
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
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {partyDef.fields.map((field) => {
                const fieldError = rowErrors?.find((e) => e.fieldId === field.id);
                return (
                  <FieldRenderer
                    key={field.id}
                    field={{ ...field, colSpan: field.colSpan ?? 1 }}
                    value={row.values?.[field.id] ?? ""}
                    error={fieldError?.message}
                    disabled={disabled}
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
