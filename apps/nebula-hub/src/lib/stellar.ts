import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  rpc,
  xdr,
  type FeeBumpTransaction,
} from "@stellar/stellar-sdk";

import { type HashSigner, privySigner } from "./signing";

/** Circle classic USDC issuers (SEP-41 / Horizon credit). */
const CIRCLE_USDC_ISSUER = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  mainnet: "GA5ZSEJYB37JRC5RJRC75UPGWKOWTXQYPFJXXQE2RXYI763DGSJDFLVQ",
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rpcUrl(network: "testnet" | "mainnet"): string {
  return network === "mainnet"
    ? "https://mainnet.sorobanrpc.com"
    : "https://soroban-testnet.stellar.org";
}

function networkPassphrase(network: "testnet" | "mainnet"): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
}

function horizonUrl(network: "testnet" | "mainnet"): string {
  return network === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";
}

/**
 * Horizon is a ~400–500ms round trip and balances rarely change second to
 * second — cache briefly per address so a burst of page fetches pays once.
 */
const BALANCES_TTL_MS = 10_000;
const balancesCache = new Map<
  string,
  { at: number; promise: Promise<Array<{ asset: string; balance: string }>> }
>();

export async function fetchBalances(
  address: string,
  network: "testnet" | "mainnet",
): Promise<Array<{ asset: string; balance: string }>> {
  const key = `${network}:${address}`;
  const hit = balancesCache.get(key);
  if (hit && Date.now() - hit.at < BALANCES_TTL_MS) {
    return hit.promise;
  }
  const promise = fetchBalancesFresh(address, network).catch((error: unknown) => {
    balancesCache.delete(key);
    throw error;
  });
  balancesCache.set(key, { at: Date.now(), promise });
  return promise;
}

async function fetchBalancesFresh(
  address: string,
  network: "testnet" | "mainnet",
): Promise<Array<{ asset: string; balance: string }>> {
  const server = new Horizon.Server(horizonUrl(network));
  try {
    const account = await server.loadAccount(address);
    return account.balances.map((b) => {
      if (b.asset_type === "native") {
        return { asset: "XLM", balance: b.balance };
      }
      if (
        b.asset_type === "credit_alphanum4" ||
        b.asset_type === "credit_alphanum12"
      ) {
        return {
          asset: `${b.asset_code}:${b.asset_issuer.slice(0, 4)}…`,
          balance: b.balance,
        };
      }
      return { asset: b.asset_type, balance: b.balance };
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return [];
    }
    throw error;
  }
}

export async function buildPaymentXdr(params: {
  source: string;
  destination: string;
  amount: number;
  /** @deprecated use amount */
  amountXlm?: number;
  asset?: "native" | "USDC";
  memo?: string;
  network: "testnet" | "mainnet";
}): Promise<{ unsignedXdr: string; hashHex: string }> {
  const amount = params.amount ?? params.amountXlm;
  if (amount == null || !(amount > 0)) {
    throw new Error("Payment amount must be positive");
  }
  const asset =
    params.asset === "USDC" ? circleUsdcAsset(params.network) : Asset.native();
  const server = new Horizon.Server(horizonUrl(params.network));
  const account = await server.loadAccount(params.source);
  const fee = await server.fetchBaseFee();
  let builder = new TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: networkPassphrase(params.network),
  }).addOperation(
    Operation.payment({
      destination: params.destination,
      asset,
      amount: amount.toFixed(7).replace(/\.?0+$/, "") || "0",
    }),
  );

  if (params.memo) {
    const { Memo } = await import("@stellar/stellar-sdk");
    builder = builder.addMemo(Memo.text(params.memo.slice(0, 28)));
  }

  const tx = builder.setTimeout(180).build();
  const hashHex = tx.hash().toString("hex");
  return { unsignedXdr: tx.toXDR(), hashHex };
}

function attachSignature(
  tx: Transaction | FeeBumpTransaction,
  signatureHex: string,
  sourceAddress: string,
): void {
  const sigBytes = Buffer.from(
    signatureHex.startsWith("0x") ? signatureHex.slice(2) : signatureHex,
    "hex",
  );
  const hint = Keypair.fromPublicKey(sourceAddress).signatureHint();
  const decorated = new xdr.DecoratedSignature({
    hint,
    signature: sigBytes,
  });
  tx.signatures.push(decorated);
}

/**
 * Sign a classic transaction with any {@link HashSigner} and submit to Horizon.
 * Custodial or non-custodial depending on the signer's strategy.
 */
