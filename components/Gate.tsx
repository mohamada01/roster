'use client';
import { usePathname } from 'next/navigation';
import { useApp } from './AppProvider';
import Login from './Login';

/** The directory is team-only unless the team made it public. The dashboard handles its own sign-in. */
export default function Gate({ children }: { children: React.ReactNode }) {
  const { live, ready, email, member, publicDir, t } = useApp();
  const path = usePathname();
  if (!live || path.startsWith('/dashboard')) return <>{children}</>;
  if (!ready) return <main className="wrap"><div className="empty-state" style={{ marginTop: 40 }}><p>{t.loading}</p></div></main>;
  if (publicDir || member) return <>{children}</>;
  if (!email) return <Login />;
  return <main className="wrap"><div className="empty-state" style={{ marginTop: 40 }}><h3>{t.notMemberT}</h3><p>{t.notMemberP(email)}</p></div></main>;
}
