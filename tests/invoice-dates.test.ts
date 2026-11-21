import { describe, it, expect } from 'vitest';
import {
  assertDueOnOrAfterIssue,
  isDueOnOrAfterIssue,
  todayInTimezone,
} from '../lib/records/invoice-dates';

describe('isDueOnOrAfterIssue', () => {
  it('allows the same day', () => {
    expect(isDueOnOrAfterIssue('2026-03-10', '2026-03-10')).toBe(true);
  });

  it('allows a due date after the issue date', () => {
    expect(isDueOnOrAfterIssue('2026-03-10', '2026-03-25')).toBe(true);
  });

  it('rejects a due date one day before the issue date', () => {
    expect(isDueOnOrAfterIssue('2026-03-10', '2026-03-09')).toBe(false);
  });

  it('handles month boundaries', () => {
    expect(isDueOnOrAfterIssue('2026-01-31', '2026-02-01')).toBe(true);
    expect(isDueOnOrAfterIssue('2026-02-28', '2026-02-27')).toBe(false);
  });

  it('handles the leap day', () => {
    expect(isDueOnOrAfterIssue('2028-02-28', '2028-02-29')).toBe(true);
  });

  it('handles year boundaries', () => {
    expect(isDueOnOrAfterIssue('2026-12-31', '2027-01-01')).toBe(true);
    expect(isDueOnOrAfterIssue('2027-01-01', '2026-12-31')).toBe(false);
  });

  it('rejects invalid date strings', () => {
    expect(isDueOnOrAfterIssue('2026-02-30', '2026-03-01')).toBe(false);
    expect(isDueOnOrAfterIssue('2026-01-01', '2026/01/01')).toBe(false);
  });
});

describe('assertDueOnOrAfterIssue', () => {
  it('passes for a valid range', () => {
    expect(() => assertDueOnOrAfterIssue('2026-03-10', '2026-03-10')).not.toThrow();
  });

  it('throws when the due date is before the issue date', () => {
    expect(() => assertDueOnOrAfterIssue('2026-03-10', '2026-03-09')).toThrow(
      'Due date cannot be before the issue date.',
    );
  });

  it('throws the issue-date message for an invalid issue date', () => {
    expect(() => assertDueOnOrAfterIssue('2026-02-30', '2026-03-01')).toThrow(
      'Enter a valid issue date (YYYY-MM-DD).',
    );
  });

  it('throws the due-date message for an invalid due date', () => {
    expect(() => assertDueOnOrAfterIssue('2026-01-01', '2026/01/01')).toThrow(
      'Enter a valid due date (YYYY-MM-DD).',
    );
  });
});

describe('todayInTimezone', () => {
  it('returns the local date in the given timezone', () => {
    expect(todayInTimezone('Asia/Kolkata', new Date('2026-11-20T20:00:00Z'))).toBe('2026-11-21');
  });
});
