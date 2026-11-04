'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from './AppProvider';
import { Ic, Logo, Pills } from './Bits';
import { Co } from '@/lib/types';
import type { Dict } from '@/lib/i18n';
import { normalize, rel, Norm } from '@/lib/util';
import EditModal from './EditModal';
import Login from './Login';

export const statusName = (t: Dict, s: string) => ({ queued: t.tQueued, running: t.tRunning, done: t.tDone, partial: t.tPartial, failed: t.tFailed } as any)[s] || s;

export function Steps({ c }: { c: Co }) {
  const { t } = useApp();
  // Older rows marked a failure at stage 5; show it at the first step instead
  const stage = c.status === 'failed' && c.stage >= 5 ? 0 : c.stage;
  return <div className="steps">{t.stages.map((s, i) => {
    let cl = '';
    if (c.status === 'done' || i < stage) cl = 'ok';
    else if (i === stage) cl = c.status === 'running' ? 'run' : c.status === 'failed' ? 'bad' : c.status === 'partial' ? 'warn' : '';
    return <i key={i} className={cl} title={s} />;
  })}</div>;
}
export function stageLabel(t: Dict, c: Co) {
  if (c.status === 'running') return (t.stages[c.stage] || t.stages[4]) + '…';
  if (c.status === 'queued') return t.stQueued;
  if (c.status === 'done') return t.stDone;
  if (c.status === 'failed') return t.stFailed;
  return t.stPartial;
}

export default function Dashboard() {
  const { t, live, ready, email, member } = useApp();
  if (live && !ready) return <main className="wrap"><div className="empty-state" style={{ marginTop: 40 }}><p>{t.loading}</p></div></main>;
  if (live && !email) return <Login />;
  if (live && !member) return <main className="wrap"><div className="empty-state" style={{ marginTop: 40 }}><h3>{t.notMemberT}</h3><p>{t.notMemberP(email!)}</p></div></main>;
  return <Board />;
}

