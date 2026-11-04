// Diagnostic: which free endpoints answer from GitHub's servers. Run with: node probe.mjs
import { get } from './lib.mjs';

const show = (label, r, patterns) => {
  const t = r.text || '';
  const out = { status: r.status, url: (r.url || '').slice(0, 90), len: t.length };
  for (const [k, re] of Object.entries(patterns)) { const m = t.match(re); out[k] = m ? (m[1] || m[0]).slice(0, 160) : null; }
  console.log(label, JSON.stringify(out));
};
const META = {
  title: /<title[^>]*>([^<]{0,160})/i,
  ogTitle: /property="og:title"\s+content="([^"]*)"/i,
  ogDesc: /property="og:description"\s+content="([^"]*)"/i,
  ogImage: /property="og:image"\s+content="([^"]*)"/i,
  followers: /([\d][\d.,]*\s*[KkMm]?)\s*(?:followers|Followers|people follow|likes)/
};

const IG = ['mullersmena', 'blabla.studio'];
for (const u of IG) {
  show(`IG api ${u}`, await get(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${u}`, { headers: { 'x-ig-app-id': '936619743392459' } }), { count: /"edge_followed_by":\{"count":(\d+)/, bio: /"biography":"([^"]{0,120})/ });
  show(`IG page ${u}`, await get(`https://www.instagram.com/${u}/`), META);
  show(`IG embed ${u}`, await get(`https://www.instagram.com/${u}/embed/`), { ...META, fc: /"followers_count":(\d+)/, fullName: /"full_name":"([^"]*)"/, pic: /"profile_pic_url":"([^"]*)"/ });
}
for (const p of ['https://www.facebook.com/Mullersnetwork/', 'https://www.facebook.com/blablapage/']) {
  show(`FB page ${p}`, await get(p), META);
  show(`FB plugin ${p}`, await get(`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(p)}&tabs&width=340&height=130&small_header=false&adapt_container_width=true&hide_cover=false`), { ...META, name: /class="[^"]*_1drp[^"]*"[^>]*>([^<]+)/, likes: /([\d][\d.,]*\s*[KkMm]?)\s*(?:followers|likes)/i, img: /<img[^>]+src="(https:\/\/scontent[^"]+)"/ });
}
for (const p of ['https://www.linkedin.com/company/stork-advertising/', 'https://www.linkedin.com/company/blabla-studio/']) {
  show(`LI ${p}`, await get(p), { ...META, about: /about-us__description[^>]*>\s*([^<]{0,160})/, website: /about-us__website[\s\S]{0,400}?href="([^"]+)"/, industry: /about-us__industry[\s\S]{0,200}?<dd[^>]*>\s*([^<]+)/ });
}
for (const p of ['https://www.tiktok.com/@oohmybrand', 'https://www.youtube.com/@udjatagency', 'https://www.behance.net/blablastudio']) {
  show(`X ${p}`, await get(p), { ...META, nick: /"nickname":"([^"]*)"/, sig: /"signature":"([^"]{0,120})"/, avatar: /"avatarLarger":"([^"]*)"/ });
}
// Playwright view of Instagram, as a real browser would see it logged out
try {
  const { chromium } = await import('playwright');
  const b = await chromium.launch();
  const page = await b.newPage({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  await page.goto('https://www.instagram.com/mullersmena/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const html = await page.content();
  show('IG browser', { status: 200, url: page.url(), text: html }, { ...META, desc: /name="description"\s+content="([^"]*)"/i });
  await b.close();
} catch (e) { console.log('IG browser error', String(e.message || e)); }
