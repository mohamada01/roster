import type { Row } from './types';

// Shown only when Supabase isn't connected yet. Müller's and Stork descriptions
// and links are real, taken from their websites; all numbers are placeholders.
const base = (o: Partial<Row>): Row => ({
  id: o.slug!, slug: o.slug!, dedupe_key: o.domain || o.slug!, input_url: o.website || o.input_url || '',
  name: null, domain: null, website: null, description: null, description_source: 'meta description', logo_url: null,
  category: 'none', countries: [], founded: null, services: [], links: {}, followers: {}, followers_total: 0,
  growth_30d: null, spark: [], sortlist_url: null, sortlist_rating: null, sortlist_reviews: null,
  status: 'done', stage: 5, issues: [], overrides: {}, hidden: false, created_by: null,
  created_at: '2026-11-03T16:50:00Z', fetched_at: '2026-11-03T16:50:00Z', run_at: '2026-11-03T16:50:00Z', ...o
});

export const DEMO: Row[] = [
  base({ slug: 'mullers', name: 'Müller’s', domain: 'muller-mena.com', website: 'https://muller-mena.com/', category: 'creative', countries: ['EG', 'SA', 'AE'], founded: 2006,
    description: "Full-service creative agency in Cairo, Riyadh & Dubai. Müller's delivers TV production, social media, PR, branding, media buying & AI-powered content.",
    services: ['Social Media & PR Management', 'TV Creative & Campaigns Development', 'Media Performance & Growth', 'Branding & Personification', 'AI-Powered Content'],
    links: { instagram: 'https://www.instagram.com/mullersmena/', linkedin: 'https://www.linkedin.com/company/m%C3%BCllers-communications/', facebook: 'https://www.facebook.com/Mullersnetwork/' },
    followers: { instagram: 48200, linkedin: 12600, facebook: 96400 }, growth_30d: 3.8, spark: [40, 42, 41, 44, 46, 45, 48, 50] }),
  base({ slug: 'stork-advertising', name: 'Stork Advertising', domain: 'storkadvertising.com', website: 'https://storkadvertising.com/', category: 'performance', countries: ['GB', 'AE', 'EG'],
    description: 'Stork Advertising is a performance-led digital marketing agency in London, Dubai & Cairo. Social media, GEO, video & web dev that drive measurable ROI.',
    services: ['Social Media Management', 'Generative Engine Optimization (GEO)', 'Video Production', 'Websites Development'],
    links: { instagram: 'https://www.instagram.com/stork_advertising/', linkedin: 'https://www.linkedin.com/company/stork-advertising/', sortlist: 'https://www.sortlist.com/agency/stork-advertising' },
    sortlist_url: 'https://www.sortlist.com/agency/stork-advertising',
    followers: { instagram: 21500, linkedin: 8900 }, growth_30d: 6.2, spark: [20, 22, 23, 25, 26, 28, 29, 31], sortlist_rating: 4.9, sortlist_reviews: 31 }),
  base({ slug: 'ogbees', name: 'OG Bees', domain: 'ogbees.com', website: 'https://ogbees.com/', status: 'failed', stage: 0, issues: ['site_no_description'] }),
  base({ slug: 'blabla-studio', name: 'Blabla Studio', domain: null, input_url: 'https://www.instagram.com/blabla.studio', links: { instagram: 'https://www.instagram.com/blabla.studio' },
    followers: { instagram: null }, status: 'partial', stage: 2, issues: ['no_website', 'followers_blocked'] }),
  base({ slug: 'northline', sample: true, name: 'Northline Studio', domain: 'northline.example', category: 'branding', countries: ['EG'], founded: 2017, created_at: '2026-10-28T09:00:00Z',
    description: 'Independent branding studio building identities, packaging and brand systems for consumer brands across the region.',
    followers: { instagram: 34100, behance: 18700, linkedin: 4200, dribbble: 6100 }, growth_30d: 9.4, spark: [10, 12, 13, 15, 17, 19, 22, 25], sortlist_rating: 4.8, sortlist_reviews: 22 }),
  base({ slug: 'pixel-pulse', sample: true, name: 'Pixel & Pulse', domain: 'pixelpulse.example', category: 'performance', countries: ['AE'], founded: 2015, created_at: '2026-10-20T09:00:00Z',
    description: 'Performance marketing team focused on paid social, search and conversion tracking for e-commerce brands.',
    followers: { linkedin: 15800, instagram: 9800, x: 3100, youtube: 2400 }, growth_30d: 1.2, spark: [30, 31, 30, 31, 32, 31, 32, 32], sortlist_rating: 4.6, sortlist_reviews: 48 }),
  base({ slug: 'qamar-films', sample: true, name: 'Qamar Films', domain: 'qamarfilms.example', category: 'video', countries: ['SA'], founded: 2012, created_at: '2026-10-15T09:00:00Z',
    description: 'Commercial film and content production house. TV spots, brand films and social-first video from concept to post.',
    followers: { instagram: 62300, youtube: 41200, tiktok: 88500, linkedin: 5300 }, growth_30d: 12.7, spark: [18, 20, 24, 27, 30, 35, 41, 46], sortlist_rating: 4.7, sortlist_reviews: 14 }),
  base({ slug: 'kayan-digital', sample: true, name: 'Kayan Digital', domain: 'kayan.example', category: 'web', countries: ['EG', 'SA'], founded: 2019, created_at: '2026-10-09T09:00:00Z',
    description: 'Product design and web development agency. Websites, e-commerce stores and mobile apps built for growth.',
    followers: { linkedin: 11200, instagram: 7400, dribbble: 3900, behance: 5200 }, growth_30d: -0.8, spark: [28, 28, 27, 27, 27, 26, 26, 26], sortlist_rating: 4.9, sortlist_reviews: 57 }),
  base({ slug: 'loop-social', sample: true, name: 'Loop Social', domain: 'loopsocial.example', category: 'social', countries: ['EG'], founded: 2020, created_at: '2026-09-22T09:00:00Z',
    description: 'Social media agency running content, community management and influencer campaigns for lifestyle and F&B brands.',
    followers: { instagram: 112000, tiktok: 204000, facebook: 58000, youtube: 8200 }, growth_30d: 15.3, spark: [12, 15, 19, 22, 27, 33, 38, 45], sortlist_rating: 4.4, sortlist_reviews: 19 })
];
