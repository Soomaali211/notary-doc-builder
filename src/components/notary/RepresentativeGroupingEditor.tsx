/**
 * REPRESENTATIVE GROUPING editor.
 *
 * The per-party "Dooro wakiil" radio links ONE person to ONE representative
 * at a time, which makes a shared wakiil tedious to set up: four absent
 * people all represented by the same person means choosing the same radio
 * four times and typing nothing extra — but the user cannot SEE that those
 * four belong together, nor tick them in one go.
 *
 * This panel shows the grouping directly:
 *
 *   WAKIIL 1
 *   Matalaya:
 *     ☑ Kireeye 2   ☑ Kireeye 3   ☑ Kireeye 4   ☑ Kireeye 5
 *   Magaca Wakiilka:  [ Axmed Cali ]
 *   Telefoonka:       [ 063xxxx ]
 *   [+ Ku dar Wakiil kale]
 *
 * Checking a person links them to that representative (one stored record,
 * many `representativeId` references). People who are present are shown
 * disabled: a representative is never attached to someone who attended.
 *
 * Storage is unchanged — this only drives the same existing form state
 * (`attendance.representativeId` + the shared `wakiilo_*` list).
 */

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertTriangle, UserPlus, Users, X } from "lucide-react";
import type { FormValues, PartyDef, PartyRow } from "@/lib/notary/types";
import { getRepresentatives, representedByRep } from "@/lib/notary/formValues";
import { FieldRenderer } from "./FieldRenderer";

interface RepresentativeGroupingEditorProps {
  partyDef: PartyDef;
  values: FormValues;
  disabled?: boolean;
  /** Check/uncheck one person for this representative. */
  onTogglePerson: (repId: string, rowIndex: number, member: boolean) => void;
  /** Create a new, empty representative. */
  onCreateRep: () => void;
  onUpdateRep: (repId: string, fieldId: string, value: string) => void;
  onRemoveRep: (repId: string) => void;
}

export function RepresentativeGroupingEditor({
  partyDef,
  values,
  disabled,
  onTogglePerson,
  onCreateRep,
  onUpdateRep,
  onRemoveRep,
}: RepresentativeGroupingEditorProps) {
  const rows = (Array.isArray(values[partyDef.id]) ? values[partyDef.id] : []) as PartyRow[];
  const reps = getRepresentatives(values, partyDef);
  const repNameField = partyDef.representativeFields?.[0]?.id ?? "magac";
  const repFields = (partyDef.representativeFields ?? []).filter(
    (f) => f.id === "magac" || f.id === "telefoon",
  );

  // Only absent people can be represented; a present person keeps their own
  // signature and must never be attached to a wakiil.
  const absent = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.attendance?.status !== "jooga");

  if (absent.length === 0) return null;

  const labelFor = (row: PartyRow, index: number): string => {
    const name = (row.values?.[partyDef.fields[0]?.id ?? "magac"] ?? "").trim();
    return name || `${partyDef.singular} ${index + 1}`;
  };

  return (
    <div className="neu-raised p-4">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-pen-purple" />
        <Label className="text-sm font-semibold">
          Wakiillo — kooxaha matalaya
        </Label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Hal Wakiil wuxuu matali karaa hal qof ama dhowr qof. Magaca iyo
        telefoonka hal mar baa la geliyaa — qof kasta oo aad <strong>tixraacdo</strong>{" "}
        wuxuu usha wakiilkaas u xiran doonaa.
      </p>

      <div className="mt-3 space-y-3">
        {reps.map((rep, repIdx) => {
          const repName = (rep.values?.[repNameField] ?? "").trim();
          const heading = repName || `WAKIIL ${repIdx + 1}`;
          const members = new Set(
            rows
              .map((r, i) => ({ r, i }))
              .filter(({ r }) => r.attendance?.representativeId === rep.id)
              .map(({ i }) => i),
          );
          const memberNames = representedByRep(values, partyDef, rep.id);

          return (
            <div
              key={rep.id}
              className="rounded-lg border border-dashed border-pen-purple/40 bg-pen-purple/5 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold tracking-wide text-pen-purple uppercase">
                  {heading}
                </p>
                <button
                  type="button"
                  aria-label={`Tirtir ${heading}`}
                  disabled={disabled}
                  onClick={() => onRemoveRep(rep.id)}
                  className="flex size-6 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* MATALAYA — tick who this representative acts for. */}
              <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                Matalaya:
              </p>
              <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                {rows.map((row, index) => {
                  const present = row.attendance?.status === "jooga";
                  const checked = members.has(index);
                  return (
                    <label
                      key={row.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-all",
                        present
                          ? "cursor-not-allowed border-transparent bg-muted/30 text-muted-foreground/70"
                          : checked
                            ? "cursor-pointer border-pen-purple/60 bg-pen-purple/10 font-medium text-pen-purple"
                            : "neu-raised-sm cursor-pointer border-transparent hover:text-foreground",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled || present}
                        onChange={(e) => onTogglePerson(rep.id, index, e.target.checked)}
                        className="size-3.5 accent-[var(--pen-purple)]"
                      />
                      <span className="truncate">
                        {partyDef.singular} {index + 1} — {labelFor(row, index)}
                      </span>
                      {present && (
                        <span className="ml-auto text-[10px] text-pen-green">Jooga</span>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* The representative's own details — entered ONCE. */}
              <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                {repFields.map((field) => (
                  <FieldRenderer
                    key={field.id}
                    field={{ ...field, colSpan: field.colSpan ?? 1 }}
                    value={rep.values?.[field.id] ?? ""}
                    disabled={disabled}
                    onChange={(value) => onUpdateRep(rep.id, field.id, value)}
                  />
                ))}
              </div>

              {memberNames.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Wuxuu matalayaa ahaan: {memberNames.join(", ")}
                </p>
              )}

              {/* An incomplete representative must never silently become
                  "—" in the signed document. Say so here, per group, and
                  offer a way out that leaves the rest of the form alone. */}
              {memberNames.length > 0 && !repName && (
                <div className="mt-2 rounded-md border border-pen-orange/50 bg-pen-orange/10 p-2">
                  <p className="flex items-start gap-1.5 text-[11px] font-medium text-pen-orange">
                    <AlertTriangle className="mt-px size-3.5 shrink-0" />
                    <span>
                      Magaca wakiilka maa jiro — qof{" "}
                      {memberNames.length === 1 ? "kan" : "kan"} wakiilka uu matalayo
                      {memberNames.length === 1 ? "" : "da"} hadda magac la'aan ayay
                      document-ka ku qaadan doonaa.
                    </span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onRemoveRep(rep.id)}
                      className="rounded-md border border-pen-orange/50 px-2 py-1 text-[10px] font-medium text-pen-orange transition-colors hover:bg-pen-orange/15"
                    >
                      Ka tirtir kooxaha wakiilkan
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onCreateRep}
        className="mt-3 h-8 gap-1.5 text-xs"
      >
        <UserPlus className="size-3.5" /> + Ku dar Wakiil kale
      </Button>

      {absent.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Dhammaan dadku waa jooga — wakiil looma baahna.
        </p>
      )}
    </div>
  );
}