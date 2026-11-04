// Public profile data per platform: follower count plus name, bio, avatar and website.
// Only public pages and official APIs are used. When a platform shows a sign-in
// wall or blocks automated reads, we stop there and report it; we never try to get
// around it. The dashboard lets the team type a missing number in by hand.
//
// Every function returns { count, profile: { name, bio, avatar, website } } or
// { count: null, reason }.
import * as cheerio from 'cheerio';
import { get, handleOf, parseCount, platformOf } from './lib.mjs';

const clean = s => String(s || '').replace(/\s+/g, ' ').trim() || null;
const decodeJson = s => { try { return JSON.parse(`"${s}"`); } catch { return s; } };
const blocked = r => !r.ok || /\/(authwall|login|checkpoint|accounts\/login)/i.test(r.url || '') || r.status === 999;

function og(html) {
  const $ = cheerio.load(html);
  const m = n => $(`meta[property="${n}"]`).attr('content') || $(`meta[name="${n}"]`).attr('content') || null;
  return { $, title: m('og:title'), description: m('og:description') || m('description'), image: m('og:image') };
}

// ---------- parsers (pure, tested) ----------
export function parseMetaFollowers(html) {
  // e.g. "Stork | 8,900 followers on LinkedIn" or "12K Followers, 300 Following"
  const m = html.match(/([\d][\d.,]*\s*[KkMm]?)\s*(?:Followers|followers|متابع)/);
  return m ? parseCount(m[1]) : null;
}
export function parseTikTok(html) {
  const num = k => { const m = html.match(new RegExp(`"${k}"\\s*:\\s*(\\d+)`)); return m ? +m[1] : null; };
  const str = k => { const m = html.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)); return m ? decodeJson(m[1]) : null; };
  const link = html.match(/"bioLink"\s*:\s*\{[^}]*"link"\s*:\s*"([^"]+)"/);
  return {
    count: num('followerCount'),
    profile: { name: clean(str('nickname')), bio: clean(str('signature')), avatar: str('avatarLarger') || str('avatarMedium'), website: link ? decodeJson(link[1]) : null }
  };
}
export function parseYouTube(html) {
  const m = html.match(/"subscriberCountText"\s*:\s*\{[^}]*?"simpleText"\s*:\s*"([^"]+)"/) ||
            html.match(/([\d][\d.,]*\s*[KkMm]?)\s+subscribers/);
  const o = og(html);
  return { count: m ? parseCount(m[1]) : null, profile: { name: clean(o.title), bio: clean(o.description), avatar: o.image, website: null } };
}
export function parseLinkedIn(html) {
  const o = og(html), $ = o.$;
  const about = clean($('[data-test-id="about-us__description"]').first().text()) || clean($('section.about-us p').first().text());
  let website = $('[data-test-id="about-us__website"] a').attr('href') || null;
  if (website && /linkedin\.com\/redir/.test(website)) { try { website = new URL(website).searchParams.get('url'); } catch { /* keep */ } }
  // og:description looks like "Name | 1,234 followers on LinkedIn. Tagline | About text"
  let bio = about;
  if (!bio && o.description) bio = clean(o.description.replace(/^[^|]*\|\s*[\d.,KkMm]+\s*followers on LinkedIn\.?\s*/i, ''));
  const name = clean((o.title || '').replace(/\s*\|\s*LinkedIn\s*$/i, ''));
  return { count: parseMetaFollowers(o.description || '') ?? parseMetaFollowers(html), profile: { name, bio, avatar: o.image, website } };
}
export function parseOgProfile(html, suffix) {
  const o = og(html);
  const name = clean((o.title || '').replace(suffix || /$^/, ''));
  return { count: parseMetaFollowers(o.description || '') ?? parseMetaFollowers(html), profile: { name, bio: clean(o.description), avatar: o.image, website: null } };
}

// ---------- fetchers ----------

