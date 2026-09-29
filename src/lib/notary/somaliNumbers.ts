/**
 * Phase 3B — Somali number-to-words utility.
 *
 * 100 → "Boqol" · 500 → "Shan Boqol" · 1,000 → "Kun"
 * Used for currency-in-words (e.g. $500 → "Shan Boqol oo Dollar") when the
 * document format config requests words mode. A small, fully tested
 * utility — not a machine translation of an external library.
 *
 * Somali numeration: Kun (thousand) → Milyan (million) → Bilion (billion).
 * Compound hundreds use "iyo" (and): 123 → "Kun iyo Labaatan iyo Saddex".
 */

const ONES = [
  "",
  "Koow",
  "Laba",
  "Saddex",
  "Afar",
  "Shan",
  "Lix",
  "Toddoba",
  "Siddeed",
  "Sagaal",
];

const TEENS = [
  "Kow iyo toban",
  "Laba iyo toban",
  "Saddex iyo toban",
  "Afar iyo toban",
  "Shan iyo toban",
  "Lix iyo toban",
  "Toddoba iyo toban",
  "Siddeed iyo toban",
  "Sagaal iyo toban",
];

const TENS = [
  "",
  "Toban",
  "Labaatan",
  "Saddetan",
  "Afaratan",
  "Konton",
  "Lixdan",
  "Toddobaatan",
  "Siddeetan",
  "Sagaashan",
];

/** Whole number → Somali words. Supports 0 … 999,999,999,999. */
export function somaliNumberToWords(input: number): string {
  if (!Number.isFinite(input)) return String(input);
  const n = Math.floor(Math.abs(input));
  if (n === 0) return "Eber";
  if (n >= 1_000_000_000_000) return String(input); // out of supported range

  const parts: string[] = [];

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;

  if (billions > 0) parts.push(`${threeDigitsToWords(billions)} Bilion`);
  if (millions > 0) parts.push(`${threeDigitsToWords(millions)} Milyan`);
  if (thousands > 0) parts.push(`${threeDigitsToWords(thousands)} Kun`);
  if (rest > 0) parts.push(threeDigitsToWords(rest));

  return parts.join(" iyo ");
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const chunks: string[] = [];

  if (hundreds === 1) chunks.push("Boqol");
  else if (hundreds > 1) chunks.push(`${ONES[hundreds]} Boqol`);

  if (remainder > 0) {
    if (remainder < 10) chunks.push(ONES[remainder]);
    else if (remainder < 20) chunks.push(TEENS[remainder - 10]);
    else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      chunks.push(ones > 0 ? `${TENS[tens]} iyo ${ONES[ones]}` : TENS[tens]);
    }
  }
  return chunks.join(" iyo ");
}

/**
 * Currency in words: 500 → "Shan Boqol oo Dollar".
 * Whole + fractional part when present ("Shan Boqol oo Dollar iyo Labaatan Sent").
 */
export function formatCurrencyWordsSomali(
  value: number,
  unit = "Dollar",
  centUnit = "Sent",
): string {
  if (!Number.isFinite(value)) return String(value);
  const negative = value < 0;
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const whole = Math.floor(rounded);
  const cents = Math.round((rounded - whole) * 100);

  const wholeWords = somaliNumberToWords(whole);
  const base = `${wholeWords} oo ${unit}`;
  if (cents > 0) {
    return `${negative ? "-" : ""}${base} iyo ${somaliNumberToWords(cents)} ${centUnit}`;
  }
  return `${negative ? "-" : ""}${base}`;
}
