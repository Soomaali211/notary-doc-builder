import type { Condition, FormValues, PartyRow } from "./types";

/** True when the values stored at `key` are a party list (PartyRow[]). */
export function isPartyList(value: unknown): value is PartyRow[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "values" in (value[0] as Record<string, unknown>)
  );
}

/** Resolve a party list field path like "kireeyayaal.magac". */
function getPartyField(values: PartyRow[], path: string): unknown {
  const fieldId = path.split(".")[1] ?? "";
  return values.map((row) => row.values?.[fieldId] ?? "").filter(Boolean);
}

/**
 * Evaluate a declarative condition.
 * `get(key)` resolves a value path — plain section keys ("deebaaji.enabled")
 * or party-derived keys ("kireeyayaal.magac").
 */
export function evaluateCondition(
  condition: Condition,
  get: (key: string) => unknown,
): boolean {
  switch (condition.op) {
    case "equals":
      return get(condition.field) === condition.value;
    case "notEquals":
      return get(condition.field) !== condition.value;
    case "isTrue":
      return get(condition.field) === "yes";
    case "isFalse":
      return get(condition.field) !== "yes";
    case "notEmpty": {
      const value = get(condition.field);
      if (isPartyList(value)) return value.length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return typeof value === "string" ? value.trim().length > 0 : value != null;
    }
    case "gt": {
      const value = Number(get(condition.field));
      return Number.isFinite(value) && value > condition.value;
    }
    case "and":
      return condition.conditions.every((c) => evaluateCondition(c, get));
    case "or":
      return condition.conditions.some((c) => evaluateCondition(c, get));
    default:
      return false;
  }
}

/** Normalize form values into a flat key -> value lookup for conditions. */
export function makeGetter(formValues: FormValues) {
  return (key: string): unknown => {
    const [sectionId, fieldId] = key.split(".");
    const sectionValue = formValues[sectionId];
    if (fieldId == null) return sectionValue;
    if (isPartyList(sectionValue)) {
      return getPartyField(sectionValue, key);
    }
    if (sectionValue && typeof sectionValue === "object") {
      return (sectionValue as Record<string, string>)[fieldId];
    }
    return undefined;
  };
}
