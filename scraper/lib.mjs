// Shared helpers: link normalisation, number parsing, HTTP.

export const SOCIAL = {
  'instagram.com': 'instagram', 'linkedin.com': 'linkedin', 'facebook.com': 'facebook', 'fb.com': 'facebook',
  'x.com': 'x', 'twitter.com': 'x', 'tiktok.com': 'tiktok', 'youtube.com': 'youtube', 'youtu.be': 'youtube',
  'behance.net': 'behance', 'dribbble.com': 'dribbble', 'sortlist.com': 'sortlist', 'sortlist.co.uk': 'sortlist',
  'sortlist.fr': 'sortlist', 'sortlist.be': 'sortlist'
};
export const PLATFORMS = ['instagram', 'linkedin', 'facebook', 'x', 'tiktok', 'youtube', 'behance', 'dribbble'];

// Paths that are posts, shares or generic pages rather than a profile
const NOT_PROFILE = /\/(sharer|share|intent|p|reel|reels|tv|stories|explore|hashtag|watch|status|posts|events|groups|dialog|plugins|login|signup|privacy|legal|help|jobs|search|shorts|feed|embed)(\/|$|\?)|share\.php|\/shots\//i;

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^(www|m|mobile|web|ar-ar|en-gb|business)\./, '').toLowerCase(); } catch { return null; }
}

export function platformOf(url) {
  const h = hostOf(url);
  if (!h) return null;
  const k = Object.keys(SOCIAL).find(s => h === s || h.endsWith('.' + s));
  return k ? SOCIAL[k] : null;
}

/** Normalise any pasted link. Returns { key, kind, url, disp } or { bad: true }. */
export function normalize(raw) {
  let u = String(raw || '').trim();
  if (!u) return { bad: true };
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  let x;
  try { x = new URL(u); } catch { return { bad: true }; }
  const h = x.hostname.replace(/^(www|m)\./, '').toLowerCase();
  if (!/\.[a-z]{2,}$/.test(h)) return { bad: true };
  const kind = platformOf(x.href);
  if (kind) {
    const p = decodeURIComponent(x.pathname).replace(/\/+$/, '').toLowerCase();
    if (!p) return { bad: true };
    const baseHost = Object.keys(SOCIAL).find(s => h === s || h.endsWith('.' + s));
    return { key: baseHost + p, kind, url: x.origin + x.pathname, disp: baseHost + p };
  }
  return { key: h, kind: 'website', url: 'https://' + x.hostname + '/', disp: h };
}

// Accounts of website builders and themes. Template footers link to these, not to the company.
const BUILDER_HANDLES = new Set(['wix', 'wixstudio', 'wix-com', 'wixcom', 'wixwebsites', 'squarespace', 'godaddy', 'wordpress', 'wordpressdotcom',
  'shopify', 'webflow', 'webflowapp', 'framer', 'framerjs', 'elementor', 'hostinger', 'envato', 'themeforest', 'hubspot', 'wpengine',
  'weebly', 'jimdo', 'strikingly', 'carrd', 'zyro', 'duda', 'bluehost', 'siteground', 'namecheap', 'canva', 'facebook', 'instagram',
  'linkedin', 'tiktok', 'youtube', 'twitter', 'x', 'behance', 'dribbble', 'meta', 'yourpage', 'yourcompany', 'username', 'company']);

/**
 * Turn a link found on a site into a clean profile link, or null when it isn't the company's profile:
 * TikTok video -> its account, LinkedIn admin page -> the company page, builder/template accounts -> null.
 */
