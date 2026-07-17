import { createHash, createPrivateKey, sign as cryptoSign } from "node:crypto";

import { PrivyClient, type User } from "@privy-io/node";
import { NextRequest } from "next/server";

import { hashNebulaToken, prisma } from "./db";
import { SESSION_COOKIE, readWalletSession } from "./wallet-auth";

/**
 * Per-token principal cache. Without it every API request pays token
 * verification + a remote Privy getUserById + user upserts before doing any
 * real work — which is exactly the "every page change is slow" tax, since a
 * page mounts several fetches at once. A verified bearer token maps to the
 * same principal for its lifetime, so a short TTL is safe: revocation and
 * profile changes surface within a minute.
 */
const PRINCIPAL_TTL_MS = 60_000;
/** Short TTL while the wallet is still provisioning so refreshes pick it up. */
const PROVISIONING_TTL_MS = 5_000;
const MAX_CACHE_ENTRIES = 1_000;

const principalCache = new Map<
  string,
  { principal: AuthPrincipal; expiresAt: number }
>();

function tokenCacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getCachedPrincipal(key: string): AuthPrincipal | null {
  const hit = principalCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    principalCache.delete(key);
    return null;
  }
  return hit.principal;
}

function cachePrincipal(key: string, principal: AuthPrincipal): void {
  if (principalCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = principalCache.keys().next().value;
    if (oldest) principalCache.delete(oldest);
  }
  const ttl = principal.stellarAddress ? PRINCIPAL_TTL_MS : PROVISIONING_TTL_MS;
  principalCache.set(key, { principal, expiresAt: Date.now() + ttl });
}

export type AuthPrincipal = {
  userId: string;
  agentId: string | null;
  tokenId: string | null;
  source: "nebula_token" | "privy_session" | "dev_mint" | "wallet_session";
  email: string | null;
  stellarAddress: string | null;
  privyWalletId: string | null;
  /** How this account holds funds: Nebula-custodied vs. self-custody / partner. */
  accountType: "custodial" | "external";
  /** Where signatures come from for this account's spends. */
  signerStrategy: "privy" | "partner_callback" | "client_side";
};

function normalizeSignerStrategy(
  value: string | null | undefined,
): AuthPrincipal["signerStrategy"] {
  return value === "client_side"
    ? "client_side"
    : value === "partner_callback"
      ? "partner_callback"
      : "privy";
}

async function principalFromUser(
  user: {
    id: string;
    email: string | null;
    stellarAddress: string | null;
    privyWalletId: string | null;
    accountType?: string | null;
    signerStrategy?: string | null;
  },
  source: AuthPrincipal["source"],
  extra?: { agentId?: string | null; tokenId?: string | null },
): Promise<AuthPrincipal> {
  return {
    userId: user.id,
    agentId: extra?.agentId ?? null,
    tokenId: extra?.tokenId ?? null,
    source,
    email: user.email,
    stellarAddress: user.stellarAddress,
    privyWalletId: user.privyWalletId,
    // Persisted on the account: Privy users are custodial/privy; wallet-native
    // (Freighter/EOA) accounts are external/client_side.
    accountType: user.accountType === "external" ? "external" : "custodial",
    signerStrategy: normalizeSignerStrategy(user.signerStrategy),
  };
}

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

/**
 * Resolve Authorization: Bearer nbl_live_… | Privy access token
 * OR local DEV_MINT_SECRET header for curl demos.
 */
