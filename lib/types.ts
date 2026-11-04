export type Status = 'queued' | 'running' | 'done' | 'partial' | 'failed';

export type Row = {
  id: string; slug: string; dedupe_key: string; input_url: string;
  name: string | null; domain: string | null; website: string | null;
  description: string | null; description_source: string | null; logo_url: string | null; logo_tone?: string | null;
  category: string; countries: string[]; founded: number | null; services: string[];
  links: Record<string, string>; followers: Record<string, number | null>; followers_total: number;
  growth_30d: number | null; spark: number[];
  sortlist_url: string | null; sortlist_rating: number | null; sortlist_reviews: number | null;
  status: Status; stage: number; issues: string[];
  about?: string | null; about_source?: string | null;
  contact?: { emails?: string[]; phones?: string[]; whatsapp?: string | null; address?: string | null };
  overrides: { name?: string; category?: string; description?: string; services?: string[]; followers?: Record<string, number> };
  hidden: boolean; created_by: string | null; created_at: string; fetched_at: string | null; run_at: string | null;
  sample?: boolean; demo?: boolean; // demo mode only
};

export type Co = Row & {
  fol: Record<string, number | null>;  // effective followers (manual overrides applied)
  manualFol: string[];
  total: number;
  edited: string[];
  display: string;                     // name to show
  scraped: { name: string | null; category: string; description: string | null; services: string[] };
};

export function view(r: Row): Co {
  const o = r.overrides || {};
  const fol: Record<string, number | null> = { ...(r.followers || {}) };
  const manualFol: string[] = [];
  Object.entries(o.followers || {}).forEach(([k, v]) => { if (v != null && !Number.isNaN(+v)) { fol[k] = +v; manualFol.push(k); } });
  const total = Object.values(fol).reduce((a: number, b) => a + (b || 0), 0);
  const edited = (['name', 'category', 'description', 'services'] as const).filter(k => o[k] != null);
  const name = o.name ?? r.name ?? r.domain ?? r.input_url;
  return {
    ...r, name, display: name,
    scraped: { name: r.name, category: r.category || 'none', description: r.description, services: r.services || [] },
    category: o.category ?? r.category ?? 'none',
    description: o.description ?? r.description,
    fol, manualFol, total, edited: edited as string[],
    countries: r.countries || [], services: o.services ?? r.services ?? [], contact: r.contact || {}, links: r.links || {}, spark: r.spark || [], issues: r.issues || []
  };
}

export const isIncomplete = (c: Co) => c.status === 'failed' || (c.status === 'partial' && !c.description);
export const isPending = (c: Co) => c.status === 'queued' || (c.status === 'running' && !c.fetched_at);
