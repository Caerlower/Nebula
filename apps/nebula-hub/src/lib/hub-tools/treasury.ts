import type { ToolContext, ToolResult } from "@nebula/core";

import type { AuthPrincipal } from "../auth";
import { privyConfigured } from "../auth";
import {
  blendDepositXlm,
  blendWithdrawXlm,
  floorXlm,
  getTreasuryBalances,
  roundXlm,
} from "../blend";
import { liquidBandToXlm } from "../fx";
import { explorerTxUrl } from "../stellar";
import {
  formatAmt,
  loadTreasurySettings,
  MIN_AUTO_REBALANCE,
  MIN_TREASURY_MOVE,
  recordBlendTx,
  requireNotPaused,
} from "./context";

export async function executeBlendDeposit(
  input: { amount_xlm: number; pool_id?: string },
  principal: AuthPrincipal,
  ctx: ToolContext,
): Promise<ToolResult> {
  const paused = await requireNotPaused(principal.userId);
  if (paused) return paused;

  if (!privyConfigured()) {
    return {
      status: "error",
      reason:
        "privy_not_configured: set PRIVY_APP_ID / PRIVY_APP_SECRET / PRIVY_AUTHORIZATION_PRIVATE_KEY",
    };
  }

  const result = await blendDepositXlm({
    publicKey: ctx.stellarAddress,
    walletId: ctx.privyWalletId,
    amount: input.amount_xlm,
    network: ctx.network,
    poolId: input.pool_id,
  });

  if (!result.ok) {
    await recordBlendTx({
      principal,
      type: "blend_deposit",
      amount: input.amount_xlm,
      poolId: input.pool_id ?? "blend",
      txHash: null,
      status: "rejected",
      reason: result.error,
    });
    return { status: "error", reason: result.error };
  }

  await recordBlendTx({
    principal,
    type: "blend_deposit",
    amount: result.amount,
    poolId: result.poolId,
    txHash: result.hash,
    status: "confirmed",
    reason: "treasury_deposit",
  });

  const balances = await getTreasuryBalances(ctx.stellarAddress, ctx.network);
  return {
    status: "ok",
    tx_hash: result.hash,
    explorer_url: explorerTxUrl(ctx.network, result.hash),
    data: {
      amount_xlm: result.amount,
      pool_id: result.poolId,
      liquid: balances.liquid,
      blend_deposited: balances.blendDeposited,
    },
    message: `Deposited ${formatAmt(result.amount)} XLM to Blend`,
  };
}

export async function executeBlendWithdraw(
  input: { amount_xlm: number; pool_id?: string },
  principal: AuthPrincipal,
  ctx: ToolContext,
): Promise<ToolResult> {
  const paused = await requireNotPaused(principal.userId);
  if (paused) return paused;

  if (!privyConfigured()) {
    return {
      status: "error",
      reason:
        "privy_not_configured: set PRIVY_APP_ID / PRIVY_APP_SECRET / PRIVY_AUTHORIZATION_PRIVATE_KEY",
    };
  }

  const result = await blendWithdrawXlm({
    publicKey: ctx.stellarAddress,
    walletId: ctx.privyWalletId,
    amount: input.amount_xlm,
    network: ctx.network,
    poolId: input.pool_id,
  });

  if (!result.ok) {
    await recordBlendTx({
      principal,
      type: "blend_withdraw",
      amount: input.amount_xlm,
      poolId: input.pool_id ?? "blend",
      txHash: null,
      status: "rejected",
      reason: result.error,
    });
    return { status: "error", reason: result.error };
  }

  await recordBlendTx({
    principal,
    type: "blend_withdraw",
    amount: result.amount,
    poolId: result.poolId,
    txHash: result.hash,
    status: "confirmed",
    reason: "treasury_withdraw",
  });

  const balances = await getTreasuryBalances(ctx.stellarAddress, ctx.network);
  return {
    status: "ok",
    tx_hash: result.hash,
    explorer_url: explorerTxUrl(ctx.network, result.hash),
    data: {
      amount_xlm: result.amount,
      pool_id: result.poolId,
      liquid: balances.liquid,
      blend_deposited: balances.blendDeposited,
    },
    message: `Withdrew ${formatAmt(result.amount)} XLM from Blend`,
  };
}

