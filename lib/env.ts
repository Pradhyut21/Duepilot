import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  APP_URL: z.string().url('APP_URL must be a valid URL'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates a set of environment variables. Throws a descriptive error listing
 * every invalid key (never the values, so secrets are not leaked into logs).
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

let cachedEnv: Env | undefined;

/** Lazily parses process.env on first use and memoises the result. */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}
