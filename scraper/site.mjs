// Reads a company website: name, verbatim description, logo, platform links,
// services, About text, contact details, country hints and founding year.
// Falls back to a real browser for sites that build their content with JavaScript.
// Every text field is copied verbatim from the site; nothing is rewritten.
import * as cheerio from 'cheerio';
import { get, isProfileLink, cleanProfileLink, platformOf, PLATFORMS } from './lib.mjs';

const COUNTRY_WORDS = [
  [/\b(cairo|egypt|alexandria|giza)\b|القاهرة|مصر/i, 'EG'],
  [/\b(riyadh|jeddah|saudi|ksa|dammam|khobar)\b|الرياض|السعودية|جدة/i, 'SA'],
  [/\b(dubai|abu dhabi|uae|sharjah|united arab emirates)\b|دبي|الإمارات|أبوظبي/i, 'AE'],
  [/\b(london|united kingdom|manchester)\b|لندن/i, 'GB'],
  [/\b(doha|qatar)\b|الدوحة|قطر/i, 'QA'],
  [/\b(kuwait)\b|الكويت/i, 'KW'],
  [/\b(amman|jordan)\b|عمّان|الأردن/i, 'JO'],
  [/\b(beirut|lebanon)\b|بيروت|لبنان/i, 'LB'],
  [/\b(manama|bahrain)\b|البحرين/i, 'BH'],
  [/\b(muscat|oman)\b|مسقط|عُمان/i, 'OM'],
  [/\b(casablanca|morocco|rabat)\b|المغرب/i, 'MA'],
  [/\b(new york|los angeles|usa|united states)\b/i, 'US']
];
const ISO2 = { egypt: 'EG', 'saudi arabia': 'SA', 'united arab emirates': 'AE', uae: 'AE', 'united kingdom': 'GB', uk: 'GB', qatar: 'QA', kuwait: 'KW', jordan: 'JO', lebanon: 'LB', bahrain: 'BH', oman: 'OM', morocco: 'MA', 'united states': 'US', usa: 'US' };
const DIAL = [['20', 'EG'], ['966', 'SA'], ['971', 'AE'], ['44', 'GB'], ['974', 'QA'], ['965', 'KW'], ['962', 'JO'], ['961', 'LB'], ['973', 'BH'], ['968', 'OM'], ['212', 'MA']];

const ABOUT_PATH = /^\/(?:[a-z]{2}\/)?(about|about-us|who-we-are|our-story|story|company|agency|من-نحن)\/?$/i;
const SERVICES_PATH = /^\/(?:[a-z]{2}\/)?(services|our-services|what-we-do|solutions|capabilities|expertise|packages|marketing-solutions|خدمات|خدماتنا)\/?$/i;
const SERVICES_HEAD = /services|what we do|our expertise|capabilities|solutions|packages|خدمات|خدماتنا/i;
const NOT_SERVICE = /^(home|about|contact|get started|read more|learn more|view all|see all|faq|faqs|testimonials?|clients?|our clients|our work|work|portfolio|blog|careers?|let'?s talk|subscribe|follow us|menu|services|our services|what we do|packages & services|feedback|login|sign ?up|privacy|terms|\d+)$/i;

function abs(href, base) { try { return new URL(href, base).href; } catch { return null; } }
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
// Text of an element with a space between child elements ("<span>01</span>Social" -> "01 Social")
const textOf = ($, el) => {
  const parts = [];
  const walk = n => { if (n.type === 'text') parts.push(n.data); else if (n.children) n.children.forEach(walk); };
  walk($(el).get(0) || {});
  return clean(parts.join(' '));
};

function jsonLd($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const d = JSON.parse($(el).contents().text());
      const walk = v => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { out.push(v); if (v['@graph']) walk(v['@graph']); } };
      walk(d);
    } catch { /* ignore broken JSON-LD */ }
  });
  return out;
}

function cleanTitle(t) {
  if (!t) return null;
  const parts = t.split(/\s[|–—\-:·•]\s/).map(s => s.trim()).filter(Boolean);
  return parts[0] || t.trim();
}

