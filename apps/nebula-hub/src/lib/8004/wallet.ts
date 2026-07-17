import {
  Keypair,
  TransactionBuilder,
  hash,
  xdr,
  type FeeBumpTransaction,
  type Transaction,
} from "@stellar/stellar-sdk";
import { createClients, type ClientSet, type WalletSigner } from "@trionlabs/stellar8004";

import type { HashSigner } from "@/lib/signing";

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
 * WalletSigner for @trionlabs/stellar8004 createClients backed by any
 * {@link HashSigner}. Mirrors wrapBasicSigner / basicNodeSigner, but signs the
 * 32-byte hash via the pluggable signer (Privy raw_sign or a partner callback)
 * instead of a local Keypair secret.
 */
export function wrapHashSigner(params: {
  signer: HashSigner;
  networkPassphrase: string;
}): WalletSigner {
  const { signer, networkPassphrase } = params;
  const publicKey = signer.address;

  return {
    publicKey,
    signTransaction: async (xdrBase64, opts) => {
      const passphrase = opts?.networkPassphrase || networkPassphrase;
      const tx = TransactionBuilder.fromXDR(xdrBase64, passphrase);
      const hashHex = tx.hash().toString("hex");
      const signatureHex = await signer.signHash(hashHex, {
        unsignedXdr: tx.toXDR(),
        network: passphrase,
      });
      attachPrivySignature(tx, signatureHex, publicKey);
      return {
        signedTxXdr: tx.toXDR(),
        signerAddress: publicKey,
      };
    },
    signAuthEntry: async (authEntry) => {
      const entryHash = hash(Buffer.from(authEntry, "base64"));
      const signatureHex = await signer.signHash(entryHash.toString("hex"));
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
  signer: HashSigner;
  network: HubNetwork;
  /** Hub-cached Stellar8004 agent id — skips O(n) on-chain scan when valid. */
  cachedAgentId?: number | null;
};

export function create8004Clients(wallet: Privy8004Wallet): ClientSet {
  const config = get8004Config(wallet.network);
  const signer = wrapHashSigner({
    signer: wallet.signer,
    networkPassphrase: config.networkPassphrase,
  });
  return createClients(config, signer);
}
