import {
  Keypair,
  TransactionBuilder,
  hash,
  xdr,
  type FeeBumpTransaction,
  type Transaction,
} from "@stellar/stellar-sdk";
import { createClients, type ClientSet, type WalletSigner } from "@trionlabs/stellar8004";

import { privyRawSignHash } from "@/lib/auth";

import { get8004Config, type HubNetwork } from "./config";

function attachPrivySignature(
  tx: Transaction | FeeBumpTransaction,
  signatureHex: string,
  sourceAddress: string,
): void {
  const sigBytes = Buffer.from(
    signatureHex.startsWith("0x") ? signatureHex.slice(2) : signatureHex,
    "hex",
  );
  const hint = Keypair.fromPublicKey(sourceAddress).signatureHint();
  tx.signatures.push(
    new xdr.DecoratedSignature({
      hint,
      signature: sigBytes,
    }),
  );
}

/**
 * Privy-backed WalletSigner for @trionlabs/stellar8004 createClients.
 * Mirrors wrapBasicSigner / basicNodeSigner, but signs via Privy raw_sign
 * instead of a local Keypair secret.
 */
export function wrapPrivySigner(params: {
  publicKey: string;
  walletId: string;
  networkPassphrase: string;
}): WalletSigner {
  const { publicKey, walletId, networkPassphrase } = params;

  return {
    publicKey,
    signTransaction: async (xdrBase64, opts) => {
      const tx = TransactionBuilder.fromXDR(
        xdrBase64,
        opts?.networkPassphrase || networkPassphrase,
      );
      const hashHex = tx.hash().toString("hex");
      const signatureHex = await privyRawSignHash(walletId, hashHex);
      attachPrivySignature(tx, signatureHex, publicKey);
      return {
        signedTxXdr: tx.toXDR(),
        signerAddress: publicKey,
      };
    },
    signAuthEntry: async (authEntry) => {
      const entryHash = hash(Buffer.from(authEntry, "base64"));
      const signatureHex = await privyRawSignHash(
        walletId,
        entryHash.toString("hex"),
      );
      const signedAuthEntry = Buffer.from(
        signatureHex.startsWith("0x") ? signatureHex.slice(2) : signatureHex,
        "hex",
      ).toString("base64");
      return {
        signedAuthEntry,
        signerAddress: publicKey,
      };
    },
  };
}

export type Privy8004Wallet = {
  publicKey: string;
  walletId: string;
  network: HubNetwork;
  /** Hub-cached Stellar8004 agent id — skips O(n) on-chain scan when valid. */
  cachedAgentId?: number | null;
};

export function create8004Clients(wallet: Privy8004Wallet): ClientSet {
  const config = get8004Config(wallet.network);
  const signer = wrapPrivySigner({
    publicKey: wallet.publicKey,
    walletId: wallet.walletId,
    networkPassphrase: config.networkPassphrase,
  });
  return createClients(config, signer);
}
