'use client';
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from './AppProvider';
import { Growth, Ic, Logo, MetaRow, Pills, ServiceList, StarIcon } from './Bits';
import { CATS, ISSUES, PLATS, PLAT_KEYS, countryName } from '@/lib/meta';
import { Co, isIncomplete } from '@/lib/types';
import { fmt, fmtDate, fmtShort, handleOf, rel } from '@/lib/util';
import Compare from './Compare';
import EditModal from './EditModal';
import { Steps, stageLabel, statusName } from './Dashboard';

export default function Company({ slug }: { slug: string }) {
  const { t, lang, companies, ready, favs, toggleFav, cmp, toggleCmp, member, live, retry } = useApp();
  const [editing, setEditing] = useState(false);
  const c = companies.find(x => x.slug === slug);
  if (!c) return <main className="wrap"><div className="empty-state" style={{ marginTop: 40 }}><h3>{ready ? t.emptyT : t.loading}</h3><p><Link className="link" href="/">{t.back}</Link></p></div></main>;
  const canEdit = member || !live;
  const sh = favs.has(c.id), inCmp = cmp.includes(c.id), inc = isIncomplete(c);
  const F = t.fld, S = t.srcs;
  const plats = PLAT_KEYS.filter(k => k in c.fol || c.links[k]).sort((a, b) => (c.fol[b] || 0) - (c.fol[a] || 0));
  const hasSite = !!c.description;
  const sources: [string, string, string][] = c.sample ? Object.keys(F).map(k => [k, S.sample, 'smp']) : [
    ['desc', c.edited.includes('description') ? S.edited : hasSite ? S.site : S.missing, c.description ? 'ok' : 'miss'],
    ['logo', c.logo_url ? S.site : S.missing, c.logo_url ? 'ok' : 'miss'],
    ['social', plats.length ? S.social : S.missing, plats.length ? 'ok' : 'miss'],
    ['fol', c.total ? (c.manualFol.length ? S.folManual : S.fol) : S.missing, c.total ? 'ok' : 'miss'],
    ['sl', c.sortlist_rating != null ? S.sl : S.missing, c.sortlist_rating != null ? 'ok' : 'miss'],
    ['cat', c.edited.includes('category') ? S.edited : c.category !== 'none' ? S.cat : S.missing, c.category !== 'none' ? 'ok' : 'miss']
  ];
  const similar = companies.filter(x => x !== c && !x.hidden && !isIncomplete(x)).sort((a, b) => (+(b.category === c.category) - +(a.category === c.category)) || b.total - a.total).slice(0, 3);
  const site = c.website;

  const platP = plats.length > 0 && (
    <section className="panel"><div className="p-h"><h2>{t.platforms}</h2>{c.sample && <span className="pill sample">{t.sample}</span>}</div>
      <div className="tscroll"><table className="ptab"><thead><tr><th>{t.thPlat}</th><th>{t.thAcc}</th><th className="r">{t.thFol}</th></tr></thead><tbody>
        {plats.map(k => <tr key={k}>
          <td><span className="pn"><span className="pi">{PLATS[k].ab}</span>{PLATS[k].n}</span></td>
          <td>{c.links[k] ? <a href={c.links[k]} target="_blank" rel="noopener noreferrer">{handleOf(c.links[k], k)}</a> : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
          <td className="r num">{fmt(c.fol[k])}{c.manualFol.includes(k) && <span className="pill edited" style={{ marginInlineStart: 6 }}>{t.manual}</span>}</td>
        </tr>)}
      </tbody></table></div></section>
  );
  const infoP = (
    <section className="panel"><h2>{t.info}</h2><dl className="kv">
      <dt>{t.countriesL}</dt><dd>{c.countries.map(k => countryName(k, lang)).join(lang === 'ar' ? '، ' : ', ') || '—'}</dd>
      <dt>{t.foundedL}</dt><dd className="num">{c.founded || '—'}</dd>
      <dt>{t.addedL}</dt><dd>{fmtDate(c.created_at, lang)}</dd>
      <dt>{t.updatedL}</dt><dd>{c.status === 'running' || c.status === 'queued' ? <span className={'st ' + c.status}>{statusName(t, c.status)}</span> : c.fetched_at ? rel(c.fetched_at, lang) : t.never}</dd>
    </dl></section>
  );
  const sourcesP = (
    <section className="panel"><h2>{t.sourcesT}</h2><div className="prov">
      {sources.map(([k, s, st]) => <div key={k} className="prov-row"><i className={'d ' + st} /><div><b>{(F as any)[k]}</b><span>{s}</span></div></div>)}
    </div></section>
  );
  const simP = similar.length > 0 && (
    <section className="panel"><h2>{t.similarT}</h2><div className="sim">
      {similar.map(x => <Link key={x.id} href={'/company/' + x.slug}><Logo c={x} /><span style={{ minWidth: 0 }}><b style={{ fontWeight: 500 }}>{x.display}</b><small>{CATS[x.category]?.[lang]}</small></span><span className="meta num">{fmt(x.total)}</span></Link>)}
    </div></section>
  );

  const siteIssue = c.issues.find(i => /^site_(parked|blocked|down|empty)$/.test(i) && ISSUES[i]);
  // About: verbatim description, About-page text and services
  const hasAbout = !!(c.description || c.about || c.services.length);
  const aboutP = hasAbout && (
    <section className="panel"><h2>{t.about}</h2>
      {siteIssue && <p className="site-note"><i className="d ph" />{ISSUES[siteIssue][lang]}</p>}
      {c.description && <p className="quote" lang="en">{c.description}</p>}
      {!c.sample && c.description && <div className="src"><i />{c.edited.includes('description') ? t.edited : t.descSrc(t.srcName[c.description_source || 'meta description'] || c.description_source || '', c.domain || '')}</div>}
      {c.about && c.about.trim() !== (c.description || '').trim() && <div className="svc-wrap"><small>{t.aboutMore}</small>
        {c.about.split('\n\n').map((p, i) => <p key={i} className="about-p" lang="en">{p}</p>)}</div>}
      {c.services.length > 0 && <div className="svc-wrap"><small>{c.edited.includes('services') ? t.servicesT : t.services}</small>
        <ServiceList items={c.services} /></div>}
    </section>
  );

  // Contact details found on the site
  const ct = c.contact || {};
  const rows: [string, React.ReactNode][] = [];
  if (site) rows.push([t.websiteL, <a key="w" href={site} target="_blank" rel="noopener noreferrer">{c.domain || site}</a>]);
  (ct.emails || []).forEach(e => rows.push([t.emailL, <a key={e} href={'mailto:' + e}>{e}</a>]));
  (ct.phones || []).forEach(p => rows.push([t.phoneL, <a key={p} href={'tel:' + p} className="num">{p}</a>]));
  if (ct.whatsapp) rows.push([t.whatsappL, <a key="wa" href={'https://wa.me/' + ct.whatsapp.replace(/\D/g, '')} target="_blank" rel="noopener noreferrer" className="num">{ct.whatsapp}</a>]);
  if (ct.address) rows.push([t.addressL, <span key="ad" lang="en">{ct.address}</span>]);
  const contactP = !c.sample && (
    <section className="panel"><h2>{t.contactT}</h2>
      {rows.length ? <dl className="kv contact">{rows.map(([l, v], i) => <Fragment key={i}><dt>{l}</dt><dd>{v}</dd></Fragment>)}</dl>
        : <p className="hint" style={{ margin: 0 }}>{t.noContact}</p>}
    </section>
  );

  let main: React.ReactNode, side: React.ReactNode;
  if (inc) {
    const got = sources.filter(r => r[2] === 'ok'), miss = sources.filter(r => r[2] === 'miss');
    const reasons = (c as any).reason ? [(c as any).reason[lang]] : c.issues.map(i => ISSUES[i]?.[lang]).filter(Boolean);
    main = <>
      <section className="panel status-card"><div className="p-h"><h2>{t.statusT}</h2><span className={'st ' + c.status}>{statusName(t, c.status)}</span></div>
        <div style={{ maxWidth: 440 }}><Steps c={c} /><div className="stage">{stageLabel(t, c)}</div></div>
        {reasons.map((r, i) => <p key={i} style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.75, maxWidth: '62ch' }}>{r}</p>)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 18, marginTop: 20 }}>
          <div><small style={{ fontSize: 12, color: 'var(--faint)' }}>{t.gotT}</small><ul className="miss-list">{got.length ? got.map(r => <li key={r[0]}><i className="d ok" />{(F as any)[r[0]]}</li>) : <li>—</li>}</ul></div>
          <div><small style={{ fontSize: 12, color: 'var(--faint)' }}>{t.missT}</small><ul className="miss-list">{miss.length ? miss.map(r => <li key={r[0]}><i className="d miss" />{(F as any)[r[0]]}</li>) : <li>—</li>}</ul></div>
        </div>
        {canEdit && <div className="row-acts">
          <button className="btn primary" type="button" disabled={c.status === 'running' || c.status === 'queued'} onClick={() => retry(c.id)}>{Ic.re}<span>{t.retry}</span></button>
          <Link className="btn" href="/dashboard">{t.openDash}</Link></div>}
      </section>
      {aboutP}
      {platP}
    </>;
    side = <>{contactP}{infoP}{sourcesP}</>;
  } else {
    main = <>
      {aboutP}
      {c.total > 0 && <Chart c={c} />}
      {platP}
    </>;
    side = <>
      <section className="panel"><div className="p-h"><h2>{t.keyNums}</h2>{c.sample && <span className="pill sample">{t.sample}</span>}</div>
        <small style={{ color: 'var(--muted)', fontSize: 12 }}>{t.total}</small><div className="bignum num">{fmt(c.total)}</div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.growth}</span><Growth c={c} /></div>
        <div className="sl-box">{c.sortlist_rating != null ? <>
          <div className="sl-score num">{(+c.sortlist_rating).toFixed(1)}</div>
          <div><div className="stars">{[1, 2, 3, 4, 5].map(i => <span key={i} className={i <= Math.round(+c.sortlist_rating!) ? '' : 'off'}><StarIcon /></span>)}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{c.sortlist_reviews != null && <><span className="num">{c.sortlist_reviews}</span> {t.reviewsW} · </>}Sortlist</div>
            {(c.sortlist_url || c.links.sortlist) && <a className="link" href={c.sortlist_url || c.links.sortlist} target="_blank" rel="noopener noreferrer">{t.slProfile}</a>}</div>
        </> : <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{t.noSl}</p>}</div>
      </section>
      {contactP}{infoP}{sourcesP}{simP}
    </>;
  }

  return (
    <main className="wrap">
      <Link className="back" href="/">{Ic.back}{t.back}</Link>
      <section className="d-head"><Logo c={c} />
        <div className="d-title"><h1>{c.display} <Pills c={c} /></h1>
          <MetaRow c={c} extra={<span className="dom" style={{ fontSize: 13, direction: 'ltr', unicodeBidi: 'isolate' }}>{site ? <a href={site} target="_blank" rel="noopener noreferrer">{c.domain}</a> : c.domain}</span>} /></div>
        <div className="d-acts">
          <button className="btn" type="button" aria-pressed={sh} onClick={() => toggleFav(c.id)}>{Ic.heart}<span>{sh ? t.remShort : t.addShort}</span></button>
          {!inc && <button className="btn" type="button" aria-pressed={inCmp} onClick={() => toggleCmp(c.id)}>{inCmp ? t.inCompare : t.compare}</button>}
          {canEdit && <button className="btn" type="button" onClick={() => setEditing(true)}>{Ic.pen}<span>{t.edit}</span></button>}
          {site && !/^site_(parked|down)$/.test(siteIssue || '') && <a className="btn primary" href={site} target="_blank" rel="noopener noreferrer">{t.visit}{Ic.ext}</a>}
        </div>
      </section>
      <div className="d-grid"><div className="d-col">{main}</div><aside className="d-col">{side}</aside></div>
      {editing && <EditModal c={c} close={() => setEditing(false)} />}
      <Compare />
    </main>
  );
}

