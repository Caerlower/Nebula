import {
  PoolContractV2,
  RequestType,
  type Request,
} from "@blend-capital/blend-sdk";
import {
  BASE_FEE,
  rpc,
  TransactionBuilder,
  xdr,
  type Keypair,
} from "@stellar/stellar-sdk";

import { getNetworkConfig } from "../config.js";
import { checkAgentSpend, recordAgentSpend } from "../policy/spending.js";
import { toBlendAmount } from "../utils/amount.js";
import {
  BLEND_TESTNET_POOL,
  getBlendSdkNetwork,
} from "./config.js";
import {
  blendUsdcMismatchError,
  ensureBlendUsdcTrustline,
} from "./trustline.js";
import {
  getBlendDepositedBalance,
  getBlendLiquidUsdcBalance,
  getCircleUsdcBalance,
  getLiquidBalance,
  getNativeXlmBalance,
} from "../treasury/balances.js";
import {
  getTreasuryAssetConfig,
  type TreasuryAssetConfig,
} from "../treasury/asset.js";

const MIN_SUBMIT_AMOUNT = 0.0000001;

export type BlendSubmitResult =
  | { ok: true; hash: string; amount: number }
  | { ok: false; error: string };

export interface BlendSubmitOptions {
  /**
   * Treasury rebalances are internal wallet ↔ Blend moves.
   * They skip agent spending limits and are not recorded as agent spend.
   */
  treasury?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSorobanError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown Soroban transaction error";
}

async function pollTransaction(
  server: rpc.Server,
  hash: string,
): Promise<BlendSubmitResult> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await server.getTransaction(hash);

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { ok: true, hash, amount: 0 };
    }

    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      return { ok: false, error: "Blend transaction failed on ledger." };
    }

    await sleep(1000);
  }

  return { ok: false, error: "Timed out waiting for Blend transaction confirmation." };
}

async function validateDepositBalance(
  keypair: Keypair,
  amount: number,
  asset: TreasuryAssetConfig,
): Promise<BlendSubmitResult | null> {
  const publicKey = keypair.publicKey();

  if (asset.id === "xlm") {
    const available = await getLiquidBalance(publicKey, asset);
    if (available < amount) {
      const native = await getNativeXlmBalance(publicKey);
      return {
        ok: false,
        error:
          `Insufficient liquid XLM. Available for treasury: ${available} ` +
          `(native ${native}, fee buffer ${asset.feeBuffer}), needed: ${amount}.`,
      };
    }
    return null;
  }

  const trustline = await ensureBlendUsdcTrustline(keypair);
  if (!trustline.ok) {
    return { ok: false, error: trustline.error };
  }

  const [blendLiquid, circleUsdc] = await Promise.all([
    getBlendLiquidUsdcBalance(publicKey),
    getCircleUsdcBalance(publicKey),
  ]);

  if (blendLiquid < amount) {
    if (circleUsdc > 0 && blendLiquid === 0) {
      return { ok: false, error: blendUsdcMismatchError(circleUsdc, blendLiquid) };
    }
    return {
      ok: false,
      error: `Insufficient Blend USDC. Available: ${blendLiquid}, needed: ${amount}.`,
    };
  }

  return null;
}

async function validateWithdrawBalance(
  keypair: Keypair,
  amount: number,
  asset: TreasuryAssetConfig,
): Promise<BlendSubmitResult | null> {
  const publicKey = keypair.publicKey();
  const position = await getBlendDepositedBalance(publicKey, asset);

  if (position.deposited < amount) {
    return {
      ok: false,
      error:
        `Insufficient Blend ${asset.symbol}. Deposited: ${position.deposited}, ` +
        `needed: ${amount}.`,
    };
  }

  return null;
}

