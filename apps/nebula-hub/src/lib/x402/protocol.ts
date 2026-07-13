import { hash, Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { x402Client } from "@x402/core/client";
import type { PaymentRequirements } from "@x402/core/types";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import type { ClientStellarSigner } from "@x402/stellar";
import { DEFAULT_TOKEN_DECIMALS, getNetworkPassphrase } from "@x402/stellar";

import { privyRawSignHash } from "@/lib/auth";

export type X402Network = "stellar:testnet" | "stellar:pubnet";

export function getX402Network(
  network: "testnet" | "mainnet",
): X402Network {
  return network === "mainnet" ? "stellar:pubnet" : "stellar:testnet";
}

export function getX402RpcUrl(network: "testnet" | "mainnet"): string {
  if (network === "mainnet") {
    return (
      process.env.STELLAR_MAINNET_RPC_URL?.trim() ||
      "https://mainnet.sorobanrpc.com"
    );
  }
  return (
    process.env.STELLAR_TESTNET_RPC_URL?.trim() ||
    "https://soroban-testnet.stellar.org"
  );
}

/** Circle classic USDC issuer (testnet / mainnet). */
export function circleUsdcIssuer(network: "testnet" | "mainnet"): string {
  return network === "mainnet"
    ? "GA5ZSEJYB37JRC5RJRC75UPGWKOWTXQYPFJXXQE2RXYI763DGSJDFLVQ"
    : "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
}

const AMOUNT_SCALE = 10 ** DEFAULT_TOKEN_DECIMALS;

function requirementsAmountRaw(requirements: PaymentRequirements): string {
  if (requirements.scheme && "amount" in requirements && requirements.amount) {
    return requirements.amount;
  }

  const legacy = requirements as PaymentRequirements & {
    maxAmountRequired?: string;
  };
  if (legacy.maxAmountRequired) {
    return legacy.maxAmountRequired;
  }

  throw new Error("Payment requirements are missing an amount field.");
}

export function paymentRequirementsToUsdc(
  requirements: PaymentRequirements,
): number {
  const units = BigInt(requirementsAmountRaw(requirements));
  return Number(units) / AMOUNT_SCALE;
}

export function payToAddress(
  requirements: PaymentRequirements,
): string | null {
  const payTo = (requirements as { payTo?: string }).payTo;
  return typeof payTo === "string" && payTo.startsWith("G") ? payTo : null;
}

/**
 * SEP-43-style client signer backed by Privy raw_sign.
 * Keys never leave Privy — we only sign the auth-entry preimage hash.
 */
export function createPrivyX402Signer(params: {
  walletId: string;
  stellarAddress: string;
  network: "testnet" | "mainnet";
}): ClientStellarSigner {
  const x402Network = getX402Network(params.network);
  const defaultPassphrase = getNetworkPassphrase(x402Network);

  return {
    address: params.stellarAddress,
    signAuthEntry: async (authEntry) => {
      const preimageHash = hash(Buffer.from(authEntry, "base64"));
      const signatureHex = await privyRawSignHash(
        params.walletId,
        preimageHash.toString("hex"),
      );
      const sigBytes = Buffer.from(
        signatureHex.startsWith("0x") ? signatureHex.slice(2) : signatureHex,
        "hex",
      );
      return {
        signedAuthEntry: sigBytes.toString("base64"),
        signerAddress: params.stellarAddress,
      };
    },
    signTransaction: async (xdr, opts) => {
      const passphrase = opts?.networkPassphrase || defaultPassphrase;
      const tx = TransactionBuilder.fromXDR(xdr, passphrase);
      const signatureHex = await privyRawSignHash(
        params.walletId,
        tx.hash().toString("hex"),
      );
      const sigBytes = Buffer.from(
        signatureHex.startsWith("0x") ? signatureHex.slice(2) : signatureHex,
        "hex",
      );
      const hint = Keypair.fromPublicKey(params.stellarAddress).signatureHint();
      const { xdr: xdrNs } = await import("@stellar/stellar-sdk");
      tx.signatures.push(
        new xdrNs.DecoratedSignature({
          hint,
          signature: sigBytes,
        }),
      );
      return {
        signedTxXdr: tx.toXDR(),
        signerAddress: params.stellarAddress,
      };
    },
  };
}

export function createHubX402Client(params: {
  walletId: string;
  stellarAddress: string;
  network: "testnet" | "mainnet";
}): x402Client {
  const x402Network = getX402Network(params.network);
  const signer = createPrivyX402Signer(params);
  const rpcConfig = { url: getX402RpcUrl(params.network) };

  return new x402Client()
    .register(x402Network, new ExactStellarScheme(signer, rpcConfig))
    .register("stellar:*", new ExactStellarScheme(signer, rpcConfig))
    .registerPolicy((_version, requirements) =>
      requirements.filter((req) => req.network.startsWith("stellar:")),
    );
}
