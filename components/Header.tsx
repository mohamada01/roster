'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from './AppProvider';
import { Ic } from './Bits';
import { usePalette } from './Palette';

export default function Header() {
  const { t, lang, setLang, toggleTheme, dark, live, email, member, signOut } = useApp();
  const path = usePathname();
  const router = useRouter();
  const pal = usePalette();
  const onDash = path.startsWith('/dashboard');
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" href="/"><div className="brand-mark"><span /></div><span className="wm">Roster</span></Link>
        <button className="search-trigger" type="button" onClick={pal.open}>
          {Ic.search}<span className="lbl">{t.searchPh}</span><kbd>⌘K</kbd>
        </button>
        {(member || !live) && <button className="icon-btn nav-dash" type="button" onClick={() => router.push(onDash ? '/' : '/dashboard')}>{onDash ? t.directory : t.dashboard}</button>}
        {live && !email && <button className="icon-btn" type="button" onClick={() => router.push('/dashboard')}>{t.signIn}</button>}
        {live && email && <button className="icon-btn nav-dash" type="button" onClick={signOut} title={email}>{t.signOut}</button>}
        <button className="icon-btn" type="button" aria-label="Language" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : 'ع'}</button>
        <button className="icon-btn" type="button" aria-label="Theme" onClick={toggleTheme}>{dark ? Ic.sun : Ic.moon}</button>
      </div>
    </header>
  );
}
