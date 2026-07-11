-- Nebula waitlist table — run once in Supabase: SQL Editor → New query → paste → Run.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

-- The app talks to this table only through the server-side service-role key,
-- so lock the public roles out entirely.
alter table public.waitlist enable row level security;

revoke all on public.waitlist from anon, authenticated;
