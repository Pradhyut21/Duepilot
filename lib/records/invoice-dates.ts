/**
 * Pure invoice date rules. Dates are date-only YYYY-MM-DD strings, which
 * compare correctly as strings once validated.
 */
import { isValidIsoDate } from './rules';

/** True when the due date is the same day as or later than the issue date. */
export function isDueOnOrAfterIssue(issueDate: string, dueDate: string): boolean {
  if (!isValidIsoDate(issueDate) || !isValidIsoDate(dueDate)) {
    return false;
  }
  return dueDate >= issueDate;
}

/** Throws a user-facing error when either date is invalid or the due date is before the issue date. */
export function assertDueOnOrAfterIssue(issueDate: string, dueDate: string): void {
  if (!isValidIsoDate(issueDate)) {
    throw new Error('Enter a valid issue date (YYYY-MM-DD).');
  }
  if (!isValidIsoDate(dueDate)) {
    throw new Error('Enter a valid due date (YYYY-MM-DD).');
  }
  if (dueDate < issueDate) {
    throw new Error('Due date cannot be before the issue date.');
  }
}

/** Returns today's date (YYYY-MM-DD) in the given IANA timezone. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
