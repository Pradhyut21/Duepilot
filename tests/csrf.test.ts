import { describe, it, expect } from 'vitest';
import { isSameOriginRequest } from '../lib/auth/csrf';

const APP_URL = 'https://duepilot.example.com';

describe('isSameOriginRequest', () => {
  it('accepts a matching Origin header', () => {
    const headers = new Headers({ origin: 'https://duepilot.example.com' });
    expect(isSameOriginRequest(headers, APP_URL)).toBe(true);
  });

  it('rejects a foreign Origin header', () => {
    const headers = new Headers({ origin: 'https://evil.example.net' });
    expect(isSameOriginRequest(headers, APP_URL)).toBe(false);
  });

  it('falls back to Referer when Origin is absent', () => {
    const headers = new Headers({ referer: 'https://duepilot.example.com/login' });
    expect(isSameOriginRequest(headers, APP_URL)).toBe(true);
  });

  it('rejects when both Origin and Referer are missing', () => {
    expect(isSameOriginRequest(new Headers(), APP_URL)).toBe(false);
  });
});

