import { blendDeposit, blendWithdraw } from "../blend/transactions.js";
import {
  field,
  formatNetworkHeader,
  formatTxReference,
  section,
} from "../lib/format-output.js";
import { formatAmount } from "../utils/amount.js";
import { loadWalletFromEnv } from "../wallet.js";
import { getTreasuryAssetConfig } from "./asset.js";
import { getTreasuryBalances } from "./balances.js";
import {
  capTreasuryMoveAmount,
  getTreasuryMaxPerRebalance,
} from "./limits.js";
import {
  recordRebalance,
  recordRebalanceError,
  treasuryState,
  type RebalanceSummary,
} from "./state.js";

const MIN_ACTION_AMOUNT = 0.000001;
const TREASURY_OPTS = { treasury: true } as const;

function capReason(
  requested: number,
  capped: number,
  maxPerRebalance: number | null,
): string {
  if (capped >= requested) {
    return "";
  }
  if (maxPerRebalance !== null) {
    return ` (capped to ${formatAmount(capped)} by TREASURY_MAX_PER_REBALANCE=${maxPerRebalance})`;
  }
  return ` (capped to ${formatAmount(capped)})`;
}

export async function rebalance(): Promise<RebalanceSummary> {
  const threshold = treasuryState.getLiquidityThreshold();
  const at = new Date().toISOString();
  let assetSymbol = "XLM";

  try {
    assetSymbol = getTreasuryAssetConfig().symbol;
  } catch {
    // Filled in below when wallet/network checks pass.
  }

  if (threshold === null) {
    const summary: RebalanceSummary = {
      action: "none",
      reason: "LIQUIDITY_THRESHOLD is not configured",
      amount: 0,
      liquidBefore: 0,
      liquidAfter: 0,
      blendBefore: 0,
      blendAfter: 0,
      threshold: 0,
      asset: assetSymbol,
      error: "Set LIQUIDITY_THRESHOLD in the MCP server environment.",
      at,
    };
    recordRebalance(summary);
    return summary;
  }

  const wallet = loadWalletFromEnv();
  if (!wallet.ok) {
    const summary: RebalanceSummary = {
      action: "none",
      reason: "wallet_unavailable",
      amount: 0,
      liquidBefore: 0,
      liquidAfter: 0,
      blendBefore: 0,
      blendAfter: 0,
      threshold,
      asset: assetSymbol,
      error: wallet.error,
      at,
    };
    recordRebalance(summary);
    return summary;
  }

  if (wallet.network.name !== "testnet") {
    const summary: RebalanceSummary = {
      action: "none",
      reason: "unsupported_network",
      amount: 0,
      liquidBefore: 0,
      liquidAfter: 0,
      blendBefore: 0,
      blendAfter: 0,
      threshold,
      asset: assetSymbol,
      error: "Treasury rebalancing is configured for testnet only.",
      at,
    };
    recordRebalance(summary);
    return summary;
  }

  let assetConfig;
  try {
    assetConfig = getTreasuryAssetConfig();
    assetSymbol = assetConfig.symbol;
  } catch (error) {
    const summary: RebalanceSummary = {
      action: "none",
      reason: "asset_config_error",
      amount: 0,
      liquidBefore: 0,
      liquidAfter: 0,
      blendBefore: 0,
      blendAfter: 0,
      threshold,
      asset: assetSymbol,
      error: error instanceof Error ? error.message : "Invalid treasury asset config.",
      at,
    };
    recordRebalance(summary);
    return summary;
  }

  const publicKey = wallet.keypair.publicKey();
  const before = await getTreasuryBalances(publicKey);
  const treasuryMax = getTreasuryMaxPerRebalance();

  let summary: RebalanceSummary = {
    action: "none",
    reason: "balanced",
    amount: 0,
    liquidBefore: before.liquid,
    liquidAfter: before.liquid,
    blendBefore: before.blendDeposited,
    blendAfter: before.blendDeposited,
    threshold,
    asset: assetSymbol,
    at,
  };

  if (before.liquid > threshold) {
    const excess = before.liquid - threshold;
    const depositAmount = capTreasuryMoveAmount(excess);

    if (depositAmount >= MIN_ACTION_AMOUNT) {
      const result = await blendDeposit(
        wallet.keypair,
        depositAmount,
        TREASURY_OPTS,
      );
      const after = await getTreasuryBalances(publicKey);

      const feeNote =
        assetConfig.id === "xlm"
          ? ` (fee buffer ${formatAmount(assetConfig.feeBuffer)} XLM preserved)`
          : "";

      summary = {
        action: "deposit",
        reason:
          `DEPOSIT: liquid ${formatAmount(before.liquid)} above threshold ` +
          `${formatAmount(threshold)}; moving excess ${formatAmount(excess)}` +
          capReason(excess, depositAmount, treasuryMax) +
          feeNote,
        amount: depositAmount,
        liquidBefore: before.liquid,
        liquidAfter: after.liquid,
        blendBefore: before.blendDeposited,
        blendAfter: after.blendDeposited,
        threshold,
        asset: assetSymbol,
        hash: result.ok ? result.hash : undefined,
        error: result.ok ? undefined : result.error,
        at,
      };
    }
  } else if (before.liquid < threshold) {
    const deficit = threshold - before.liquid;
    const withdrawAmount = capTreasuryMoveAmount(
      Math.min(deficit, before.blendDeposited),
    );

    if (withdrawAmount >= MIN_ACTION_AMOUNT) {
      const result = await blendWithdraw(
        wallet.keypair,
        withdrawAmount,
        TREASURY_OPTS,
      );
      const after = await getTreasuryBalances(publicKey);

      const partialNote =
        before.blendDeposited < deficit
          ? ` (Blend only had ${formatAmount(before.blendDeposited)}; withdrew all available)`
          : "";

      summary = {
        action: "withdraw",
        reason:
          `WITHDRAW: liquid ${formatAmount(before.liquid)} below threshold ` +
          `${formatAmount(threshold)}; restoring ${formatAmount(deficit)}` +
          capReason(
            Math.min(deficit, before.blendDeposited),
            withdrawAmount,
            treasuryMax,
          ) +
          partialNote,
        amount: withdrawAmount,
        liquidBefore: before.liquid,
        liquidAfter: after.liquid,
        blendBefore: before.blendDeposited,
        blendAfter: after.blendDeposited,
        threshold,
        asset: assetSymbol,
        hash: result.ok ? result.hash : undefined,
        error: result.ok ? undefined : result.error,
        at,
      };
    } else {
      summary = {
        action: "none",
        reason:
          `WITHDRAW needed but Blend ${assetSymbol} balance ` +
          `(${formatAmount(before.blendDeposited)}) is insufficient`,
        amount: 0,
        liquidBefore: before.liquid,
        liquidAfter: before.liquid,
        blendBefore: before.blendDeposited,
        blendAfter: before.blendDeposited,
        threshold,
        asset: assetSymbol,
        at,
      };
    }
  }

  recordRebalance(summary);
  return summary;
}

