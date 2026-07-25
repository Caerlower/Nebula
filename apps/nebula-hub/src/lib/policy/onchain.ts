/**
 * On-chain Nebula policy — shared multi-tenant Soroban contract.
 * Agent G-address is slot key + signer. Mutations are dashboard-only.
 * Amounts are USDC (7 decimals); Hub converts XLM via oracle.
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

import {
  policyContractConfiguredFor,
  policyContractIdFor,
  envHubNetwork,
  type HubNetwork,
} from "@/lib/network";
import { privySigner } from "@/lib/signing";
import { signAndSubmitSoroban } from "@/lib/stellar";

export type SpendCategory = "transfer" | "x402" | "mpp";

export type CategoryLimitsXlm = {
  transfer: number;
  x402: number;
  mpp: number;
};

type Network = HubNetwork;
type AgentWallet = {
  walletId: string;
  stellarAddress: string;
  network: Network;
};

const STROOP = 10_000_000n;

type OkHash = { ok: true; hash: string };
type OkMaybeHash = { ok: true; hash?: string };
type Fail = { ok: false; error: string };

function networkPassphrase(network: Network): string {
  return network === "mainnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";
}

function rpcUrl(network: Network): string {
  return network === "mainnet"
    ? "https://mainnet.sorobanrpc.com"
    : "https://soroban-testnet.stellar.org";
}

export function policyContractConfigured(network?: Network): boolean {
  return policyContractConfiguredFor(network ?? envHubNetwork());
}

export function policyContractId(network?: Network): string {
  const net = network ?? envHubNetwork();
  const id = policyContractIdFor(net);
  if (!id) {
    throw new Error(
      net === "mainnet"
        ? "POLICY_CONTRACT_ID_MAINNET is not set"
        : "POLICY_CONTRACT_ID_TESTNET (or POLICY_CONTRACT_ID) is not set",
    );
  }
  return id;
}

function toStroops(amount: number): bigint {
  return BigInt(Math.round(amount * Number(STROOP)));
}

function i128ScVal(amount: number | bigint): xdr.ScVal {
  const v = typeof amount === "bigint" ? amount : toStroops(amount);
  return nativeToScVal(v, { type: "i128" });
}

function addressScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

function categoryScVal(category: SpendCategory): xdr.ScVal {
  return xdr.ScVal.scvU32(
    category === "transfer" ? 0 : category === "x402" ? 1 : 2,
  );
}

function categoryLimitsScVal(limits: CategoryLimitsXlm): xdr.ScVal {
  const entries: Array<[string, number]> = [
    ["mpp", limits.mpp],
    ["transfer", limits.transfer],
    ["x402", limits.x402],
  ];
  entries.sort(([a], [b]) => a.localeCompare(b));
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

async function invokePolicy(
  wallet: AgentWallet,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  const contract = new Contract(policyContractId(wallet.network));
  const server = new rpc.Server(rpcUrl(wallet.network));
  const account = await server.getAccount(wallet.stellarAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(wallet.network),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);
  return signAndSubmitSoroban({
    preparedTx: prepared,
    signer: privySigner(wallet.walletId, wallet.stellarAddress),
    sourceAddress: wallet.stellarAddress,
    network: wallet.network,
  });
}

async function mutatePolicy(
  wallet: AgentWallet,
  method: string,
  args: xdr.ScVal[],
): Promise<OkHash | Fail> {
  if (!policyContractConfigured(wallet.network)) {
    return { ok: false, error: "POLICY_CONTRACT_ID not configured for this network" };
  }
  try {
    const hash = await invokePolicy(wallet, method, args);
    return { ok: true, hash };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function ownerArg(address: string): xdr.ScVal {
  return addressScVal(address);
}

/** Ensure the agent's policy slot exists. */
export async function ensurePolicyInitialized(
  params: AgentWallet & {
    maxPerCallXlm: number;
    maxPerDayXlm: number;
    categories: CategoryLimitsXlm;
    liquidLowXlm?: number;
    liquidHighXlm?: number;
    autoYield?: boolean;
  },
): Promise<OkMaybeHash | Fail> {
  if (!policyContractConfigured(params.network)) {
    return { ok: false, error: "POLICY_CONTRACT_ID not configured for this network" };
  }
  const { stellarAddress: a } = params;
  try {
    const hash = await invokePolicy(params, "initialize", [
      ownerArg(a),
      i128ScVal(params.maxPerCallXlm),
      i128ScVal(params.maxPerDayXlm),
      categoryLimitsScVal(params.categories),
      i128ScVal(params.liquidLowXlm ?? 2),
      i128ScVal(params.liquidHighXlm ?? 10),
      xdr.ScVal.scvBool(params.autoYield ?? true),
    ]);
    return { ok: true, hash };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/AlreadyInitialized|#2|error.*?2\b/i.test(message)) {
      return { ok: true };
    }
    return { ok: false, error: message };
  }
}

export async function onchainSetLimits(
  params: AgentWallet & { maxPerCallXlm: number; maxPerDayXlm: number },
): Promise<OkHash | Fail> {
  return mutatePolicy(params, "set_limits", [
    ownerArg(params.stellarAddress),
    i128ScVal(params.maxPerCallXlm),
    i128ScVal(params.maxPerDayXlm),
  ]);
}

export async function onchainSetCategoryLimits(
  params: AgentWallet & { categories: CategoryLimitsXlm },
): Promise<OkHash | Fail> {
  return mutatePolicy(params, "set_category_limits", [
    ownerArg(params.stellarAddress),
    categoryLimitsScVal(params.categories),
  ]);
}

export async function onchainSetTreasuryBand(
  params: AgentWallet & {
    liquidLowXlm: number;
    liquidHighXlm: number;
    autoYield: boolean;
  },
): Promise<OkHash | Fail> {
  return mutatePolicy(params, "set_treasury_band", [
    ownerArg(params.stellarAddress),
    i128ScVal(params.liquidLowXlm),
    i128ScVal(params.liquidHighXlm),
    xdr.ScVal.scvBool(params.autoYield),
  ]);
}

export async function onchainSetPaused(
  params: AgentWallet & { paused: boolean },
): Promise<OkHash | Fail> {
  return mutatePolicy(params, "set_paused", [
    ownerArg(params.stellarAddress),
    xdr.ScVal.scvBool(params.paused),
  ]);
}

/**
 * On-chain spend gate when a policy contract is configured for this network.
 * Fail-closed when configured (invoke must succeed). When unset (e.g. mainnet
 * before pubnet deploy), skip — Hub off-chain caps still apply.
 */
export async function onchainCheckSpend(
  params: AgentWallet & {
    category: SpendCategory;
    amountXlm: number;
    init?: {
      maxPerCallXlm: number;
      maxPerDayXlm: number;
      categories: CategoryLimitsXlm;
      liquidLowXlm?: number;
      liquidHighXlm?: number;
      autoYield?: boolean;
    };
  },
): Promise<OkMaybeHash | Fail> {
  if (!policyContractConfigured(params.network)) {
    return { ok: true };
  }
  try {
    if (params.init) {
      const ensured = await ensurePolicyInitialized({
        ...params,
        ...params.init,
      });
      if (!ensured.ok) {
        return { ok: false, error: `policy_init:${ensured.error}` };
      }
    }
    const hash = await invokePolicy(params, "check_spend", [
      ownerArg(params.stellarAddress),
      categoryScVal(params.category),
      i128ScVal(params.amountXlm),
    ]);
    return { ok: true, hash };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