export function cleanProfileLink(url) {
  const kind = platformOf(url);
  if (!kind) return null;
  let x;
  try { x = new URL(url); } catch { return null; }
  const parts = x.pathname.split('/').filter(Boolean);
  let handle = '';
  try { handle = decodeURIComponent((kind === 'linkedin' || (kind === 'youtube' && /^(c|channel|user)$/.test(parts[0] || '')) ? parts[1] : parts[0]) || ''); } catch { /* keep empty */ }
  handle = handle.replace(/^@/, '').toLowerCase();
  if (kind !== 'sortlist' && BUILDER_HANDLES.has(handle)) return null;
  if (kind === 'tiktok' && parts[0] && parts[0].startsWith('@')) return `https://www.tiktok.com/${parts[0]}`;
  if (kind === 'linkedin' && /^(company|school|showcase)$/.test(parts[0] || '') && parts[1]) return `https://www.linkedin.com/${parts[0]}/${parts[1]}/`;
  if (kind === 'facebook' && /^profile\.php$/i.test(parts[0] || '')) {
    const id = x.searchParams.get('id');
    return id && /^\d+$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null;
  }
  return isProfileLink(x.href) ? x.origin + x.pathname : null;
}

export function isProfileLink(url) {
  const kind = platformOf(url);
  if (!kind) return false;
  try {
    const x = new URL(url);
    if (kind === 'facebook' && /\/profile\.php$/i.test(x.pathname)) return !!x.searchParams.get('id');
    if (NOT_PROFILE.test(x.pathname + x.search)) return false;
    const parts = x.pathname.split('/').filter(Boolean);
    if (!parts.length) return false;
    if (kind === 'linkedin') return /^(company|school|showcase|in)$/.test(parts[0]) && parts.length >= 2;
    if (kind === 'youtube') return /^(@|c$|channel$|user$)/.test(parts[0]);
    if (kind === 'tiktok') return parts[0].startsWith('@');
    if (kind === 'sortlist') return /^(agency|agencies)$/.test(parts[0]) && parts.length >= 2;
    return true;
  } catch { return false; }
}

export function handleOf(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const kind = platformOf(url);
    if (kind === 'linkedin' || kind === 'sortlist') return decodeURIComponent(parts[1] || '');
    return decodeURIComponent(parts[0] || '').replace(/^@/, '');
  } catch { return ''; }
}

/** "12.3K" -> 12300, "1,204" -> 1204, "2.1M" -> 2100000, "1.2 ألف" not supported */
export function parseCount(s) {
  if (s == null) return null;
  const m = String(s).replace(/ /g, ' ').trim().match(/^([\d.,]+)\s*([KkMmBb])?/);
  if (!m) return null;
  let num = m[1];
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  if (mult > 1) num = num.replace(/,/g, '.');
  else num = num.replace(/[.,](?=\d{3}(\D|$))/g, '');
  const v = parseFloat(num.replace(/,/g, ''));
  return Number.isFinite(v) ? Math.round(v * mult) : null;
}

// An honest crawler identity. We never disguise the scraper as a person's browser.
export const UA = 'Mozilla/5.0 (compatible; RosterBot/1.0; +https://github.com/mohamada01/roster)';

export async function get(url, { headers = {}, timeout = 20000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, {
      redirect: 'follow', signal: ctl.signal,
      headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9,ar;q=0.8', accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8', ...headers }
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url, text };
  } catch (e) {
    return { ok: false, status: 0, url, text: '', error: String(e && e.message || e) };
  } finally { clearTimeout(t); }
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

const foldName = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
/**
 * Does a profile's display name belong to this company? Guards against a site linking someone else's
 * account (a template link, a typo, a taken handle). Names in non-Latin scripts can't be compared, so they pass.
 */
export function profileMatches(profileName, refs) {
  if (!profileName) return true;
  if (/[\u0600-\u06ff\u0400-\u04ff\u4e00-\u9fff]/.test(profileName)) return true;
  const n = foldName(profileName);
  if (n.length < 3) return true;
  const list = refs.map(foldName).filter(r => r.length >= 3);
  if (!list.length) return true;
  return list.some(r => {
    if (r.includes(n) || n.includes(r)) return true;
    for (let i = 0; i + 5 <= n.length; i++) if (r.includes(n.slice(i, i + 5))) return true;
    return false;
  });
}

