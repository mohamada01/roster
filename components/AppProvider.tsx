'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { STRINGS, Dict } from '@/lib/i18n';
import type { Lang } from '@/lib/meta';
import { DEMO_REASON } from '@/lib/meta';
import { LIVE, sb } from '@/lib/supabase';
import { DEMO } from '@/lib/demo';
import { Co, Row, view } from '@/lib/types';
import { Norm, nameFrom, slugify } from '@/lib/util';

type Settings = { refresh_days: number; public_read: boolean };
type Ctx = {
  t: Dict; lang: Lang; setLang: (l: Lang) => void; toggleTheme: () => void; dark: boolean;
  view: 'grid' | 'list'; setView: (v: 'grid' | 'list') => void;
  live: boolean; ready: boolean; email: string | null; member: boolean | null; publicDir: boolean;
  companies: Co[]; reload: () => Promise<void>;
  favs: Set<string>; toggleFav: (id: string) => void;
  cmp: string[]; toggleCmp: (id: string) => void; clearCmp: () => void;
  toast: (m: string) => void;
  addLinks: (items: Norm[]) => Promise<{ added: number; failed: number; dispatched: boolean }>;
  saveEdit: (id: string, patch: { overrides: Row['overrides']; hidden: boolean; links: Record<string, string> }) => Promise<boolean>;
  remove: (id: string) => Promise<void>; retry: (id: string) => Promise<void>; refreshAll: () => Promise<void>;
  settings: Settings; saveSettings: (s: Partial<Settings>) => Promise<void>;
  team: string[]; loadTeam: () => Promise<void>; addMember: (e: string) => Promise<boolean>; removeMember: (e: string) => Promise<void>;
  signIn: (e: string) => Promise<string | null>; signOut: () => Promise<void>;
  history: (id: string) => Promise<{ day: string; total: number }[]>;
};
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