export async function signAndSubmit(params: {
  unsignedXdr: string;
  hashHex: string;
  signer: HashSigner;
  sourceAddress: string;
  network: "testnet" | "mainnet";
}): Promise<string> {
  const signatureHex = await params.signer.signHash(params.hashHex, {
    unsignedXdr: params.unsignedXdr,
    network: params.network,
  });
  const tx = TransactionBuilder.fromXDR(
    params.unsignedXdr,
    networkPassphrase(params.network),
  );
  attachSignature(tx, signatureHex, params.sourceAddress);

  const server = new Horizon.Server(horizonUrl(params.network));
  const result = await server.submitTransaction(tx);
  return result.hash;
}

export async function signAndSubmitWithPrivy(params: {
  unsignedXdr: string;
  hashHex: string;
  walletId: string;
  sourceAddress: string;
  network: "testnet" | "mainnet";
}): Promise<string> {
  return signAndSubmit({
    unsignedXdr: params.unsignedXdr,
    hashHex: params.hashHex,
    signer: privySigner(params.walletId, params.sourceAddress),
    sourceAddress: params.sourceAddress,
    network: params.network,
  });
}

/**
 * Sign a prepared Soroban transaction with any {@link HashSigner} and submit
 * over RPC, polling until confirmation.
 */
export async function signAndSubmitSoroban(params: {
  preparedTx: Transaction;
  signer: HashSigner;
  sourceAddress: string;
  network: "testnet" | "mainnet";
}): Promise<string> {
  const hashHex = params.preparedTx.hash().toString("hex");
  const signatureHex = await params.signer.signHash(hashHex, {
    unsignedXdr: params.preparedTx.toXDR(),
    network: params.network,
  });
  attachSignature(params.preparedTx, signatureHex, params.sourceAddress);

  const server = new rpc.Server(rpcUrl(params.network));
  const sendResponse = await server.sendTransaction(params.preparedTx);

  if (sendResponse.status === "ERROR") {
    const detail =
      sendResponse.errorResult?.toXDR("base64") ?? "Soroban submission rejected.";
    throw new Error(`Soroban submit failed: ${detail}`);
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await server.getTransaction(sendResponse.hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return sendResponse.hash;
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      const detail =
        "resultXdr" in result && result.resultXdr
          ? ` result=${String(result.resultXdr)}`
          : "";
      throw new Error(`Soroban transaction failed on ledger.${detail}`);
    }
    await sleep(1000);
  }

  throw new Error("Timed out waiting for Soroban transaction confirmation.");
}

export async function signAndSubmitSorobanWithPrivy(params: {
  preparedTx: Transaction;
  walletId: string;
  sourceAddress: string;
  network: "testnet" | "mainnet";
}): Promise<string> {
  return signAndSubmitSoroban({
    preparedTx: params.preparedTx,
    signer: privySigner(params.walletId, params.sourceAddress),
    sourceAddress: params.sourceAddress,
    network: params.network,
  });
}

export function explorerTxUrl(
  network: "testnet" | "mainnet",
  hash: string,
): string {
  const segment = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}

export function circleUsdcAsset(network: "testnet" | "mainnet"): Asset {
  return new Asset("USDC", CIRCLE_USDC_ISSUER[network]);
}

export async function hasUsdcTrustline(
  address: string,
  network: "testnet" | "mainnet",
): Promise<boolean> {
  const server = new Horizon.Server(horizonUrl(network));
  const issuer = CIRCLE_USDC_ISSUER[network];
  try {
    const account = await server.loadAccount(address);
    return account.balances.some(
      (b) =>
        (b.asset_type === "credit_alphanum4" ||
          b.asset_type === "credit_alphanum12") &&
        b.asset_code === "USDC" &&
        b.asset_issuer === issuer,
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Open (or no-op) a classic Circle USDC trustline, signed by any
 * {@link HashSigner} (Privy or partner). Required before x402 / USDC payments.
 */
export async function ensureUsdcTrustline(params: {
  address: string;
  signer: HashSigner;
  network: "testnet" | "mainnet";
}): Promise<{ alreadyHad: boolean; txHash: string | null }> {
  if (await hasUsdcTrustline(params.address, params.network)) {
    return { alreadyHad: true, txHash: null };
  }

  const server = new Horizon.Server(horizonUrl(params.network));
  const account = await server.loadAccount(params.address);
  const fee = await server.fetchBaseFee();
  const tx = new TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: networkPassphrase(params.network),
  })
    .addOperation(
      Operation.changeTrust({
        asset: circleUsdcAsset(params.network),
        limit: "1000000",
      }),
    )
    .setTimeout(180)
    .build();

  const txHash = await signAndSubmit({
    unsignedXdr: tx.toXDR(),
    hashHex: tx.hash().toString("hex"),
    signer: params.signer,
    sourceAddress: params.address,
    network: params.network,
  });

  balancesCache.delete(`${params.network}:${params.address}`);
  return { alreadyHad: false, txHash };
}
