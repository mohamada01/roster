// Starts the GitHub Actions fetch job right away. Only signed-in team members can call it.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  const token = process.env.GITHUB_DISPATCH_TOKEN, repo = process.env.GITHUB_REPO;
  if (!url || !anon) return NextResponse.json({ dispatched: false, reason: 'supabase_not_configured' });
  if (!token || !repo) return NextResponse.json({ dispatched: false, reason: 'github_not_configured' });

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return NextResponse.json({ dispatched: false, reason: 'signed_out' }, { status: 401 });
  const sb = createClient(url, anon, { global: { headers: { Authorization: 'Bearer ' + jwt } }, auth: { persistSession: false } });
  const { data: member } = await sb.rpc('is_member');
  if (!member) return NextResponse.json({ dispatched: false, reason: 'not_member' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const inputs: Record<string, string> = { mode: ['queued', 'scheduled', 'all'].includes(body.mode) ? body.mode : 'queued' };
  if (typeof body.company_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.company_id)) inputs.company_id = body.company_id;

  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/fetch.yml/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
    body: JSON.stringify({ ref: process.env.GITHUB_BRANCH || 'main', inputs })
  });
  return NextResponse.json({ dispatched: r.status === 204, status: r.status });
}
