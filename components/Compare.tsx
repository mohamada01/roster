'use client';
import { useState } from 'react';
import { useApp } from './AppProvider';
import { Logo } from './Bits';
import { CATS, PLATS, PLAT_KEYS, countryName } from '@/lib/meta';
import { fmt } from '@/lib/util';

export default function Compare() {
  const { t, lang, companies, cmp, clearCmp } = useApp();
  const [open, setOpen] = useState(false);
  const L = cmp.map(id => companies.find(c => c.id === id)).filter(Boolean);
  const n = L.length;
  const R = t.rows;
  const best = (vals: (number | null)[]) => {
    const nums = vals.filter(v => typeof v === 'number') as number[];
    if (nums.length < 2) return -1;
    const m = Math.max(...nums);
    return vals.filter(v => v === m).length === 1 ? vals.indexOf(m) : -1;
  };
  const Line = ({ label, vals, f, cmpr }: { label: React.ReactNode; vals: (number | null)[]; f: (v: number) => string; cmpr?: boolean }) => {
    const b = cmpr ? best(vals) : -1;
    return <tr><th>{label}</th>{vals.map((v, i) => <td key={i} className={(i === b ? 'best ' : '') + (v == null ? 'na ' : '') + 'num'}>{v == null ? '—' : f(v)}</td>)}</tr>;
  };
  const plats = PLAT_KEYS.filter(k => L.some(c => c!.fol[k] != null));
  return (
    <>
      <div className={'tray' + (n ? ' show' : '')}><div className="tray-in">
        <div className="tray-logos">{L.map(c => <Logo key={c!.id} c={c!} />)}</div>
        <span className="tray-txt">{t.trayTxt(n)}</span>
        <button className="btn primary" type="button" disabled={n < 2} onClick={() => setOpen(true)}>{t.cmpBtn(n)}</button>
        <button className="x" type="button" onClick={clearCmp}>{t.clear}</button>
      </div></div>
      {open && n >= 2 && (
        <div className="scrim open" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal wide" role="dialog" aria-modal="true">
            <div className="m-head"><h3>{t.compareTitle}</h3><button className="mini" type="button" aria-label="Close" onClick={() => setOpen(false)}>✕</button></div>
            <div className="m-body"><div className="cmp-scroll"><table className="cmp">
              <thead><tr><th />{L.map(c => <th key={c!.id}><div className="who"><Logo c={c!} /><div><b>{c!.display}</b><div className="dom" style={{ fontSize: 12, color: 'var(--muted)' }}>{c!.domain}</div></div></div></th>)}</tr></thead>
              <tbody>
                <tr><th>{R.cat}</th>{L.map(c => <td key={c!.id}><span className="tag cat">{CATS[c!.category]?.[lang]}</span></td>)}</tr>
                <tr><th>{R.country}</th>{L.map(c => <td key={c!.id}>{c!.countries.map(k => countryName(k, lang)).join(lang === 'ar' ? '، ' : ', ') || '—'}</td>)}</tr>
                <Line label={R.founded} vals={L.map(c => c!.founded)} f={v => String(v)} />
                <Line label={R.total} vals={L.map(c => c!.total || null)} f={fmt} cmpr />
                <Line label={R.growth} vals={L.map(c => c!.growth_30d)} f={v => (v >= 0 ? '+' : '') + v + '%'} cmpr />
                <Line label={R.rating} vals={L.map(c => c!.sortlist_rating)} f={v => (+v).toFixed(1) + ' ★'} cmpr />
                <Line label={R.reviews} vals={L.map(c => c!.sortlist_reviews)} f={v => String(v)} cmpr />
                {plats.map(k => <Line key={k} label={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span className="pi">{PLATS[k].ab}</span>{PLATS[k].n}</span>} vals={L.map(c => c!.fol[k] ?? null)} f={fmt} cmpr />)}
              </tbody>
            </table></div></div>
          </div>
        </div>
      )}
    </>
  );
}
