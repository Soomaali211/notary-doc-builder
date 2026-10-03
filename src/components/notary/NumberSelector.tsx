import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NumberSelectorProps {
  value: number;
  min: number;
  /** 0 or undefined = unlimited. */
  max?: number;
  disabled?: boolean;
  label: string;
  onChange: (next: number) => void;
}

/**
 * Count-first number selector: [-] 3 [+].
 * The user picks HOW MANY parties first; rows are created to match
 * (see setRepeatableCount in the engine) — no hard-coded counts.
 */
export function NumberSelector({
  value,
  min,
  max,
  disabled,
  label,
  onChange,
}: NumberSelectorProps) {
  const atMin = value <= min;
  const atMax = max !== undefined && max > 0 && value >= max;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="neu-inset inline-flex items-center gap-1 p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Yar ${label}`}
          disabled={disabled || atMin}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="neu-raised-sm size-10 rounded-full"
        >
          <Minus className="size-4" />
        </Button>
        <span
          aria-live="polite"
          className="min-w-12 select-none text-center text-lg font-bold tabular-nums"
        >
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Bar ${label}`}
          disabled={disabled || atMax}
          onClick={() => onChange(value + 1)}
          className="neu-raised-sm size-10 rounded-full"
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <span className="text-xs text-muted-foreground">
        {/* The floor is read from `min`, not assumed to be 1: an OPTIONAL
            list (photographs, signature lines, certificates) may legally be
            zero, and telling the user "at least 1" while the selector shows
            0 is simply wrong. */}
        {atMax
          ? `Ugu badnaan ${max}.`
          : atMin
            ? min === 0
              ? "Waa la dooran karaa in la eeyo."
              : `Ugu yaraan ${min}.`
            : ""}
      </span>
    </div>
  );
}

/** Compact read-only counter used in party step headers. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary",
        className,
      )}
    >
      {count}
    </span>
  );
}
