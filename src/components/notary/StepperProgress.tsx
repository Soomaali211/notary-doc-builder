import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProgressProps {
  steps: string[];
  keys: string[];
  current: number;
  /** When true the review step is active. */
  review: boolean;
  reviewLabel: string;
  completed: Set<string>;
}

/**
 * Compact horizontal stepper for mobile/tablet: shows the current step
 * number/title, a dot rail with completed/current states, and a progress
 * percentage. The full neumorphic sidebar takes over on desktop.
 */
export function StepperProgress({
  steps,
  keys,
  current,
  review,
  reviewLabel,
  completed,
}: StepperProgressProps) {
  const total = steps.length + 1;
  const activeIndex = review ? steps.length : current;
  const pct = Math.round(((activeIndex + 1) / total) * 100);
  const label = review ? reviewLabel : steps[current];

  return (
    <div className="neu-raised px-4 py-3" aria-label="Horudhac tallaabada">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="neu-dot-active flex size-7 shrink-0 items-center justify-center text-[11px] font-bold tabular-nums">
            {review ? <Check className="size-3.5" /> : String(current + 1).padStart(2, "0")}
          </span>
          <span className="truncate text-sm font-semibold text-primary">{label}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {activeIndex + 1}/{total} · {pct}%
        </span>
      </div>
      {/* Dot rail */}
      <div className="mt-2.5 flex items-center gap-1.5">
        {steps.map((s, i) => {
          const done = completed.has(keys[i]);
          const isCurrent = i === current && !review;
          return (
            <span
              key={keys[i]}
              aria-hidden
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                done
                  ? "bg-pen-green/60"
                  : isCurrent
                    ? "bg-primary shadow-[0_0_8px_var(--primary)]"
                    : "bg-border",
              )}
            />
          );
        })}
        <span
          aria-hidden
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            review ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-border",
          )}
        />
      </div>
    </div>
  );
}
