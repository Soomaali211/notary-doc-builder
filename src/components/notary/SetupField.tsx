import { FieldRenderer } from "./FieldRenderer";
import { NumberSelector } from "./NumberSelector";
import { getAnswer, setAnswer, setRepeatableCount } from "@/lib/notary/engine";
import type {
  FieldDef,
  FormValues,
  PartyDef,
} from "@/lib/notary/types";
import type { SectionErrors } from "@/lib/notary/validation";

/**
 * Renders one Step 1 field with Step-1-aware controls:
 *  – yes_no and radio become big selectable cards (neumorphic).
 *  – a single/multiple choice that names a partyModeTarget reveals an inline
 *    number selector when "multiple" is chosen (Tirada: [-] 2 [+]) — the
 *    count chosen here is REUSED by the dynamic party steps, so the same
 *    question is never asked twice.
 *
 * The party mode is found from the CONFIG (`FieldDef.partyModeTarget` →
 * PartyDef.id), never from a hard-coded field id. Heshiis Kiro's two fields
 * are resolved through the same lookup by their caller, so both document
 * types share one code path and a third would need no changes here at all.
 */
export function SetupField({
  field,
  values,
  errors,
  sectionId,
  partyDef,
  countLabel,
  countFieldId,
  onValues,
}: {
  field: FieldDef;
  values: FormValues;
  errors?: SectionErrors;
  sectionId: string;
  /** The party list this choice sizes, when the field declares one. */
  partyDef?: PartyDef;
  /** Somali noun for the count selector, e.g. "Iibiyayaasha". */
  countLabel?: string;
  /**
   * Field that HOLDS the chosen count (the party's `countFrom` path).
   * The inline selector writes it, which is what makes a draft restore able
   * to rebuild the list. Empty for a choice with no count of its own.
   */
  countFieldId?: string;
  onValues: (next: FormValues) => void;
}) {
  const value = getAnswer(values, sectionId, field.id);
  const err = errors?.fieldErrors[field.id];

  const isPartyMode = Boolean(field.partyModeTarget) && Boolean(partyDef);
  const mode = value === "multiple" ? "multiple" : "single";
  // A document type without this group has no rows to count — the field
  // still renders, the inline selector simply has nothing to drive.
  const count = partyDef
    ? ((values[partyDef.id] as unknown[] | undefined) ?? []).length
    : 0;

  const setCount = (next: number) => {
    if (!partyDef) return;
    const target = Math.max(2, next);
    // The number is STORED on the count field as well as applied to the rows,
    // so a restored draft rebuilds the same list from the saved answer. The
    // rows are never the only copy of the figure.
    const stored = countFieldId
      ? setAnswer(values, sectionId, countFieldId, String(target))
      : values;
    onValues(setRepeatableCount(stored, partyDef, target));
  };

  return (
    <div className="space-y-2">
      <div className="mb-1">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          {field.label}
        </p>
        {field.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{field.description}</p>
        )}
        {err && <p className="mt-1 text-sm text-destructive">✗ {err}</p>}
      </div>

      {/* Option cards (Haa/Maya, Kireeye/Kireeyayaal, Iibiye/Iibiyayaal …) */}
      {field.type === "yes_no" || field.type === "radio" ? (
        <div
          role="radiogroup"
          aria-label={field.label}
          className="grid gap-2.5 sm:grid-cols-2"
        >
          {(field.options ?? []).map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  let next = setAnswer(values, sectionId, field.id, opt.value);
                  // Party mode drives the row count directly (#2/#3/#19):
                  // Kireeye → exactly 1 row; Kireeyayaal → at least 2.
                  if (isPartyMode && partyDef) {
                    const target = opt.value === "single" ? 1 : Math.max(2, count);
                    next = setRepeatableCount(next, partyDef, target);
                  }
                  onValues(next);
                }}
                className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring ${
                  active
                    ? "neu-inset glow-primary-sm text-primary"
                    : "neu-raised text-foreground/80 hover:text-foreground"
                }`}
              >
                {opt.label}
                <span
                  aria-hidden
                  className={`flex size-5 items-center justify-center rounded-full border-2 transition-colors ${
                    active ? "border-primary bg-primary" : "border-border"
                  }`}
                >
                  {active && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Party-mode → inline number selector (multiple only) */}
      {isPartyMode && partyDef && mode === "multiple" && (
        <div className="reveal-enter neu-inset mt-1 flex flex-wrap items-center justify-between gap-3 p-3">
          <span className="text-sm font-medium">
            Tirada {countLabel ?? partyDef.singular}
          </span>
          <NumberSelector
            value={Math.max(2, count)}
            min={2}
            label={partyDef.singular}
            onChange={setCount}
          />
        </div>
      )}

      {/* Non-choice fields (reference, dates, textarea) via the standard renderer. */}
      {field.type !== "yes_no" && field.type !== "radio" && (
        <FieldRenderer
          field={{ ...field, colSpan: 2 }}
          value={value}
          error={err}
          onChange={(next) => onValues(setAnswer(values, sectionId, field.id, next))}
        />
      )}
    </div>
  );
}