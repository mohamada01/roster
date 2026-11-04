import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;

export const LIVE = Boolean(url && key);

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient | null {
  if (!LIVE) return null;
  if (!client) client = createClient(url!, key!, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });
  return client;
}
