import {
  PoolContractV2,
  RequestType,
  type Request,
} from "@blend-capital/blend-sdk";
import {
  Asset,
  BASE_FEE,
  Operation,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

import { signAndSubmitSorobanWithPrivy } from "../stellar";
import {
  getBlendDeposited,
  getBlendDepositedXlm,
  getLiquidUsdc,
  getLiquidXlm,
  getNativeXlmBalance,
} from "./balances";
import {
  type BlendAsset,
  assertBlendAssetSupported,
  blendAssetId,
  blendXlmAsset,
  floorXlm,
  getBlendSdkNetwork,
  resolvePool,
  roundXlm,
} from "./config";

const MIN_SUBMIT_AMOUNT = 0.0000001;
const BLEND_SCALE = 10_000_000n;

function toBlendAmount(amount: number): bigint {
  return BigInt(Math.round(roundXlm(amount) * Number(BLEND_SCALE)));
}

function formatSorobanError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown Soroban transaction error";
}

function formatPayAmount(amount: number): string {
  return amount.toFixed(7).replace(/\.?0+$/, "") || "0";
}

export type BlendSubmitResult =
  | { ok: true; hash: string; amount: number; poolId: string }
  | { ok: false; error: string };

export type BlendPayBundleResult =
  | {
      ok: true;
      hash: string;
      withdrawAmount: number;
      payAmount: number;
      poolId: string;
    }
  | { ok: false; error: string };

export async function blendDepositXlm(params: {
  publicKey: string;
  walletId: string;
  amount: number;
  network: "testnet" | "mainnet";
  poolId?: string | null;
}): Promise<BlendSubmitResult> {
  return blendDeposit({ ...params, asset: "XLM" });
}

export async function blendWithdrawXlm(params: {
  publicKey: string;
  walletId: string;
  amount: number;
  network: "testnet" | "mainnet";
  poolId?: string | null;
}): Promise<BlendSubmitResult> {
  return blendWithdraw({ ...params, asset: "XLM" });
}

export async function blendDeposit(params: {
  publicKey: string;
  walletId: string;
  amount: number;
  network: "testnet" | "mainnet";
  asset: BlendAsset;
  poolId?: string | null;
}): Promise<BlendSubmitResult> {
  return submitCollateral({
    ...params,
    requestType: RequestType.SupplyCollateral,
  });
}

export async function blendWithdraw(params: {
  publicKey: string;
  walletId: string;
  amount: number;
  network: "testnet" | "mainnet";
  asset: BlendAsset;
  poolId?: string | null;
}): Promise<BlendSubmitResult> {
  return submitCollateral({
    ...params,
    requestType: RequestType.WithdrawCollateral,
  });
}

/**
 * Atomic: Blend WithdrawCollateral + classic native Payment in one Stellar tx
 * (one InvokeHostFunction + one Payment — allowed; two invokes are not).
 *
 * Soroban envelopes cannot carry a memo — callers must omit memo for this path.
 */