export function formatRebalanceSummary(summary: RebalanceSummary): string {
  const symbol = summary.asset;
  const lines = [
    ...formatNetworkHeader("testnet", "Treasury rebalance"),
    field("Direction", summary.action.toUpperCase()),
    field("Asset", symbol),
    field("Reason", summary.reason),
    field("Threshold", `${formatAmount(summary.threshold)} ${symbol}`),
    field("Amount moved", `${formatAmount(summary.amount)} ${symbol}`),
    field(
      `Liquid ${symbol}`,
      `${formatAmount(summary.liquidBefore)} → ${formatAmount(summary.liquidAfter)}`,
    ),
    field(
      `Blend ${symbol}`,
      `${formatAmount(summary.blendBefore)} → ${formatAmount(summary.blendAfter)}`,
    ),
    field("At", summary.at),
  ];

  if (summary.hash) {
    lines.push(...formatTxReference("testnet", summary.hash));
  }

  if (summary.error) {
    lines.push(section("Error"), field("Message", summary.error));
  }

  return lines.join("\n");
}

export async function rebalanceSafely(): Promise<void> {
  if (treasuryState.loopRunning) {
    console.error("[treasury] Skipping rebalance — previous run still in progress.");
    return;
  }

  treasuryState.loopRunning = true;

  try {
    const summary = await rebalance();
    if (
      summary.action === "none" &&
      summary.reason === "LIQUIDITY_THRESHOLD is not configured"
    ) {
      treasuryState.warnMissingThresholdOnce();
      return;
    }

    console.error(`[treasury] ${summary.action.toUpperCase()} @ ${summary.at}`);
    if (summary.action !== "none") {
      console.error(formatRebalanceSummary(summary));
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown rebalance failure";
    recordRebalanceError(message);
    console.error(`[treasury] Rebalance failed: ${message}`);
  } finally {
    treasuryState.loopRunning = false;
  }
}

export function startTreasuryLoop(): void {
  const intervalMs = treasuryState.getRebalanceIntervalSeconds() * 1000;
  const treasuryMax = getTreasuryMaxPerRebalance();

  try {
    const asset = getTreasuryAssetConfig();
    console.error(
      `[treasury] Asset: ${asset.symbol} (reserve ${asset.reserveContract})`,
    );
    if (asset.id === "xlm") {
      console.error(`[treasury] XLM fee buffer: ${asset.feeBuffer}`);
    }
  } catch (error) {
    console.error(
      `[treasury] Warning: ${error instanceof Error ? error.message : "invalid asset config"}`,
    );
  }

  console.error(
    `[treasury] Max per rebalance: ${
      treasuryMax === null ? "none (full excess/deficit)" : treasuryMax
    }`,
  );
  console.error(
    `[treasury] Treasury moves do NOT count against agent MAX_PER_CALL / MAX_PER_DAY`,
  );
  console.error(
    `[treasury] Background loop started (every ${treasuryState.getRebalanceIntervalSeconds()}s)`,
  );

  const threshold = treasuryState.getLiquidityThreshold();
  if (threshold === null) {
    treasuryState.warnMissingThresholdOnce();
    return;
  }

  console.error(`[treasury] Liquidity threshold: ${threshold}`);

  void rebalanceSafely();

  setInterval(() => {
    void rebalanceSafely();
  }, intervalMs);
}
