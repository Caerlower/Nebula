-- Twin-agent / network isolation schema (idempotent).
-- Safe to re-run against Supabase / Postgres used by Nebula Hub.
-- Applies: preferredNetwork, Agent/Transaction/Confirmation/PolicySettings.network,
-- PolicySettings composite PK (userId, network), and supporting indexes.

BEGIN;

-- User.preferredNetwork
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "preferredNetwork" TEXT NOT NULL DEFAULT 'testnet';

-- Agent.network
ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "network" TEXT NOT NULL DEFAULT 'testnet';
CREATE INDEX IF NOT EXISTS "Agent_userId_network_idx"
  ON "Agent" ("userId", "network");

-- Transaction.network
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "network" TEXT NOT NULL DEFAULT 'testnet';
CREATE INDEX IF NOT EXISTS "Transaction_userId_network_createdAt_idx"
  ON "Transaction" ("userId", "network", "createdAt");

-- Confirmation.network
ALTER TABLE "Confirmation"
  ADD COLUMN IF NOT EXISTS "network" TEXT NOT NULL DEFAULT 'testnet';
CREATE INDEX IF NOT EXISTS "Confirmation_userId_network_idx"
  ON "Confirmation" ("userId", "network");

-- PolicySettings.network + composite primary key
ALTER TABLE "PolicySettings"
  ADD COLUMN IF NOT EXISTS "network" TEXT NOT NULL DEFAULT 'testnet';

-- Backfill any legacy NULLs (if column existed nullable)
UPDATE "User" SET "preferredNetwork" = 'testnet'
  WHERE "preferredNetwork" IS NULL OR "preferredNetwork" = '';
UPDATE "Agent" SET "network" = 'testnet'
  WHERE "network" IS NULL OR "network" = '';
UPDATE "Transaction" SET "network" = 'testnet'
  WHERE "network" IS NULL OR "network" = '';
UPDATE "Confirmation" SET "network" = 'testnet'
  WHERE "network" IS NULL OR "network" = '';
UPDATE "PolicySettings" SET "network" = 'testnet'
  WHERE "network" IS NULL OR "network" = '';

-- Rebuild PolicySettings PK to (userId, network) if still single-column
DO $$
DECLARE
  pk_cols text;
BEGIN
  SELECT string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position)
    INTO pk_cols
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'PolicySettings'
    AND tc.constraint_type = 'PRIMARY KEY';

  IF pk_cols IS DISTINCT FROM 'userId,network' THEN
    ALTER TABLE "PolicySettings" DROP CONSTRAINT IF EXISTS "PolicySettings_pkey";
    -- Deduplicate before composite PK (keep one row per userId+network)
    DELETE FROM "PolicySettings" a
      USING "PolicySettings" b
     WHERE a.ctid < b.ctid
       AND a."userId" = b."userId"
       AND a."network" = b."network";
    ALTER TABLE "PolicySettings"
      ADD CONSTRAINT "PolicySettings_pkey" PRIMARY KEY ("userId", "network");
  END IF;
END $$;

COMMIT;
