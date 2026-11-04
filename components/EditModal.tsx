'use client';
import { useState } from 'react';
import { useApp } from './AppProvider';
import { CATS, PLATS, PLAT_KEYS } from '@/lib/meta';
import { Co } from '@/lib/types';
import { normalize } from '@/lib/util';

export default function EditModal({ c, close }: { c: Co; close: () => void }) {
  const { t, lang, saveEdit, toast } = useApp();
  const o = c.overrides || {};
  const [name, setName] = useState(o.name ?? c.name ?? '');
  const [cat, setCat] = useState(o.category ?? c.category);
  const [desc, setDesc] = useState(o.description ?? c.description ?? '');
  const [hidden, setHidden] = useState(c.hidden);
  const [fol, setFol] = useState<Record<string, string>>(Object.fromEntries(PLAT_KEYS.map(k => [k, o.followers?.[k] != null ? String(o.followers[k]) : ''])));
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const ov: Co['overrides'] = {};
    const s = c.scraped;
    if (name.trim() && name.trim() !== (s.name ?? '')) ov.name = name.trim();
    if (cat !== s.category) ov.category = cat;
    if (desc.trim() && desc.trim() !== (s.description ?? '')) ov.description = desc.trim();
    const f = Object.fromEntries(Object.entries(fol).filter(([, v]) => v.trim() !== '' && !isNaN(+v)).map(([k, v]) => [k, Math.round(+v)]));
    if (Object.keys(f).length) ov.followers = f;
    const links = { ...c.links };
    extra.split(/[\s,]+/).filter(Boolean).forEach(l => { const n = normalize(l); if (!n.bad && n.kind !== 'website') links[n.kind!] = n.url!; });
    const ok = await saveEdit(c.id, { overrides: ov, hidden, links });
    setBusy(false);
    toast(ok ? t.saved : t.errGeneric);
    if (ok) close();
  };
  const fields = PLAT_KEYS.filter(k => k in c.links || k in c.fol);

  return (
    <div className="scrim open" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="m-head"><h3>{t.editT}</h3><button className="mini" type="button" aria-label="Close" onClick={close}>✕</button></div>
        <div className="m-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field"><label htmlFor="edName">{t.fName}</label><input type="text" id="edName" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="edCat">{t.fCatL}</label>
            <select className="select" id="edCat" style={{ width: '100%' }} value={cat} onChange={e => setCat(e.target.value)}>
              {Object.keys(CATS).map(k => <option key={k} value={k}>{CATS[k][lang]}</option>)}</select></div>
          <div className="field"><label htmlFor="edDesc">{t.fDesc}</label><textarea id="edDesc" value={desc} onChange={e => setDesc(e.target.value)} /><span className="note">{t.fDescNote}</span></div>
          {fields.length > 0 && <div className="field"><label>{t.fFolEdit}</label>
            <div className="fol-grid">{fields.map(k => (
              <label key={k} className="fol-in"><span className="pi">{PLATS[k].ab}</span><span className="fol-n">{PLATS[k].n}</span>
                <input type="number" min="0" inputMode="numeric" id={'edFol-' + k} value={fol[k]} placeholder={c.followers?.[k] != null ? String(c.followers[k]) : '—'} onChange={e => setFol({ ...fol, [k]: e.target.value })} /></label>
            ))}</div><span className="note">{t.fFolEditNote}</span></div>}
          <div className="field"><label htmlFor="edLinks">{t.fLinks}</label><textarea id="edLinks" style={{ minHeight: 64 }} value={extra} placeholder="https://www.tiktok.com/@brand" onChange={e => setExtra(e.target.value)} /><span className="note">{t.fLinksNote}</span></div>
          <label className="opt" style={{ paddingInline: 0 }}><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /><span className="box" /><span className="t">{t.fHide}</span></label>
        </div>
        <div className="m-foot"><button className="btn" type="button" onClick={close}>{t.cancel}</button><button className="btn primary" type="button" disabled={busy} onClick={save}>{t.save}</button></div>
      </div>
    </div>
  );
}
