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
 *  – kireeye_mode / kirayste_mode reveal an inline number selector
 *    when "multiple" is chosen (Tirada: [-] 2 [+]) — the count chosen
 *    here is REUSED by the dynamic party steps (#19: no repeated question).
 */
export function SetupField({
  field,
  values,
  errors,
  sectionId,
  landlordDef,
  tenantDef,
  onValues,
}: {
  field: FieldDef;
  values: FormValues;
  errors?: SectionErrors;
  sectionId: string;
  landlordDef: PartyDef;
  tenantDef: PartyDef;
  onValues: (next: FormValues) => void;
}) {
  const value = getAnswer(values, sectionId, field.id);
  const err = errors?.fieldErrors[field.id];

  const isPartyMode =
    field.id === "kireeye_mode" || field.id === "kirayste_mode";
  const partyDef = field.id === "kireeye_mode" ? landlordDef : tenantDef;
  const mode = value === "multiple" ? "multiple" : "single";
  const count = ((values[partyDef.id] as unknown[] | undefined) ?? []).length;

  const setCount = (next: number) => {
    onValues(setRepeatableCount(values, partyDef, Math.max(2, next)));
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

      {/* Option cards (Haa/Maya, Kireeye/Kireeyayaal, Furan/Xidhan …) */}
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
                  if (isPartyMode) {
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
      {isPartyMode && mode === "multiple" && (
        <div className="reveal-enter neu-inset mt-1 flex flex-wrap items-center justify-between gap-3 p-3">
          <span className="text-sm font-medium">
            Tirada {field.id === "kireeye_mode" ? "Kireeyayaasha" : "Kiraystayaasha"}
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