// Instagram: official Instagram Graph API "Business Discovery" only. Needs a free
// Meta developer app, an Instagram professional account and a token (see README).
export async function instagram(url) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN, me = process.env.INSTAGRAM_BUSINESS_ID;
  if (!token || !me) return { count: null, reason: 'needs_instagram_api' };
  const h = handleOf(url);
  const v = process.env.META_GRAPH_VERSION || 'v21.0';
  const fields = `business_discovery.username(${encodeURIComponent(h)}){username,name,biography,website,followers_count,profile_picture_url}`;
  const r = await get(`https://graph.facebook.com/${v}/${me}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
  try {
    const j = JSON.parse(r.text);
    if (j.error) return { count: null, reason: 'instagram_api: ' + (j.error.message || j.error.type) };
    const b = j.business_discovery;
    return { count: b.followers_count ?? null, profile: { name: clean(b.name) || b.username, bio: clean(b.biography), avatar: b.profile_picture_url || null, website: b.website || null } };
  } catch { return { count: null, reason: 'instagram_api_error' }; }
}

export async function linkedin(url) {
  const r = await get(url);
  if (blocked(r)) return { count: null, reason: 'sign_in_wall' };
  return parseLinkedIn(r.text);
}

export async function tiktok(url) {
  const r = await get(`https://www.tiktok.com/@${encodeURIComponent(handleOf(url))}`);
  if (blocked(r)) return { count: null, reason: 'blocked' };
  const p = parseTikTok(r.text);
  return p.count == null && !p.profile.name ? { count: null, reason: 'not_found' } : p;
}

export async function youtube(url) {
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    const h = handleOf(url);
    const q = h.startsWith('UC') ? `id=${h}` : `forHandle=${encodeURIComponent('@' + h.replace(/^@/, ''))}`;
    const r = await get(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${q}&key=${key}`);
    try {
      const it = JSON.parse(r.text).items[0];
      return { count: +it.statistics.subscriberCount, profile: { name: it.snippet.title, bio: clean(it.snippet.description), avatar: it.snippet.thumbnails?.high?.url || null, website: null } };
    } catch { /* fall back to the public page */ }
  }
  const r = await get(url);
  if (blocked(r)) return { count: null, reason: 'blocked' };
  return parseYouTube(r.text);
}

export async function facebook(url) {
  const r = await get(url);
  if (blocked(r)) return { count: null, reason: 'sign_in_wall' };
  const p = parseOgProfile(r.text, /\s*\|\s*Facebook\s*$/i);
  const likes = (p.profile.bio || '').match(/([\d][\d.,]*\s*[KkMm]?)\s+(?:likes|followers)/i);
  if (p.count == null && likes) p.count = parseCount(likes[1]);
  return p.count == null && !p.profile.name ? { count: null, reason: 'sign_in_wall' } : p;
}

export async function behance(url) {
  const r = await get(url);
  if (blocked(r)) return { count: null, reason: 'blocked' };
  const p = parseOgProfile(r.text, /\s+on\s+Behance\s*$/i);
  const m = r.text.match(/"followers"\s*:\s*\{?\s*"?(?:count|total)?"?\s*:?\s*(\d+)/);
  if (p.count == null && m) p.count = +m[1];
  return p;
}

export async function dribbble(url) {
  const r = await get(url);
  if (blocked(r)) return { count: null, reason: 'blocked' };
  const p = parseOgProfile(r.text, /\s*\|\s*Dribbble\s*$/i);
  const m = r.text.match(/"followers_count"\s*:\s*(\d+)/);
  if (m) p.count = +m[1];
  return p;
}

// X (Twitter) has no free way to read follower counts.
export async function x() { return { count: null, reason: 'no_free_source' }; }

export const FETCHERS = { instagram, tiktok, youtube, linkedin, facebook, behance, dribbble, x };

/** A usable website found on a profile (not another social link or a link-in-bio page). */
export function websiteFromProfile(p) {
  const w = p && p.profile && p.profile.website;
  if (!w || platformOf(w) || /linktr\.ee|beacons\.ai|bio\.link|wa\.me|linkin\.bio|taplink|campsite\.bio/i.test(w)) return null;
  return /^https?:\/\//i.test(w) ? w : 'https://' + w;
}
