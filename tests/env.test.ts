import { describe, it, expect } from 'vitest';
import { parseEnv } from '../lib/env';

const validEnv = {
  DATABASE_URL: 'postgres://duepilot:secret@localhost:5432/duepilot',
  SESSION_SECRET: 'x'.repeat(32),
  APP_URL: 'http://localhost:3000',
};

describe('parseEnv', () => {
  it('accepts valid values', () => {
    const env = parseEnv(validEnv);
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.SESSION_SECRET).toHaveLength(32);
  });

  it('rejects a SESSION_SECRET shorter than 32 characters', () => {
    expect(() => parseEnv({ ...validEnv, SESSION_SECRET: 'x'.repeat(31) })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('rejects an invalid APP_URL', () => {
    expect(() => parseEnv({ ...validEnv, APP_URL: 'not a url' })).toThrow(/APP_URL/);
  });
});