const ls = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem('roster:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: any) { try { localStorage.setItem('roster:' + k, JSON.stringify(v)); } catch { /* storage off */ } }
};

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangS] = useState<Lang>('ar');
  const [dark, setDark] = useState(true);
  const [viewMode, setViewS] = useState<'grid' | 'list'>('grid');
  const [rows, setRows] = useState<Row[]>(LIVE ? [] : DEMO);
  const [ready, setReady] = useState(!LIVE);
  const [email, setEmail] = useState<string | null>(null);
  const [member, setMember] = useState<boolean | null>(LIVE ? null : true);
  const [publicDir, setPublicDir] = useState(false);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [cmp, setCmp] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>({ refresh_days: 7, public_read: false });
  const [team, setTeam] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ m: string; k: number } | null>(null);
  const t = STRINGS[lang];

  // preferences
  useEffect(() => {
    setLangS(ls.get('lang', 'ar'));
    setViewS(ls.get('view', 'grid'));
    const th = document.documentElement.dataset.theme;
    setDark(th ? th === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches);
    if (!LIVE) setFavs(new Set(ls.get<string[]>('favs', [])));
  }, []);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
  const setLang = (l: Lang) => { setLangS(l); ls.set('lang', l); };
  const setView = (v: 'grid' | 'list') => { setViewS(v); ls.set('view', v); };
  const toggleTheme = () => { const n = dark ? 'light' : 'dark'; document.documentElement.dataset.theme = n; ls.set('theme', n); setDark(!dark); };

  const tRef = useRef<any>();
  const toast = useCallback((m: string) => { setMsg({ m, k: Date.now() }); clearTimeout(tRef.current); tRef.current = setTimeout(() => setMsg(null), 2600); }, []);

  // ---------- live data ----------
  const reload = useCallback(async () => {
    const s = sb(); if (!s) return;
    const { data, error } = await s.from('companies').select('*').order('created_at', { ascending: false });
    if (!error && data) setRows(data as Row[]);
    const st = await s.from('settings').select('refresh_days,public_read').eq('id', 1).maybeSingle();
    if (st.data) { setSettings(st.data as Settings); setPublicDir(!!st.data.public_read); }
  }, []);

  const afterAuth = useCallback(async (mail: string | null) => {
    const s = sb()!;
    setEmail(mail);
    if (mail) {
      const { data } = await s.rpc('is_member');
      setMember(!!data);
      const f = await s.from('favorites').select('company_id');
      if (f.data) setFavs(new Set(f.data.map((r: any) => r.company_id)));
    } else { setMember(false); setFavs(new Set(ls.get<string[]>('favs', []))); }
    await reload();
    setReady(true);
  }, [reload]);

  useEffect(() => {
    if (!LIVE) return;
    const s = sb()!;
    s.auth.getSession().then(({ data }) => afterAuth(data.session?.user?.email ?? null));
    const { data: sub } = s.auth.onAuthStateChange((_e, session) => { afterAuth(session?.user?.email ?? null); });
    return () => sub.subscription.unsubscribe();
  }, [afterAuth]);

  // Poll while something is being fetched
  const active = rows.some(r => r.status === 'queued' || r.status === 'running');
  useEffect(() => {
    if (!LIVE || !ready) return;
    const id = setInterval(() => { if (!document.hidden) reload(); }, active ? 5000 : 60000);
    return () => clearInterval(id);
  }, [active, ready, reload]);

  const dispatch = async (body: any) => {
    const s = sb(); if (!s) return false;
    const { data } = await s.auth.getSession();
    try {
      const r = await fetch('/api/dispatch', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (data.session?.access_token || '') }, body: JSON.stringify(body) });
      const j = await r.json(); return !!j.dispatched;
    } catch { return false; }
  };

  // ---------- demo fetch simulation ----------
  const timers = useRef<Record<string, any>>({});
  const simulate = (id: string, final: Partial<Row>, stopAt = 5) => {
    clearInterval(timers.current[id]);
    setRows(rs => rs.map(r => r.id === id ? { ...r, status: 'running', stage: 0, run_at: new Date().toISOString() } : r));
    let stage = 0;
    timers.current[id] = setInterval(() => {
      if (stage >= stopAt) {
        clearInterval(timers.current[id]);
        setRows(rs => rs.map(r => r.id === id ? { ...r, ...final, stage: stopAt, fetched_at: new Date().toISOString() } : r));
        return;
      }
      stage++;
      setRows(rs => rs.map(r => r.id === id ? { ...r, stage } : r));
    }, 900);
  };
  const demoFinal = (r: Row): [Partial<Row>, number] =>
    r.slug === 'ogbees' ? [{ status: 'failed' }, 0] : r.slug === 'blabla-studio' ? [{ status: 'partial' }, 2] : r.demo ? [{ status: 'partial', issues: ['demo'] }, 5] : [{ status: 'done' }, 5];

  // ---------- actions ----------
  const addLinks: Ctx['addLinks'] = async items => {
    const now = new Date().toISOString();
    const make = (n: Norm, i: number): Row => {
      const name = nameFrom(n);
      return {
        id: LIVE ? undefined as any : 'local-' + Date.now().toString(36) + i, slug: slugify(name) + '-' + Math.random().toString(36).slice(2, 6),
        dedupe_key: n.key!, input_url: n.url!, name, domain: n.kind === 'website' ? n.disp! : null, website: n.kind === 'website' ? n.url! : null,
        description: null, description_source: null, logo_url: null, category: 'none', countries: [], founded: null, services: [],
        links: n.kind !== 'website' ? { [n.kind!]: n.url! } : {}, followers: {}, followers_total: 0, growth_30d: null, spark: [],
        sortlist_url: null, sortlist_rating: null, sortlist_reviews: null, status: 'queued', stage: 0, issues: [], overrides: {}, hidden: false,
        created_by: email, created_at: now, fetched_at: null, run_at: null, demo: !LIVE
      };
    };
    if (!LIVE) {
      const made = items.map(make);
      setRows(rs => [...made, ...rs]);
      made.forEach(r => setTimeout(() => simulate(r.id, { status: 'partial', issues: ['demo'] }), 300));
      return { added: made.length, failed: 0, dispatched: true };
    }
    const s = sb()!;
    let added = 0, failed = 0;
    for (const [i, n] of items.entries()) {
      const r = make(n, i); delete (r as any).id; delete (r as any).demo;
      const { error } = await s.from('companies').insert(r);
      if (error) failed++; else added++;
    }
    await reload();
    const dispatched = added ? await dispatch({ mode: 'queued' }) : false;
    return { added, failed, dispatched };
  };

  const saveEdit: Ctx['saveEdit'] = async (id, patch) => {
    if (!LIVE) { setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r)); return true; }
    const { error } = await sb()!.from('companies').update(patch).eq('id', id);
    await reload(); return !error;
  };
  const remove: Ctx['remove'] = async id => {
    if (LIVE) await sb()!.from('companies').delete().eq('id', id);
    setRows(rs => rs.filter(r => r.id !== id)); setCmp(c => c.filter(x => x !== id));
  };
  const retry: Ctx['retry'] = async id => {
    if (!LIVE) { const r = rows.find(x => x.id === id); if (r) { const [f, at] = demoFinal(r); simulate(id, f, at); } return; }
    await sb()!.from('companies').update({ status: 'queued', stage: 0 }).eq('id', id);
    await reload();
    const ok = await dispatch({ mode: 'queued', company_id: id });
    if (!ok) toast(t.queuedLater);
  };
  const refreshAll: Ctx['refreshAll'] = async () => {
    if (!LIVE) { rows.forEach(r => { const [f, at] = demoFinal(r); simulate(r.id, f, at); }); return; }
    await sb()!.from('companies').update({ status: 'queued', stage: 0 }).neq('status', 'running');
    await reload();
    const ok = await dispatch({ mode: 'queued' });
    toast(ok ? t.refreshing : t.queuedLater);
  };

  const toggleFav = (id: string) => {
    const on = !favs.has(id);
    const next = new Set(favs); on ? next.add(id) : next.delete(id); setFavs(next);
    // Visitors without an account keep their shortlist in this browser
    if (!LIVE || !email) { ls.set('favs', [...next]); return; }
    const s = sb()!;
    on ? s.from('favorites').insert({ company_id: id }).then(() => {}) : s.from('favorites').delete().eq('company_id', id).then(() => {});
  };
  const toggleCmp = (id: string) => {
    if (cmp.includes(id)) setCmp(cmp.filter(x => x !== id));
    else if (cmp.length >= 3) toast(t.maxCmp);
    else setCmp([...cmp, id]);
  };

  const saveSettings: Ctx['saveSettings'] = async p => {
    const next = { ...settings, ...p }; setSettings(next); setPublicDir(next.public_read);
    if (LIVE) await sb()!.from('settings').update(p).eq('id', 1);
  };
  const loadTeam = async () => {
    if (!LIVE) { setTeam(['you@example.com']); return; }
    const { data } = await sb()!.from('team_members').select('email').order('added_at');
    setTeam((data || []).map((r: any) => r.email));
  };
  const addMember = async (e: string) => {
    if (!LIVE) { setTeam(tm => [...tm, e]); return true; }
    const { error } = await sb()!.from('team_members').insert({ email: e.trim().toLowerCase() });
    await loadTeam(); return !error;
  };
  const removeMember = async (e: string) => { if (LIVE) await sb()!.from('team_members').delete().eq('email', e); await loadTeam(); if (!LIVE) setTeam(tm => tm.filter(x => x !== e)); };

  const signIn = async (e: string) => {
    const { error } = await sb()!.auth.signInWithOtp({ email: e.trim(), options: { emailRedirectTo: window.location.origin + window.location.pathname } });
    return error ? error.message : null;
  };
  const signOut = async () => { await sb()?.auth.signOut(); };

  const history = async (id: string) => {
    if (!LIVE) return [];
    const { data } = await sb()!.from('snapshots').select('day,total').eq('company_id', id).order('day');
    return (data || []) as any;
  };

  const companies = useMemo(() => rows.map(r => {
    const c = view(r);
    if (r.demo && r.status === 'partial') (c as any).reason = DEMO_REASON;
    return c;
  }), [rows]);

  const value: Ctx = {
    t, lang, setLang, toggleTheme, dark, view: viewMode, setView, live: LIVE, ready, email, member, publicDir,
    companies, reload, favs, toggleFav, cmp, toggleCmp, clearCmp: () => setCmp([]), toast,
    addLinks, saveEdit, remove, retry, refreshAll, settings, saveSettings, team, loadTeam, addMember, removeMember, signIn, signOut, history
  };
  return (
    <C.Provider value={value}>
      {children}
      <div className={'toast' + (msg ? ' show' : '')} role="status">{msg?.m}</div>
    </C.Provider>
  );
}