export async function resolveAuth(
  req: NextRequest,
): Promise<AuthPrincipal | null> {
  const token = bearerToken(req);
  // Partner (Tael) attribution: a company token + this header identifies which
  // card is calling. It changes the resolved principal, so it must key the cache.
  const taelAgent = req.headers.get("x-tael-agent")?.trim() || null;
  // Wallet-native (Freighter/EOA) sessions carry an httpOnly cookie, not a Bearer.
  const sessionToken = token
    ? null
    : (req.cookies.get(SESSION_COOKIE)?.value ?? null);
  const cacheKey = token
    ? tokenCacheKey(taelAgent ? `${token}::${taelAgent}` : token)
    : sessionToken
      ? tokenCacheKey(sessionToken)
      : null;
  if (cacheKey) {
    const cached = getCachedPrincipal(cacheKey);
    if (cached) return cached;
  }

  if (token?.startsWith("nbl_live_")) {
    const tokenHash = hashNebulaToken(token);
    const row = await prisma.nebulaToken.findUnique({
      where: { tokenHash },
      include: { user: true, agent: true },
    });
    if (!row || row.revokedAt) {
      return null;
    }
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    // Bookkeeping only — never block the request on it.
    void prisma.nebulaToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    const principal = await principalFromUser(row.user, "nebula_token", {
      agentId: row.agentId,
      tokenId: row.id,
    });
    // A token bound to an agent operates the AGENT's own wallet + signer, not
    // the owner's. Legacy agents without a provisioned wallet fall back to the
    // owner wallet (backward compatible). Tael cards surface here as
    // partner_callback agents whose address is the external card.
    if (row.agent?.stellarAddress) {
      principal.stellarAddress = row.agent.stellarAddress;
      principal.privyWalletId = row.agent.privyWalletId;
      principal.accountType =
        row.agent.accountType === "external" ? "external" : "custodial";
      principal.signerStrategy = normalizeSignerStrategy(
        row.agent.signerStrategy,
      );
    } else if (taelAgent) {
      // Company (agent-less) token + x-tael-agent header → resolve the card
      // agent owned by this company account and operate that card's wallet.
      const card = await prisma.agent.findFirst({
        where: { userId: row.userId, stellarAddress: taelAgent },
      });
      if (card) {
        principal.agentId = card.id;
        principal.stellarAddress = card.stellarAddress;
        principal.privyWalletId = card.privyWalletId;
        principal.accountType =
          card.accountType === "external" ? "external" : "custodial";
        principal.signerStrategy = normalizeSignerStrategy(card.signerStrategy);
      }
    }
    if (cacheKey) cachePrincipal(cacheKey, principal);
    return principal;
  }

  if (token && privyConfigured()) {
    const privy = getPrivy();
    if (privy) {
      try {
        const claims = await privy.utils().auth().verifyAccessToken(token);

        // Fast path: a known user needs no remote Privy profile fetch —
        // one indexed lookup and we're done.
        const existing = await prisma.user.findUnique({
          where: { privyUserId: claims.user_id },
        });
        if (existing) {
          if (!existing.privyWalletId || !existing.stellarAddress) {
            // Retry wallet provisioning in the background (no-op when done).
            void ensureUserFromPrivy({
              privyUserId: claims.user_id,
              email: existing.email,
              name: existing.name,
            }).catch(() => {});
          }
          const principal = await principalFromUser(existing, "privy_session");
          if (cacheKey) cachePrincipal(cacheKey, principal);
          return principal;
        }

        // First login: fetch the Privy profile to create the user row.
        const privyUser = await privy.users()._get(claims.user_id);
        const profile = profileFromPrivyUser(privyUser);
        const emailAccount =
          profile.email ||
          `${claims.user_id.replace(/[^a-zA-Z0-9]/g, "").slice(-16)}@users.nebula.local`;
        const name = profile.name || profile.email?.split("@")[0] || null;
        const user = await ensureUserFromPrivy({
          privyUserId: claims.user_id,
          email: emailAccount,
          name,
        });
        const principal = await principalFromUser(user, "privy_session");
        if (cacheKey) cachePrincipal(cacheKey, principal);
        return principal;
      } catch (error) {
        console.error("[auth] Privy token verify failed", error);
      }
    }
  }

  // Wallet-native sign-in (Freighter / EOA): httpOnly session cookie.
  if (sessionToken) {
    const claims = readWalletSession(sessionToken);
    if (claims) {
      const user = await prisma.user.findUnique({ where: { id: claims.sub } });
      if (user) {
        const principal = await principalFromUser(user, "wallet_session");
        if (cacheKey) cachePrincipal(cacheKey, principal);
        return principal;
      }
    }
  }

  // Local demo only — never honor in production / on Vercel.
  const devSecret = req.headers.get("x-nebula-dev-mint");
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL !== "1" &&
    process.env.DEV_MINT_SECRET &&
    devSecret === process.env.DEV_MINT_SECRET
  ) {
    const email = process.env.DEV_USER_EMAIL ?? "dev@nebula.local";
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        privyUserId: `dev|${email}`,
        email,
        name: "Dev User",
        stellarAddress: demoStellarAddress(),
        privyWalletId: demoPrivyWalletId(),
      },
      update: {
        stellarAddress: demoStellarAddress(),
        privyWalletId: demoPrivyWalletId(),
      },
    });
    await prisma.policySettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    return principalFromUser(user, "dev_mint");
  }

  return null;
}

