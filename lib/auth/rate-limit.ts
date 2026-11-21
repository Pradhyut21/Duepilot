export const RATE_LIMIT_MAX_FAILURES = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Maps a key (e.g. "login:<email>") to the timestamps (ms) of recorded attempts. */
export type AttemptStore = Map<string, number[]>;

export interface AttemptResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

const defaultStore: AttemptStore = new Map();

/**
 * Call once per login attempt before verifying credentials. Attempts inside the
 * window are counted; once RATE_LIMIT_MAX_FAILURES are recorded, further attempts
 * are refused until the oldest one ages out. A successful login should call
 * resetAttempts(key).
 */
export function checkAndRecordAttempt(
  key: string,
  now: number = Date.now(),
  store: AttemptStore = defaultStore,
): AttemptResult {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (store.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (recent.length >= RATE_LIMIT_MAX_FAILURES) {
    store.set(key, recent);
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + RATE_LIMIT_WINDOW_MS - now),
    };
  }

  recent.push(now);
  store.set(key, recent);
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_FAILURES - recent.length,
    retryAfterMs: 0,
  };
}

export function resetAttempts(key: string, store: AttemptStore = defaultStore): void {
  store.delete(key);
}
