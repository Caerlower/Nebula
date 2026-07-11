import type { Keypair } from "@stellar/stellar-sdk";

import type { NetworkConfig } from "../config.js";
import { findAgentIdOnChain } from "../8004/onchain.js";
import { create8004Clients } from "../8004/client.js";
import { getActiveMppSession } from "../mpp/session.js";
import { isPolicyEnabled } from "../policy/config.js";
import { readPolicyStatus } from "../policy/status.js";
import {
  loadSpendingLimitsConfig,
  spendingLimitEngine,
} from "../spending-limits.js";
import { getTreasuryBalances } from "../treasury/balances.js";
import { treasuryState } from "../treasury/state.js";
import { formatAmount } from "../utils/amount.js";
import { formatBlendRate, field, formatNetworkHeader, linkField, section } from "../lib/format-output.js";
import { stellarExpertAccountUrl } from "../lib/explorer.js";
import { fetchAccountBalances, formatBalances } from "../wallet.js";

export type DashboardBalance = {
  label: string;
  amount: string;
};

export type DashboardSnapshot = {
  network: string;
  address: string;
  funded: boolean;
  balances: DashboardBalance[];
  balancesText: string;
  spending: {
    mode: "onchain" | "offchain";
    maxPerCall: number | null;
    maxPerDay: number | null;
    dailySpent: number | null;
    dailyRemaining: number | null;
    mppSessionReserved: number;
    policyContractId: string | null;
  };
  treasury: {
    asset: string;
    liquid: number;
    blendDeposited: number;
    supplyApy: number | null;
    supplyApyDisplay: string;
    threshold: number | null;
    lastRebalanceAt: string | null;
  } | null;
  identity: {
    agentId: number | null;
    registered: boolean;
  };
  mppSession: {
    channel: string;
    budgetUsdc: number;
    cumulativeUsdc: number;
    remainingUsdc: number;
    openedAt: string;
  } | null;
  warnings: string[];
};

function parseBalanceLines(balancesText: string): DashboardBalance[] {
  return balancesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(":");
      if (colon === -1) {
        return { label: line, amount: "" };
      }
      return {
        label: line.slice(0, colon).trim(),
        amount: line.slice(colon + 1).trim(),
      };
    });
}

