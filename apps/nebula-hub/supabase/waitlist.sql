-- Prefer running the full Hub schema once:
--   supabase/hub.sql
--
-- This file remains for waitlist-only setups.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

revoke all on public.waitlist from anon, authenticated;
