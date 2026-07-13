-- Nebula Hub schema — run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run (IF NOT EXISTS). Keeps waitlist table untouched.

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
create table if not exists public."User" (
  id               text primary key,
  "privyUserId"    text not null unique,
  email            text not null unique,
  name             text,
  "privyWalletId"  text unique,
  "stellarAddress" text unique,
  "createdAt"      timestamptz not null default now()
);

-- If you already ran an older hub.sql with auth0Id:
--   alter table public."User" rename column "auth0Id" to "privyUserId";

-- ---------------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------------
create table if not exists public."Agent" (
  id          text primary key,
  "userId"    text not null references public."User"(id) on delete cascade,
  name        text not null,
  framework   text not null,
  status      text not null default 'active',
  "createdAt" timestamptz not null default now()
);

create index if not exists "Agent_userId_idx" on public."Agent"("userId");

-- ---------------------------------------------------------------------------
-- Nebula tokens (hashed nbl_live_… only — never store plaintext)
-- ---------------------------------------------------------------------------
create table if not exists public."NebulaToken" (
  id           text primary key,
  "userId"     text not null references public."User"(id) on delete cascade,
  "agentId"    text references public."Agent"(id) on delete set null,
  label        text not null,
  "tokenHash"  text not null unique,
  "lastUsedAt" timestamptz,
  "revokedAt"  timestamptz,
  "expiresAt"  timestamptz,
  "createdAt"  timestamptz not null default now()
);

create index if not exists "NebulaToken_userId_idx" on public."NebulaToken"("userId");

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
create table if not exists public."Transaction" (
  id               text primary key,
  "userId"         text not null references public."User"(id) on delete cascade,
  "agentId"        text,
  type             text not null,
  destination      text not null,
  "amountXlm"      numeric(18, 7) not null,
  memo             text,
  reason           text not null,
  "txHash"         text unique,
  status           text not null,
  "confirmationId" text,
  "createdAt"      timestamptz not null default now()
);

create index if not exists "Transaction_userId_createdAt_idx"
  on public."Transaction"("userId", "createdAt" desc);

-- ---------------------------------------------------------------------------
-- Confirmations
-- ---------------------------------------------------------------------------
create table if not exists public."Confirmation" (
  id           text primary key,
  "userId"     text not null references public."User"(id) on delete cascade,
  "toolName"   text not null,
  input        jsonb not null,
  summary      text not null,
  status       text not null default 'pending',
  "expiresAt"  timestamptz not null,
  "approvedAt" timestamptz,
  "txHash"     text,
  "createdAt"  timestamptz not null default now()
);

create index if not exists "Confirmation_userId_idx" on public."Confirmation"("userId");

-- ---------------------------------------------------------------------------
-- Whitelist / denylist
-- ---------------------------------------------------------------------------
create table if not exists public."WhitelistEntry" (
  id          text primary key,
  "userId"    text not null references public."User"(id) on delete cascade,
  address     text not null,
  label       text not null,
  "createdAt" timestamptz not null default now(),
  unique ("userId", address)
);

create table if not exists public."DenylistEntry" (
  id          text primary key,
  "userId"    text not null references public."User"(id) on delete cascade,
  address     text not null,
  reason      text,
  "createdAt" timestamptz not null default now(),
  unique ("userId", address)
);

-- ---------------------------------------------------------------------------
-- Policy settings (per user)
-- ---------------------------------------------------------------------------
create table if not exists public."PolicySettings" (
  "userId"            text primary key references public."User"(id) on delete cascade,
  "microThreshold"    numeric(18, 7) not null default 0.1,
  "perTxCap"          numeric(18, 7) not null default 5,
  "dailyCap"          numeric(18, 7) not null default 20,
  paused              boolean not null default false,
  "autoYield"         boolean not null default true,
  "liquidThreshold"   numeric(18, 7) not null default 2,
  "liquidHigh"        numeric(18, 7) not null default 10,
  "catTransfer"       numeric(18, 7) not null default 20,
  "catX402"           numeric(18, 7) not null default 5,
  "catMpp"            numeric(18, 7) not null default 5
);

