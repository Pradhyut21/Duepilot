import { createHmac } from 'node:crypto';
import { getPool } from '../db/client';
import { getEnv } from '../env';
import { RATE_LIMIT_MAX_FAILURES, RATE_LIMIT_WINDOW_MS } from './rate-limit';
function bucket(value: string) {
  return createHmac('sha256', getEnv().SESSION_SECRET)
    .update(value)
    .digest('hex');
}
export async function admit(value: string, maximum = RATE_LIMIT_MAX_FAILURES) {
  const {
    rows: [r],
  } = await getPool().query(
    `INSERT INTO request_windows(key,attempts,expires_at) VALUES($1,1,now()+($2::int * interval '1 millisecond'))
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN request_windows.expires_at<=now() THEN 1 ELSE request_windows.attempts+1 END,
 expires_at=CASE WHEN request_windows.expires_at<=now() THEN excluded.expires_at ELSE request_windows.expires_at END RETURNING attempts`,
    [bucket(value), RATE_LIMIT_WINDOW_MS],
  );
  return r.attempts <= maximum;
}
export async function clearBucket(value: string) {
  await getPool().query('DELETE FROM request_windows WHERE key=$1', [
    bucket(value),
  ]);
}
