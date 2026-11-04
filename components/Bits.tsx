'use client';
import { useState } from 'react';
import { Co } from '@/lib/types';
import { PLATS } from '@/lib/meta';
import { fmt, hue, initials } from '@/lib/util';
import { useApp } from './AppProvider';

export function Logo({ c, size }: { c: Co; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style: any = { '--h': hue(c.slug || c.display) };
  if (size) { style.width = size; style.height = size; }
  const empty = !c.description && !c.total;
  if (c.logo_url && !broken) {
    return <div className="logo has-img" style={style}><img src={c.logo_url} alt="" loading="lazy" onError={() => setBroken(true)} /></div>;
  }
  return <div className={'logo' + (empty ? ' empty' : '')} style={style}>{initials(c.display)}</div>;
}

export function Spark({ c }: { c: Co }) {
  const p = c.spark || [];
  if (p.length < 2) return null;
  const mn = Math.min(...p), mx = Math.max(...p), r = mx - mn || 1;
  const pts = p.map((v, i) => `${(i / (p.length - 1) * 54 + 1).toFixed(1)},${(21 - (v - mn) / r * 19).toFixed(1)}`);
  const last = pts[pts.length - 1].split(',');
  return (
    <svg className={'spark ' + ((c.growth_30d ?? 0) >= 0 ? 'up' : 'down')} viewBox="0 0 56 22" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill="currentColor" />
    </svg>
  );
}

export function Growth({ c }: { c: Co }) {
  if (c.growth_30d == null) return <span className="num" style={{ color: 'var(--faint)' }}>—</span>;
  const g = +c.growth_30d;
  return <span className="growth"><span className={'v num ' + (g >= 0 ? 'up' : 'down')}>{g >= 0 ? '+' : ''}{g}%</span><Spark c={c} /></span>;
}

export const StarIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>;

export function Rating({ c }: { c: Co }) {
  if (c.sortlist_rating == null) return <span className="rating n">—</span>;
  return <span className="rating"><StarIcon /><b className="num">{(+c.sortlist_rating).toFixed(1)}</b>{c.sortlist_reviews != null && <span className="n num">({c.sortlist_reviews})</span>}</span>;
}

export function Pills({ c }: { c: Co }) {
  const { t } = useApp();
  return <>
    {c.sample && <span className="pill sample">{t.sample}</span>}
    {c.demo && <span className="pill demo">{t.demo}</span>}
    {(c.status === 'partial' || c.status === 'failed') && <span className="pill partial">{t.partial}</span>}
    {c.edited.length > 0 && <span className="pill edited">{t.edited}</span>}
    {c.hidden && <span className="pill sample">{t.hiddenL}</span>}
  </>;
}

export function PlatChips({ c, limit }: { c: Co; limit?: number }) {
  let e = Object.entries(c.fol).filter(([k]) => PLATS[k]).sort((a, b) => (b[1] || 0) - (a[1] || 0));
  if (!e.length) return null;
  if (limit) e = e.slice(0, limit);
  return <div className="plats">{e.map(([k, v]) => <span key={k} className="plat" title={PLATS[k].n}><span className="pi">{PLATS[k].ab}</span><b>{fmt(v)}</b></span>)}</div>;
}

export const Ic = {
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path className="fillable" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  ext: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>,
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
  down: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" /></svg>,
  filter: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4" /></svg>,
  arrowDown: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m0 0 6-6m-6 6-6-6" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  re: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>,
  pen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>,
  bin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>,
  dash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="7" height="9" rx="1.5" /><rect x="13" y="4" width="7" height="5" rx="1.5" /><rect x="13" y="11" width="7" height="9" rx="1.5" /><rect x="4" y="15" width="7" height="5" rx="1.5" /></svg>,
  trend: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 16 6-6 4 4 6-6" /></svg>,
  globe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
};
