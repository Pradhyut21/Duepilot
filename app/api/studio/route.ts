import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { sessionForRequest, readStudio } from '@/lib/studio/data';
import { mutate, StudioError } from '@/lib/studio/mutations';
import { isSameOriginRequest } from '@/lib/auth/csrf';
import { getEnv } from '@/lib/env';
export async function POST(req: Request) {
  if (!isSameOriginRequest(req.headers, getEnv().APP_URL))
    return NextResponse.json(
      { error: 'Refresh this page and try again.' },
      { status: 403 },
    );
  const s = await sessionForRequest();
  if (!s?.business)
    return NextResponse.json(
      { error: 'Your session expired. Sign in again.' },
      { status: 401 },
    );
  try {
    const raw = await req.text();
    if (raw.length > 120000)
      return NextResponse.json(
        { error: 'Request is too large.' },
        { status: 413 },
      );
    const body = JSON.parse(raw);
    if (
      !body ||
      typeof body.action !== 'string' ||
      typeof body.fields !== 'object' ||
      body.fields === null
    )
      return NextResponse.json(
        { error: 'Invalid operation.' },
        { status: 400 },
      );
    const result = await mutate(
      s.business.businessId,
      s.user.id,
      body.action,
      body.fields,
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof SyntaxError)
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    if (e instanceof StudioError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError) {
      const i = e.issues[0];
      return NextResponse.json(
        { error: i.path.join(' ') + ': ' + i.message },
        { status: 400 },
      );
    }
    const code = (e as { code?: string })?.code;
    return NextResponse.json(
      {
        error:
          code === '23505'
            ? 'This record already exists.'
            : 'Could not save this change. Refresh and try again.',
      },
      { status: code === '23505' ? 409 : 500 },
    );
  }
}
export async function GET() {
  const s = await sessionForRequest();
  if (!s?.business)
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  return NextResponse.json(await readStudio(s.business.businessId), {
    headers: {
      'Content-Disposition': 'attachment; filename="duepilot-studio.json"',
      'Cache-Control': 'private, no-store',
    },
  });
}
