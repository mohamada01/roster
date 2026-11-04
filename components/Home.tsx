'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from './AppProvider';
import { Growth, Ic, Logo, MetaRow, Pills, PlatChips, Rating, Spark } from './Bits';
import { usePalette } from './Palette';
import { CATS, ISSUES, PLATS, PLAT_KEYS, countryName } from '@/lib/meta';
import { Co, isIncomplete, isPending } from '@/lib/types';
import { fmt } from '@/lib/util';
import Compare from './Compare';

const list = (s: string | null) => (s ? s.split(',').filter(Boolean) : []);

export default function Home() {
  const { t, companies, live } = useApp();
  const pal = usePalette();
  const visible = companies.filter(c => !c.hidden && !isPending(c));
  const withData = visible.filter(c => !isIncomplete(c));
  return (
    <main className="wrap">
      {!live && <div className="notice" style={{ marginTop: 20 }}><i /><span>{t.demoBanner}</span></div>}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-copy">
          <span className="eyebrow"><i /><span>{t.heroEyebrow}</span></span>
          <h1 dangerouslySetInnerHTML={{ __html: t.heroTitle }} />
          <p className="hero-sub">{t.heroSub}</p>
          <div className="hero-cta">
            <button className="btn primary big" type="button" onClick={() => document.getElementById('companies')?.scrollIntoView({ behavior: 'smooth' })}><span>{t.browse}</span>{Ic.arrowDown}</button>
            <button className="btn big" type="button" onClick={pal.open}><span>{t.heroSearch}</span><kbd>⌘K</kbd></button>
          </div>
          <div className="stats">
            <div className="stat"><b className="num">{visible.length}</b><span>{t.stCo}</span></div>
            <div className="stat"><b className="num">{new Set(withData.filter(c => c.category !== 'none').map(c => c.category)).size}</b><span>{t.stCat}</span></div>
            <div className="stat"><b className="num">{fmt(visible.reduce((a, c) => a + c.total, 0))}</b><span>{t.stFol}</span></div>
          </div>
        </div>
        <Sorter cos={withData} />
      </section>
      <Movers cos={withData} />
      <Directory all={visible} />
      <Compare />
    </main>
  );
}

function Sorter({ cos }: { cos: Co[] }) {
  const { t, lang } = useApp();
  const pick = useMemo(() => [...cos].filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 6), [cos]);
  const crits = useMemo(() => {
    const c: { i: number; f: (c: Co) => number; v: (c: Co) => string }[] = [{ i: 0, f: c => c.total, v: c => fmt(c.total) }];
    if (pick.filter(c => c.growth_30d != null).length >= 2) c.push({ i: 1, f: c => c.growth_30d ?? -1e9, v: c => c.growth_30d == null ? '—' : (c.growth_30d >= 0 ? '+' : '') + c.growth_30d + '%' });
    if (pick.filter(c => c.sortlist_rating != null).length >= 2) c.push({ i: 2, f: c => c.sortlist_rating ?? 0, v: c => c.sortlist_rating == null ? '—' : (+c.sortlist_rating).toFixed(1) + ' ★' });
    return c;
  }, [pick]);
  const [ci, setCi] = useState(0);
  useEffect(() => {
    if (crits.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => { if (!document.hidden) setCi(i => (i + 1) % crits.length); }, 3400);
    return () => clearInterval(id);
  }, [crits.length]);
  const cr = crits[ci % crits.length];
  if (pick.length < 2) return <div className="sorter" aria-hidden="true"><div className="empty-state" style={{ border: 0 }}><p>{t.heroEmpty}</p></div></div>;
  const ordered = [...pick].sort((a, b) => cr.f(b) - cr.f(a));
  const vals = pick.map(cr.f).filter(v => v > -1e9), mx = Math.max(...vals), mn = Math.min(...vals, 0);
  return (
    <div className="sorter" aria-hidden="true">
      <div className="sorter-head"><small>{t.sortBy}</small>
        <div className="crit">{crits.map(c => <span key={c.i} className={c === cr ? 'on' : ''}>{t.crit[c.i]}</span>)}</div></div>
      <div className="rows" style={{ height: pick.length * 52 }}>
        {pick.map(c => {
          const rank = ordered.indexOf(c);
          return (
            <div key={c.id} className={'srow' + (rank === 0 ? ' lead' : '')} style={{ transform: `translateY(${rank * 52}px)` }}>
              <span className="rk">{String(rank + 1).padStart(2, '0')}</span><Logo c={c} />
              <div className="nm"><b>{c.display}</b><div className="bar"><i style={{ width: Math.max(6, ((cr.f(c) - mn) / ((mx - mn) || 1)) * 100) + '%' }} /></div></div>
              <span className="val">{cr.v(c)}</span>
            </div>
          );
        })}
      </div>
      <div className="sorter-foot"><span>{t.liveRank}</span><span className="num">{new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' })}</span></div>
    </div>
  );
}

