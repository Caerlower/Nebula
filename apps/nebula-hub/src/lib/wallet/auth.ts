/**
 * Wallet-native (Freighter / EOA) sign-in — "Sign-In With Stellar".
 *
 * Flow:
 *  1. Client connects Freighter and asks for a challenge (`buildChallenge`).
 *  2. Freighter `signMessage(message)` produces a base64 SEP-53 signature.
 *  3. Client posts { address, message, signature, challengeToken } back; the
 *     server re-verifies the challenge binding + the signature (`verifyChallenge`).
 *  4. Server mints an HMAC session token stored in an httpOnly cookie.
 *
 * No private key ever reaches the Hub — this proves wallet ownership only.
 * Everything is stateless: the challenge and session are self-describing signed
 * tokens, so no extra DB tables are needed.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { Keypair } from "@stellar/stellar-sdk";

export const SESSION_COOKIE = "nebula_session";

/** SEP-53 fixed prefix for off-chain message signing. */
const SEP53_PREFIX = "Stellar Signed Message:\n";

/** SEP-53 canonical hash: SHA256(prefix || message). */
function sep53MessageHash(message: string): Buffer {
  const encoded = Buffer.concat([
    Buffer.from(SEP53_PREFIX, "utf8"),
    Buffer.from(message, "utf8"),
  ]);
  return createHash("sha256").update(encoded).digest();
}

const CHALLENGE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

const SIGN_IN_DOMAIN = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.nebulaonchain.xyz"
)
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

/** Stable HMAC secret for challenge + session tokens. */
function sessionSecret(): string {
  const secret =
    process.env.WALLET_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    throw new Error("WALLET_SESSION_SECRET is not set");
  }
  // Local dev fallback only — never used in production.
  return "dev-only-insecure-wallet-session-secret";
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Compact `<body>.<sig>` HMAC token (JWT-ish, no external dep). */
function signToken(payload: Record<string, unknown>): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", sessionSecret()).update(body).digest());
  return `${body}.${sig}`;
}

function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(
    createHmac("sha256", sessionSecret()).update(body).digest(),
  );
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      exp?: number;
    };
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload as T;
  } catch {
    return null;
  }
}

export function isStellarPublicKey(address: string): boolean {
  try {
    Keypair.fromPublicKey(address);
    return address.startsWith("G") && address.length === 56;
  } catch {
    return false;
  }
}

export type WalletChallenge = {
  message: string;
  challengeToken: string;
  expiresAt: number;
};

/** Build a signable challenge message + a bound, stateless challenge token. */
export function buildChallenge(address: string): WalletChallenge | null {
  if (!isStellarPublicKey(address)) return null;
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = Date.now();
  const exp = issuedAt + CHALLENGE_TTL_MS;
  const message = [
    `${SIGN_IN_DOMAIN} wants you to sign in with your Stellar account:`,
    address,
    "",
    "Sign this message to prove you own this wallet. This does not create a transaction or cost any fees.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
    `Expires At: ${new Date(exp).toISOString()}`,
  ].join("\n");
  const challengeToken = signToken({ address, nonce, exp });
  return { message, challengeToken, expiresAt: exp };
}

/**
 * Verify a signed challenge. Confirms the challenge token was issued by us, is
 * unexpired, is bound to this address + message, and that the signature is a
 * valid SEP-53 signature from the wallet.
 */
export function verifyChallenge(params: {
  address: string;
  message: string;
  signature: string;
  challengeToken: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!isStellarPublicKey(params.address)) {
    return { ok: false, reason: "invalid_address" };
  }
  const claim = verifyToken<{ address: string; nonce: string; exp: number }>(
    params.challengeToken,
  );
  if (!claim) return { ok: false, reason: "challenge_invalid_or_expired" };
  if (claim.address !== params.address) {
    return { ok: false, reason: "challenge_address_mismatch" };
  }
  if (!params.message.includes(claim.nonce)) {
    return { ok: false, reason: "challenge_nonce_mismatch" };
  }

  let signatureBuf: Buffer;
  try {
    signatureBuf = Buffer.from(params.signature, "base64");
  } catch {
    return { ok: false, reason: "signature_decode_failed" };
  }

  try {
    const keypair = Keypair.fromPublicKey(params.address);
    // Freighter signs per SEP-53: sign(SHA256(prefix || message)).
    const valid = keypair.verify(sep53MessageHash(params.message), signatureBuf);
    if (!valid) return { ok: false, reason: "signature_invalid" };
  } catch {
    return { ok: false, reason: "signature_verify_failed" };
  }

  return { ok: true };
}

export type WalletSessionClaims = {
  sub: string;
  addr: string;
  typ: "wallet";
  exp: number;
};

export function mintWalletSessionToken(params: {
  userId: string;
  address: string;
}): { token: string; expiresAt: number } {
  const exp = Date.now() + SESSION_TTL_MS;
  const token = signToken({
    sub: params.userId,
    addr: params.address,
    typ: "wallet",
    exp,
  });
  return { token, expiresAt: exp };
}

export function readWalletSession(token: string): WalletSessionClaims | null {
  const claims = verifyToken<WalletSessionClaims>(token);
  if (!claims || claims.typ !== "wallet" || !claims.sub) return null;
  return claims;
}

/** httpOnly, same-site cookie header value for the session token. */
export function sessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}
