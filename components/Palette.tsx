'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from './AppProvider';
import { Ic, Logo } from './Bits';
import { CATS } from '@/lib/meta';

const P = createContext<{ open: () => void }>({ open: () => {} });
export const usePalette = () => useContext(P);

export default function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); }
      else if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement as HTMLElement)?.tagName || '')) { e.preventDefault(); setOpen(true); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  return <P.Provider value={{ open: () => setOpen(true) }}>{children}{open && <Palette close={() => setOpen(false)} />}</P.Provider>;
}

function Palette({ close }: { close: () => void }) {
  const { t, lang, setLang, toggleTheme, companies, view, setView, member, live } = useApp();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const ql = q.trim().toLowerCase();
  const cos = companies.filter(c => !c.hidden && (!ql || (c.display + ' ' + (c.domain || '') + ' ' + CATS[c.category]?.ar + ' ' + CATS[c.category]?.en).toLowerCase().includes(ql))).slice(0, 6);
  const canDash = member || !live;
  const acts = useMemo(() => [
    canDash && { label: t.actAdd, ico: Ic.plus, run: () => router.push('/dashboard?add=1') },
    canDash && { label: path.startsWith('/dashboard') ? t.actHome : t.actDash, ico: Ic.dash, run: () => router.push(path.startsWith('/dashboard') ? '/' : '/dashboard') },
    { label: t.actTheme, ico: Ic.moon, run: toggleTheme },
    { label: t.actView, ico: Ic.list, run: () => { setView(view === 'grid' ? 'list' : 'grid'); if (path !== '/') router.push('/'); } },
    { label: t.actGrowth, ico: Ic.trend, run: () => router.push('/?sort=growth#companies') },
    { label: t.actShort, ico: Ic.heart, run: () => router.push('/?short=1#companies') },
    { label: t.actLang, ico: Ic.globe, run: () => setLang(lang === 'ar' ? 'en' : 'ar') }
  ].filter(Boolean).filter((a: any) => !ql || a.label.toLowerCase().includes(ql)) as any[], [t, ql, view, lang, path, canDash]);
  const items = [...cos.map(c => ({ label: c.display, run: () => router.push('/company/' + c.slug), c })), ...acts];
  const run = (i: number) => { const it = items[i]; if (!it) return; close(); it.run(); };
  useEffect(() => { listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' }); }, [idx]);

  return (
    <div className="scrim open" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Search">
        <div className="pal-in">{Ic.search}
          <input autoFocus value={q} placeholder={t.searchPh} onChange={e => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((idx + 1) % Math.max(items.length, 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((idx - 1 + items.length) % Math.max(items.length, 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(idx); }
              else if (e.key === 'Escape') close();
            }} />
          <kbd>Esc</kbd>
        </div>
        <div className="pal-list" ref={listRef}>
          {cos.length > 0 && <div className="pal-sec">{t.palCo}</div>}
          {cos.map((c, i) => (
            <button key={c.id} type="button" className={'pal-item' + (i === idx ? ' active' : '')} onMouseMove={() => setIdx(i)} onClick={() => run(i)}>
              <Logo c={c} /><span>{c.display}</span><span className="meta">{CATS[c.category]?.[lang]}</span>
            </button>
          ))}
          {acts.length > 0 && <div className="pal-sec">{t.palAct}</div>}
          {acts.map((a, j) => {
            const i = cos.length + j;
            return <button key={a.label} type="button" className={'pal-item' + (i === idx ? ' active' : '')} onMouseMove={() => setIdx(i)} onClick={() => run(i)}>
              <span className="pi-ico">{a.ico}</span><span>{a.label}</span></button>;
          })}
          {!items.length && <div className="pal-sec">{t.emptyT}</div>}
        </div>
        <div className="pal-foot"><span>↑↓ {t.navigate}</span><span>↵ {t.select}</span></div>
      </div>
    </div>
  );
}
