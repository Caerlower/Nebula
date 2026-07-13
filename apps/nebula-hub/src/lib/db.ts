import { createHash, randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Cap pool size so Next.js (many concurrent API routes) does not exhaust
 * Supabase / PgBouncer. Override with PRISMA_CONNECTION_LIMIT.
 */
function withPoolParams(url: string): string {
  if (!url || url.includes("connection_limit=")) return url;
  const limit =
    process.env.PRISMA_CONNECTION_LIMIT?.trim() ||
    (process.env.NODE_ENV === "development" ? "5" : "3");
  const sep = url.includes("?") ? "&" : "?";
  const params = new URLSearchParams();
  params.set("connection_limit", limit);
  params.set("pool_timeout", "20");
  // Transaction pooler (Supabase :6543) needs pgbouncer=true for Prisma.
  if (url.includes(":6543") && !url.includes("pgbouncer=")) {
    params.set("pgbouncer", "true");
  }
  return `${url}${sep}${params.toString()}`;
}

function createPrisma(): PrismaClient {
  const url = withPoolParams(process.env.DATABASE_URL ?? "");
  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * Hot-reload can keep a PrismaClient from before `prisma generate`.
 * Recreate if expected delegates / fields are missing from the schema.
 */
function clientLooksCurrent(client: PrismaClient): boolean {
  if (
    typeof (client as { mppSession?: { findFirst?: unknown } }).mppSession
      ?.findFirst !== "function"
  ) {
    return false;
  }
  // NebulaToken.expiresAt was added for OAuth / Connect API key TTL.
  const fields = (
    client as {
      _runtimeDataModel?: {
        models?: { NebulaToken?: { fields?: Array<{ name?: string }> } };
      };
    }
  )._runtimeDataModel?.models?.NebulaToken?.fields;
  if (
    Array.isArray(fields) &&
    !fields.some((field) => field.name === "expiresAt")
  ) {
    return false;
  }
  return true;
}

function resolvePrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && clientLooksCurrent(existing)) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect().catch(() => undefined);
  }
  const next = createPrisma();
  globalForPrisma.prisma = next;
  return next;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = resolvePrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function hashNebulaToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function mintNebulaTokenPlaintext(): string {
  return `nbl_live_${randomBytes(24).toString("base64url")}`;
}

/**
 * Server-only Supabase client (service-role key — never import this from
 * client components). Returns null when the env isn't configured so callers
 * can fall back to local storage in dev.
 *
 * Required env (apps/nebula-hub/.env.local and Vercel):
 *   SUPABASE_URL=https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
 *
 * Prisma Hub tables use DATABASE_URL / DIRECT_URL — see docs/SUPABASE.md
 */
let cached: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached =
    url && key
      ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
  return cached;
}
