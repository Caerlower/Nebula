import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import { getNetworkConfig } from "../config.js";
import { BLEND_TESTNET_USDC_ISSUER } from "./config.js";

export async function hasBlendUsdcTrustline(publicKey: string): Promise<boolean> {
  const network = getNetworkConfig();
  const server = new Horizon.Server(network.horizonUrl);

  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.some(
      (balance) =>
        (balance.asset_type === "credit_alphanum4" ||
          balance.asset_type === "credit_alphanum12") &&
        balance.asset_code === "USDC" &&
        balance.asset_issuer === BLEND_TESTNET_USDC_ISSUER,
    );
  } catch {
    return false;
  }
}

export async function ensureBlendUsdcTrustline(
  keypair: Keypair,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const publicKey = keypair.publicKey();
  const hasTrustline = await hasBlendUsdcTrustline(publicKey);

  if (hasTrustline) {
    return { ok: true };
  }

  const network = getNetworkConfig();
  const server = new Horizon.Server(network.horizonUrl);
  const asset = new Asset("USDC", BLEND_TESTNET_USDC_ISSUER);

  try {
    const account = await server.loadAccount(publicKey);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: network.networkPassphrase,
    })
      .addOperation(
        Operation.changeTrust({ asset, limit: "1000000" }),
      )
      .setTimeout(30)
      .build();

    transaction.sign(keypair);
    await server.submitTransaction(transaction);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add Blend USDC trustline";
    return { ok: false, error: message };
  }
}

export function blendUsdcMismatchError(
  circleUsdcBalance: number,
  blendUsdcBalance: number,
): string {
  return [
    "Your wallet holds Circle testnet USDC, but Blend TestnetV2 requires a different USDC token.",
    "",
    `Circle USDC (GBBD... issuer): ${circleUsdcBalance}`,
    `Blend USDC (GATAL... issuer): ${blendUsdcBalance}`,
    "",
    "Circle faucet USDC cannot be deposited into Blend directly.",
    "Get Blend USDC by swapping XLM on the testnet DEX (see README) or using testnet.blend.capital.",
    "",
    `Blend USDC issuer: ${BLEND_TESTNET_USDC_ISSUER}`,
  ].join("\n");
}
