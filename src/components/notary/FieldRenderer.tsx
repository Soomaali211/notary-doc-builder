import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { FieldDef } from "@/lib/notary/types";

interface FieldRendererProps {
  field: FieldDef;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function FieldRenderer({
  field,
  value,
  error,
  disabled,
  onChange,
}: FieldRendererProps) {
  const required = !field.optional && field.validation?.required !== false;

  return (
    <div className={cn("space-y-1.5", field.colSpan === 2 && "sm:col-span-2")}>
      <Label className="flex items-baseline gap-1.5 text-[13px] font-medium text-foreground/90">
        <span>{field.label}</span>
        {required && <span className="text-destructive">*</span>}
        {field.hint && (
          <span className="notebook-annotation ml-auto hidden text-[11px] font-normal text-muted-foreground sm:inline">
            {field.hint}
          </span>
        )}
      </Label>

      {field.type === "yesno" ? (
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
      ) : field.type === "textarea" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={3}
          className={cn("resize-y bg-card/80", error && "border-destructive")}
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
          className={cn("bg-card/80", error && "border-destructive")}
        />
      )}

      {error && <p className="text-sm text-destructive">✗ {error}</p>}
    </div>
  );
}
