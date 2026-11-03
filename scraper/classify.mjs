// Picks one category from the site's own text. Never writes a description.
// Uses keyword scoring for free; if GEMINI_API_KEY is set it asks Gemini to
// choose from the same fixed list and falls back to keywords on any error.

export const CATEGORIES = ['creative', 'performance', 'branding', 'video', 'web', 'social', 'pr'];

const RULES = {
  creative: ['full-service', 'full service', 'integrated', 'creative agency', 'advertising agency', '360', 'campaigns', 'tv creative', 'creative network', 'atl', 'btl'],
  performance: ['performance', 'digital marketing', 'paid media', 'ppc', 'seo', 'sem', 'media buying', 'growth marketing', 'roi', 'google ads', 'lead generation', 'geo', 'generative engine'],
  branding: ['branding', 'brand identity', 'visual identity', 'packaging', 'logo design', 'brand strategy', 'naming', 'rebrand'],
  video: ['video production', 'production house', 'film', 'commercials', 'tvc', 'animation', 'motion graphics', 'post-production', 'cinematography'],
  web: ['web development', 'website development', 'web design', 'app development', 'mobile app', 'ui/ux', 'ux design', 'e-commerce', 'ecommerce', 'software', 'shopify', 'wordpress'],
  social: ['social media', 'community management', 'influencer', 'content creation', 'content creators', 'tiktok', 'ugc'],
  pr: ['public relations', 'pr agency', 'media relations', 'communications agency', 'reputation', 'press', 'corporate communications']
};

function count(text, word) {
  const re = new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}([^a-z]|$)`, 'gi');
  return (text.match(re) || []).length;
}

export function classifyByKeywords(description, otherText) {
  const d = String(description || '').toLowerCase();
  const o = String(otherText || '').toLowerCase();
  const scores = {};
  for (const [cat, words] of Object.entries(RULES)) {
    scores[cat] = words.reduce((s, w) => s + count(d, w) * 3 + Math.min(count(o, w), 3), 0);
  }
  // A site that offers four or more distinct kinds of service is full-service
  const breadth = Object.entries(scores).filter(([k, v]) => k !== 'creative' && v > 0).length;
  if (breadth >= 4) scores.creative += 6;
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'none';
}

export async function classify(description, otherText) {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const prompt = `Choose the single best category for this agency from this list: ${CATEGORIES.join(', ')}.
creative = full-service/integrated advertising, performance = digital/performance marketing and SEO, branding = brand identity, video = video/film production, web = websites/apps, social = social media management, pr = public relations.
Answer with the category word only.

Description: ${description || ''}
Site text: ${String(otherText || '').slice(0, 2500)}`;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } })
      });
      const j = await r.json();
      const ans = String(j?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase().replace(/[^a-z]/g, '');
      if (CATEGORIES.includes(ans)) return ans;
    } catch { /* fall back to keywords */ }
  }
  return classifyByKeywords(description, otherText);
}