function Board() {
  const { t, lang, companies, addLinks, retry, remove, refreshAll, toast, settings, saveSettings, live } = useApp();
  const sp = useSearchParams();
  const [text, setText] = useState('');
  const [tab, setTab] = useState('all');
  const [ask, setAsk] = useState<string | null>(null);
  const [editing, setEditing] = useState<Co | null>(null);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (sp.get('add')) ta.current?.focus(); }, [sp]);

  const keysOf = (c: Co) => {
    const k = new Set<string>();
    [c.input_url, c.website, c.domain && 'https://' + c.domain, ...Object.values(c.links)].forEach(v => { if (!v) return; const n = normalize(v); if (!n.bad) k.add(n.key!); });
    return k;
  };
  const keyIndex = useMemo(() => { const m = new Map<string, Co>(); companies.forEach(c => keysOf(c).forEach(k => m.set(k, c))); return m; }, [companies]);
  const checks = useMemo(() => {
    const seen = new Set<string>();
    return text.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean).map(raw => {
      const n = normalize(raw);
      if (n.bad) return { raw, v: 'bad' as const };
      if (seen.has(n.key!)) return { raw, v: 'dupPaste' as const };
      seen.add(n.key!);
      const d = keyIndex.get(n.key!);
      return d ? { raw, v: 'dup' as const, co: d } : { raw, v: 'new' as const, n };
    });
  }, [text, keyIndex]);

  const add = async () => {
    const nw = checks.filter(x => x.v === 'new').map(x => (x as any).n as Norm);
    if (!nw.length) { toast(t.nothingNew); return; }
    setBusy(true);
    const r = await addLinks(nw);
    setBusy(false); setText(''); setTab('all');
    toast(r.dispatched ? t.addedToast(r.added, checks.length - r.added) : t.queuedLater);
  };

  const cnt: Record<string, number> = { all: companies.length, queued: 0, running: 0, done: 0, partial: 0, failed: 0 };
  companies.forEach(c => { cnt[c.status] = (cnt[c.status] || 0) + 1; });
  const TL: Record<string, string> = { all: t.tAll, queued: t.tQueued, running: t.tRunning, done: t.tDone, partial: t.tPartial, failed: t.tFailed };
  const ord: Record<string, number> = { running: 0, queued: 1, failed: 2, partial: 3, done: 4 };
  const rows = companies.filter(c => tab === 'all' || c.status === tab)
    .sort((a, b) => ord[a.status] - ord[b.status] || +new Date(b.run_at || b.created_at) - +new Date(a.run_at || a.created_at));

  return (
    <main className="wrap">
      {!live && <div className="notice" style={{ marginTop: 20 }}><i /><span>{t.demoBanner}</span></div>}
      <section className="dash-head">
        <div><h1>{t.dashTitle}</h1><p>{t.dashSub}</p></div>
        <div className="d-acts">
          <label className="sched" htmlFor="schedSel">{t.schedule}</label>
          <select className="select" id="schedSel" value={settings.refresh_days} onChange={e => saveSettings({ refresh_days: +e.target.value })}>
            {Object.entries(t.sched).map(([d, l]) => <option key={d} value={d}>{l}</option>)}
          </select>
          <button className="btn" type="button" onClick={refreshAll}>{Ic.re}<span>{t.refreshAll}</span></button>
        </div>
      </section>
      <div className="dash-grid">
        <div className="d-col">
          <section className="panel add">
            <h2><label htmlFor="addInput">{t.addLabel}</label></h2>
            <textarea id="addInput" ref={ta} rows={3} spellCheck={false} value={text} placeholder={t.addPh} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } }} />
            <div className="add-row"><span className="hint">{t.addHint}</span><button className="btn primary" type="button" disabled={busy} onClick={add}>{t.addBtn}</button></div>
            {checks.length > 0 && <div className="checks">{checks.map((x, i) => (
              <div key={i} className="chk"><code>{x.raw}</code>
                {x.v === 'new' ? <span className="st done">{t.chkNew}</span>
                  : x.v === 'dup' ? <Link className="st partial" href={'/company/' + x.co.slug}>{t.chkDup(x.co.display)}</Link>
                  : x.v === 'dupPaste' ? <span className="st partial">{t.chkDupPaste}</span>
                  : <span className="st failed">{t.chkBad}</span>}
              </div>))}</div>}
          </section>
          <div className="tiles">{['all', 'running', 'done', 'partial', 'failed'].map(k => (
            <div key={k} className="tile"><small><i className={k} />{TL[k]}</small><b className="num">{k === 'running' ? cnt.running + cnt.queued : cnt[k] || 0}</b></div>))}</div>
          <section className="panel flush">
            <div className="q-head"><h2>{t.queueT}</h2>
              <div className="tabs">{Object.keys(TL).filter(k => k === 'all' || cnt[k]).map(k => (
                <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>{TL[k]}<span className="n">{cnt[k] || 0}</span></button>))}</div></div>
            {!rows.length ? <div className="empty-q">{t.emptyQ}</div> : <div className="tscroll"><div className="qlist">
              <div className="qrow hd"><div>{t.thCo}</div><div>{t.thStatus}</div><div>{t.thStep}</div><div>{t.thWhen}</div><div /></div>
              {rows.map(c => (
                <div key={c.id} className="qrow">
                  <div className="who"><Logo c={c} /><div style={{ minWidth: 0 }}><b>{c.display}<Pills c={c} /></b><small>{c.input_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</small></div></div>
                  <div><span className={'st ' + c.status}>{statusName(t, c.status)}</span></div>
                  <div><Steps c={c} /><div className="stage">{stageLabel(t, c)}</div></div>
                  <div className="when">{rel(c.run_at || c.created_at, lang)}</div>
                  <div className="acts">{ask === c.id
                    ? <div className="confirm"><span>{t.sure}</span><button type="button" className="yes" onClick={async () => { setAsk(null); await remove(c.id); toast(t.deleted); }}>{t.yes}</button><button type="button" onClick={() => setAsk(null)}>{t.no}</button></div>
                    : <>
                      <Link className="mini" href={'/company/' + c.slug} title={t.view} aria-label={t.view}>{Ic.eye}</Link>
                      <button className="mini" type="button" title={t.retry} aria-label={t.retry} disabled={c.status === 'running' || c.status === 'queued'} onClick={() => retry(c.id)}>{Ic.re}</button>
                      <button className="mini" type="button" title={t.edit} aria-label={t.edit} onClick={() => setEditing(c)}>{Ic.pen}</button>
                      <button className="mini danger" type="button" title={t.del} aria-label={t.del} onClick={() => setAsk(c.id)}>{Ic.bin}</button>
                    </>}</div>
                </div>))}
            </div></div>}
          </section>
        </div>
        <aside className="d-col"><Team /><Sources /></aside>
      </div>
      {editing && <EditModal c={companies.find(x => x.id === editing.id) || editing} close={() => setEditing(null)} />}
    </main>
  );
}

