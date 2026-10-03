import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FIELD_SKIPPED, type FieldDef } from "@/lib/notary/types";
import { PhotoField } from "./PhotoField";

interface FieldRendererProps {
  field: FieldDef;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  /**
   * Options for a field of type "person": the people already entered in this
   * document. Absent for every other field type, and for every document that
   * declares no person fields — so Heshiis Kiro renders exactly as before.
   */
  personOptions?: { value: string; label: string }[];
}

export function FieldRenderer({
  field,
  value,
  error,
  disabled,
  onChange,
  personOptions,
}: FieldRendererProps) {
  const required = !field.optional && field.validation?.required !== false;
  const skipped = value === FIELD_SKIPPED;

  return (
    <div className={cn("space-y-1.5", field.colSpan === 2 && "sm:col-span-2")}>
      <Label className="flex items-baseline gap-1.5 text-[13px] font-medium text-foreground/90">
        <span>{field.label}</span>
        {required && <span className="text-destructive">*</span>}
        {!required && field.skippable && (
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
            (Optional)
          </span>
        )}
        {field.hint && (
          <span className="ml-auto hidden text-[11px] font-normal text-muted-foreground sm:inline">
            {field.hint}
          </span>
        )}
      </Label>

      {skipped ? (
        <div className="neu-inset-sm rounded-md px-3 py-2 text-sm text-muted-foreground italic">
          — Skipped —
        </div>
      ) : field.type === "person" ? (
        // The person PICKER. The stored value is the person's ID — the real
        // link — so nothing downstream has to match on a typed name. When
        // nobody has been entered yet the list is empty and the field says
        // so, rather than inviting the notary to type a name that could miss.
        <select
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Dooro qofka —</option>
          {(personOptions ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.type === "yes_no" ? (
        <RadioGroup
          value={value || undefined}
          onValueChange={onChange}
          disabled={disabled}
          className="flex flex-wrap gap-4 pt-1"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id={`${field.id}-yes`} />
            <Label htmlFor={`${field.id}-yes`} className="font-normal">
              Haa
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id={`${field.id}-no`} />
            <Label htmlFor={`${field.id}-no`} className="font-normal">
              Maya
            </Label>
          </div>
        </RadioGroup>
      ) : field.type === "radio" ? (
        <RadioGroup
          value={value || undefined}
          onValueChange={onChange}
          disabled={disabled}
          className="flex flex-wrap gap-4 pt-1"
        >
          {field.options?.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupItem value={opt.value} id={`${field.id}-${opt.value}`} />
              <Label htmlFor={`${field.id}-${opt.value}`} className="font-normal">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      ) : field.type === "checkbox" ? (
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm">
          <input
            type="checkbox"
            checked={value === "yes"}
            onChange={(e) => onChange(e.target.checked ? "yes" : "no")}
            disabled={disabled}
            className="size-4 accent-[var(--primary)]"
          />
          {field.placeholder ?? "Haa"}
        </label>
      ) : field.type === "multiselect" ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {field.options?.map((opt) => {
            const chosen = value.split(",").map((s) => s.trim()).filter(Boolean);
            const checked = chosen.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card/80 text-muted-foreground hover:bg-muted",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = checked
                      ? chosen.filter((c) => c !== opt.value)
                      : [...chosen, opt.value];
                    onChange(next.join(","));
                  }}
                  className="size-3.5 accent-[var(--primary)]"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      ) : field.type === "photo" ? (
        // Its own component: the upload needs Convex, and this branch only
        // ever mounts for a field explicitly typed "photo".
        <PhotoField value={value} disabled={disabled} error={error} onChange={onChange} />
      ) : field.type === "email" ? (
        <Input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={cn(error && "border-destructive")}
        />
      ) : field.type === "textarea" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={3}
          className={cn("resize-y", error && "border-destructive")}
        />
      ) : field.type === "select" ? (
        <Select
          value={value || undefined}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn("w-full bg-card/80", error && "border-destructive")}
          >
            <SelectValue placeholder={field.placeholder ?? "Dooro…"} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={
            field.type === "phone" || field.type === "currency"
              ? "text"
              : field.type === "number"
                ? "number"
                : field.type
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={cn(error && "border-destructive")}
        />
      )}

      {/* Guided form — explicit Skip only for skippable fields. The user
          decides: "Buuxi hadda" (type) or "Skip" (marker, not an error). */}
      {field.skippable && (skipped ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-pen-orange">— Skipped</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange("")}
          >
            Buuxi hadda
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => onChange(FIELD_SKIPPED)}
        >
          Skip
        </button>
      ))}

      {error && <p className="text-sm text-destructive">✗ {error}</p>}
    </div>
  );
}