export async function blendWithdrawAndPay(params: {
  publicKey: string;
  walletId: string;
  withdrawAmount: number;
  destination: string;
  payAmount: number;
  network: "testnet" | "mainnet";
  poolId?: string | null;
}): Promise<BlendPayBundleResult> {
  const pool = resolvePool(params.network, params.poolId);
  if (!pool) {
    return { ok: false, error: "No Blend pool available for this network." };
  }

  let withdrawAmount = floorXlm(params.withdrawAmount);
  const payAmount = roundXlm(params.payAmount);
  if (withdrawAmount < MIN_SUBMIT_AMOUNT) {
    return { ok: false, error: "Withdraw amount is too small to submit to Blend." };
  }
  if (payAmount < MIN_SUBMIT_AMOUNT) {
    return { ok: false, error: "Payment amount is too small." };
  }

  const position = await getBlendDepositedXlm(
    params.publicKey,
    params.network,
    params.poolId,
  );
  const deposited = floorXlm(position.deposited);
  if (withdrawAmount > deposited) {
    if (withdrawAmount - deposited <= 0.000001) {
      withdrawAmount = deposited;
    } else {
      return {
        ok: false,
        error:
          `Insufficient Blend XLM. Deposited: ${deposited}, ` +
          `needed: ${withdrawAmount}.`,
      };
    }
  }
  if (withdrawAmount < MIN_SUBMIT_AMOUNT) {
    return { ok: false, error: "Withdraw amount is too small to submit to Blend." };
  }

  const blendNetwork = getBlendSdkNetwork(params.network);
  const rpcServer = new rpc.Server(blendNetwork.rpc);
  const poolContract = new PoolContractV2(pool.poolId);

  const request: Request = {
    amount: toBlendAmount(withdrawAmount),
    request_type: RequestType.WithdrawCollateral,
    address: blendXlmAsset(params.network),
  };

  let blendOp: xdr.Operation;
  try {
    blendOp = xdr.Operation.fromXDR(
      poolContract.submit({
        from: params.publicKey,
        spender: params.publicKey,
        to: params.publicKey,
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

  const paymentOp = Operation.payment({
    destination: params.destination,
    asset: Asset.native(),
    amount: formatPayAmount(payAmount),
  });

  let sourceAccount;
  try {
    sourceAccount = await rpcServer.getAccount(params.publicKey);
  } catch (error) {
    return {
      ok: false,
      error: `Failed to load account: ${formatSorobanError(error)}`,
    };
  }

  // Withdraw first so classic payment can spend the credited XLM in the same tx.
  let transaction;
  try {
    transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: blendNetwork.passphrase,
    })
      .addOperation(blendOp)
      .addOperation(paymentOp)
      .setTimeout(60)
      .build();
  } catch (error) {
    return {
      ok: false,
      error: `Failed to build bundled transaction: ${formatSorobanError(error)}`,
    };
  }

  let prepared;
  try {
    prepared = await rpcServer.prepareTransaction(transaction);
  } catch (error) {
    return {
      ok: false,
      error: `Failed to simulate bundled withdraw+pay: ${formatSorobanError(error)}`,
    };
  }

  try {
    const hash = await signAndSubmitSorobanWithPrivy({
      preparedTx: prepared,
      walletId: params.walletId,
      sourceAddress: params.publicKey,
      network: params.network,
    });
    return {
      ok: true,
      hash,
      withdrawAmount,
      payAmount,
      poolId: pool.poolId,
    };
  } catch (error) {
    return { ok: false, error: formatSorobanError(error) };
  }
}

async function submitCollateral(params: {
  publicKey: string;
  walletId: string;
  amount: number;
  network: "testnet" | "mainnet";
  asset: BlendAsset;
  poolId?: string | null;
  requestType: RequestType.SupplyCollateral | RequestType.WithdrawCollateral;
}): Promise<BlendSubmitResult> {
  try {
    assertBlendAssetSupported(params.network, params.asset);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const pool = resolvePool(params.network, params.poolId);
  if (!pool) {
    return { ok: false, error: "No Blend pool available for this network." };
  }

  let amount = floorXlm(params.amount);
  if (amount < MIN_SUBMIT_AMOUNT) {
    return { ok: false, error: "Amount is too small to submit to Blend." };
  }

  if (params.requestType === RequestType.SupplyCollateral) {
    if (params.asset === "XLM") {
      const { liquid, feeBuffer } = await getLiquidXlm(
        params.publicKey,
        params.network,
      );
      const available = floorXlm(liquid);
      if (amount > available) {
        if (amount - available <= 0.000001) {
          amount = available;
        } else {
          const native = await getNativeXlmBalance(
            params.publicKey,
            params.network,
          );
          return {
            ok: false,
            error:
              `Insufficient liquid XLM. Available for treasury: ${available} ` +
              `(native ${native}, fee buffer ${feeBuffer}), needed: ${amount}.`,
          };
        }
      }
    } else {
      const liquid = floorXlm(
        await getLiquidUsdc(params.publicKey, params.network),
      );
      if (amount > liquid) {
        if (amount - liquid <= 0.000001) {
          amount = liquid;
        } else {
          return {
            ok: false,
            error: `Insufficient liquid USDC. Available: ${liquid}, needed: ${amount}.`,
          };
        }
      }
    }
    if (amount < MIN_SUBMIT_AMOUNT) {
      return { ok: false, error: "Amount is too small to submit to Blend." };
    }
  } else {
    const position = await getBlendDeposited(
      params.publicKey,
      params.network,
      params.asset,
      params.poolId,
    );
    const deposited = floorXlm(position.deposited);
    if (amount > deposited) {
      if (amount - deposited <= 0.000001) {
        amount = deposited;
      } else {
        return {
          ok: false,
          error:
            `Insufficient Blend ${params.asset}. Deposited: ${deposited}, ` +
            `needed: ${amount}.`,
        };
      }
    }
    if (amount < MIN_SUBMIT_AMOUNT) {
      return { ok: false, error: "Amount is too small to submit to Blend." };
    }
  }

  const blendNetwork = getBlendSdkNetwork(params.network);
  const rpcServer = new rpc.Server(blendNetwork.rpc);
  const poolContract = new PoolContractV2(pool.poolId);

  const request: Request = {
    amount: toBlendAmount(amount),
    request_type: params.requestType,
    address: blendAssetId(params.network, params.asset),
  };

  let operation: xdr.Operation;
  try {
    operation = xdr.Operation.fromXDR(
      poolContract.submit({
        from: params.publicKey,
        spender: params.publicKey,
        to: params.publicKey,
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
    sourceAccount = await rpcServer.getAccount(params.publicKey);
  } catch (error) {
    return {
      ok: false,
      error: `Failed to load account: ${formatSorobanError(error)}`,
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

  try {
    const hash = await signAndSubmitSorobanWithPrivy({
      preparedTx: prepared,
      walletId: params.walletId,
      sourceAddress: params.publicKey,
      network: params.network,
    });
    return { ok: true, hash, amount, poolId: pool.poolId };
  } catch (error) {
    return { ok: false, error: formatSorobanError(error) };
  }
}