export async function executeOptimizeTreasury(
  principal: AuthPrincipal,
  ctx: ToolContext,
  opts?: {
    requireAutoYield?: boolean;
    /** After a spend we only park excess — never pull again (pre-spend already topped the floor). */
    depositOnly?: boolean;
    /** Minimum XLM move for this optimize pass (defaults to dust min). */
    minMove?: number;
  },
): Promise<ToolResult> {
  const paused = await requireNotPaused(principal.userId);
  if (paused) return paused;

  const settings = await loadTreasurySettings(principal.userId);
  const requireAutoYield = opts?.requireAutoYield !== false;
  if (requireAutoYield && !settings.autoYield) {
    return {
      status: "ok",
      data: { action: "none", reason: "auto_yield_disabled" },
      message: "Auto-yield is off. Enable it in treasury settings, then retry.",
    };
  }

  const band = await liquidBandToXlm({
    lowUsdc: Number(settings.liquidThreshold),
    highUsdc: Number(settings.liquidHigh),
  });
  const thresholdLow = band.lowXlm;
  const thresholdHigh = band.highXlm;
  const minMove = opts?.minMove ?? MIN_TREASURY_MOVE;
  const before = await getTreasuryBalances(ctx.stellarAddress, ctx.network);

  // Above ceiling → park excess down to high (not all the way to low).
  if (before.liquid > thresholdHigh) {
    const excess = floorXlm(before.liquid - thresholdHigh);
    if (excess < minMove) {
      return {
        status: "ok",
        data: {
          action: "none",
          reason: "balanced",
          liquid: before.liquid,
          blend_deposited: before.blendDeposited,
          liquid_low_usdc: band.lowUsdc,
          liquid_high_usdc: band.highUsdc,
          liquid_low_xlm: thresholdLow,
          liquid_high_xlm: thresholdHigh,
        },
        message: "Treasury already inside the liquid band.",
      };
    }
    return executeBlendDeposit({ amount_xlm: excess }, principal, ctx);
  }

  if (opts?.depositOnly) {
    return {
      status: "ok",
      data: {
        action: "none",
        reason: "deposit_only_in_band",
        liquid: before.liquid,
        blend_deposited: before.blendDeposited,
        liquid_low_usdc: band.lowUsdc,
        liquid_high_usdc: band.highUsdc,
        liquid_low_xlm: thresholdLow,
        liquid_high_xlm: thresholdHigh,
      },
      message: "Liquid at or below ceiling — no deposit needed.",
    };
  }

  // Below floor → pull up to low.
  if (before.liquid < thresholdLow) {
    const deficit = roundXlm(thresholdLow - before.liquid);
    const withdrawAmount = floorXlm(
      Math.min(deficit, before.blendDeposited),
    );
    if (withdrawAmount < minMove) {
      return {
        status: "ok",
        data: {
          action: "none",
          reason: "insufficient_blend_balance",
          liquid: before.liquid,
          blend_deposited: before.blendDeposited,
          liquid_low_usdc: band.lowUsdc,
          liquid_high_usdc: band.highUsdc,
          liquid_low_xlm: thresholdLow,
          liquid_high_xlm: thresholdHigh,
        },
        message: `Liquid below floor but Blend only has ${formatAmt(before.blendDeposited)} XLM.`,
      };
    }
    return executeBlendWithdraw({ amount_xlm: withdrawAmount }, principal, ctx);
  }

  return {
    status: "ok",
    data: {
      action: "none",
      reason: "balanced",
      liquid: before.liquid,
      blend_deposited: before.blendDeposited,
      liquid_low_usdc: band.lowUsdc,
      liquid_high_usdc: band.highUsdc,
      liquid_low_xlm: thresholdLow,
      liquid_high_xlm: thresholdHigh,
    },
    message: "Treasury already inside the liquid band.",
  };
}