const NOT_SERVICE_START = /^(view all|see all|read the|read more|explore|discover|let'?s|let’s|have a|tell us|thank you|your |what you|get in touch|contact|about us|use cases|book a|become a|join |follow|subscribe|why |how |our clients|our work|meet )/i;

function uniqServices(list, exclude = new Set()) {
  const seen = new Set(), out = [];
  for (const raw of list) {
    // Drop list numbering such as "01", "02 —", "3." at the start
    const s = clean(raw).replace(/^\d{1,2}(?:[.)\-–—:]\s*|\s+)/, '').replace(/[:.→]+$/, '').trim();
    if (s.length < 3 || s.length > 70 || NOT_SERVICE.test(s) || NOT_SERVICE_START.test(s) || s.split(' ').length > 9) continue;
    if (/[?!]/.test(s) || exclude.has(s.toLowerCase())) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(s);
    if (out.length >= 12) break;
  }
  return out;
}

/** Services listed on a page: items inside a section whose heading says "services". */
// Remove parts of a page that are never a services list: menus, forms, popups, footers.
// Returns the menu link texts so they can be excluded too.
function stripChrome($) {
  const navTexts = new Set();
  $('header a, nav a, footer a').each((_, a) => navTexts.add(clean($(a).text()).toLowerCase()));
  $('header,nav,footer,form,dialog,[role=dialog],[aria-modal=true],script,style,noscript,[class*=modal],[class*=popup],[id*=modal]').remove();
  return navTexts;
}

/**
 * Services listed on a page, trying the most reliable patterns first:
 *  1. the Services dropdown in the site menu
 *  2. elements the site itself labels as services (class names like "service-item", "svc-tab")
 *  3. items inside a section whose heading says "services" / "what we do"
 */
export function servicesFromSections($in) {
  const html = $in.html();
  const $orig = cheerio.load(html);

  // 1. Menu dropdown under a "Services" / "Solutions" item
  const fromMenu = [];
  $orig('nav li, header li').each((_, li) => {
    const top = $orig(li).children('a,button,span').first().text();
    if (!SERVICES_HEAD.test(top) || clean(top).length > 30) return;
    $orig(li).find('ul a, [class*=sub] a, [class*=dropdown] a').each((__, a) => { fromMenu.push(textOf($orig, a)); });
  });
  const menu = uniqServices(fromMenu);
  if (menu.length >= 2) return menu;

  const $ = cheerio.load(html);
  const navTexts = stripChrome($);

  // 2. Elements whose class names say "service"
  // Grouped by the class that marks them, keeping the biggest group (e.g. all "svc-tab" buttons)
  const groups = {};
  $('[class]').each((_, el) => {
    const token = String($(el).attr('class') || '').split(/\s+/).find(c => /^(svc|services?)([_-][a-z0-9_-]+)?$|[_-](svc|services?)([_-]|$)/i.test(c));
    if (!token) return;
    const t = textOf($, el);
    (groups[token] = groups[token] || []);
    if (t.length >= 3 && t.length <= 70) groups[token].push(t);
    else $(el).find('h2,h3,h4,h5,h6,button,[role=tab]').each((__, it) => groups[token].push(textOf($, it)));
  });
  const byClass = Object.values(groups).map(g => uniqServices(g, navTexts)).sort((a, b) => b.length - a.length)[0] || [];
  if (byClass.length >= 3) return byClass;

  // 3. Items under a "services" heading (climbing out of page-builder wrappers)
  const found = [];
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    if (!SERVICES_HEAD.test($(el).text()) || $(el).text().length > 60) return;
    let box = $(el).parent();
    for (let i = 0; i < 6 && box.text().length < 200; i++) {
      const up = box.parent();
      if (!up.length || up.is('html')) break;
      box = up;
    }
    if (!box.length || box.text().length > 6000) return;
    box.find('h2,h3,h4,h5,h6,li,strong,b,dt,button,[role=tab]').each((__, it) => { if (it !== el) found.push(textOf($, it)); });
  });
  const bySection = uniqServices(found, navTexts);
  return [menu, byClass, bySection].sort((a, b) => b.length - a.length)[0];
}

