/**
 * Money and decimal parsing helpers.
 *
 * All conversions use string operations only (no floating-point), so
 * "1234.50" becomes exactly 123450 paise.
 */

/** Largest value that fits a Postgres `integer` column (2^31 - 1). */
export const MAX_PAISE = 2147483647;

const MAX_PAISE_DIGITS = String(MAX_PAISE);

/**
 * Parses a non-negative decimal string into an integer scaled by 10^scale.
 * Accepts digits with an optional fractional part of at most `scale` digits.
 * Rejects signs, exponents, separators, empty integer or fraction parts,
 * and surrounding whitespace is trimmed first.
 *
 * @throws Error if the input is not a valid non-negative decimal within the scale.
 */
export function parseDecimalScaled(value: string, scale: number, label: string): number {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`${label} must be a non-negative number, got "${value}"`);
  }

  const intPart = match[1];
  const fracPart = match[2] ?? '';
  if (fracPart.length > scale) {
    throw new Error(`${label} can have at most ${scale} decimal places, got "${value}"`);
  }

  // Pad the fraction to the full scale, then join digits as a string.
  const digits = (intPart + fracPart.padEnd(scale, '0')).replace(/^0+(?=\d)/, '');
  const result = Number(digits);
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} is too large: "${value}"`);
  }
  return result;
}

/**
 * Converts a rupee decimal string (e.g. "1234.50") to integer paise.
 *
 * @throws Error if the value is negative, malformed, has more than two
 *         decimal places, or exceeds MAX_PAISE.
 */
export function parseRupeesToPaise(value: string): number {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Amount must be a non-negative rupee value, got "${value}"`);
  }

  const intPart = match[1];
  const fracPart = match[2] ?? '';
  if (fracPart.length > 2) {
    throw new Error(`Amount can have at most 2 decimal places, got "${value}"`);
  }

  const digits = (intPart + fracPart.padEnd(2, '0')).replace(/^0+(?=\d)/, '');

  // Compare as strings: shorter digit strings are smaller; equal lengths compare lexicographically.
  const tooLarge =
    digits.length > MAX_PAISE_DIGITS.length ||
    (digits.length === MAX_PAISE_DIGITS.length && digits > MAX_PAISE_DIGITS);
  if (tooLarge) {
    throw new Error(`Amount is too large: "${value}"`);
  }

  return Number(digits);
}