-- Idempotent adds for existing DBs
alter table public."PolicySettings" add column if not exists "catTransfer" numeric(18, 7) not null default 20;
alter table public."PolicySettings" add column if not exists "catX402" numeric(18, 7) not null default 5;
alter table public."PolicySettings" add column if not exists "catMpp" numeric(18, 7) not null default 5;
alter table public."PolicySettings" add column if not exists "liquidHigh" numeric(18, 7) not null default 10;
-- Blend was briefly a spend category; drop if present (treasury move, not outbound spend)
alter table public."PolicySettings" drop column if exists "catBlend";

-- ---------------------------------------------------------------------------
-- Waitlist (idempotent — same as waitlist.sql)
-- ---------------------------------------------------------------------------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lock down public roles — Hub uses DATABASE_URL (postgres) / service role.
-- ---------------------------------------------------------------------------
alter table public."User" enable row level security;
alter table public."Agent" enable row level security;
alter table public."NebulaToken" enable row level security;
alter table public."Transaction" enable row level security;
alter table public."Confirmation" enable row level security;
alter table public."WhitelistEntry" enable row level security;
alter table public."DenylistEntry" enable row level security;
alter table public."PolicySettings" enable row level security;
alter table public.waitlist enable row level security;

revoke all on public."User" from anon, authenticated;
revoke all on public."Agent" from anon, authenticated;
revoke all on public."NebulaToken" from anon, authenticated;
revoke all on public."Transaction" from anon, authenticated;
revoke all on public."Confirmation" from anon, authenticated;
revoke all on public."WhitelistEntry" from anon, authenticated;
revoke all on public."DenylistEntry" from anon, authenticated;
revoke all on public."PolicySettings" from anon, authenticated;
revoke all on public.waitlist from anon, authenticated;

-- ---------------------------------------------------------------------------
-- OAuth DCR (remote MCP connectors)
-- ---------------------------------------------------------------------------
create table if not exists public."OAuthClient" (
  "clientId"         text primary key,
  "clientSecretHash" text,
  "clientName"       text,
  "redirectUris"     jsonb not null,
  "createdAt"        timestamptz not null default now()
);

create table if not exists public."OAuthAuthorizationCode" (
  "codeHash"            text primary key,
  "clientId"            text not null,
  "userId"              text not null,
  "redirectUri"         text not null,
  "codeChallenge"       text not null,
  "codeChallengeMethod" text not null default 'S256',
  "expiresAt"           timestamptz not null,
  "usedAt"              timestamptz,
  "createdAt"           timestamptz not null default now()
);

create index if not exists "OAuthAuthorizationCode_clientId_idx"
  on public."OAuthAuthorizationCode"("clientId");

-- ---------------------------------------------------------------------------
-- MPP payment-channel sessions
-- ---------------------------------------------------------------------------
create table if not exists public."MppSession" (
  id                    text primary key,
  "userId"              text not null references public."User"(id) on delete cascade,
  channel               text not null,
  recipient             text not null,
  "budgetUsdc"          numeric(18, 7) not null,
  "budgetStroops"       text not null,
  "cumulativeStroops"   text not null default '0',
  "commitmentSecretHex" text not null,
  "commitmentPubkeyHex" text not null,
  "networkId"           text not null,
  status                text not null default 'open',
  "openedAt"            timestamptz not null default now(),
  "closedAt"            timestamptz,
  "closeTxHash"         text,
  "deployWasmHash"      text
);

create index if not exists "MppSession_userId_status_idx"
  on public."MppSession"("userId", status);

alter table public."OAuthClient" enable row level security;
alter table public."OAuthAuthorizationCode" enable row level security;
alter table public."MppSession" enable row level security;
revoke all on public."OAuthClient" from anon, authenticated;
revoke all on public."OAuthAuthorizationCode" from anon, authenticated;
revoke all on public."MppSession" from anon, authenticated;

-- Stellar8004 reputation cache (safe to re-run)
alter table public."User"
  add column if not exists "stellar8004AgentId" integer;
alter table public."User"
  add column if not exists "reputationScore" integer not null default 0;
alter table public."User"
  add column if not exists "reputationTier" text not null default 'unrated';
alter table public."Agent"
  add column if not exists "reputationScore" integer not null default 0;
alter table public."Agent"
  add column if not exists "reputationTier" text not null default 'unrated';

-- OAuth / MCP token expiry (null = until revoked)
alter table public."NebulaToken"
  add column if not exists "expiresAt" timestamptz;