/** Services from a dedicated services page: its section headings. */
export function servicesFromPage(html) {
  const fromSections = servicesFromSections(cheerio.load(html));
  if (fromSections.length >= 3) return fromSections;
  const $ = cheerio.load(html);
  const navTexts = stripChrome($);
  const heads = [];
  $('h2,h3,h4').each((_, el) => heads.push($(el).text()));
  return uniqServices(heads, navTexts);
}

/** First substantial paragraphs of an About page, verbatim. */
export function aboutFromPage(html) {
  const $ = cheerio.load(html);
  $('header,footer,nav,script,style,noscript,form').remove();
  const paras = [];
  $('main p, article p, section p, p').each((_, el) => {
    const t = clean($(el).text());
    if (t.length >= 80 && !paras.includes(t) && !/cookie|privacy|©|all rights reserved/i.test(t)) paras.push(t);
  });
  const out = [];
  let len = 0;
  for (const p of paras) { if (len + p.length > 900 && out.length) break; out.push(p); len += p.length; if (out.length >= 3) break; }
  return out.length ? out.join('\n\n') : null;
}

// ---------- name ----------
const GENERIC_NAME = /^(home|homepage|home page|welcome|index|main|website|official website|official site|coming soon|under construction|access denied|just a moment\.*|attention required.*|403 forbidden|404.*|page not found|not found|untitled|default)$/i;
const fold = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');

export const isGenericName = n => !n || GENERIC_NAME.test(String(n).trim());

export function titleParts(title) {
  if (!title) return [];
  return title.split(/\s[|–—\-:·•»]\s|\s\|\s?|\s?\|\s/).map(s => s.trim()).filter(Boolean);
}
export function domainCore(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    const parts = h.split('.');
    // "muller-mena.com" -> "mullermena", "brand.co.uk" -> "brand"
    const core = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2] || parts[0];
    return core.replace(/-/g, '');
  } catch { return ''; }
}
/** Readable name from a domain: "oohmybrand.com" -> "Oohmybrand", "muller-mena.com" -> "Muller Mena" */
export function nameFromDomain(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    const parts = h.split('.');
    const core = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2] || parts[0];
    return core.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } catch { return null; }
}
function sharesStem(a, b) {
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  for (let i = 0; i + 5 <= a.length; i++) if (b.includes(a.slice(i, i + 5))) return true;
  return false;
}
/** The candidate that matches the domain wins; generic titles and taglines are skipped. */
/** candidates: [og:site_name, structured-data name, application-name, ...title parts] */
export function pickName(candidates, pageUrl) {
  const core = domainCore(pageUrl);
  // Taglines ("Creating. Innovating. Elevating.") and long sentences are never the name
  const isTagline = c => /[.!?]$/.test(c) || /\.\s/.test(c) || c.split(' ').length > 6;
  const list = candidates.map(c => clean(c)).filter(c => c && c.length <= 60 && !GENERIC_NAME.test(c) && !isTagline(c));
  const match = list.find(c => sharesStem(fold(c), core));
  if (match) return match;
  // Nothing matches the domain: trust a name the site declares (og:site_name, structured data),
  // otherwise build it from the domain rather than using a page title
  const ok = c => { c = clean(c); return c && c.length <= 60 && !GENERIC_NAME.test(c) && !isTagline(c) ? c : null; };
  const declared = candidates.slice(0, 3).map(ok).find(Boolean);
  return declared || nameFromDomain(pageUrl);
}

