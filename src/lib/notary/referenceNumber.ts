/**
 * Reference number COMPOSITION (document side only — the database is not
 * touched).
 *
 * The office keeps a short, safe, strictly-sequential serial in the database
 * ("DPN-MG-001" — letters, digits, dashes). The document itself prints the
 * full reference the scan shows:
 *
 *   Ref/Dpn/MG/001/01/26
 *   └─ declared by DocumentConfig.referenceFormat
 *      {serial} = the digits of the stored serial  → "001"
 *      {MM}/{YY} = the document's own date         → "01" / "26"
 *
 * Nothing here allocates or persists anything: the serial is decided by the
 * database counter, this module only PRINTS it. A document type that
 * declares no `referenceFormat` prints exactly what the database holds, so
 * Heshiis Kiro ("DPN-K-004") is byte-identical to before.
 *
 * Pure functions — no Date.now(), no timezone, no locale: the month and year
 * come from the date the user typed in the form ("2026-01-30").
 */

/** "DPN-MG-001" → "001". Digits only, as they appear at the end. */
export function referenceSerial(reference: string): string {
  const match = /(\d+)\s*$/.exec(reference.trim());
  return match ? match[1] : "";
}

/** "2026-01-30" → { MM: "01", YY: "26" }. Empty strings when unknown. */
export function referenceDateParts(date: string | undefined): { MM: string; YY: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((date ?? "").trim());
  if (!match) return { MM: "", YY: "" };
  const [, year, month] = match;
  return { MM: month, YY: year.slice(2) };
}

/**
 * Fill a declared `referenceFormat` for printing.
 *
 * Returns the STORED reference unchanged when the config declares no format,
 * and also when a token cannot be filled (no serial yet, no document date) —
 * a half-written reference like "Ref/Dpn/MG//01/26" must never reach a signed
 * document, so the safe short form is printed instead.
 */
export function composeReferenceNumber(input: {
  /** Declared format, e.g. "Ref/Dpn/MG/{serial}/{MM}/{YY}". */
  format: string | undefined;
  /** The short serial the database holds, e.g. "DPN-MG-001". */
  reference: string;
  /** The document's own date, "YYYY-MM-DD". */
  date?: string;
}): string {
  const { format, reference, date } = input;
  const stored = reference.trim();
  if (!format || !stored) return stored;

  const parts: Record<string, string> = {
    serial: referenceSerial(stored),
    ...referenceDateParts(date),
  };

  let filled = format.replace(/\{(serial|MM|YY)\}/g, (_all, token: string) => parts[token] ?? "");
  // Any token we could not resolve, or one we do not know at all, disqualifies
  // the composed form — the short serial is printed instead.
  if (!filled || /\{[^{}]*\}/.test(filled) || !parts.serial || !parts.MM || !parts.YY) {
    return stored;
  }
  return filled;
}
