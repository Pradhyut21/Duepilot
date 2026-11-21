import { describe, it, expect } from 'vitest';
import {
  generateSessionToken,
  hashSessionToken,
  isSessionExpired,
} from '../lib/auth/session';

describe('generateSessionToken', () => {
  it('produces 32 random bytes encoded as 43 base64url characters', () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces different tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSessionToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('hashSessionToken', () => {
  it('is deterministic for the same token', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it('is a 64-character hex SHA-256 digest that differs from the token', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
  });
});

describe('isSessionExpired', () => {
  it('is true for a date in the past', () => {
    const now = new Date('2030-01-01T00:00:00Z');
    expect(isSessionExpired(new Date('2029-12-31T23:59:59Z'), now)).toBe(true);
  });

  it('is false for a date in the future', () => {
    const now = new Date('2030-01-01T00:00:00Z');
    expect(isSessionExpired(new Date('2030-01-02T00:00:00Z'), now)).toBe(false);
  });
});

