// Entry point, run by GitHub Actions.
//   MODE=queued   -> companies the team just added (default)
//   MODE=scheduled-> queued + any company older than settings.refresh_days
//   MODE=all      -> every company
//   COMPANY_ID=…  -> just one company
import { createClient } from '@supabase/supabase-js';
import { readSite, closeBrowser } from './site.mjs';
import { FETCHERS } from './platforms.mjs';
import { readSortlist, discoverSortlist } from './sortlist.mjs';
import { classify } from './classify.mjs';
import { normalize, platformOf, isProfileLink, PLATFORMS, hostOf, sleep } from './lib.mjs';

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

async function processCompany(c) {
  console.log(`\n▶ ${c.name || c.input_url}`);
  const issues = [];
  const links = { ...(c.links || {}) };
  const input = normalize(c.input_url);
  if (input.kind && input.kind !== 'website' && !links[input.kind]) links[input.kind] = input.url;
  let website = c.website || (input.kind === 'website' ? input.url : null);
  await upd(c.id, { status: 'running', stage: 0, run_at: new Date().toISOString() });

  // 0. Website. A social-only company may reveal its site in the Instagram bio.
  const followers = {};
  const cache = {};
  if (!website && links.instagram) {
    cache.instagram = await FETCHERS.instagram(links.instagram);
    const ext = cache.instagram.extra && cache.instagram.extra.externalUrl;
    if (ext && !platformOf(ext) && !/linktr\.ee|beacons\.ai|bio\.link|wa\.me/i.test(ext)) website = normalize(ext).url;
  }
  let site = null;
  if (website) {
    site = await readSite(website);
    if (site.error) { issues.push(site.error); site = null; }
    else if (!site.description) issues.push('site_no_description');
  } else issues.push('no_website');
  await upd(c.id, { stage: 1 });

  // 1. Platform links from the site (links the team added win)
  if (site) for (const [k, u] of Object.entries(site.links)) if (!links[k] && isProfileLink(u)) links[k] = u;
  await upd(c.id, { stage: 2, links });

  // 2. Followers, one platform at a time
  for (const p of PLATFORMS) {
    if (!links[p]) continue;
    const r = cache[p] || await FETCHERS[p](links[p]).catch(() => ({ count: null, reason: 'error' }));
    followers[p] = r.count;
    console.log(`  ${p}: ${r.count ?? '— ' + (r.reason || '')}`);
    await sleep(1200);
  }
  const counted = Object.values(followers).filter(v => v != null).length;
  if (Object.keys(followers).length && !counted) issues.push('followers_blocked');
  else if (Object.keys(followers).length > counted) issues.push('followers_some_missing');
  await upd(c.id, { stage: 3 });

  // 3. Sortlist
  let sl = null;
  const slUrl = links.sortlist || c.sortlist_url;
  if (slUrl) { const r = await readSortlist(slUrl); if (!r.error) { const { html, ...rest } = r; sl = rest; } }
  else if (site && site.name) sl = await discoverSortlist(site.name, hostOf(website));
  if (sl) links.sortlist = sl.url;
  await upd(c.id, { stage: 4 });

  // 4. Category
  const category = site ? await classify(site.description, site.classifyText) : (c.category || 'none');

  const today = new Date().toISOString().slice(0, 10);
  const counts = Object.fromEntries(Object.entries(followers).filter(([, v]) => v != null));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const { spark, growth } = total ? await history(c.id, today, counts) : { spark: c.spark || [], growth: c.growth_30d };

  const hasCore = site && site.description;
  const status = !site && !total ? 'failed' : (hasCore && !issues.some(i => i === 'followers_blocked')) ? 'done' : 'partial';
  const name = (site && site.name) || c.name;

  await upd(c.id, {
    name, website: website || null, domain: website ? hostOf(website) : c.domain,
    description: site ? site.description : c.description,
    description_source: site ? site.descriptionSource : c.description_source,
    logo_url: site ? site.logo : c.logo_url,
    countries: site && site.countries.length ? site.countries : c.countries,
    services: site && site.services && site.services.length ? site.services : c.services,
    about: site ? site.about : c.about, about_source: site ? site.aboutSource : c.about_source,
    contact: site ? site.contact : c.contact,
    founded: (site && site.founded) || c.founded,
    links, followers, followers_total: total, spark, growth_30d: growth,
    sortlist_url: sl ? sl.url : c.sortlist_url, sortlist_rating: sl ? sl.rating : c.sortlist_rating, sortlist_reviews: sl ? sl.reviews : c.sortlist_reviews,
    category: category === 'none' ? c.category : category,
    status, stage: status === 'done' ? 5 : !site ? 0 : issues.includes('followers_blocked') ? 2 : 5, issues, fetched_at: new Date().toISOString()
  });
  console.log(`  → ${status}${issues.length ? ' (' + issues.join(', ') + ')' : ''}`);
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