function Movers({ cos }: { cos: Co[] }) {
  const { t, lang } = useApp();
  const L = cos.filter(c => c.growth_30d != null).sort((a, b) => (b.growth_30d! - a.growth_30d!)).slice(0, 3);
  if (L.length < 2) return null;
  return (
    <section className="movers">
      <div className="mv-head"><h2>{t.moversT}</h2><span>{t.moversSub}</span></div>
      <div className="mv-grid">{L.map((c, i) => (
        <Link key={c.id} href={'/company/' + c.slug} className="mv">
          <span className="rk">{String(i + 1).padStart(2, '0')}</span><Logo c={c} />
          <span style={{ minWidth: 0 }}><b>{c.display}</b><small>{CATS[c.category]?.[lang]}</small></span>
          <span className="g"><span className={'v ' + (c.growth_30d! >= 0 ? 'up' : 'down')}>{c.growth_30d! >= 0 ? '+' : ''}{c.growth_30d}%</span><Spark c={c} /></span>
        </Link>
      ))}</div>
    </section>
  );
}

function Directory({ all }: { all: Co[] }) {
  const { t, lang, view, setView, favs, toast } = useApp();
  const sp = useSearchParams();
  const router = useRouter();
  const [railOpen, setRailOpen] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const f = {
    q: sp.get('q') || '', cats: list(sp.get('cat')), on: list(sp.get('on')), countries: list(sp.get('country')),
    min: +(sp.get('min') || 0), rating: +(sp.get('rating') || 0), sort: sp.get('sort') || 'total',
    short: sp.get('short') === '1', hidePartial: sp.get('complete') === '1'
  };
  const setP = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v == null || v === '' || v === '0' ? p.delete(k) : p.set(k, v)));
    router.replace('/' + (p.toString() ? '?' + p.toString() : ''), { scroll: false });
  };
  const toggleIn = (key: string, arr: string[], v: string) => setP({ [key]: (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]).join(',') });

  const q = f.q.trim().toLowerCase();
  const res = useMemo(() => {
    const r = all.filter(c => {
      if (q && !(c.display + ' ' + (c.domain || '') + ' ' + (c.description || '') + ' ' + CATS[c.category]?.ar + ' ' + CATS[c.category]?.en).toLowerCase().includes(q)) return false;
      if (f.cats.length && !f.cats.includes(c.category)) return false;
      if (f.on.length && !f.on.every(p => p in c.links || p in c.fol)) return false;
      if (f.countries.length && !c.countries.some(k => f.countries.includes(k))) return false;
      if (f.min && c.total < f.min) return false;
      if (f.rating && !(c.sortlist_rating != null && c.sortlist_rating >= f.rating)) return false;
      if (f.short && !favs.has(c.id)) return false;
      if (f.hidePartial && isIncomplete(c)) return false;
      return true;
    });
    const key: Record<string, (c: Co) => number> = {
      total: c => c.total, growth: c => c.growth_30d ?? -1e9, rating: c => c.sortlist_rating ?? -1,
      reviews: c => c.sortlist_reviews ?? -1, new: c => +new Date(c.created_at)
    };
    return r.sort((a, b) => {
      if (isIncomplete(a) !== isIncomplete(b)) return isIncomplete(a) ? 1 : -1;
      if (f.sort === 'name') return a.display.localeCompare(b.display);
      return (key[f.sort] || key.total)(b) - (key[f.sort] || key.total)(a) || a.display.localeCompare(b.display);
    });
  }, [all, sp, favs]);

  const usedCats = Object.keys(CATS).filter(k => all.some(c => c.category === k));
  const usedCountries = [...new Set(all.flatMap(c => c.countries))];
  const chips: [string, () => void][] = [
    ...f.cats.map(k => [CATS[k]?.[lang] || k, () => toggleIn('cat', f.cats, k)] as [string, () => void]),
    ...f.on.map(k => [PLATS[k]?.n || k, () => toggleIn('on', f.on, k)] as [string, () => void]),
    ...f.countries.map(k => [countryName(k, lang), () => toggleIn('country', f.countries, k)] as [string, () => void])
  ];
  if (f.min) chips.push([fmt(f.min) + '+ ' + t.fFol, () => setP({ min: null })]);
  if (f.rating) chips.push([f.rating + '+ ★', () => setP({ rating: null })]);
  if (f.short) chips.push([t.onlyShort, () => setP({ short: null })]);
  if (f.hidePartial) chips.push([t.hidePartial, () => setP({ complete: null })]);
  if (f.q) chips.push([`“${f.q}”`, () => setP({ q: null })]);

  const share = async () => {
    try { await navigator.clipboard.writeText(location.href); } catch { /* clipboard blocked */ }
    toast(t.shareOk);
  };
  const exportCsv = () => {
    const L = favs.size ? all.filter(c => favs.has(c.id)) : res;
    const head = ['name', 'website', 'category', 'countries', 'total_followers', ...PLAT_KEYS, 'growth_30d_pct', 'sortlist_rating', 'sortlist_reviews', 'description'];
    const qt = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = L.map(c => [c.display, c.website || c.input_url, CATS[c.category]?.en, c.countries.join(' '), c.total || '', ...PLAT_KEYS.map(k => c.fol[k] ?? ''), c.growth_30d ?? '', c.sortlist_rating ?? '', c.sortlist_reviews ?? '', c.description || ''].map(qt).join(','));
    setCsv([head.join(','), ...rows].join('\n'));
  };

  const Opt = ({ k, label, on, count, onChange }: any) => (
    <label className="opt" key={k}><input type="checkbox" checked={on} onChange={onChange} /><span className="box" /><span className="t">{label}</span>{count != null && <span className="c num">{count}</span>}</label>
  );

  return (
    <>
      <section className="head sec" id="companies"><div><h1>{t.title}</h1><p>{t.sub}</p></div></section>
      <div className="layout">
        <aside className={'rail' + (railOpen ? ' open' : '')} aria-label={t.filters}>
          <div className="rail-head"><h3>{t.filters}</h3><button className="mini" type="button" aria-label="Close" onClick={() => setRailOpen(false)}>✕</button></div>
          {usedCats.length > 0 && <div className="fgroup"><h3>{t.fCat}</h3><div className="opts">
            {usedCats.map(k => <Opt key={k} label={CATS[k][lang]} on={f.cats.includes(k)} count={all.filter(c => c.category === k).length} onChange={() => toggleIn('cat', f.cats, k)} />)}</div></div>}
          <div className="fgroup"><h3>{t.fPlat}</h3><div className="opts">
            {PLAT_KEYS.map(k => <Opt key={k} label={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span className="pi">{PLATS[k].ab}</span>{PLATS[k].n}</span>}
              on={f.on.includes(k)} count={all.filter(c => k in c.links || k in c.fol).length} onChange={() => toggleIn('on', f.on, k)} />)}</div></div>
          {usedCountries.length > 0 && <div className="fgroup"><h3>{t.fCountry}</h3><div className="opts">
            {usedCountries.map(k => <Opt key={k} label={countryName(k, lang)} on={f.countries.includes(k)} count={all.filter(c => c.countries.includes(k)).length} onChange={() => toggleIn('country', f.countries, k)} />)}</div></div>}
          <div className="fgroup"><h3>{t.fFol}</h3><div className="seg">
            {[0, 1e4, 5e4, 1e5].map(v => <button key={v} type="button" aria-pressed={f.min === v} onClick={() => setP({ min: String(v) })}>{v ? fmt(v) + '+' : t.any}</button>)}</div></div>
          <div className="fgroup"><h3>{t.fRating}</h3><div className="seg">
            {[0, 4.5, 4.8].map(v => <button key={v} type="button" aria-pressed={f.rating === v} onClick={() => setP({ rating: String(v) })}>{v ? v + '+' : t.any}</button>)}</div></div>
          <div className="fgroup"><h3>{t.fData}</h3><div className="opts">
            <Opt label={t.onlyShort} on={f.short} count={favs.size} onChange={() => setP({ short: f.short ? null : '1' })} />
            <Opt label={t.hidePartial} on={f.hidePartial} onChange={() => setP({ complete: f.hidePartial ? null : '1' })} /></div></div>
          <button className="reset" type="button" onClick={() => router.replace('/', { scroll: false })}>{t.reset}</button>
        </aside>
        <div className={'rail-scrim' + (railOpen ? ' open' : '')} onClick={() => setRailOpen(false)} />

        <section style={{ minWidth: 0 }}>
          <div className="toolbar">
            <button className="btn filters-btn" type="button" onClick={() => setRailOpen(true)}>{Ic.filter}<span>{t.filters}</span></button>
            <div className="count" dangerouslySetInnerHTML={{ __html: t.results(res.length, all.length) }} />
            <label htmlFor="dirSearch" hidden>{t.searchPh}</label>
            <input id="dirSearch" className="select dir-search" type="search" defaultValue={f.q} placeholder={t.heroSearch + '…'}
              onKeyDown={e => { if (e.key === 'Enter') setP({ q: (e.target as HTMLInputElement).value.trim() }); }}
              onBlur={e => { if (e.target.value.trim() !== f.q) setP({ q: e.target.value.trim() }); }} />
            <label htmlFor="sortSel" hidden>Sort</label>
            <select id="sortSel" className="select" value={f.sort} onChange={e => setP({ sort: e.target.value === 'total' ? null : e.target.value })}>
              {['total', 'growth', 'rating', 'reviews', 'new', 'name'].map(k => <option key={k} value={k}>{(t as any)['sort_' + k]}</option>)}
            </select>
            <div className="viewtog" role="group" aria-label="View">
              <button type="button" aria-label="Grid" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>{Ic.grid}</button>
              <button type="button" aria-label="List" aria-pressed={view === 'list'} onClick={() => setView('list')}>{Ic.list}</button>
            </div>
            <button className="btn" type="button" onClick={share}>{Ic.link}<span>{t.share}</span></button>
            <button className="btn" type="button" onClick={exportCsv}>{Ic.down}<span>{t.csv}</span></button>
          </div>
          {chips.length > 0 && <div className="chips">{chips.map(([l, fn], i) => <button key={i} className="chip" type="button" onClick={fn}>{l}<span>×</span></button>)}</div>}
          {!all.length ? <div className="empty-state"><h3>{t.emptyAllT}</h3><p>{t.emptyAllP}</p><Link className="btn primary" href="/dashboard" style={{ marginTop: 12 }}>{t.dashboard}</Link></div>
            : !res.length ? <div className="empty-state"><h3>{t.emptyT}</h3><p>{t.emptyP}</p></div>
            : view === 'grid' ? <div className="grid">{res.map(c => <Card key={c.id} c={c} />)}</div>
            : <div className="list-scroll"><div className="list">
                <div className="lrow hd"><div>{t.lh.co}</div><div>{t.lh.cat}</div><div>{t.lh.pl}</div><div>{t.lh.tot}</div><div>{t.lh.gr}</div><div>{t.lh.ra}</div><div /></div>
                {res.map(c => <LRow key={c.id} c={c} />)}</div></div>}
        </section>
      </div>
      {csv != null && <CsvModal text={csv} close={() => setCsv(null)} />}
    </>
  );
}