function Chart({ c }: { c: Co }) {
  const { t, lang, history, live } = useApp();
  const [pts, setPts] = useState<{ day: string; total: number }[] | null>(null);
  useEffect(() => {
    if (!live) {
      // demo: rebuild a plausible line from the sample spark
      const s = c.spark.length > 1 ? c.spark : [];
      const last = s[s.length - 1] || 1;
      setPts(s.map((v, i) => ({ day: new Date(Date.now() - (s.length - 1 - i) * 7 * 864e5).toISOString(), total: Math.round(c.total * v / last) })));
    } else history(c.id).then(setPts);
  }, [c.id, c.total]);
  return (
    <section className="panel"><div className="p-h"><h2>{t.folChart}</h2>{(c.sample || !live) && <span className="pill sample">{t.sample}</span>}</div>
      {pts == null ? <p className="hint">{t.loading}</p> : pts.length < 2 ? <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>{t.chartWait}</p> : <div className="chart">{svg(pts, lang, t.folChart)}</div>}
    </section>
  );
}

function svg(rows: { day: string; total: number }[], lang: any, label: string) {
  const p = rows.map(r => r.total), n = p.length;
  const W = 640, H = 220, L = 52, R = 14, Tp = 14, B = 30;
  let mn = Math.min(...p), mx = Math.max(...p);
  const span = (mx - mn) || mx * 0.02 || 1; mn -= span * 0.2; mx += span * 0.2;
  const X = (i: number) => L + i * (W - L - R) / (n - 1), Y = (v: number) => Tp + (1 - (v - mn) / (mx - mn)) * (H - Tp - B);
  const pts = p.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const xi = [...new Set([0, Math.round((n - 1) / 3), Math.round(2 * (n - 1) / 3), n - 1])];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="gs1" /><stop offset="1" className="gs2" /></linearGradient></defs>
      {[0, 0.5, 1].map(f => { const v = mn + (mx - mn) * f; return <g key={f}><line className="gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text className="ax" x={L - 8} y={Y(v) + 4} textAnchor="end">{fmt(Math.round(v))}</text></g>; })}
      <path className="ar" d={`M${X(0)},${H - B} L${pts.join(' L')} L${X(n - 1)},${H - B} Z`} />
      <polyline className="ln" points={pts.join(' ')} />
      <circle className="dot" cx={X(n - 1)} cy={Y(p[n - 1])} r="5" />
      {xi.map(i => <text key={i} className="ax" x={X(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{fmtShort(new Date(rows[i].day), lang)}</text>)}
    </svg>
  );
}
