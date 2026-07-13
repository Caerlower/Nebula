/**
 * On-chain Nebula policy (Soroban) — shared multi-tenant contract.
 *
 * Env: POLICY_CONTRACT_ID = C… (deployed nebula-policy wasm).
 * Each user's G-address owns a policy slot (initialize once).
 * Categories: transfer / x402 / mpp (outbound spend). Blend is not capped.
 *
 * Spend limits use the same 7-decimal stroop scaler as native assets; the
 * unit is USDC for spend caps, category caps, check_spend, and the liquid band.
 * Hub converts band USDC → XLM via CoinGecko when comparing to Blend balances.
 */

import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

import { signAndSubmitSorobanWithPrivy } from "./stellar";

export type SpendCategory = "transfer" | "x402" | "mpp";

export type CategoryLimitsXlm = {
  transfer: number;
  x402: number;
  mpp: number;
};

const STROOP = 10_000_000n;

function networkPassphrase(network: "testnet" | "mainnet"): string {
  return network === "mainnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";
}

function rpcUrl(network: "testnet" | "mainnet"): string {
  return network === "mainnet"
    ? "https://mainnet.sorobanrpc.com"
    : "https://soroban-testnet.stellar.org";
}

export function policyContractConfigured(): boolean {
  return Boolean(process.env.POLICY_CONTRACT_ID?.trim());
}

export function policyContractId(): string {
  const id = process.env.POLICY_CONTRACT_ID?.trim();
  if (!id) throw new Error("POLICY_CONTRACT_ID is not set");
  return id;
}

export function toStroops(amountXlm: number): bigint {
  return BigInt(Math.round(amountXlm * Number(STROOP)));
}

function categoryScVal(category: SpendCategory): xdr.ScVal {
  // #[repr(u32)] contracttype enum — encoded as U32 discriminant, not Symbol vec.
  const discriminant =
    category === "transfer" ? 0 : category === "x402" ? 1 : 2;
  return xdr.ScVal.scvU32(discriminant);
}

function i128ScVal(amount: bigint): xdr.ScVal {
  return nativeToScVal(amount, { type: "i128" });
}

/** Soroban contract struct → sorted ScMap (symbol keys). */
function categoryLimitsScVal(limits: CategoryLimitsXlm): xdr.ScVal {
  const entries: Array<[string, bigint]> = [
    ["mpp", toStroops(limits.mpp)],
    ["transfer", toStroops(limits.transfer)],
    ["x402", toStroops(limits.x402)],
  ];
  // ScMap keys must be in ascending XDR order.
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return xdr.ScVal.scvMap(
    entries.map(
      ([key, value]) =>
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol(key),
          val: i128ScVal(value),
        }),
    ),
  );
}

async function invokePolicy(params: {
  walletId: string;
  sourceAddress: string;
  network: "testnet" | "mainnet";
  method: string;
  args: xdr.ScVal[];
}): Promise<string> {
  const contract = new Contract(policyContractId());
  const server = new rpc.Server(rpcUrl(params.network));
  const account = await server.getAccount(params.sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(params.network),
  })
    .addOperation(contract.call(params.method, ...params.args))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return signAndSubmitSorobanWithPrivy({
    preparedTx: prepared,
    walletId: params.walletId,
    sourceAddress: params.sourceAddress,
    network: params.network,
  });
}

function ownerScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

/** Ensure the user's policy slot exists (idempotent: ignore AlreadyInitialized). */
export async function ensurePolicyInitialized(params: {
  walletId: string;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  maxPerCallXlm: number;
  maxPerDayXlm: number;
  categories: CategoryLimitsXlm;
  liquidLowXlm?: number;
  liquidHighXlm?: number;
  autoYield?: boolean;
}): Promise<{ ok: true; hash?: string } | { ok: false; error: string }> {
  if (!policyContractConfigured()) {
    return { ok: false, error: "POLICY_CONTRACT_ID not configured" };
  }
  try {
    const hash = await invokePolicy({
      walletId: params.walletId,
      sourceAddress: params.stellarAddress,
      network: params.network,
      method: "initialize",
      args: [
        ownerScVal(params.stellarAddress),
        nativeToScVal(toStroops(params.maxPerCallXlm), { type: "i128" }),
        nativeToScVal(toStroops(params.maxPerDayXlm), { type: "i128" }),
        categoryLimitsScVal(params.categories),
        nativeToScVal(toStroops(params.liquidLowXlm ?? 2), { type: "i128" }),
        nativeToScVal(toStroops(params.liquidHighXlm ?? 10), {
          type: "i128",
        }),
        xdr.ScVal.scvBool(params.autoYield ?? true),
      ],
    });
    return { ok: true, hash };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Already initialized is fine.
    if (/AlreadyInitialized|#2|error.*?2\b/i.test(message)) {
      return { ok: true };
    }
    return { ok: false, error: message };
  }
}