export function unauthorized(): Response {
  return Response.json({ status: "error", reason: "unauthorized" }, { status: 401 });
}

export function forbidden(reason: string): Response {
  return Response.json({ status: "rejected", reason }, { status: 403 });
}

export function isDashboardAuth(principal: AuthPrincipal): boolean {
  return (
    principal.source === "privy_session" ||
    principal.source === "dev_mint" ||
    principal.source === "wallet_session"
  );
}

/**
 * Local-demo wallet defaults when Privy wallet API isn't fully configured.
 * Real addresses come from Privy server wallets on first login.
 */
export function demoStellarAddress(): string {
  return (
    process.env.DEV_STELLAR_ADDRESS?.trim() ||
    // Fixed valid G-address for dry-run demos only (not a funded account).
    "GBPKRIZ7TT2LHECTS4C4XXXM3F3HIABTHY2FLG7UUKNN3MKV3YRV4ODI"
  );
}

export function demoPrivyWalletId(): string {
  return process.env.DEV_PRIVY_WALLET_ID?.trim() || "dev-wallet";
}

/**
 * Upsert Hub user from a verified Privy user id. Provisions a Stellar server wallet
 * on first login when PRIVY_* wallet API is configured.
 */
export async function ensureUserFromPrivy(claims: {
  privyUserId: string;
  email?: string | null;
  name?: string | null;
}) {
  const email = claims.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Privy user is missing an email");
  }

  let user = await prisma.user.findUnique({
    where: { privyUserId: claims.privyUserId },
  });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        privyUserId: claims.privyUserId,
        email,
        name: claims.name ?? null,
      },
    });
    await prisma.policySettings.create({ data: { userId: user.id } });
  } else if (user.privyUserId !== claims.privyUserId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        privyUserId: claims.privyUserId,
        name: claims.name ?? user.name,
      },
    });
  }

  if (!user.privyWalletId || !user.stellarAddress) {
    // Await provisioning briefly so the first /api/me response usually has a
    // wallet. Cap wait so Privy latency cannot hang OAuth/login forever.
    const userId = user.id;
    const provision = createStellarWalletForUser(userId);
    try {
      const wallet = await Promise.race([
        provision,
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 8_000);
        }),
      ]);
      if (wallet) {
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            privyWalletId: wallet.walletId,
            stellarAddress: wallet.address,
          },
        });
      } else {
        // Timed out — finish the same in-flight provision in the background.
        void provision
          .then(async (late) => {
            if (!late) return;
            await prisma.user.update({
              where: { id: userId },
              data: {
                privyWalletId: late.walletId,
                stellarAddress: late.address,
              },
            });
          })
          .catch((error) => {
            console.error("[users] background wallet provision failed", error);
          });
      }
    } catch (error) {
      console.error("[users] wallet provision failed", error);
    }
  }

  return user;
}

// ---------------------------------------------------------------------------
// Privy client / signing (formerly src/lib/privy.ts)
// ---------------------------------------------------------------------------

let client: PrivyClient | null | undefined;

