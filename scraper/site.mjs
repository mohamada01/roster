// Reads a company website: name, verbatim description, logo, platform links,
// country hints and founding year. Falls back to a real browser for sites
// that build their content with JavaScript.
import * as cheerio from 'cheerio';
import { get, isProfileLink, platformOf } from './lib.mjs';

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

function abs(href, base) { try { return new URL(href, base).href; } catch { return null; } }

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

/** Pure parser: HTML string -> extracted fields. Exported for tests. */
export function parseSite(html, pageUrl) {
  const $ = cheerio.load(html);
  const meta = n => $(`meta[name="${n}"]`).attr('content') || $(`meta[property="${n}"]`).attr('content') || null;
  const ld = jsonLd($);
  const org = ld.find(o => /Organization|Corporation|LocalBusiness|ProfessionalService|AdvertisingAgency/i.test([].concat(o['@type'] || []).join(' '))) || {};

  const description = (meta('description') || meta('og:description') || meta('twitter:description') || org.description || '').trim() || null;
  const descriptionSource = meta('description') ? 'meta description' : meta('og:description') ? 'og:description' : meta('twitter:description') ? 'twitter:description' : org.description ? 'structured data' : null;
  const name = (meta('og:site_name') || (typeof org.name === 'string' ? org.name : null) || cleanTitle($('title').first().text()) || '').trim() || null;

  // Logo: structured data, then the largest icon, then og:image
  let logo = typeof org.logo === 'string' ? org.logo : org.logo && org.logo.url;
  if (!logo) {
    const icons = [];
    $('link[rel]').each((_, el) => {
      const rel = ($(el).attr('rel') || '').toLowerCase();
      if (!/icon/.test(rel)) return;
      const size = parseInt(($(el).attr('sizes') || '').split('x')[0], 10) || (rel.includes('apple') ? 180 : 32);
      const href = $(el).attr('href');
      if (href && !/\.svg($|\?)/i.test(href) || rel.includes('apple')) icons.push({ href, size });
    });
    icons.sort((a, b) => b.size - a.size);
    logo = icons[0] && icons[0].href;
  }
  if (!logo) logo = meta('msapplication-TileImage') || meta('og:image') || '/favicon.ico';
  logo = abs(logo, pageUrl);

  // Platform links: first profile link per platform, plus structured data sameAs
  const links = {};
  const consider = href => {
    const u = abs(href, pageUrl);
    if (!u || !isProfileLink(u)) return;
    const k = platformOf(u);
    if (!links[k]) links[k] = u.split('?')[0].replace(/\/+$/, '/') ;
  };
  [].concat(org.sameAs || []).forEach(consider);
  $('a[href]').each((_, el) => consider($(el).attr('href')));

  // Country hints: structured address, then description/title/footer text only
  const countries = new Set();
  [].concat(org.address || []).forEach(a => {
    const c = a && (typeof a.addressCountry === 'string' ? a.addressCountry : a.addressCountry && a.addressCountry.name);
    if (c) countries.add(c.length === 2 ? c.toUpperCase() : (ISO2[c.toLowerCase()] || null));
  });
  const hintText = [description, $('title').text(), $('footer').text().slice(0, 3000), $('address').text()].join(' ');
  COUNTRY_WORDS.forEach(([re, code]) => { if (re.test(hintText)) countries.add(code); });
  countries.delete(null);

  // Founding year
  let founded = null;
  const fd = org.foundingDate && String(org.foundingDate).match(/(19|20)\d{2}/);
  if (fd) founded = +fd[0];
  const bodyText = $('body').text().replace(/\s+/g, ' ');
  if (!founded) {
    const m = bodyText.match(/\b(?:since|founded(?: in)?|established(?: in)?|est\.?)\s*((?:19|20)\d{2})\b/i) || bodyText.match(/تأسست(?: عام| في)?\s*((?:19|20)\d{2})/);
    if (m) founded = +m[1];
  }

  // Text used only for choosing a category, never shown
  const classifyText = [name, description, $('title').text(), $('h1,h2,h3').text(), $('nav').text()].join(' ').replace(/\s+/g, ' ').slice(0, 4000);

  return {
    name, description, descriptionSource, logo, links,
    sortlist: links.sortlist || null,
    countries: [...countries], founded, classifyText,
    bodyLength: bodyText.trim().length
  };
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
  const page = await b.newPage({ userAgent: undefined });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 }).catch(() => page.waitForTimeout(3000));
    await page.waitForTimeout(1500);
    return { html: await page.content(), url: page.url() };
  } finally { await page.close(); }
}

/** Fetch + parse a website. Returns parsed fields, or { error } */
export async function readSite(url) {
  const res = await get(url);
  let parsed = res.ok && res.text ? parseSite(res.text, res.url || url) : null;
  let rendered = false;
  // Thin or failed page: try a real browser
  if (!parsed || !parsed.description || parsed.bodyLength < 400) {
    try {
      const r = await render(url);
      const p2 = parseSite(r.html, r.url);
      if (!parsed || (p2.description && !parsed.description) || p2.bodyLength > parsed.bodyLength) { parsed = p2; rendered = true; }
    } catch (e) {
      if (!parsed) return { error: 'site_unreachable', detail: String(e.message || e) };
    }
  }
  if (!parsed) return { error: 'site_unreachable' };
  return { ...parsed, finalUrl: res.url || url, rendered };
}