function useOpen(c: Co) {
  const router = useRouter();
  return (e: React.MouseEvent) => { if (!(e.target as HTMLElement).closest('button,label,input,a')) router.push('/company/' + c.slug); };
}

function Card({ c }: { c: Co }) {
  const { t, lang, favs, toggleFav, cmp, toggleCmp } = useApp();
  const open = useOpen(c);
  const sh = favs.has(c.id), inc = isIncomplete(c);
  return (
    <article className={'card' + (inc ? ' partial' : '')} onClick={open}>
      <div className="c-top"><Logo c={c} />
        <div className="c-name"><h2><Link href={'/company/' + c.slug} className="c-link">{c.display}</Link> <Pills c={c} /></h2><div className="dom">{c.domain || c.input_url.replace(/^https?:\/\/(www\.)?/, '')}</div></div>
        <div className="c-acts"><button className="mini" type="button" aria-pressed={sh} title={sh ? t.remShort : t.addShort} aria-label={sh ? t.remShort : t.addShort} onClick={() => toggleFav(c.id)}>{Ic.heart}</button></div>
      </div>
      <MetaRow c={c} />
      {inc ? <p className="reason">{(c as any).reason?.[lang] || c.issues.map(i => ISSUES[i]?.[lang]).filter(Boolean)[0] || t.partial}</p>
        : <>{c.description && <p className="desc" lang="en">{c.description}</p>}{!c.sample && c.description && <div className="desc-src">{t.descFrom(c.domain || '')}</div>}</>}
      {!inc && <PlatChips c={c} />}
      {!inc && <div className="c-foot">
        <div className="metric"><small>{t.total}</small><div className="v num">{fmt(c.total)}</div></div>
        <div className="metric"><small>{t.growth}</small><Growth c={c} /></div>
        <div className="metric"><small>{t.rating}</small><Rating c={c} /></div>
      </div>}
      {!inc && <label className="cmp-check"><input type="checkbox" checked={cmp.includes(c.id)} onChange={() => toggleCmp(c.id)} /> {t.compare}</label>}
    </article>
  );
}

