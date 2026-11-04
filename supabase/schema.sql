-- Roster database schema
-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run.

create extension if not exists pgcrypto;

-- Who can use the dashboard and see the directory
create table if not exists team_members (
  email text primary key,
  added_at timestamptz not null default now()
);

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- App settings (single row)
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  refresh_days int not null default 7,      -- how often every company is re-fetched
  public_read boolean not null default false -- true = anyone can browse the directory
);
insert into settings (id) values (1) on conflict do nothing;

create or replace function directory_is_public() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public_read from settings where id = 1), false);
$$;

-- Companies
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  dedupe_key text unique not null,          -- normalised input link, blocks duplicates
  input_url text not null,                  -- the link the team pasted
  name text,
  domain text,
  website text,
  description text,                         -- verbatim from the site, never rewritten
  description_source text,                  -- e.g. "meta description"
  logo_url text,
  category text not null default 'none',
  countries text[] not null default '{}',
  founded int,
  services text[] not null default '{}',
  links jsonb not null default '{}',        -- { instagram: url, linkedin: url, ... }
  followers jsonb not null default '{}',    -- { instagram: 1234, ... } null = could not read
  followers_total int not null default 0,
  growth_30d numeric,
  spark int[] not null default '{}',        -- recent follower totals for the mini chart
  sortlist_url text,
  sortlist_rating numeric,
  sortlist_reviews int,
  status text not null default 'queued' check (status in ('queued','running','done','partial','failed')),
  stage int not null default 0,             -- 0 site, 1 links, 2 followers, 3 sortlist, 4 category, 5 finished
  issues text[] not null default '{}',      -- what is missing, as codes the UI translates
  overrides jsonb not null default '{}',    -- manual edits: name, category, description, followers
  hidden boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  fetched_at timestamptz,
  run_at timestamptz
);
create index if not exists companies_status_idx on companies (status);

-- Added later: About text, contact details (safe to run on an existing database)
alter table companies add column if not exists about text;
alter table companies add column if not exists about_source text;
alter table companies add column if not exists contact jsonb not null default '{}';
alter table companies add column if not exists logo_tone text;  -- 'light' = white logo, shown on a dark tile

-- Daily follower history, used for growth and charts
create table if not exists snapshots (
  company_id uuid not null references companies(id) on delete cascade,
  day date not null default current_date,
  total int not null,
  followers jsonb not null default '{}',
  primary key (company_id, day)
);

-- Personal shortlist
create table if not exists favorites (
  user_id uuid not null default auth.uid(),
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- Row level security
alter table team_members enable row level security;
alter table settings     enable row level security;
alter table companies    enable row level security;
alter table snapshots    enable row level security;
alter table favorites    enable row level security;

drop policy if exists tm_read on team_members;
drop policy if exists tm_write on team_members;
drop policy if exists tm_delete on team_members;
create policy tm_read   on team_members for select using (is_member());
create policy tm_write  on team_members for insert with check (is_member());
create policy tm_delete on team_members for delete using (is_member());

drop policy if exists st_read on settings;
drop policy if exists st_write on settings;
create policy st_read  on settings for select using (true);
create policy st_write on settings for update using (is_member());

drop policy if exists co_read on companies;
drop policy if exists co_insert on companies;
drop policy if exists co_update on companies;
drop policy if exists co_delete on companies;
create policy co_read   on companies for select using (is_member() or (directory_is_public() and not hidden and status in ('done','partial')));
create policy co_insert on companies for insert with check (is_member());
create policy co_update on companies for update using (is_member());
create policy co_delete on companies for delete using (is_member());

drop policy if exists sn_read on snapshots;
create policy sn_read on snapshots for select using (is_member() or directory_is_public());

drop policy if exists fav_all on favorites;
create policy fav_all on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lets the signed-in user check membership from the app
grant execute on function is_member() to anon, authenticated;
grant execute on function directory_is_public() to anon, authenticated;

-- FIRST STEP AFTER RUNNING THIS FILE: add yourself (change the email):
-- insert into team_members (email) values ('you@example.com');
