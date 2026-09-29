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

/** Resolve a party-list field path like "kireeyayaal.magac" → string[] of filled values. */
function partyFieldValues(rows: PartyRow[], fieldId: string): string[] {
  return rows
    .map((r) => (r.values?.[fieldId] ?? "").trim())
    .filter((v) => v.length > 0);
}

/**
 * Evaluate a declarative condition.
 * `get(key)` resolves a value path — plain section keys ("deebaaji.deebaaji_jira")
 * or party-derived keys ("kireeyayaal.magac").
 *
 * Evaluation is defensive: malformed conditions or missing values evaluate
 * to false rather than throwing, so a bad rule can never crash the interview.
 */
export function evaluateCondition(
  condition: Condition | undefined,
  get: (key: string) => unknown,
): boolean {
  try {
    if (!condition) return false;
    switch (condition.op) {
      case "equals":
        return String(get(condition.field) ?? "") === String(condition.value);
      case "not_equals":
        return String(get(condition.field) ?? "") !== String(condition.value);
      case "greater_than": {
        const n = Number(get(condition.field));
        return Number.isFinite(n) && n > condition.value;
      }
      case "less_than": {
        const n = Number(get(condition.field));
        return Number.isFinite(n) && n < condition.value;
      }
      case "contains": {
        const v = get(condition.field);
        if (Array.isArray(v)) return v.map(String).includes(String(condition.value));
        if (typeof v === "string") {
          // Multiselect values are comma-joined: match list membership first,
          // then fall back to substring matching for plain text.
          const items = v.split(",").map((s) => s.trim());
          return items.includes(String(condition.value)) || v.includes(String(condition.value));
        }
        return false;
      }
      case "is_empty": {
        const v = get(condition.field);
        if (isPartyList(v)) return v.length === 0;
        if (typeof v === "string") return v.trim() === "";
        return v == null;
      }
      case "is_not_empty": {
        const v = get(condition.field);
        if (isPartyList(v)) return v.length > 0;
        if (typeof v === "string") return v.trim() !== "";
        return v != null;
      }
      case "is_true":
        return get(condition.field) === "yes";
      case "is_false":
        return get(condition.field) !== "yes";
      case "and":
        return (condition.conditions ?? []).every((c) => evaluateCondition(c, get));
      case "or":
        return (condition.conditions ?? []).some((c) => evaluateCondition(c, get));
      case "not":
        return !evaluateCondition(condition.condition, get);
      default:
        return false;
    }
  } catch {
    // Rule evaluation must never crash the interview.
    return false;
  }
}

/** Collect every referenced field path inside a condition (for dependency maps). */
export function conditionFields(condition: Condition | undefined): string[] {
  if (!condition) return [];
  switch (condition.op) {
    case "and":
    case "or":
      return condition.conditions.flatMap(conditionFields);
    case "not":
      return conditionFields(condition.condition);
    default:
      return [condition.field];
  }
}

/**
 * Normalize form values into a flat key → value lookup for rules.
 * Party-list keys resolve to arrays of that field's filled values.
 */
export function makeGetter(formValues: FormValues) {
  return (key: string): unknown => {
    const [sectionId, fieldId] = key.split(".");
    const sectionValue = formValues[sectionId];
    if (fieldId == null) return sectionValue;
    if (isPartyList(sectionValue)) {
      return partyFieldValues(sectionValue, fieldId);
    }
    if (sectionValue && typeof sectionValue === "object") {
      return (sectionValue as Record<string, string>)[fieldId];
    }
    return undefined;
  };
}
