import { Asset, Horizon, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

import type { HashSigner } from "./signing";
import {
  circleUsdcAsset,
  ensureUsdcTrustline,
  explorerTxUrl,
  signAndSubmit,
} from "./stellar";

export type SwapAsset = "XLM" | "USDC";

function horizonUrl(network: "testnet" | "mainnet"): string {
  return network === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";
}

function networkPassphrase(network: "testnet" | "mainnet"): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
}

function toAsset(symbol: SwapAsset, network: "testnet" | "mainnet"): Asset {
  return symbol === "USDC" ? circleUsdcAsset(network) : Asset.native();
}

function formatAmount(amount: number): string {
  return amount.toFixed(7).replace(/\.?0+$/, "") || "0";
}

export type SwapQuote = {
  fromAsset: SwapAsset;
  toAsset: SwapAsset;
  sendAmount: number;
  /** Best-path destination amount from Horizon. */
  receiveAmount: number;
  path: string[];
  source: "horizon_strict_send";
};

/**
 * Quote a strict-send path payment XLM ↔ Circle USDC on the classic DEX.
 */
export async function quoteStrictSendSwap(params: {
  fromAsset: SwapAsset;
  toAsset: SwapAsset;
  amount: number;
  network: "testnet" | "mainnet";
}): Promise<SwapQuote> {
  if (params.fromAsset === params.toAsset) {
    throw new Error("from_asset and to_asset must differ");
  }
  if (!(params.amount > 0)) {
    throw new Error("amount must be positive");
  }

  const server = new Horizon.Server(horizonUrl(params.network));
  const source = toAsset(params.fromAsset, params.network);
  const dest = toAsset(params.toAsset, params.network);
  const sendAmount = formatAmount(params.amount);

  const paths = await server
    .strictSendPaths(source, sendAmount, [dest])
    .limit(5)
    .call();

  const best = paths.records[0];
  if (!best) {
    throw new Error(
      `no_dex_path: no Stellar DEX path for ${params.amount} ${params.fromAsset} → ${params.toAsset}`,
    );
  }

  const receiveAmount = Number(best.destination_amount);
  if (!Number.isFinite(receiveAmount) || receiveAmount <= 0) {
    throw new Error("no_dex_path: invalid destination amount from Horizon");
  }

  const pathLabels = (best.path ?? []).map((p) => {
    if (p.asset_type === "native") return "XLM";
    return `${p.asset_code}`;
  });

  return {
    fromAsset: params.fromAsset,
    toAsset: params.toAsset,
    sendAmount: params.amount,
    receiveAmount,
    path: pathLabels,
    source: "horizon_strict_send",
  };
}

/**
 * Build + sign a pathPaymentStrictSend for XLM ↔ Circle USDC using any
 * {@link HashSigner} (Privy or partner). Opens USDC trustline first when
 * receiving USDC.
 */
export async function executeStrictSendSwap(params: {
  sourceAddress: string;
  signer: HashSigner;
  fromAsset: SwapAsset;
  toAsset: SwapAsset;
  sendAmount: number;
  /** Minimum destination amount after slippage. */
  destMin: number;
  network: "testnet" | "mainnet";
  memo?: string;
}): Promise<{ hash: string; explorerUrl: string; quote: SwapQuote }> {
  if (params.fromAsset === params.toAsset) {
    throw new Error("from_asset and to_asset must differ");
  }
  if (!(params.sendAmount > 0) || !(params.destMin > 0)) {
    throw new Error("send and destMin amounts must be positive");
  }

  if (params.toAsset === "USDC") {
    await ensureUsdcTrustline({
      address: params.sourceAddress,
      signer: params.signer,
      network: params.network,
    });
  }

  const quote = await quoteStrictSendSwap({
    fromAsset: params.fromAsset,
    toAsset: params.toAsset,
    amount: params.sendAmount,
    network: params.network,
  });

  if (params.destMin > quote.receiveAmount) {
    throw new Error(
      `slippage_exceeded: quote ${quote.receiveAmount} ${params.toAsset} ` +
        `< min ${params.destMin} ${params.toAsset}`,
    );
  }

  const server = new Horizon.Server(horizonUrl(params.network));
  const account = await server.loadAccount(params.sourceAddress);
  const fee = await server.fetchBaseFee();

  const sendAsset = toAsset(params.fromAsset, params.network);
  const destAsset = toAsset(params.toAsset, params.network);

  // Rebuild path Assets from the quote call for the operation.
  const paths = await server
    .strictSendPaths(sendAsset, formatAmount(params.sendAmount), [destAsset])
    .limit(1)
    .call();
  const best = paths.records[0];
  if (!best) {
    throw new Error("no_dex_path: path disappeared before submit");
  }

  const hopAssets: Asset[] = (best.path ?? []).map((p) => {
    if (p.asset_type === "native") return Asset.native();
    return new Asset(p.asset_code, p.asset_issuer);
  });

  let builder = new TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: networkPassphrase(params.network),
  }).addOperation(
    Operation.pathPaymentStrictSend({
      sendAsset,
      sendAmount: formatAmount(params.sendAmount),
      destination: params.sourceAddress,
      destAsset,
      destMin: formatAmount(params.destMin),
      path: hopAssets,
    }),
  );

  if (params.memo) {
    const { Memo } = await import("@stellar/stellar-sdk");
    builder = builder.addMemo(Memo.text(params.memo.slice(0, 28)));
  }

  const tx = builder.setTimeout(180).build();
  const hashHex = tx.hash().toString("hex");
  const hash = await signAndSubmit({
    unsignedXdr: tx.toXDR(),
    hashHex,
    signer: params.signer,
    sourceAddress: params.sourceAddress,
    network: params.network,
  });

  return {
    hash,
    explorerUrl: explorerTxUrl(params.network, hash),
    quote,
  };
}

export function destMinAfterSlippage(
  quotedReceive: number,
  maxSlippageBps: number,
): number {
  const bps = Math.min(5_000, Math.max(1, maxSlippageBps));
  const min = quotedReceive * (1 - bps / 10_000);
  // Floor to 7 decimals without going to zero for tiny quotes.
  return Math.max(0.0000001, Math.floor(min * 1e7) / 1e7);
}