async function submitPoolRequest(
  keypair: Keypair,
  amount: number,
  requestType: RequestType.SupplyCollateral | RequestType.WithdrawCollateral,
  options: BlendSubmitOptions = {},
  asset: TreasuryAssetConfig = getTreasuryAssetConfig(),
): Promise<BlendSubmitResult> {
  if (amount < MIN_SUBMIT_AMOUNT) {
    return { ok: false, error: "Amount is too small to submit to Blend." };
  }

  const isTreasury = options.treasury === true;

  if (!isTreasury) {
    const network = getNetworkConfig();
    const limitCheck = await checkAgentSpend(keypair, network, amount);
    if (!limitCheck.ok) {
      return {
        ok: false,
        error: "reason" in limitCheck ? limitCheck.reason : limitCheck.error,
      };
    }
  }

  if (requestType === RequestType.SupplyCollateral) {
    const balanceError = await validateDepositBalance(keypair, amount, asset);
    if (balanceError) {
      return balanceError;
    }
  } else {
    const balanceError = await validateWithdrawBalance(keypair, amount, asset);
    if (balanceError) {
      return balanceError;
    }
  }

  const publicKey = keypair.publicKey();
  const blendNetwork = getBlendSdkNetwork();
  const rpcServer = new rpc.Server(blendNetwork.rpc);
  const pool = new PoolContractV2(BLEND_TESTNET_POOL.poolId);

  const request: Request = {
    amount: toBlendAmount(amount),
    request_type: requestType,
    address: asset.reserveContract,
  };

  let operation: xdr.Operation;
  try {
    operation = xdr.Operation.fromXDR(
      pool.submit({
        from: publicKey,
        spender: publicKey,
        to: publicKey,
        requests: [request],
      }),
      "base64",
    );
  } catch (error) {
    return {
      ok: false,
      error: `Failed to build Blend operation: ${formatSorobanError(error)}`,
    };
  }

  let sourceAccount;
  try {
    sourceAccount = await rpcServer.getAccount(publicKey);
  } catch (error) {
    return {
      ok: false,
      error: `Failed to load account for Blend transaction: ${formatSorobanError(error)}`,
    };
  }

  let transaction;
  try {
    transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: blendNetwork.passphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();
  } catch (error) {
    return {
      ok: false,
      error: `Failed to build transaction: ${formatSorobanError(error)}`,
    };
  }

  let prepared;
  try {
    prepared = await rpcServer.prepareTransaction(transaction);
  } catch (error) {
    return {
      ok: false,
      error: `Failed to simulate Blend transaction: ${formatSorobanError(error)}`,
    };
  }

  prepared.sign(keypair);

  let sendResponse;
  try {
    sendResponse = await rpcServer.sendTransaction(prepared);
  } catch (error) {
    return {
      ok: false,
      error: `Failed to submit Blend transaction: ${formatSorobanError(error)}`,
    };
  }

  if (sendResponse.status === "ERROR") {
    return {
      ok: false,
      error: sendResponse.errorResult?.toXDR("base64") ?? "Blend submission rejected.",
    };
  }

  const confirmation = await pollTransaction(rpcServer, sendResponse.hash);
  if (!confirmation.ok) {
    return confirmation;
  }

  if (!isTreasury) {
    const network = getNetworkConfig();
    const recorded = await recordAgentSpend(
      keypair,
      network,
      amount,
      asset.symbol,
    );
    if (!recorded.ok) {
      return {
        ok: false,
        error:
          `Blend transaction succeeded (${sendResponse.hash}) but spending record failed: ${recorded.error}`,
      };
    }
  }

  return { ok: true, hash: sendResponse.hash, amount };
}

export async function blendDeposit(
  keypair: Keypair,
  amount: number,
  options?: BlendSubmitOptions,
): Promise<BlendSubmitResult> {
  return submitPoolRequest(
    keypair,
    amount,
    RequestType.SupplyCollateral,
    options,
  );
}

export async function blendWithdraw(
  keypair: Keypair,
  amount: number,
  options?: BlendSubmitOptions,
): Promise<BlendSubmitResult> {
  return submitPoolRequest(
    keypair,
    amount,
    RequestType.WithdrawCollateral,
    options,
  );
}
