// Entry point, run by GitHub Actions.
//   MODE=queued   -> companies the team just added (default)
//   MODE=scheduled-> queued + any company older than settings.refresh_days
//   MODE=all      -> every company
//   COMPANY_ID=…  -> just one company
import { createClient } from '@supabase/supabase-js';
import { readSite, closeBrowser, isGenericName, nameFromDomain, domainCore } from './site.mjs';
import { firstGoodLogo } from './logo.mjs';
import { FETCHERS, websiteFromProfile } from './platforms.mjs';
import { readSortlist, discoverSortlist } from './sortlist.mjs';
import { classify } from './classify.mjs';
import { normalize, platformOf, cleanProfileLink, profileMatches, PLATFORMS, hostOf, handleOf, sleep } from './lib.mjs';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Add them under the repo Settings > Secrets and variables > Actions.');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const MODE = process.env.MODE || 'queued';
const ONLY = process.env.COMPANY_ID || '';

async function upd(id, patch) {
  const { error } = await sb.from('companies').update(patch).eq('id', id);
  if (error) console.error('update failed', id, error.message);
}

// Any database error stops the run with a clear message instead of silently doing nothing
function must({ data, error }, what) {
  if (error) {
    console.error(`\n✖ Could not ${what}: ${error.message}`);
    if (/invalid api key|jwt|unauthorized|no api key/i.test(error.message + ' ' + (error.code || '')))
      console.error('  Check the SUPABASE_SECRET_KEY secret: it must be the Supabase secret key (starts with sb_secret_).');
    process.exit(1);
  }
  return data || [];
}

async function targets() {
  must(await sb.from('settings').select('id').limit(1), 'connect to the database');
  if (ONLY) return must(await sb.from('companies').select('*').eq('id', ONLY), 'read the company');
  // Pick up rows left "running" by a run that was cancelled
  const stale = new Date(Date.now() - 2 * 3600e3).toISOString();
  await sb.from('companies').update({ status: 'queued' }).eq('status', 'running').lt('run_at', stale);
  const queued = must(await sb.from('companies').select('*').eq('status', 'queued').order('created_at'), 'read queued companies');
  if (MODE === 'queued') return queued;
  if (MODE === 'all') return must(await sb.from('companies').select('*').order('created_at'), 'read companies');
  const { data: s } = await sb.from('settings').select('refresh_days').eq('id', 1).single();
  const days = (s && s.refresh_days) || 7;
  const cutoff = new Date(Date.now() - (days - 0.25) * 864e5).toISOString();
  const old = must(await sb.from('companies').select('*').neq('status', 'queued').or(`fetched_at.is.null,fetched_at.lt.${cutoff}`), 'read companies due for refresh');
  return [...queued, ...old];
}

async function history(id, today, followers) {
  await sb.from('snapshots').upsert({ company_id: id, day: today, total: Object.values(followers).reduce((a, b) => a + (b || 0), 0), followers }, { onConflict: 'company_id,day' });
  const { data } = await sb.from('snapshots').select('day,total').eq('company_id', id).order('day', { ascending: false }).limit(60);
  const rows = (data || []).filter(r => r.total > 0);
  const spark = rows.slice(0, 8).map(r => r.total).reverse();
  let growth = null;
  if (rows.length > 1) {
    const now = rows[0];
    const target = Date.parse(now.day) - 30 * 864e5;
    const then = rows.find(r => Date.parse(r.day) <= target + 2 * 864e5) || null;
    if (then && then.total > 0) growth = Math.round(((now.total - then.total) / then.total) * 1000) / 10;
  }
  return { spark, growth };
}