function LRow({ c }: { c: Co }) {
  const { t, lang, favs, toggleFav, cmp, toggleCmp } = useApp();
  const open = useOpen(c);
  const sh = favs.has(c.id), inc = isIncomplete(c);
  return (
    <div className="lrow" onClick={open}>
      <div className="who"><Logo c={c} /><div className="c-name"><h2><Link href={'/company/' + c.slug} className="c-link">{c.display}</Link> <Pills c={c} /></h2><div className="dom">{c.domain || ''}</div></div></div>
      <div><span className="tag cat">{CATS[c.category]?.[lang]}</span></div>
      <div>{inc ? <span style={{ fontSize: 12, color: 'var(--faint)' }}>{t.partial}</span> : <PlatChips c={c} limit={3} />}</div>
      <div className="num" style={{ fontWeight: 500 }}>{inc ? '—' : fmt(c.total)}</div>
      <div>{inc ? '—' : <Growth c={c} />}</div>
      <div>{inc ? '—' : <Rating c={c} />}</div>
      <div className="acts">
        {!inc && <label className="mini" title={t.compare}><input type="checkbox" checked={cmp.includes(c.id)} onChange={() => toggleCmp(c.id)} style={{ accentColor: 'var(--accent)' }} /></label>}
        <button className="mini" type="button" aria-pressed={sh} title={sh ? t.remShort : t.addShort} aria-label={sh ? t.remShort : t.addShort} onClick={() => toggleFav(c.id)}>{Ic.heart}</button>
      </div>
    </div>
  );
}

function CsvModal({ text, close }: { text: string; close: () => void }) {
  const { t, favs, toast } = useApp();
  const ta = useRef<HTMLTextAreaElement>(null);
  const download = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'roster-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text); } catch { ta.current?.select(); } toast(t.copied); };
  return (
    <div className="scrim open" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="m-head"><h3>{t.csvTitle}</h3><button className="mini" type="button" aria-label="Close" onClick={close}>✕</button></div>
        <div className="m-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>{t.csvNote(favs.size)}</p>
          <textarea ref={ta} className="csv" readOnly value={text} />
          <div style={{ display: 'flex', gap: 8 }}><button className="btn primary" type="button" onClick={download}>{Ic.down}<span>{t.download}</span></button><button className="btn" type="button" onClick={copy}>{t.copy}</button></div>
        </div>
      </div>
    </div>
  );
}
