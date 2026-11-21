import { describe, it, expect } from 'vitest';
import {
  checkAndRecordAttempt,
  resetAttempts,
  RATE_LIMIT_MAX_FAILURES,
  RATE_LIMIT_WINDOW_MS,
  type AttemptStore,
} from '../lib/auth/rate-limit';

describe('checkAndRecordAttempt', () => {
  it('allows the first 5 attempts and blocks the 6th within the window', () => {
    const store: AttemptStore = new Map();
    const now = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i++) {
      expect(checkAndRecordAttempt('login:a@example.test', now, store).allowed).toBe(true);
    }

    const blocked = checkAndRecordAttempt('login:a@example.test', now, store);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows attempts again once the window has passed', () => {
    const store: AttemptStore = new Map();
    const now = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i++) {
      checkAndRecordAttempt('login:b@example.test', now, store);
    }
    expect(checkAndRecordAttempt('login:b@example.test', now, store).allowed).toBe(false);

    const later = now + RATE_LIMIT_WINDOW_MS + 1;
    expect(checkAndRecordAttempt('login:b@example.test', later, store).allowed).toBe(true);
  });

  it('allows attempts again after resetAttempts is called', () => {
    const store: AttemptStore = new Map();
    const now = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i++) {
      checkAndRecordAttempt('login:c@example.test', now, store);
    }
    expect(checkAndRecordAttempt('login:c@example.test', now, store).allowed).toBe(false);

    resetAttempts('login:c@example.test', store);
    expect(checkAndRecordAttempt('login:c@example.test', now, store).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const store: AttemptStore = new Map();
    const now = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i++) {
      checkAndRecordAttempt('login:d@example.test', now, store);
    }
    expect(checkAndRecordAttempt('login:e@example.test', now, store).allowed).toBe(true);
  });
});
