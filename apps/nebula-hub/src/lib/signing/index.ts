/**
 * Pluggable Stellar signing.
 *
 * Every Nebula spend ultimately signs a 32-byte transaction (or auth-entry
 * preimage) hash. Historically that hash was always signed by Privy raw_sign
 * with a Nebula-custodied wallet. A `HashSigner` abstracts *where the key
 * lives* so the same tool logic can run custodial or non-custodial:
 *
 *  - `privy`            → Privy Tier-2 raw_sign (Nebula-custodied wallet)
 *  - `partner_callback` → a partner (e.g. Tael) signs with the card key it holds
 *  - `client_side`      → the end user signs in their own wallet (EOA/Freighter)
 *
 * The key never lives in the Hub for the non-custodial strategies.
 */

import { createHmac, randomUUID } from "node:crypto";

import { privyRawSignHash } from "../auth";

export type SignerStrategy = "privy" | "partner_callback" | "client_side";

/**
 * Extra context handed to a signer alongside the hash. Non-custodial partners
 * (e.g. Tael) decode `unsignedXdr` to re-validate the spend against the card's
 * caps before signing. Custodial (Privy) signers ignore it.
 */
export interface SignContext {
  unsignedXdr?: string;
  network?: string;
}

/**
 * Signs a 32-byte Stellar transaction / auth-entry preimage hash (hex in,
 * `0x…` hex signature out). Implementations must not hold a raw private key in
 * the Hub process for non-custodial strategies.
 */
export interface HashSigner {
  readonly strategy: SignerStrategy;
  readonly address: string;
  signHash(hashHex: string, context?: SignContext): Promise<string>;
}

/**
 * Raised when a signature can only be produced off-server (non-custodial EOA
 * accounts). The route layer catches this and returns the unsigned payload for
 * the client wallet to sign, then resubmits the signed XDR.
 */
export class ClientSignatureRequiredError extends Error {
  readonly code = "client_signature_required";
  readonly address: string;
  readonly hashHex: string;
  readonly unsignedXdr?: string;

  constructor(params: {
    address: string;
    hashHex: string;
    unsignedXdr?: string;
  }) {
    super("client_signature_required");
    this.name = "ClientSignatureRequiredError";
    this.address = params.address;
    this.hashHex = params.hashHex;
    this.unsignedXdr = params.unsignedXdr;
  }
}

/** Nebula-custodied signer: Privy Tier-2 raw_sign. Keys stay in Privy. */
export function privySigner(walletId: string, address: string): HashSigner {
  return {
    strategy: "privy",
    address,
    signHash: (hashHex) => privyRawSignHash(walletId, hashHex),
  };
}

/** Config for a partner (Tael) callback signer. */
export interface PartnerSignerConfig {
  /** Partner's sign endpoint, e.g. Tael's `/partner/sign`. */
  endpoint: string;
  /** Shared HMAC secret used to authenticate Nebula → partner requests. */
  secret: string;
  /** Optional partner identifier echoed as a header. */
  partnerId?: string;
}

export function partnerSignerConfigFromEnv(): PartnerSignerConfig | null {
  const endpoint = process.env.TAEL_PARTNER_SIGN_URL?.trim();
  const secret = process.env.TAEL_HMAC_SECRET?.trim();
  if (!endpoint || !secret) return null;
  return { endpoint, secret, partnerId: process.env.TAEL_PARTNER_ID?.trim() };
}

/**
 * Non-custodial partner signer: Nebula never holds the key. For each spend we
 * POST the hash (+ unsigned XDR for the partner's own cap re-validation) to the
 * partner's sign endpoint, authenticated with an HMAC over `timestamp.body`.
 * The partner signs with the card key it custodies and returns the signature.
 *
 * Request  → { card_address, hash_hex, unsigned_xdr, network, nonce }
 * Response ← { signature: "0x…" | "…" }  (ed25519 over the 32-byte hash)
 * Headers  → x-nebula-timestamp, x-nebula-signature (hex hmac-sha256).
 */
export function partnerCallbackSigner(
  address: string,
  config: PartnerSignerConfig,
): HashSigner {
  return {
    strategy: "partner_callback",
    address,
    async signHash(hashHex, context) {
      const body = JSON.stringify({
        card_address: address,
        hash_hex: hashHex.startsWith("0x") ? hashHex.slice(2) : hashHex,
        unsigned_xdr: context?.unsignedXdr ?? null,
        network: context?.network ?? null,
        nonce: randomUUID(),
      });
      const timestamp = Date.now().toString();
      const signature = createHmac("sha256", config.secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nebula-timestamp": timestamp,
          "x-nebula-signature": signature,
          ...(config.partnerId ? { "x-nebula-partner": config.partnerId } : {}),
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `partner_sign_failed(${res.status}): ${text.slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as { signature?: string };
      if (!json.signature) {
        throw new Error("partner_sign_no_signature");
      }
      return json.signature.startsWith("0x")
        ? json.signature
        : `0x${json.signature}`;
    },
  };
}

/**
 * Non-custodial EOA signer. The Hub cannot produce this signature, so it raises
 * `ClientSignatureRequiredError`; the caller hands the unsigned payload to the
 * user's wallet (Freighter etc.) and resubmits the signed result.
 */
export function clientSideSigner(address: string): HashSigner {
  return {
    strategy: "client_side",
    address,
    signHash: async (hashHex) => {
      throw new ClientSignatureRequiredError({ address, hashHex });
    },
  };
}

/** Minimal account shape needed to select a signer. */
export interface SignableAccount {
  accountType: "custodial" | "external";
  signerStrategy: SignerStrategy;
  stellarAddress: string | null;
  privyWalletId: string | null;
}

/**
 * Pick the right {@link HashSigner} for an account. Custodial accounts sign via
 * Privy; external accounts sign non-custodially (EOA today, partner callback
 * once wired). Throws if the account is missing what its strategy needs.
 */
export function resolveSigner(account: SignableAccount): HashSigner {
  if (!account.stellarAddress) {
    throw new Error("cannot resolve a signer without a Stellar address");
  }
  switch (account.signerStrategy) {
    case "privy":
      if (!account.privyWalletId) {
        throw new Error("privy signer strategy requires a privyWalletId");
      }
      return privySigner(account.privyWalletId, account.stellarAddress);
    case "client_side":
      return clientSideSigner(account.stellarAddress);
    case "partner_callback": {
      const config = partnerSignerConfigFromEnv();
      if (!config) {
        throw new Error(
          "partner_callback signer requires TAEL_PARTNER_SIGN_URL and TAEL_HMAC_SECRET",
        );
      }
      return partnerCallbackSigner(account.stellarAddress, config);
    }
    default:
      throw new Error(
        `unknown signer strategy: ${String(account.signerStrategy)}`,
      );
  }
}
