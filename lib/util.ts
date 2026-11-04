import type { Lang } from './meta';

export const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n);

export const initials = (n: string) =>
  (n || '?').replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export const hue = (s: string) => { let h = 0; for (const ch of s || '') h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

const loc = (lang: Lang) => (lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');
export const fmtDate = (iso: string, lang: Lang) => (iso ? new Date(iso).toLocaleDateString(loc(lang), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtShort = (d: Date, lang: Lang) => d.toLocaleDateString(loc(lang), { day: 'numeric', month: 'short' });
export function rel(iso: string | null, lang: Lang) {
  if (!iso) return '—';
  const d = (new Date(iso).getTime() - Date.now()) / 1000, a = Math.abs(d);
  const r = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
  if (a < 45) return r.format(0, 'second');
  if (a < 3600) return r.format(Math.round(d / 60), 'minute');
  if (a < 86400) return r.format(Math.round(d / 3600), 'hour');
  return r.format(Math.round(d / 86400), 'day');
}

// ---- links (mirrors scraper/lib.mjs) ----
export const SOCIAL: Record<string, string> = {
  'instagram.com': 'instagram', 'linkedin.com': 'linkedin', 'facebook.com': 'facebook', 'fb.com': 'facebook', 'x.com': 'x', 'twitter.com': 'x',
  'tiktok.com': 'tiktok', 'youtube.com': 'youtube', 'behance.net': 'behance', 'dribbble.com': 'dribbble',
  'sortlist.com': 'sortlist', 'sortlist.co.uk': 'sortlist', 'sortlist.fr': 'sortlist', 'sortlist.be': 'sortlist'
};
export type Norm = { key?: string; kind?: string; url?: string; disp?: string; bad?: boolean };
export function normalize(raw: string): Norm {
  let u = String(raw || '').trim();
  if (!u) return { bad: true };
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  let x: URL;
  try { x = new URL(u); } catch { return { bad: true }; }
  const h = x.hostname.replace(/^(www|m)\./, '').toLowerCase();
  if (!/\.[a-z]{2,}$/.test(h)) return { bad: true };
  const soc = Object.keys(SOCIAL).find(s => h === s || h.endsWith('.' + s));
  if (soc) {
    const p = decodeURIComponent(x.pathname).replace(/\/+$/, '').toLowerCase();
    if (!p) return { bad: true };
    return { key: soc + p, kind: SOCIAL[soc], url: x.origin + x.pathname, disp: soc + p };
  }
  return { key: h, kind: 'website', url: 'https://' + x.hostname + '/', disp: h };
}
export function nameFrom(n: Norm) {
  const s = n.kind === 'website' ? n.disp.split('.')[0] : (n.disp.split('/').filter(Boolean).pop() || n.disp);
  return s.replace(/^@/, '').replace(/[._-]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase()).trim();
}
export function handleOf(url: string, kind: string) {
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean);
    if (kind === 'linkedin' || kind === 'sortlist') return decodeURIComponent(p[1] || p[0] || '');
    return '@' + decodeURIComponent(p[0] || '').replace(/^@/, '');
  } catch { return url; }
}
export const slugify = (s: string) =>
  String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'company';