export async function onchainSetLimits(params: {
  walletId: string;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  maxPerCallXlm: number;
  maxPerDayXlm: number;
}): Promise<{ ok: true; hash: string } | { ok: false; error: string }> {
  if (!policyContractConfigured()) {
    return { ok: false, error: "POLICY_CONTRACT_ID not configured" };
  }
  try {
    const hash = await invokePolicy({
      walletId: params.walletId,
      sourceAddress: params.stellarAddress,
      network: params.network,
      method: "set_limits",
      args: [
        ownerScVal(params.stellarAddress),
        nativeToScVal(toStroops(params.maxPerCallXlm), { type: "i128" }),
        nativeToScVal(toStroops(params.maxPerDayXlm), { type: "i128" }),
      ],
    });
    return { ok: true, hash };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function onchainSetCategoryLimits(params: {
  walletId: string;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  categories: CategoryLimitsXlm;
}): Promise<{ ok: true; hash: string } | { ok: false; error: string }> {
  if (!policyContractConfigured()) {
    return { ok: false, error: "POLICY_CONTRACT_ID not configured" };
  }
  try {
    const hash = await invokePolicy({
      walletId: params.walletId,
      sourceAddress: params.stellarAddress,
      network: params.network,
      method: "set_category_limits",
      args: [
        ownerScVal(params.stellarAddress),
        categoryLimitsScVal(params.categories),
      ],
    });
    return { ok: true, hash };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function onchainSetTreasuryBand(params: {
  walletId: string;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  liquidLowXlm: number;
  liquidHighXlm: number;
  autoYield: boolean;
}): Promise<{ ok: true; hash: string } | { ok: false; error: string }> {
  if (!policyContractConfigured()) {
    return { ok: false, error: "POLICY_CONTRACT_ID not configured" };
  }
  try {
    const hash = await invokePolicy({
      walletId: params.walletId,
      sourceAddress: params.stellarAddress,
      network: params.network,
      method: "set_treasury_band",
      args: [
        ownerScVal(params.stellarAddress),
        nativeToScVal(toStroops(params.liquidLowXlm), { type: "i128" }),
        nativeToScVal(toStroops(params.liquidHighXlm), { type: "i128" }),
        xdr.ScVal.scvBool(params.autoYield),
      ],
    });
    return { ok: true, hash };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Record + enforce on-chain spend for a category. Soft-skip if contract unset. */
export async function onchainCheckSpend(params: {
  walletId: string;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  category: SpendCategory;
  amountXlm: number;
  /** Used only if the owner's policy slot was never initialized. */
  init?: {
    maxPerCallXlm: number;
    maxPerDayXlm: number;
    categories: CategoryLimitsXlm;
    liquidLowXlm?: number;
    liquidHighXlm?: number;
    autoYield?: boolean;
  };
}): Promise<
  | { ok: true; hash: string | null; skipped: boolean }
  | { ok: false; error: string }
> {
  if (!policyContractConfigured()) {
    return { ok: true, hash: null, skipped: true };
  }
  try {
    const init = params.init ?? {
      maxPerCallXlm: Math.max(params.amountXlm, 5),
      maxPerDayXlm: Math.max(params.amountXlm * 10, 20),
      categories: {
        transfer: 20,
        x402: 5,
        mpp: 5,
      },
    };
    await ensurePolicyInitialized({
      walletId: params.walletId,
      stellarAddress: params.stellarAddress,
      network: params.network,
      ...init,
    });

    const hash = await invokePolicy({
      walletId: params.walletId,
      sourceAddress: params.stellarAddress,
      network: params.network,
      method: "check_spend",
      args: [
        ownerScVal(params.stellarAddress),
        categoryScVal(params.category),
        nativeToScVal(toStroops(params.amountXlm), { type: "i128" }),
      ],
    });
    return { ok: true, hash, skipped: false };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
