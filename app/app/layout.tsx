import { redirect } from 'next/navigation';
import { Aperture, LogOut } from 'lucide-react';
import { sessionForRequest } from '@/lib/studio/data';
import { AppNav } from '@/components/nav/AppNav';
import { Brand } from '@/components/studio/Brand';
import { logoutAction } from '../(auth)/actions';
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await sessionForRequest();
  if (!s) redirect('/login');
  return (
    <div className="appshell">
      <aside>
        <Brand />
        <div className="asidecaption">Workspace</div>
        <AppNav />
        <div className="asidefoot">
          <Aperture size={18} />
          Photography studio
        </div>
      </aside>
      <div className="workmain">
        <header className="topbar">
          <div>
            <Aperture size={19} />
            <b>{s.business?.businessName ?? 'Studio'}</b>
            {s.business?.isDemo && (
              <span className="status">Demo workspace</span>
            )}
          </div>
          <form action={logoutAction}>
            <button aria-label="Log out" title="Log out">
              <LogOut size={17} />
              <span>Log out</span>
            </button>
          </form>
        </header>
        <AppNav variant="top" />
        <main>{children}</main>
      </div>
    </div>
  );
}
