/**
 * TrustLine client for Nebula Hub — same protocol as @trustline-agents/agent-sdk
 * (https://docs.0xtrustline.online), but signing uses Privy HashSigner instead of
 * an agent-held secret. Testnet only.
 */
import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Networks,
  rpc,
  scValToNative,
  TimeoutInfinite,
  TransactionBuilder,
  type Transaction,
  xdr,
} from "@stellar/stellar-sdk";

import type { HashSigner } from "../signing";
import { explorerTxUrl, signAndSubmitSoroban } from "../stellar";

const DEFAULT_API = "https://trustline-rpxt.onrender.com";
const TESTNET_RPC = "https://soroban-testnet.stellar.org";

export type TrustLineContracts = {
  registry: string;
  creditLine: string;
  vault: string;
};

export type CreditTerms = {
  tier: number;
  limitUsdc: number;
  aprBps: number;
};

export type VaultState = {
  liquidityUsdc: number;
  principalUsdc: number;
  amountOwedUsdc: number;
  totalAssetsUsdc: number;
  yieldPoolUsdc: number;
  limitUsdc: number;
  aprBps: number;
};

export type TrustLineTxResult = {
  txHash: string;
  returnValue: unknown;
  explorerUrl: string;
};

function toStroops(usdc: number): bigint {
  return BigInt(Math.round(usdc * 10_000_000));
}

function fromStroops(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v) / 10_000_000;
  if (typeof v === "number") return v / 10_000_000;
  if (typeof v === "string") return Number(v) / 10_000_000;
  // i128 often arrives as { hi, lo } from scValToNative in some paths
  if (typeof v === "object" && v !== null && "lo" in v) {
    const o = v as { hi?: bigint | number; lo: bigint | number };
    const hi = BigInt(o.hi ?? 0);
    const lo = BigInt(o.lo);
    const n = (hi << 64n) + (lo < 0n ? lo + (1n << 64n) : lo);
    return Number(n) / 10_000_000;
  }
  return Number(v) / 10_000_000;
}