// Which profile to trust first for name, description and logo when the website can't be used
const PROFILE_ORDER = ['linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'behance', 'dribbble'];
const PROFILE_SOURCE = { linkedin: 'linkedin profile', instagram: 'instagram profile', facebook: 'facebook profile', tiktok: 'tiktok profile', youtube: 'youtube profile', behance: 'behance profile', dribbble: 'dribbble profile' };

async function fetchProfiles(links, done, profiles, followers, refs) {
  for (const p of PLATFORMS) {
    if (!links[p] || done.has(p)) continue;
    done.add(p);
    const r = await FETCHERS[p](links[p]).catch(() => ({ count: null, reason: 'error' }));
    const name = r.profile && r.profile.name;
    if (name && !profileMatches(name, refs())) {
      // Someone else's account: don't count it and don't show it
      console.log(`  ${p}: ✗ skipped, the profile is "${name}", not this company`);
      delete links[p];
      await sleep(1200);
      continue;
    }
    followers[p] = r.count ?? null;
    if (r.profile) profiles[p] = r.profile;
    console.log(`  ${p}: ${r.count ?? '— ' + (r.reason || '')}${name ? ' · ' + name : ''}`);
    await sleep(1200);
  }
}

/** Readable name when nothing better is known: the domain, or the handle of a social link. */
function fallbackName(c, website, input) {
  if (c.name && !isGenericName(c.name) && !/^[\w.-]+\.[a-z]{2,}\/?$/i.test(c.name) && !/^https?:/i.test(c.name)) return c.name;
  if (website) return nameFromDomain(website);
  if (input.kind && input.kind !== 'website') {
    const h = handleOf(input.url).replace(/[._-]+/g, ' ').trim();
    return h ? h.replace(/\b\w/g, ch => ch.toUpperCase()) : c.name;
  }
  return nameFromDomain(c.input_url) || c.name;
}

async function processCompany(c) {
  console.log(`\n▶ ${c.name || c.input_url}`);
  const issues = [];
  // Stored links, cleaned: builder/template accounts dropped, video and admin links turned into the profile
  const links = {};
  for (const [k, u] of Object.entries(c.links || {})) { const clean = cleanProfileLink(u); if (clean) links[k] = clean; }
  const input = normalize(c.input_url);
  if (input.kind && input.kind !== 'website' && !links[input.kind]) links[input.kind] = input.url;
  let website = c.website || (input.kind === 'website' ? input.url : null);
  await upd(c.id, { status: 'running', stage: 0, run_at: new Date().toISOString() });

  // 0. Website
  let site = null, siteProblem = null;
  if (website) {
    site = await readSite(website);
    if (site.error) { siteProblem = site.error; site = null; }
  }
  await upd(c.id, { stage: 1 });

  // 1. Platform links from the site (links the team added win)
  if (site) for (const [k, u] of Object.entries(site.links)) if (!links[k]) links[k] = u;
  await upd(c.id, { stage: 2, links });

  // 2. Social profiles: followers, and name/bio/logo/website for the fallback
  const followers = {}, profiles = {}, done = new Set();
  const refs = () => [site && site.name, website && domainCore(website), domainCore(c.input_url), c.overrides && c.overrides.name,
    input.kind && input.kind !== 'website' ? handleOf(input.url) : null, !isGenericName(c.name) ? c.name : null].filter(Boolean);
  await fetchProfiles(links, done, profiles, followers, refs);

  // No usable website? Look for one on the profiles and read it
  if (!site) {
    const found = PROFILE_ORDER.map(p => websiteFromProfile({ profile: profiles[p] })).find(w => w && hostOf(w) !== hostOf(website || ''));
    if (found) {
      console.log(`  website from profile: ${found}`);
      const s2 = await readSite(found);
      if (!s2.error) {
        site = s2; website = normalize(found).url; siteProblem = null;
        for (const [k, u] of Object.entries(site.links)) if (!links[k]) links[k] = u;
        await fetchProfiles(links, done, profiles, followers, refs);
      }
    }
  }
  if (!site) issues.push(siteProblem || 'no_website');
  else if (!site.description) issues.push('site_no_description');

  const counted = Object.values(followers).filter(v => v != null).length;
  if (Object.keys(followers).length && !counted) issues.push('followers_blocked');
  else if (Object.keys(followers).length > counted) issues.push('followers_some_missing');
  await upd(c.id, { stage: 3 });

  // Fallbacks from the profiles, always verbatim
  const firstProfile = field => { for (const p of PROFILE_ORDER) { const v = profiles[p] && profiles[p][field]; if (v) return { v, p }; } return null; };
  let description = site && site.description, descriptionSource = site && site.descriptionSource;
  if (!description) { const b = firstProfile('bio'); if (b) { description = b.v; descriptionSource = PROFILE_SOURCE[b.p]; } }
  let name = site && site.name;
  if (!name) { const n = firstProfile('name'); name = n ? n.v : null; }
  // Logo: the first site logo that really loads, then a profile picture, then the site's small icon
  let logo = null, logoTone = null, logoFrom = '-';
  const pick = async (cands, from) => { if (logo) return; const g = await firstGoodLogo(cands); if (g) { logo = g.url; logoTone = g.tone; logoFrom = from; } };
  if (site) await pick(site.logoCandidates.filter(x => x.quality === 'good'), 'site');
  await pick(PROFILE_ORDER.map(p => profiles[p] && profiles[p].avatar).filter(Boolean), 'profile');
  if (site) await pick(site.logoCandidates.filter(x => x.quality !== 'good'), 'site icon');

  // 3. Sortlist
  let sl = null;
  const slUrl = links.sortlist || c.sortlist_url;
  if (slUrl) { const r = await readSortlist(slUrl); if (!r.error) { const { html, ...rest } = r; sl = rest; } }
  else if (site && site.name && website) sl = await discoverSortlist(site.name, hostOf(website));
  if (sl) links.sortlist = sl.url;
  await upd(c.id, { stage: 4 });

  // 4. Category, from the site or, without one, from the profile bios
  const bios = Object.values(profiles).map(p => p.bio).filter(Boolean).join(' ');
  const category = description ? await classify(description, (site ? site.classifyText : '') + ' ' + bios) : 'none';

  const today = new Date().toISOString().slice(0, 10);
  const counts = Object.fromEntries(Object.entries(followers).filter(([, v]) => v != null));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const { spark, growth } = total ? await history(c.id, today, counts) : { spark: c.spark || [], growth: c.growth_30d };

  const status = !description && !total ? 'failed' : (description && !issues.includes('followers_blocked')) ? 'done' : 'partial';

  await upd(c.id, {
    name: name || fallbackName(c, website, input), website: website || null, domain: website ? hostOf(website) : c.domain,
    description: description || null, description_source: descriptionSource || null,
    logo_url: logo || null, logo_tone: logoTone,
    countries: site && site.countries.length ? site.countries : c.countries,
    services: site && site.services && site.services.length ? site.services : (site ? [] : c.services),
    about: site ? site.about : null, about_source: site ? site.aboutSource : null,
    contact: site ? site.contact : {},
    founded: (site && site.founded) || c.founded,
    links, followers, followers_total: total, spark, growth_30d: growth,
    sortlist_url: sl ? sl.url : c.sortlist_url, sortlist_rating: sl ? sl.rating : c.sortlist_rating, sortlist_reviews: sl ? sl.reviews : c.sortlist_reviews,
    category: category === 'none' ? c.category : category,
    status, stage: status === 'done' ? 5 : !description ? 0 : issues.includes('followers_blocked') ? 2 : 5, issues, fetched_at: new Date().toISOString()
  });
  console.log(`  → ${status}${issues.length ? ' (' + issues.join(', ') + ')' : ''} · ${name || fallbackName(c, website, input) || '?'} · desc from ${descriptionSource || '-'} · logo ${logoFrom}${logoTone ? ' (' + logoTone + ')' : ''}`);
}

const list = await targets();
console.log(`Mode ${MODE}: ${list.length} compan${list.length === 1 ? 'y' : 'ies'} to fetch`);
for (const c of list) {
  try { await processCompany(c); }
  catch (e) {
    console.error('  ✖', e);
    await upd(c.id, { status: 'failed', stage: 0, issues: ['error'], fetched_at: new Date().toISOString() });
  }
}
await closeBrowser();
// Touch the database every run so the free Supabase project never pauses
await sb.from('settings').select('id').limit(1);
console.log('\nDone.');