function Team() {
  const { t, team, loadTeam, addMember, removeMember, email, settings, saveSettings, toast } = useApp();
  const [v, setV] = useState('');
  useEffect(() => { loadTeam(); }, []);
  return (
    <section className="panel"><h2>{t.teamT}</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>{t.teamHint}</p>
      <div className="team">{team.map(e => (
        <div key={e} className="team-row"><span>{e}{e === email && <small> · {t.you}</small>}</span>
          {e !== email && <button className="mini danger" type="button" aria-label={t.del} title={t.del} onClick={() => removeMember(e)}>{Ic.bin}</button>}</div>))}</div>
      <form className="team-add" onSubmit={async e => { e.preventDefault(); if (!/.+@.+\..+/.test(v)) return; const ok = await addMember(v); if (ok) setV(''); else toast(t.errGeneric); }}>
        <label htmlFor="teamEmail" hidden>{t.email}</label>
        <input id="teamEmail" type="email" className="select" placeholder="name@company.com" value={v} onChange={e => setV(e.target.value)} />
        <button className="btn" type="submit">{t.teamAdd}</button>
      </form>
      <div className="setting">
        <label className="opt" style={{ paddingInline: 0 }}><input type="checkbox" checked={settings.public_read} onChange={e => saveSettings({ public_read: e.target.checked })} /><span className="box" /><span className="t">{t.publicL}</span></label>
        <p className="hint" style={{ margin: '4px 0 0' }}>{t.publicHint}</p>
      </div>
    </section>
  );
}

function Sources() {
  const { t, lang } = useApp();
  const PROV: { n: string; d: { ar: string; en: string }; s: 'ready' | 'setup' | 'key' }[] = [
    { n: lang === 'ar' ? 'موقع الشركة' : 'Company website', d: { ar: 'الاسم والوصف واللوجو ولينكات المنصات. المواقع اللي بتتحمّل بالجافاسكريبت بتتقري بمتصفح كامل.', en: 'Name, description, logo and platform links. JavaScript sites are read with a full browser.' }, s: 'ready' },
    { n: 'Sortlist', d: { ar: 'التقييم وعدد الريفيوهات من صفحة الوكالة العامة.', en: 'Rating and review count from the public agency page.' }, s: 'ready' },
    { n: 'LinkedIn · TikTok · Behance', d: { ar: 'من الصفحات العامة: المتابعين والاسم والنبذة واللوجو. ولو الموقع واقف، البيانات بتيجي منها.', en: 'From public pages: followers, name, bio and logo. If the website is down, data comes from here.' }, s: 'ready' },
    { n: 'Instagram', d: { ar: 'إنستجرام بيمنع القراءة الآلية، ومش بنحاول نتخطاه. الطريقة المجانية الرسمية: Instagram API من Meta (الخطوات في README). لحد ما يتربط، الرقم بيتكتب يدوي.', en: "Instagram blocks automated reads and we don't work around it. The free official route is Meta's Instagram API (steps in the README). Until then, type the number in." }, s: 'key' },
    { n: 'Facebook', d: { ar: 'الصفحة العامة بس. لو فيسبوك طلب تسجيل دخول، الرقم بيتكتب يدوي.', en: 'Public page only. If Facebook asks for a sign-in, type the number in.' }, s: 'setup' },
    { n: 'YouTube', d: { ar: 'شغال من غير مفتاح، وأدق بمفتاح YouTube Data API المجاني.', en: 'Works without a key; more reliable with the free YouTube Data API key.' }, s: 'key' },
    { n: 'X', d: { ar: 'مفيش طريقة مجانية. الرقم بيتكتب يدوي.', en: 'No free source. Type the number in by hand.' }, s: 'setup' },
    { n: lang === 'ar' ? 'التصنيف' : 'Classification', d: { ar: 'تلقائي من كلمات الموقع. أدق لو ضفت مفتاح Gemini المجاني.', en: 'Automatic from site wording. More accurate with a free Gemini key.' }, s: 'key' }
  ];
  const lbl = { ready: lang === 'ar' ? 'شغّال' : 'Working', setup: lang === 'ar' ? 'يدوي' : 'Manual', key: lang === 'ar' ? 'مفتاح اختياري' : 'Optional key' };
  return (
    <section className="panel"><h2>{t.provT}</h2>
      {PROV.map(p => <div key={p.n} className="pv"><b>{p.n}</b><span className={'ps ' + p.s}>{lbl[p.s]}</span><p>{p.d[lang]}</p></div>)}
    </section>
  );
}
