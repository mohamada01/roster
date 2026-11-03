// Free, best-effort follower counts. Every function returns
// { count, extra } or { count: null, reason }. Platforms change their pages
// often and some block automated reads, so a null here is normal and the
// dashboard lets the team type the number in by hand.
import { get, handleOf, parseCount } from './lib.mjs';

const ok = (count, extra) => (count == null ? { count: null, reason: 'not_found' } : { count, extra });

export function parseInstagramJson(text) {
  try {
    const u = JSON.parse(text).data.user;
    return { count: u.edge_followed_by.count, externalUrl: u.external_url || null };
  } catch { return null; }
}
export function parseMetaFollowers(html) {
  // e.g. <meta content="12K Followers, 300 Following, 900 Posts ..."> or "Stork | 8,900 followers on LinkedIn"
  const m = html.match(/([\d][\d.,]*\s*[KkMm]?)\s*(?:Followers|followers|متابع)/);
  return m ? parseCount(m[1]) : null;
}
export function parseTikTok(html) {
  const m = html.match(/"followerCount"\s*:\s*(\d+)/);
  return m ? +m[1] : null;
}
export function parseYouTube(html) {
  const m = html.match(/"subscriberCountText"\s*:\s*\{[^}]*?"simpleText"\s*:\s*"([^"]+)"/) ||
            html.match(/([\d][\d.,]*\s*[KkMm]?)\s+subscribers/);
  return m ? parseCount(m[1]) : null;
}
export function parseFacebook(html) {
  const m = html.match(/([\d][\d.,]*\s*[KkMm]?)\s+(?:followers|people follow this|likes)/i);
  return m ? parseCount(m[1]) : null;
}
export function parseBehance(html) {
  const m = html.match(/"followers"\s*:\s*\{?\s*"?(?:count|total)?"?\s*:?\s*(\d+)/) || html.match(/([\d][\d.,]*\s*[KkMm]?)\s*<\/[^>]+>\s*(?:<[^>]+>\s*)*Followers/i);
  return m ? parseCount(m[1]) : null;
}
export function parseDribbble(html) {
  const m = html.match(/"followers_count"\s*:\s*(\d+)/) || html.match(/([\d][\d.,]*\s*[KkMm]?)\s*(?:<\/[^>]+>\s*(?:<[^>]+>\s*)*)?\s*followers/i);
  return m ? parseCount(m[1]) : null;
}

export async function instagram(url) {
  const h = handleOf(url);
  if (!h) return { count: null, reason: 'bad_link' };
  const api = await get(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(h)}`, {
    headers: { 'x-ig-app-id': '936619743392459', accept: '*/*' }
  });
  const j = api.ok ? parseInstagramJson(api.text) : null;
  if (j) return { count: j.count, extra: { externalUrl: j.externalUrl } };
  const page = await get(`https://www.instagram.com/${encodeURIComponent(h)}/`);
  return page.ok ? ok(parseMetaFollowers(page.text)) : { count: null, reason: 'blocked' };
}

export async function tiktok(url) {
  const h = handleOf(url);
  const r = await get(`https://www.tiktok.com/@${encodeURIComponent(h)}`);
  return r.ok ? ok(parseTikTok(r.text)) : { count: null, reason: 'blocked' };
}

export async function youtube(url) {
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    const h = handleOf(url);
    const q = h.startsWith('UC') ? `id=${h}` : `forHandle=${encodeURIComponent('@' + h.replace(/^@/, ''))}`;
    const r = await get(`https://www.googleapis.com/youtube/v3/channels?part=statistics&${q}&key=${key}`);
    try { const c = JSON.parse(r.text).items[0].statistics.subscriberCount; return ok(+c); } catch { /* fall through */ }
  }
  const r = await get(url, { headers: { cookie: 'CONSENT=YES+1' } });
  return r.ok ? ok(parseYouTube(r.text)) : { count: null, reason: 'blocked' };
}

export async function linkedin(url) {
  const r = await get(url);
  return r.ok ? ok(parseMetaFollowers(r.text)) : { count: null, reason: 'blocked' };
}

export async function facebook(url) {
  const r = await get(url);
  return r.ok ? ok(parseFacebook(r.text) ?? parseMetaFollowers(r.text)) : { count: null, reason: 'blocked' };
}

export async function behance(url) {
  const r = await get(url);
  return r.ok ? ok(parseBehance(r.text)) : { count: null, reason: 'blocked' };
}

export async function dribbble(url) {
  const r = await get(url);
  return r.ok ? ok(parseDribbble(r.text)) : { count: null, reason: 'blocked' };
}

// X (Twitter) has no free way to read follower counts any more.
export async function x() { return { count: null, reason: 'no_free_source' }; }

export const FETCHERS = { instagram, tiktok, youtube, linkedin, facebook, behance, dribbble, x };
