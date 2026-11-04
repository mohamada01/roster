// Checks a logo before it is saved: it must load, be a real image, and not be blank.
// Also measures its tone, so a white logo is shown on a dark tile instead of disappearing on white.
import sharp from 'sharp';
import { UA } from './lib.mjs';

/** Pure: tone of RGBA pixels. Exported for tests. */
export function toneOf(data, channels = 4) {
  let opaque = 0, total = 0, lum = 0;
  for (let i = 0; i < data.length; i += channels) {
    total++;
    const a = channels === 4 ? data[i + 3] : 255;
    if (a < 40) continue;
    opaque++;
    lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  if (!total || opaque / total < 0.01) return { blank: true };
  const mean = lum / opaque;
  const transparent = 1 - opaque / total;
  // Has see-through areas, and what is drawn is near white -> needs a dark tile
  if (transparent > 0.05 && mean > 0.82) return { tone: 'light' };
  // Fully opaque and near white everywhere -> a blank white square
  if (transparent <= 0.05 && mean > 0.97) return { blank: true };
  return { tone: 'dark' };
}

/** { ok, tone } for one image URL. ICO files can't be measured, so they pass without a tone. */
export async function checkLogo(url) {
  if (!url || /^data:/i.test(url) || /^chrome-error:/i.test(url)) return { ok: false };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8' } });
    if (!res.ok) return { ok: false };
    const type = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return { ok: false };
    if (/icon|ico/.test(type) || /\.ico(\?|$)/i.test(url)) return { ok: true, tone: null };
    if (type && !type.startsWith('image/') && !/octet-stream/.test(type)) return { ok: false };
    const img = sharp(buf, { density: 96 });
    const meta = await img.metadata();
    if (!meta.width || !meta.height || meta.width < 16 || meta.height < 16) return { ok: false };
    const { data, info } = await img.ensureAlpha().resize(96, 96, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    const r = toneOf(data, info.channels);
    if (r.blank) return { ok: false };
    return { ok: true, tone: r.tone, width: meta.width, height: meta.height };
  } catch {
    return { ok: false };
  } finally { clearTimeout(t); }
}

/** First candidate that really loads. */
export async function firstGoodLogo(candidates) {
  for (const c of candidates || []) {
    const r = await checkLogo(c.u || c);
    if (r.ok) return { url: c.u || c, tone: r.tone, quality: c.quality || 'good' };
  }
  return null;
}