/**
 * Pre-spend Blend top-up: only cover a payment shortfall.
 * Does NOT restore the liquid floor — that is band rebalance (optimize_treasury).
 * Uses raw native balance so the fee buffer does not force needless pulls.
 */
export async function computeSpendTopUp(
  principal: AuthPrincipal,
  ctx: ToolContext,
  amountXlm: number,
): Promise<
  | { ok: true; withdrawAmount: number; liquid: number; blend: number }
  | { ok: false; reason: string }
> {
  const settings = await loadTreasurySettings(principal.userId);
  const amount = roundXlm(amountXlm);
  const bal = await getTreasuryBalances(ctx.stellarAddress, ctx.network);

  if (!settings.autoYield || settings.paused) {
    if (bal.rawNativeXlm + 1e-9 < amount) {
      return {
        ok: false,
        reason:
          `insufficient_liquid: need ${formatAmt(amount)} XLM, ` +
          `native ${formatAmt(bal.rawNativeXlm)} (auto-yield off or paused)`,
      };
    }
    return {
      ok: true,
      withdrawAmount: 0,
      liquid: bal.liquid,
      blend: bal.blendDeposited,
    };
  }

  if (!privyConfigured()) {
    return { ok: false, reason: "privy_not_configured" };
  }

  // Only pull what is missing to clear the payment itself.
  const shortfall = floorXlm(Math.max(0, amount - bal.rawNativeXlm));
  const withdrawAmount = floorXlm(
    Math.min(shortfall, bal.blendDeposited),
  );

  if (withdrawAmount < MIN_TREASURY_MOVE) {
    if (bal.rawNativeXlm + 1e-9 < amount) {
      return {
        ok: false,
        reason:
          `insufficient_liquid_and_blend: need ${formatAmt(amount)} XLM, ` +
          `native ${formatAmt(bal.rawNativeXlm)}, Blend ${formatAmt(bal.blendDeposited)}`,
      };
    }
    return {
      ok: true,
      withdrawAmount: 0,
      liquid: bal.liquid,
      blend: bal.blendDeposited,
    };
  }

  return {
    ok: true,
    withdrawAmount,
    liquid: bal.liquid,
    blend: bal.blendDeposited,
  };
}

/**
 * Fallback when a memo is present (Soroban envelopes forbid memos) or
 * the bundled simulate fails: separate Blend withdraw, then classic pay.
 */
export async function ensureLiquidForSpendSequential(
  principal: AuthPrincipal,
  ctx: ToolContext,
  withdrawAmount: number,
  payAmount: number,
): Promise<ToolResult | null> {
  const pulled = await executeBlendWithdraw(
    { amount_xlm: withdrawAmount },
    principal,
    ctx,
  );
  if (pulled.status !== "ok") return pulled;

  const after = await getTreasuryBalances(ctx.stellarAddress, ctx.network);
  if (after.liquid + 1e-9 < payAmount) {
    return {
      status: "error",
      reason:
        `insufficient_liquid_after_blend_pull: need ${formatAmt(payAmount)} XLM, ` +
        `liquid ${formatAmt(after.liquid)}, Blend ${formatAmt(after.blendDeposited)}`,
    };
  }
  return null;
}

export function scheduleAutoRebalance(
  principal: AuthPrincipal,
  ctx: ToolContext,
  reason: string,
  opts?: { depositOnly?: boolean; minMove?: number },
): void {
  void (async () => {
    try {
      const result = await executeOptimizeTreasury(principal, ctx, {
        depositOnly: opts?.depositOnly,
        minMove: opts?.minMove ?? MIN_AUTO_REBALANCE,
      });
      if (result.status === "ok" && result.tx_hash) {
        console.error(
          `[treasury] auto-rebalance (${reason}) ok ${result.tx_hash}`,
        );
      } else if (result.status === "error" || result.status === "rejected") {
        console.error(
          `[treasury] auto-rebalance (${reason}) ${result.status}:`,
          "reason" in result ? result.reason : result,
        );
      }
    } catch (error) {
      console.error(`[treasury] auto-rebalance (${reason}) failed`, error);
    }
  })();
}