export async function buildDashboardSnapshot(
  keypair: Keypair,
  network: NetworkConfig,
): Promise<DashboardSnapshot> {
  const address = keypair.publicKey();
  const warnings: string[] = [];

  const balanceResult = await fetchAccountBalances(address, network);
  const funded = balanceResult.ok;
  const balancesText = balanceResult.ok
    ? formatBalances(balanceResult.balances)
    : balanceResult.notFound
      ? "Account not funded yet."
      : `Error: ${balanceResult.error}`;

  if (!funded && balanceResult.ok === false && !balanceResult.notFound) {
    warnings.push(balanceResult.error);
  }

  let spendingMode: "onchain" | "offchain" = "offchain";
  let maxPerCall: number | null = null;
  let maxPerDay: number | null = null;
  let dailySpent: number | null = null;
  let dailyRemaining: number | null = null;
  const policyContractId = process.env.POLICY_CONTRACT_ID?.trim() || null;

  if (isPolicyEnabled()) {
    spendingMode = "onchain";
    const policy = await readPolicyStatus(keypair, network);
    if (policy.ok) {
      maxPerCall = policy.status.maxPerCall;
      maxPerDay = policy.status.maxPerDay;
      dailySpent = policy.status.dailySpent;
      dailyRemaining = policy.status.dailyRemaining;
    } else {
      warnings.push(policy.error);
    }
  } else {
    const limits = loadSpendingLimitsConfig();
    if (limits.ok) {
      maxPerCall = limits.config.maxPerCall;
      maxPerDay = limits.config.maxPerDay;
      const report = spendingLimitEngine.getReport(limits.config);
      dailySpent = report.dailySpent + report.mppSessionReserved;
      dailyRemaining = report.dailyRemaining;
    } else {
      warnings.push(limits.error);
    }
  }

  const mppSessionReserved = spendingLimitEngine.getMppSessionReserved();

  let treasury: DashboardSnapshot["treasury"] = null;
  try {
    const tb = await getTreasuryBalances(address);
    const threshold = treasuryState.getLiquidityThreshold();
    treasury = {
      asset: tb.asset.symbol.toUpperCase(),
      liquid: tb.liquid,
      blendDeposited: tb.blendDeposited,
      supplyApy: tb.supplyApy,
      supplyApyDisplay:
        tb.supplyApy === null ? "—" : formatBlendRate(tb.supplyApy),
      threshold,
      lastRebalanceAt: treasuryState.lastRebalance?.at ?? null,
    };
  } catch (error) {
    warnings.push(
      error instanceof Error ? error.message : "Treasury status unavailable.",
    );
  }

  let agentId: number | null = null;
  let registered = false;
  try {
    const clients = create8004Clients(keypair, network);
    const lookup = await findAgentIdOnChain(clients, address);
    if (lookup.ok) {
      registered = true;
      agentId = lookup.agentId;
    }
  } catch {
    // Identity is optional on dashboard.
  }

  const session = getActiveMppSession();
  const mppSession = session
    ? {
        channel: session.channel,
        budgetUsdc: session.budgetUsdc,
        cumulativeUsdc: Number(session.cumulativeStroops) / 10_000_000,
        remainingUsdc: Math.max(
          session.budgetUsdc - Number(session.cumulativeStroops) / 10_000_000,
          0,
        ),
        openedAt: session.openedAt,
      }
    : null;

  return {
    network: network.name,
    address,
    funded,
    balances: parseBalanceLines(balancesText),
    balancesText,
    spending: {
      mode: spendingMode,
      maxPerCall,
      maxPerDay,
      dailySpent,
      dailyRemaining,
      mppSessionReserved,
      policyContractId,
    },
    treasury,
    identity: { agentId, registered },
    mppSession,
    warnings,
  };
}

export function formatDashboardSummary(snapshot: DashboardSnapshot): string {
  const lines = [
    ...formatNetworkHeader(snapshot.network as NetworkConfig["name"], "Wallet dashboard"),
    field("Address", snapshot.address),
    linkField(
      "Explorer",
      stellarExpertAccountUrl(snapshot.network as NetworkConfig["name"], snapshot.address),
    ),
    section("Balances"),
    snapshot.balancesText,
    section(`Spending (${snapshot.spending.mode})`),
    field("Per call", String(snapshot.spending.maxPerCall ?? "—")),
    field("Daily cap", String(snapshot.spending.maxPerDay ?? "—")),
    field("Spent today", String(snapshot.spending.dailySpent ?? "—")),
    field("Remaining", String(snapshot.spending.dailyRemaining ?? "—")),
  ];

  if (snapshot.spending.mppSessionReserved > 0) {
    lines.push(
      field(
        "MPP reserved",
        `${formatAmount(snapshot.spending.mppSessionReserved)} USDC`,
      ),
    );
  }

  if (snapshot.treasury) {
    lines.push(
      section(`Treasury · ${snapshot.treasury.asset}`),
      field("Liquid", formatAmount(snapshot.treasury.liquid)),
      field("In Blend", formatAmount(snapshot.treasury.blendDeposited)),
      field("Supply APY", snapshot.treasury.supplyApyDisplay),
    );
  }

  if (snapshot.identity.registered && snapshot.identity.agentId !== null) {
    lines.push(field("8004 agent ID", String(snapshot.identity.agentId)));
  }

  if (snapshot.warnings.length > 0) {
    lines.push(section("Warnings"), ...snapshot.warnings.map((w) => `  • ${w}`));
  }

  return lines.join("\n");
}
