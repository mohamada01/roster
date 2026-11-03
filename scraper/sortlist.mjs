// Sortlist rating and review count from the public agency page.
import { get, slugify } from './lib.mjs';

export function parseSortlist(html) {
  let rating = null, reviews = null;
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    const m = b.match(/"aggregateRating"\s*:\s*\{([^}]*)\}/);
    if (m) {
      const rv = m[1].match(/"ratingValue"\s*:\s*"?([\d.]+)/);
      const rc = m[1].match(/"(?:reviewCount|ratingCount)"\s*:\s*"?(\d+)/);
      if (rv) rating = +rv[1];
      if (rc) reviews = +rc[1];
      break;
    }
  }
  if (rating == null) {
    const rv = html.match(/"ratingValue"\s*:\s*"?([\d.]+)/);
    const rc = html.match(/"(?:reviewCount|reviewsCount|ratingCount)"\s*:\s*"?(\d+)/);
    if (rv) rating = +rv[1];
    if (rc) reviews = +rc[1];
  }
  if (rating != null && (rating <= 0 || rating > 5)) rating = null;
  return { rating, reviews };
}

export async function readSortlist(url) {
  const r = await get(url);
  if (!r.ok) return { error: r.status === 404 ? 'sortlist_not_found' : 'sortlist_blocked' };
  return { ...parseSortlist(r.text), url: r.url || url, html: r.text };
}

/** Try the obvious profile address and keep it only if it links back to the company's domain. */
export async function discoverSortlist(name, domain) {
  if (!name || !domain) return null;
  const base = domain.replace(/^www\./, '');
  const candidates = [...new Set([slugify(name), slugify(base.split('.')[0])])].filter(Boolean);
  for (const slug of candidates) {
    const url = `https://www.sortlist.com/agency/${slug}`;
    const r = await readSortlist(url);
    if (!r.error && r.html && r.html.toLowerCase().includes(base.toLowerCase())) {
      const { html, ...rest } = r;
      return rest;
    }
  }
  return null;
}
