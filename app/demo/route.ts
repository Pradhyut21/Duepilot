import { NextResponse } from 'next/server';
import { createDemo } from '@/lib/studio/demo';
import { getEnv } from '@/lib/env';
import { isSameOriginRequest } from '@/lib/auth/csrf';
import {
  createSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';
import { admit } from '@/lib/auth/throttle';
export const maxDuration = 60;
export async function POST(req: Request) {
  const origin = getEnv().APP_URL;
  if (!isSameOriginRequest(req.headers, origin))
    return new Response('Request origin rejected', { status: 403 });
  const ip = req.headers.get('x-vercel-forwarded-for') || 'local';
  if (!(await admit('demo:' + ip, 20)))
    return new Response('Demo limit reached. Try again in 15 minutes.', {
      status: 429,
    });
  const user = await createDemo();
  const { token } = await createSession(user);
  const res = NextResponse.redirect(new URL('/app', origin), 303);
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return res;
}