/** score_registry::register when the agent is already enrolled (Error #2). */
function isAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /already\s*regist/.test(m) ||
    /error\s*\(?\s*#?\s*2\b/.test(m) ||
    /Error\(Contract,\s*#2\)/i.test(message) ||
    /HostError: Error\(Contract,\s*#2\)/i.test(message) ||
    /contract error[:\s#]*2\b/i.test(message) ||
    /#2\b/.test(message)
  );
}

export function trustlineConfigured(): boolean {
  const flag = process.env.TRUSTLINE_ENABLED?.trim();
  if (flag === "0" || flag === "false") return false;
  // Default on for testnet Hub; set TRUSTLINE_ENABLED=0 to disable.
  return true;
}

export function trustlineApiBase(): string {
  return (
    process.env.TRUSTLINE_API_BASE_URL?.trim() ||
    DEFAULT_API
  ).replace(/\/$/, "");
}

/**
 * Pinned TrustLine testnet contract IDs. Env overrides win; remote `/config`
 * must match these before the Hub will sign any invoke.
 * Live defaults from https://trustline-rpxt.onrender.com/config (Jul 2026).
 */
export function pinnedTrustLineContracts(): TrustLineContracts & {
  usdcSac: string;
} {
  return {
    registry:
      process.env.TRUSTLINE_REGISTRY_ID?.trim() ||
      "CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX",
    creditLine:
      process.env.TRUSTLINE_CREDIT_LINE_ID?.trim() ||
      "CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO",
    vault:
      process.env.TRUSTLINE_VAULT_ID?.trim() ||
      "CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3",
    usdcSac:
      process.env.TRUSTLINE_USDC_SAC?.trim() ||
      "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  };
}

function assertConfigMatchesPin(
  remote: TrustLineContracts & { usdcSac?: string },
  pin: TrustLineContracts & { usdcSac: string },
): void {
  const mismatches: string[] = [];
  if (remote.registry !== pin.registry) {
    mismatches.push(`registry remote=${remote.registry} pin=${pin.registry}`);
  }
  if (remote.creditLine !== pin.creditLine) {
    mismatches.push(
      `creditLine remote=${remote.creditLine} pin=${pin.creditLine}`,
    );
  }
  if (remote.vault !== pin.vault) {
    mismatches.push(`vault remote=${remote.vault} pin=${pin.vault}`);
  }
  if (remote.usdcSac && remote.usdcSac !== pin.usdcSac) {
    mismatches.push(`usdcSac remote=${remote.usdcSac} pin=${pin.usdcSac}`);
  }
  if (mismatches.length) {
    throw new Error(
      `trustline_config_mismatch: /config does not match pinned IDs (${mismatches.join("; ")}). Update TRUSTLINE_*_ID env or refuse the API.`,
    );
  }
}

export class TrustLineHubClient {
  private server: rpc.Server;
  private passphrase: string;
  private apiBaseUrl: string;
  private contracts: TrustLineContracts | null = null;
  private usdcSacId: string | null = null;

  constructor(
    readonly address: string,
    private readonly signer: HashSigner,
    private readonly network: "testnet" | "mainnet",
  ) {
    if (network !== "testnet") {
      throw new Error(
        "TrustLine is testnet-only (prototype — https://docs.0xtrustline.online).",
      );
    }
    this.passphrase = Networks.TESTNET;
    this.server = new rpc.Server(
      process.env.STELLAR_TESTNET_RPC_URL?.trim() || TESTNET_RPC,
    );
    this.apiBaseUrl = trustlineApiBase();
  }

  async ensureContracts(): Promise<TrustLineContracts> {
    if (this.contracts) return this.contracts;
    const pin = pinnedTrustLineContracts();
    const cfg = await this.apiGet<{
      scoreRegistryContractId?: string;
      creditLineContractId?: string;
      lendingVaultContractId?: string;
      usdcSac?: string;
    }>("/config");
    const remote = {
      registry: cfg.scoreRegistryContractId ?? "",
      creditLine: cfg.creditLineContractId ?? "",
      vault: cfg.lendingVaultContractId ?? "",
      usdcSac: cfg.usdcSac,
    };
    if (!remote.registry || !remote.creditLine || !remote.vault) {
      throw new Error(
        "TrustLine contract ids unavailable from /config — check TRUSTLINE_API_BASE_URL.",
      );
    }
    assertConfigMatchesPin(remote, pin);
    this.usdcSacId = pin.usdcSac;
    this.contracts = {
      registry: pin.registry,
      creditLine: pin.creditLine,
      vault: pin.vault,
    };
    return this.contracts;
  }

  /** Pinned vault id (for policy destination / confirmation). */
  async vaultContractId(): Promise<string> {
    const c = await this.ensureContracts();
    return c.vault;
  }

  private async usdcSac(): Promise<string> {
    if (this.usdcSacId) return this.usdcSacId;
    await this.ensureContracts();
    if (!this.usdcSacId) {
      throw new Error("usdcSac unavailable after TrustLine config pin");
    }
    return this.usdcSacId;
  }

  async creditLine(): Promise<CreditTerms> {
    const c = await this.ensureContracts();
    const t = (await this.read(c.creditLine, "terms", [
      this.addr(this.address),
    ])) as { tier: unknown; limit: unknown; apr_bps: unknown };
    return {
      tier: Number(t.tier),
      limitUsdc: fromStroops(t.limit),
      aprBps: Number(t.apr_bps),
    };
  }

  async vaultState(): Promise<VaultState> {
    const c = await this.ensureContracts();
    const s = (await this.read(c.vault, "state", [
      this.addr(this.address),
    ])) as Record<string, unknown>;
    return {
      liquidityUsdc: fromStroops(s.liquidity),
      principalUsdc: fromStroops(s.principal),
      amountOwedUsdc: fromStroops(s.amount_owed),
      totalAssetsUsdc: fromStroops(s.total_assets),
      yieldPoolUsdc: fromStroops(s.yield_pool),
      limitUsdc: fromStroops(s.limit),
      aprBps: Number(s.apr_bps),
    };
  }

  async availableCreditUsdc(): Promise<number> {
    const c = await this.ensureContracts();
    const v = await this.read(c.vault, "available_credit", [
      this.addr(this.address),
    ]);
    return fromStroops(v);
  }

  async usdcBalanceUsdc(): Promise<number> {
    const sac = await this.usdcSac();
    const v = await this.read(sac, "balance", [this.addr(this.address)]);
    return v ? fromStroops(v) : 0;
  }

  async revenue(fromLedger?: number): Promise<unknown> {
    const q = fromLedger ? `?fromLedger=${fromLedger}` : "";
    return this.apiGet(`/agent/${this.address}/revenue${q}`);
  }

  async underwrite(opts: {
    skipProof?: boolean;
    fromLedger?: number;
  } = {}): Promise<unknown> {
    const q = new URLSearchParams();
    if (opts.skipProof) q.set("skipProof", "true");
    if (opts.fromLedger) q.set("fromLedger", String(opts.fromLedger));
    const qs = q.toString();
    return this.apiPost(
      `/agent/${this.address}/underwrite${qs ? `?${qs}` : ""}`,
    );
  }

  async register(): Promise<TrustLineTxResult> {
    const c = await this.ensureContracts();
    return this.invoke(c.registry, "register", [this.addr(this.address)]);
  }

  /**
   * Register (idempotent) then underwrite. If the agent is already in
   * score_registry, skip the failed register and still run underwrite.
   */
  async onboard(opts: {
    skipProof?: boolean;
    fromLedger?: number;
  } = {}): Promise<{
    register: TrustLineTxResult | { alreadyRegistered: true };
    underwrite: unknown;
  }> {
    let register: TrustLineTxResult | { alreadyRegistered: true };
    try {
      register = await this.register();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isAlreadyRegisteredError(msg)) {
        register = { alreadyRegistered: true };
      } else {
        throw e;
      }
    }
    const underwrite = await this.underwrite(opts);
    return { register, underwrite };
  }

  async borrow(usdc: number): Promise<TrustLineTxResult> {
    if (!(usdc > 0) || !Number.isFinite(usdc)) {
      throw new Error("borrow amount must be a positive finite number");
    }
    const c = await this.ensureContracts();
    await this.ensureLiquidity(usdc);
    return this.invoke(c.vault, "borrow", [
      this.addr(this.address),
      this.i128(toStroops(usdc)),
    ]);
  }

  async repay(usdc: number): Promise<TrustLineTxResult> {
    if (!(usdc > 0) || !Number.isFinite(usdc)) {
      throw new Error("repay amount must be a positive finite number");
    }
    const c = await this.ensureContracts();
    return this.invoke(c.vault, "repay", [
      this.addr(this.address),
      this.i128(toStroops(usdc)),
    ]);
  }

  private async ensureLiquidity(usdc: number): Promise<void> {
    try {
      await this.apiPost(`/agent/${this.address}/ensure-liquidity`, {
        neededUsdc: usdc,
      });
    } catch {
      // Best-effort testnet treasury seed — borrow surfaces real errors.
    }
  }

  private addr(a: string): xdr.ScVal {
    return new Address(a).toScVal();
  }

  private i128(n: bigint): xdr.ScVal {
    return nativeToScVal(n, { type: "i128" });
  }

  private async read(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<unknown> {
    const acct = await this.server.getAccount(this.address);
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`${method} simulation failed: ${sim.error}`);
    }
    const retval = sim.result?.retval;
    return retval ? scValToNative(retval) : null;
  }

  private async invoke(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<TrustLineTxResult> {
    const acct = await this.server.getAccount(this.address);
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(TimeoutInfinite)
      .build();
    const prepared = (await this.server.prepareTransaction(tx)) as Transaction;
    const txHash = await signAndSubmitSoroban({
      preparedTx: prepared,
      signer: this.signer,
      sourceAddress: this.address,
      network: this.network,
    });
    return {
      txHash,
      returnValue: null,
      explorerUrl: explorerTxUrl(this.network, txHash),
    };
  }

  private async apiGet<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBaseUrl}${path}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`TrustLine GET ${path} → ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  private async apiPost<T = unknown>(
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.apiBaseUrl}${path}`, {
      method: "POST",
      ...(body !== undefined
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `TrustLine POST ${path} → ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    return res.json() as Promise<T>;
  }
}