export function privyConfigured(): boolean {
  return Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

export function getPrivy(): PrivyClient | null {
  if (client !== undefined) return client;
  if (!privyConfigured()) {
    client = null;
    return null;
  }
  client = new PrivyClient({
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
  });
  return client;
}

export type StellarWalletRef = {
  walletId: string;
  address: string;
};

/**
 * Create a Privy server Stellar wallet (Tier-2). Returns null if Privy isn't configured.
 * Signing later needs PRIVY_AUTHORIZATION_PRIVATE_KEY (authorization key from Privy dashboard).
 */
export async function createStellarWalletForUser(
  _userId: string,
): Promise<StellarWalletRef | null> {
  const privy = getPrivy();
  if (!privy) return null;

  try {
    const created = await privy.wallets().create({
      chain_type: "stellar",
    });
    return { walletId: created.id, address: created.address };
  } catch (error) {
    console.error("[privy] wallets().create(stellar) failed", error);
    return null;
  }
}

/** Pull email/name from new SDK linked_accounts shape. */
export function profileFromPrivyUser(user: User): {
  email: string | null;
  name: string | null;
} {
  let email: string | null = null;
  let name: string | null = null;
  for (const account of user.linked_accounts) {
    if (account.type === "email" && !email) {
      email = account.address;
    } else if (account.type === "google_oauth") {
      if (!email) email = account.email;
      if (!name && account.name) name = account.name;
    } else if (account.type === "github_oauth") {
      if (!email && "email" in account && typeof account.email === "string") {
        email = account.email;
      }
      if (!name && "name" in account && typeof account.name === "string") {
        name = account.name;
      } else if (
        !name &&
        "username" in account &&
        typeof account.username === "string"
      ) {
        name = account.username;
      }
    }
  }
  return { email, name };
}

function basicAuthHeader(): string {
  const id = process.env.PRIVY_APP_ID!;
  const secret = process.env.PRIVY_APP_SECRET!;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

/**
 * Privy dashboard keys look like `wallet-auth:<base64-pkcs8>` (no PEM headers).
 * PEM with BEGIN/END also works. See:
 * https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation
 */
function loadAuthorizationPrivateKey() {
  const raw = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY?.trim();
  if (!raw) return null;

  let material = raw.replace(/\\n/g, "\n").trim();
  if (
    (material.startsWith('"') && material.endsWith('"')) ||
    (material.startsWith("'") && material.endsWith("'"))
  ) {
    material = material.slice(1, -1);
  }
  if (material.startsWith("wallet-auth:")) {
    material = material.slice("wallet-auth:".length);
  }
  if (!material.includes("BEGIN PRIVATE KEY")) {
    material = `-----BEGIN PRIVATE KEY-----\n${material}\n-----END PRIVATE KEY-----`;
  }
  return createPrivateKey(material);
}

/** RFC 8785-ish key sorting so Privy can verify the signature. */
function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [
          key,
          sortKeys((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
}

/**
 * Sign Privy wallet API requests when an authorization private key is configured.
 * See: https://docs.privy.io/controls/authorization-keys
 */
function authorizationSignature(
  method: string,
  url: string,
  body: unknown,
): string | undefined {
  const key = loadAuthorizationPrivateKey();
  if (!key) return undefined;

  const payload = {
    version: 1,
    method,
    url,
    body,
    headers: {
      "privy-app-id": process.env.PRIVY_APP_ID,
    },
  };
  const serialized = canonicalize(payload);
  // P-256 authorization keys must be signed with SHA-256 (not the default null algo).
  const signature = cryptoSign("sha256", Buffer.from(serialized), key);
  return signature.toString("base64");
}

/**
 * Sign a Stellar transaction hash via Privy raw_sign (Tier-2).
 * Returns hex signature (0x…).
 */
export async function privyRawSignHash(
  walletId: string,
  hashHex: string,
): Promise<string> {
  if (!privyConfigured()) {
    throw new Error("Privy is not configured (PRIVY_APP_ID / PRIVY_APP_SECRET)");
  }

  const hash = hashHex.startsWith("0x") ? hashHex : `0x${hashHex}`;
  const url = `https://api.privy.io/v1/wallets/${walletId}/raw_sign`;
  const body = { params: { hash } };
  const headers: Record<string, string> = {
    Authorization: basicAuthHeader(),
    "Content-Type": "application/json",
    "privy-app-id": process.env.PRIVY_APP_ID!,
  };
  const authSig = authorizationSignature("POST", url, body);
  if (authSig) {
    headers["privy-authorization-signature"] = authSig;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Privy raw_sign failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as {
    data?: { signature?: string; encoding?: string };
    signature?: string;
  };
  const signature = json.data?.signature ?? json.signature;
  if (!signature) {
    throw new Error("Privy raw_sign returned no signature");
  }
  return signature.startsWith("0x") ? signature : `0x${signature}`;
}

/** Cheap health probe — does not create a wallet. */
export function privyAppIdFingerprint(): string | null {
  const id = process.env.PRIVY_APP_ID;
  if (!id) return null;
  return createHash("sha256").update(id).digest("hex").slice(0, 8);
}