// ---------- logo ----------
/** Best logo on the page, plus whether it is good enough or just a small favicon. */
export function pickLogo($, org, meta, pageUrl) {
  const cand = [];
  const add = (href, rank, quality) => { const u = href && abs(String(href).trim(), pageUrl); if (u && !/^data:image\/gif/i.test(u)) cand.push({ u, rank, quality }); };
  const ld = typeof org.logo === 'string' ? org.logo : org.logo && (org.logo.url || org.logo.contentUrl);
  add(ld, 1, 'good');
  $('link[rel]').each((_, el) => {
    const rel = ($(el).attr('rel') || '').toLowerCase();
    if (!/icon/.test(rel)) return;
    const href = $(el).attr('href');
    const size = parseInt(($(el).attr('sizes') || '').split('x')[0], 10) || (rel.includes('apple') ? 180 : 0) || (href && /(\d{3})x\1/.test(href) ? +href.match(/(\d{3})x\1/)[1] : 32);
    if (rel.includes('apple')) add(href, 2, 'good');
    else if (size >= 120) add(href, 3, 'good');
    else add(href, 7, 'weak');
  });
  // The logo image in the site header. Client/partner logo strips are skipped.
  const NOT_OWN = /client|partner|brands?\b|logos|marquee|carousel|slider|swiper|ticker|trusted|award/i;
  const imgSrc = el => { const i = $(el); return i.attr('src') || i.attr('data-src') || (i.attr('srcset') || '').split(' ')[0]; };
  const own = el => {
    const src = imgSrc(el) || '';
    if (!src || /\/(logos|clients|partners|brands)\//i.test(src)) return false;
    return !$(el).parents().toArray().some(p => NOT_OWN.test(($(p).attr('class') || '') + ' ' + ($(p).attr('id') || '')));
  };
  const tiers = [
    'header [class*=logo] img, header img[class*=logo], header img[alt*=logo i], header a[href="/"] img, a[class*=logo] img, a[href="/"] img',
    '[class*=logo] img, img[class*=logo], img[id*=logo], img[alt*=logo i], img[src*=logo i]',
    'header img, nav img'
  ];
  for (let t = 0; t < tiers.length; t++) {
    const el = $(tiers[t]).toArray().find(own);
    if (el) add(imgSrc(el), 4 + t * 0.1, 'good');
  }
  const ogImg = meta('og:image');
  if (ogImg && /logo/i.test(ogImg)) add(ogImg, 5, 'good');
  add(meta('msapplication-TileImage'), 6, 'good');
  add('/favicon.ico', 9, 'weak');
  cand.sort((a, b) => a.rank - b.rank);
  const seen = new Set();
  const logoCandidates = cand.filter(c => !seen.has(c.u) && seen.add(c.u)).map(({ u, quality }) => ({ u, quality }));
  return cand.length ? { logo: cand[0].u, logoQuality: cand[0].quality, logoCandidates } : { logo: null, logoQuality: 'none', logoCandidates: [] };
}

// ---------- dead, parked or protected sites ----------
const PARKING_HOST = /(^|\.)(forsale\.godaddy\.com|godaddy\.com|afternic\.com|sedo\.com|dan\.com|hugedomains\.com|atom\.com|squadhelp\.com|bodis\.com|parkingcrew\.net|above\.com|undeveloped\.com|domainmarket\.com|buydomains\.com|sav\.com|spaceship\.com|namecheap\.com)$/i;
/** Why a fetched page can't be used as the company's website, or null if it's fine. */
export function deadReason({ html, finalUrl, title, logo, bodyLength }) {
  const body = String(html || '').slice(0, 200000);
  let host = '';
  try { host = new URL(finalUrl).hostname; } catch { /* keep empty */ }
  if (/^chrome-error:|^about:blank/i.test(finalUrl || '')) return 'site_down';
  let logoHost = '';
  try { logoHost = new URL(logo).hostname; } catch { /* none */ }
  if (PARKING_HOST.test(host) || PARKING_HOST.test(logoHost) || /^\/lander\b/.test((() => { try { return new URL(finalUrl).pathname; } catch { return ''; } })()) ||
      /location\.href\s*=\s*["']\/lander|parking-lander|sedoparking|parkingcrew|bodis\.com|domain-for-sale|afternic\.com|forsale\.godaddy/i.test(body) ||
      /domain (?:name )?(?:is|may be) for sale|buy this domain|this domain is parked|parked free|domain parking|make an offer on this domain|inquire about this domain|get this domain/i.test(body)) return 'site_parked';
  if (/^(just a moment|attention required|checking your browser|ddos-guard|please wait|one more step|access denied|security check)/i.test(title || '') ||
      (bodyLength < 1500 && /cf-chl|challenge-platform|captcha|are you a robot|verify you are human/i.test(body))) return 'site_blocked';
  if (/^(404|403|500|502|503|not found|page not found|site not found|account suspended|website expired|index of \/|error)/i.test(title || '') ||
      /this account has been suspended|website is no longer available|hosting (?:has|account has) expired|site can.t be reached|this site is currently unavailable/i.test(body)) return 'site_down';
  if (bodyLength < 600 && /coming soon|under construction|launching soon|website is under maintenance/i.test(body)) return 'site_empty';
  return null;
}

/** Pure parser: HTML string -> extracted fields. Exported for tests. */
export function parseSite(html, pageUrl) {
  const $ = cheerio.load(html);
  const meta = n => $(`meta[name="${n}"]`).attr('content') || $(`meta[property="${n}"]`).attr('content') || null;
  const ld = jsonLd($);
  const org = ld.find(o => /Organization|Corporation|LocalBusiness|ProfessionalService|AdvertisingAgency/i.test([].concat(o['@type'] || []).join(' '))) || {};
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return ''; } })();

  let description = clean(meta('description') || meta('og:description') || meta('twitter:description') || org.description || '') || null;
  let descriptionSource = meta('description') ? 'meta description' : meta('og:description') ? 'og:description' : meta('twitter:description') ? 'twitter:description' : org.description ? 'structured data' : null;

  // Homepage lead text, used when there is no description: main heading + first paragraph, verbatim
  let heroText = null;
  {
    const $b = cheerio.load(html); $b('header,nav,script,style,noscript').remove();
    const h = $b('h1').first().length ? $b('h1').first() : $b('h2').first();
    const headText = clean(h.text());
    let para = null;
    $b('p').each((_, el) => { const t = clean($b(el).text()); if (!para && t.length >= 60) para = t; });
    if (headText && para) heroText = `${headText} ${para}`;
    else heroText = para || null;
  }

  const title = clean($('title').first().text());
  const name = pickName([meta('og:site_name'), typeof org.name === 'string' ? org.name : null, meta('application-name'), ...titleParts(title)], pageUrl);

  const { logo, logoQuality, logoCandidates } = pickLogo($, org, meta, pageUrl);

  // Links: platform profiles, internal redirects like /instagram, About and Services pages, contact
  const links = {};
  const internalSocial = {};
  let aboutUrl = null, servicesUrl = null;
  const emails = new Set(), phones = new Set();
  let whatsapp = null;
  const consider = href => {
    if (!href) return;
    if (/^mailto:/i.test(href)) { const e = href.slice(7).split('?')[0].trim().toLowerCase(); if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)) emails.add(e); return; }
    if (/^tel:/i.test(href)) { const p = href.slice(4).replace(/[^\d+]/g, ''); if (p.replace(/\D/g, '').length >= 7) phones.add(p); return; }
    const u = abs(href, pageUrl);
    if (!u) return;
    const wa = u.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:.*&)?phone=)(%2B|\+)?(\d{7,15})/i);
    if (wa) { whatsapp = whatsapp || '+' + wa[2]; return; }
    if (platformOf(u)) { const clean = cleanProfileLink(u); if (clean) { const k = platformOf(u); if (!links[k]) links[k] = clean; } return; }
    try {
      const x = new URL(u);
      if (x.origin !== origin) return;
      const seg = x.pathname.replace(/\/+$/, '').toLowerCase();
      const first = seg.split('/').filter(Boolean)[0] || '';
      const alias = { twitter: 'x', fb: 'facebook', ig: 'instagram', insta: 'instagram' }[first] || first;
      if (PLATFORMS.includes(alias) && seg.split('/').filter(Boolean).length === 1) internalSocial[alias] = internalSocial[alias] || u;
      if (!aboutUrl && ABOUT_PATH.test(x.pathname)) aboutUrl = u;
      if (!servicesUrl && SERVICES_PATH.test(x.pathname)) servicesUrl = u;
    } catch { /* skip */ }
  };
  [].concat(org.sameAs || []).forEach(consider);
  $('a[href]').each((_, el) => consider($(el).attr('href')));
  [].concat(org.telephone || []).forEach(p => phones.add(String(p).replace(/[^\d+]/g, '')));
  [].concat(org.email || []).forEach(e => emails.add(String(e).toLowerCase()));

  // Address
  let address = null;
  const addr = [].concat(org.address || [])[0];
  if (addr && typeof addr === 'object') address = clean([addr.streetAddress, addr.addressLocality, addr.addressRegion, typeof addr.addressCountry === 'string' ? addr.addressCountry : addr.addressCountry && addr.addressCountry.name].filter(Boolean).join(', ')) || null;
  else if (typeof addr === 'string') address = clean(addr);
  if (!address) { const a = clean($('address').first().text()); if (a && a.length <= 200) address = a; }

  // Country hints: structured address, phone codes, then description/title/footer/address text only
  const countries = new Set();
  [].concat(org.address || []).forEach(a => {
    const c = a && (typeof a.addressCountry === 'string' ? a.addressCountry : a.addressCountry && a.addressCountry.name);
    if (c) countries.add(c.length === 2 ? c.toUpperCase() : (ISO2[c.toLowerCase()] || null));
  });
  [...phones, whatsapp].filter(Boolean).forEach(p => {
    const d = String(p).replace(/^\+|^00/, '');
    if (!/^\+|^00/.test(String(p))) return;
    const hit = DIAL.find(([code]) => d.startsWith(code));
    if (hit) countries.add(hit[1]);
  });
  const hintText = [description, $('title').text(), $('footer').text().slice(0, 3000), address].join(' ');
  COUNTRY_WORDS.forEach(([re, code]) => { if (re.test(hintText)) countries.add(code); });
  countries.delete(null);

  // Founding year
  let founded = null;
  const fd = org.foundingDate && String(org.foundingDate).match(/(19|20)\d{2}/);
  if (fd) founded = +fd[0];
  const bodyText = $('body').text().replace(/\s+/g, ' ');
  if (!founded) founded = foundedIn(bodyText);

  const services = servicesFromSections($);
  const classifyText = [name, description, heroText, $('title').text(), $('h1,h2,h3').text(), $('nav').text(), services.join(', ')].join(' ').replace(/\s+/g, ' ').slice(0, 4000);

  return {
    name, title, description, descriptionSource, heroText, logo, logoQuality, logoCandidates, links, internalSocial,
    dead: deadReason({ html, finalUrl: pageUrl, title, logo, bodyLength: bodyText.trim().length }),
    sortlist: links.sortlist || null, aboutUrl, servicesUrl, services,
    contact: { emails: [...emails].slice(0, 3), phones: [...phones].slice(0, 3), whatsapp, address },
    countries: [...countries], founded, classifyText,
    bodyLength: bodyText.trim().length
  };
}

