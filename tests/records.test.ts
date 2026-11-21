import { describe, it, expect } from 'vitest';
import {
  formatInvoiceNumber,
  parseQuantityThousandths,
  parseTaxRateBp,
  lineTotalPaise,
  mapRecurrenceRule,
  isValidIsoDate,
} from '../lib/records/rules';

describe('formatInvoiceNumber', () => {
  it('pads the sequence to four digits with an INV- prefix', () => {
    expect(formatInvoiceNumber(1)).toBe('INV-0001');
    expect(formatInvoiceNumber(42)).toBe('INV-0042');
  });

  it('keeps growing past four digits', () => {
    expect(formatInvoiceNumber(10000)).toBe('INV-10000');
  });
});

describe('parseQuantityThousandths', () => {
  it('parses quantities with up to three decimals', () => {
    expect(parseQuantityThousandths('2')).toBe(2000);
    expect(parseQuantityThousandths('1.5')).toBe(1500);
    expect(parseQuantityThousandths('0.001')).toBe(1);
  });

  it('rejects zero, negatives and excess decimals', () => {
    expect(() => parseQuantityThousandths('0')).toThrow(/greater than zero/);
    expect(() => parseQuantityThousandths('-1')).toThrow();
    expect(() => parseQuantityThousandths('1.0001')).toThrow();
  });
});

describe('parseTaxRateBp', () => {
  it('converts a percentage to basis points', () => {
    expect(parseTaxRateBp('18')).toBe(1800);
    expect(parseTaxRateBp('5.5')).toBe(550);
  });

  it('rejects rates above 100 percent', () => {
    expect(() => parseTaxRateBp('101')).toThrow(/between 0 and 100/);
  });
});

describe('lineTotalPaise', () => {
  it('multiplies quantity by unit price exactly', () => {
    expect(lineTotalPaise(2000, 15050)).toBe(30100);
  });

  it('rounds half up to whole paise', () => {
    expect(lineTotalPaise(1500, 333)).toBe(500);
  });
});

describe('mapRecurrenceRule', () => {
  it('maps the empty choice to a one-off expense', () => {
    expect(mapRecurrenceRule('')).toBeNull();
  });

  it('passes through MONTHLY and WEEKLY', () => {
    expect(mapRecurrenceRule('MONTHLY')).toBe('MONTHLY');
    expect(mapRecurrenceRule('WEEKLY')).toBe('WEEKLY');
  });

  it('rejects any other rule', () => {
    expect(() => mapRecurrenceRule('DAILY')).toThrow();
  });
});

describe('isValidIsoDate', () => {
  it('accepts real calendar dates in YYYY-MM-DD form', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
  });

  it('rejects impossible dates and other formats', () => {
    expect(isValidIsoDate('2025-02-29')).toBe(false);
    expect(isValidIsoDate('2025-1-01')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });
});
