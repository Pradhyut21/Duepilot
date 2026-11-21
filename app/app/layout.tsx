import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, validateSession } from '../../lib/auth/session';
import { AppNav } from '../../components/nav/AppNav';
import { Button } from '../../components/ui/Button';
import { logoutAction } from '../(auth)/actions';

/**
 * Protected shell for every /app route. The session cookie is validated on each
 * request; missing or invalid sessions are sent to /login. The business context
 * comes from the validated session, never from client input.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect('/login');
  }

  const session = await validateSession(token);
  if (!session) {
    redirect('/login');
  }

  const businessName = session.business?.businessName ?? 'Your business';

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="px-6 py-5">
          <p className="text-lg font-bold text-ink">DuePilot</p>
        </div>
        <AppNav variant="sidebar" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500 md:hidden">DuePilot</p>
            <p className="truncate text-base font-semibold text-ink">{businessName}</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Log out
            </Button>
          </form>
        </header>

        <div className="border-b border-slate-200 bg-white md:hidden">
          <AppNav variant="top" />
        </div>

        <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

