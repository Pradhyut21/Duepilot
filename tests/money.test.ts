import { describe, it, expect } from 'vitest';
import { parseDecimalScaled, parseRupeesToPaise, MAX_PAISE } from '../lib/money';

describe('parseRupeesToPaise', () => {
  it('converts a two-decimal rupee string to paise', () => {
    expect(parseRupeesToPaise('1234.50')).toBe(123450);
  });

  it('accepts whole rupees and one decimal place', () => {
    expect(parseRupeesToPaise('1234')).toBe(123400);
    expect(parseRupeesToPaise('1234.5')).toBe(123450);
  });

  it('handles sub-rupee amounts and leading zeros', () => {
    expect(parseRupeesToPaise('0.05')).toBe(5);
    expect(parseRupeesToPaise('00012.10')).toBe(1210);
    expect(parseRupeesToPaise('0')).toBe(0);
  });

  it('trims surrounding whitespace', () => {
    expect(parseRupeesToPaise('  12.00  ')).toBe(1200);
  });

  it('accepts the largest value that fits a Postgres integer column', () => {
    expect(parseRupeesToPaise('21474836.47')).toBe(MAX_PAISE);
    expect(MAX_PAISE).toBe(2147483647);
  });

  it('rejects amounts above the integer column limit', () => {
    expect(() => parseRupeesToPaise('21474836.48')).toThrow(/too large/i);
  });

  it('rejects negative amounts', () => {
    expect(() => parseRupeesToPaise('-1')).toThrow();
    expect(() => parseRupeesToPaise('-0.50')).toThrow();
  });

  it('rejects more than two decimal places', () => {
    expect(() => parseRupeesToPaise('1.234')).toThrow();
  });

  it('rejects non-numeric input', () => {
    for (const bad of ['', '   ', 'abc', '1e3', '1,234.50', '12.', '.5', '12.3.4', 'NaN', 'Infinity', '+5', '12abc']) {
      expect(() => parseRupeesToPaise(bad)).toThrow();
    }
  });
});

describe('parseDecimalScaled', () => {
  it('scales to three decimal places for quantities', () => {
    expect(parseDecimalScaled('1.5', 3, 'Quantity')).toBe(1500);
    expect(parseDecimalScaled('0.001', 3, 'Quantity')).toBe(1);
    expect(parseDecimalScaled('2', 3, 'Quantity')).toBe(2000);
  });

  it('rejects more decimals than the scale allows', () => {
    expect(() => parseDecimalScaled('1.0001', 3, 'Quantity')).toThrow(/Quantity/);
  });

  it('scales percentages to basis points', () => {
    expect(parseDecimalScaled('18', 2, 'Tax rate')).toBe(1800);
    expect(parseDecimalScaled('18.25', 2, 'Tax rate')).toBe(1825);
  });
});