export function foundedIn(text) {
  const m = String(text || '').match(/\b(?:since|founded(?: in)?|established(?: in)?|est\.?)\s*((?:19|20)\d{2})\b/i) || String(text || '').match(/تأسست(?: عام| في)?\s*((?:19|20)\d{2})/);
  return m ? +m[1] : null;
}

let browserPromise = null;
async function browser() {
  if (!browserPromise) {
    const { chromium } = await import('playwright');
    browserPromise = chromium.launch();
  }
  return browserPromise;
}
export async function closeBrowser() {
  if (browserPromise) { try { (await browserPromise).close(); } catch { /* already closed */ } }
}

async function render(url) {
  const b = await browser();
  const page = await b.newPage();
  const hops = [];
  page.on('framenavigated', f => { try { hops.push(new URL(f.url()).hostname); } catch { /* ignore */ } });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 }).catch(() => page.waitForTimeout(3000));
    // Scroll once so lazy sections (services, footers) load
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(2000);
    return { html: await page.content(), url: page.url(), parked: hops.some(h => PARKING_HOST.test(h)) };
  } finally { await page.close(); }
}

/** Where an internal link such as /instagram ends up, following server and JavaScript redirects. */
async function resolveRedirect(url) {
  const r = await get(url);
  if (r.url && platformOf(r.url)) return r.url;
  try {
    const b = await browser();
    const ctx = await b.newContext();
    const page = await ctx.newPage();
    let target = null;
    ctx.on('page', p => { target = target || p.url(); });
    page.on('framenavigated', f => { if (f === page.mainFrame() && platformOf(f.url())) target = target || f.url(); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    target = target || page.url();
    await ctx.close();
    return platformOf(target) ? target : null;
  } catch { return null; }
}

async function fetchHtml(url) {
  const r = await get(url);
  const thin = !r.ok || cheerio.load(r.text || '')('body').text().replace(/\s+/g, ' ').trim().length < 400;
  if (!thin) return r.text;
  try { return (await render(url)).html; } catch { return r.ok ? r.text : null; }
}

/** Fetch + parse a website. Returns parsed fields, or { error } */
export async function readSite(url) {
  const res = await get(url);
  let parsed = res.text ? parseSite(res.text, res.url || url) : null;
  // A bot-protection page: stop here. We don't try to get past it.
  if (parsed && parsed.dead === 'site_blocked') return { error: 'site_blocked' };
  if (parsed && parsed.dead === 'site_parked') return { error: 'site_parked' };
  if (!res.ok) parsed = null;
  let rendered = false;
  // Thin, failed or JavaScript-built page: load it in a normal browser
  if (!parsed || parsed.dead || !parsed.description || parsed.bodyLength < 400 || !Object.keys(parsed.links).length) {
    try {
      const r = await render(url);
      const p2 = parseSite(r.html, r.url);
      // A for-sale page anywhere in the chain means the domain isn't the company's site
      if (r.parked || p2.dead === 'site_parked') return { error: 'site_parked' };
      if (!parsed || (parsed.dead && !p2.dead) || (!p2.dead && (p2.bodyLength > parsed.bodyLength || (p2.description && !parsed.description)))) { parsed = { ...p2, description: p2.description || parsed?.description, descriptionSource: p2.description ? p2.descriptionSource : parsed?.descriptionSource }; rendered = true; }
      else for (const [k, v] of Object.entries(p2.links)) if (!parsed.links[k]) parsed.links[k] = v;
    } catch (e) {
      if (!parsed) return { error: 'site_unreachable', detail: String(e.message || e) };
    }
  }
  if (!parsed) return { error: 'site_unreachable' };
  if (parsed.dead) return { error: parsed.dead };

  // Internal redirect links (example.com/instagram) -> the real profile
  for (const [k, u] of Object.entries(parsed.internalSocial || {})) {
    if (parsed.links[k]) continue;
    const real = await resolveRedirect(u);
    const clean = real && cleanProfileLink(real);
    if (clean) parsed.links[k] = clean;
  }

  // About page: verbatim paragraphs
  let about = null;
  if (parsed.aboutUrl) {
    const html = await fetchHtml(parsed.aboutUrl);
    if (html) {
      about = aboutFromPage(html);
      if (!parsed.founded) parsed.founded = foundedIn(cheerio.load(html)('body').text());
      if (about) parsed.classifyText += ' ' + about.slice(0, 1500);
    }
  }

  // Services page, only when the homepage didn't list enough
  let services = parsed.services;
  if (parsed.servicesUrl && services.length < 3) {
    const html = await fetchHtml(parsed.servicesUrl);
    if (html) { const s = servicesFromPage(html); if (s.length > services.length) services = s; }
  }

  // Description fallback: About page first paragraph, then homepage lead text
  let description = parsed.description, descriptionSource = parsed.descriptionSource;
  if (!description && about) { description = about.split('\n\n')[0]; descriptionSource = 'about page'; }
  if (!description && parsed.heroText) { description = parsed.heroText; descriptionSource = 'homepage text'; }

  // Nothing readable at all (an empty shell, a silent block or a hiccup): treat as unreachable,
  // so the run keeps what it knew before and uses the social profiles
  if (!description && !about && parsed.bodyLength < 250) return { error: 'site_unreachable' };

  return { ...parsed, description, descriptionSource, about, aboutSource: about ? parsed.aboutUrl : null, services, finalUrl: res.url || url, rendered };
}
