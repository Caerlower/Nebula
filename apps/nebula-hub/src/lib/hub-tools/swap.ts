import type { ToolContext, ToolResult } from "@nebula/core";

import type { AuthPrincipal } from "../auth";
import { privyConfigured } from "../auth";
import { getLiquidXlm } from "../blend";
import { prisma } from "../db";
import { xlmToUsdc } from "../fx";
import { fetchBalances } from "../stellar";
import {
  destMinAfterSlippage,
  executeStrictSendSwap,
  quoteStrictSendSwap,
  type SwapAsset,
} from "../swap";
import { formatAmt, loadPolicySnapshot, requireNotPaused } from "./context";
import { scheduleParkExcessAfterActivity } from "./treasury";

export async function executeGetSwapQuote(
  input: { from_asset: SwapAsset; to_asset: SwapAsset; amount: number },
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    const quote = await quoteStrictSendSwap({
      fromAsset: input.from_asset,
      toAsset: input.to_asset,
      amount: input.amount,
      network: ctx.network,
    });
    const path =
      quote.path.length > 0
        ? `${input.from_asset} → ${quote.path.join(" → ")} → ${input.to_asset}`
        : `${input.from_asset} → ${input.to_asset}`;
    return {
      status: "ok",
      data: {
        from_asset: quote.fromAsset,
        to_asset: quote.toAsset,
        send_amount: quote.sendAmount,
        receive_amount: quote.receiveAmount,
        path: quote.path,
        source: quote.source,
      },
      message:
        `Quote: sell ${formatAmt(quote.sendAmount)} ${quote.fromAsset} → ` +
        `~${formatAmt(quote.receiveAmount)} ${quote.toAsset}\nPath: ${path}`,
    };
  } catch (error) {
    return {
      status: "error",
      reason: error instanceof Error ? error.message : "swap_quote_failed",
    };
  }
}

async function sendSideUsdcValue(
  fromAsset: SwapAsset,
  amount: number,
): Promise<number> {
  if (fromAsset === "USDC") return amount;
  return xlmToUsdc(amount);
}

async function assertHaveBalance(
  ctx: ToolContext,
  fromAsset: SwapAsset,
  amount: number,
): Promise<ToolResult | null> {
  if (fromAsset === "XLM") {
    const { liquid } = await getLiquidXlm(ctx.stellarAddress, ctx.network);
    if (amount > liquid) {
      return {
        status: "error",
        reason:
          `insufficient_liquid_xlm: need ${formatAmt(amount)}, ` +
          `have ${formatAmt(liquid)} (fee buffer reserved)`,
      };
    }
    return null;
  }

  const balances = await fetchBalances(ctx.stellarAddress, ctx.network);
  const usdc = balances.find(
    (b) => b.asset === "USDC" || b.asset.startsWith("USDC:"),
  );
  const have = usdc ? Number(usdc.balance) : 0;
  if (!(have >= amount)) {
    return {
      status: "error",
      reason: `insufficient_usdc: need ${formatAmt(amount)}, have ${formatAmt(have)}`,
    };
  }
  return null;
}

export async function executeSwap(
  input: {
    from_asset: SwapAsset;
    to_asset: SwapAsset;
    amount: number;
    max_slippage_bps?: number;
    reason: string;
  },
  principal: AuthPrincipal,
  ctx: ToolContext,
  confirmationId?: string,
): Promise<ToolResult> {
  const paused = await requireNotPaused(principal.userId);
  if (paused) return paused;

  if (input.from_asset === input.to_asset) {
    return { status: "error", reason: "from_asset and to_asset must differ" };
  }

  const short = await assertHaveBalance(ctx, input.from_asset, input.amount);
  if (short) return short;

  const slippageBps = input.max_slippage_bps ?? 100;

  if (!privyConfigured() && principal.privyWalletId === "dev-wallet") {
    const quote = await quoteStrictSendSwap({
      fromAsset: input.from_asset,
      toAsset: input.to_asset,
      amount: input.amount,
      network: ctx.network,
    });
    const fakeHash = `dev_swap_${Date.now().toString(16)}`;
    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: principal.agentId,
        type: "swap",
        destination: ctx.stellarAddress,
        amountXlm: input.amount,
        reason: `${input.reason}; ${input.from_asset}→${input.to_asset}; dry-run`,
        txHash: fakeHash,
        status: "confirmed",
        confirmationId,
      },
    });
    return {
      status: "ok",
      tx_hash: fakeHash,
      data: {
        from_asset: input.from_asset,
        to_asset: input.to_asset,
        send_amount: input.amount,
        receive_amount_est: quote.receiveAmount,
        dry_run: true,
      },
      message:
        `Dev dry-run swap ${formatAmt(input.amount)} ${input.from_asset} → ` +
        `~${formatAmt(quote.receiveAmount)} ${input.to_asset}`,
    };
  }

  try {
    const quote = await quoteStrictSendSwap({
      fromAsset: input.from_asset,
      toAsset: input.to_asset,
      amount: input.amount,
      network: ctx.network,
    });
    const destMin = destMinAfterSlippage(quote.receiveAmount, slippageBps);
    const result = await executeStrictSendSwap({
      sourceAddress: ctx.stellarAddress,
      walletId: ctx.privyWalletId,
      fromAsset: input.from_asset,
      toAsset: input.to_asset,
      sendAmount: input.amount,
      destMin,
      network: ctx.network,
      memo: `swap ${input.from_asset}/${input.to_asset}`.slice(0, 28),
    });

    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: principal.agentId,
        type: "swap",
        destination: ctx.stellarAddress,
        amountXlm: input.amount,
        reason:
          `${input.reason}; ${input.from_asset}→${input.to_asset}; ` +
          `recv~${formatAmt(result.quote.receiveAmount)}; slip≤${slippageBps}bps`,
        txHash: result.hash,
        status: "confirmed",
        confirmationId,
      },
    });

    scheduleParkExcessAfterActivity(principal, ctx, "after_swap");

    return {
      status: "ok",
      tx_hash: result.hash,
      explorer_url: result.explorerUrl,
      data: {
        from_asset: input.from_asset,
        to_asset: input.to_asset,
        send_amount: input.amount,
        receive_amount_quoted: result.quote.receiveAmount,
        dest_min: destMin,
        max_slippage_bps: slippageBps,
        path: result.quote.path,
      },
      message:
        `Swapped ${formatAmt(input.amount)} ${input.from_asset} → ` +
        `≥${formatAmt(destMin)} ${input.to_asset} (quoted ${formatAmt(result.quote.receiveAmount)})`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "swap_failed";
    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: principal.agentId,
        type: "swap",
        destination: ctx.stellarAddress,
        amountXlm: input.amount,
        reason: `${input.reason}; failed:${reason}`,
        status: "rejected",
        confirmationId,
      },
    });
    return { status: "error", reason };
  }
}

/** Confirmation gate for swap (notional in USDC; does not count as outbound spend). */
export async function decideSwapConfirmation(
  input: {
    from_asset: SwapAsset;
    to_asset: SwapAsset;
    amount: number;
  },
  principal: AuthPrincipal,
  ctx: ToolContext,
): Promise<
  | { action: "auto" }
  | { action: "reject"; reason: string }
  | { action: "confirm"; amountUsdc: number; reason: string }
> {
  const policy = await loadPolicySnapshot(principal.userId);
  if (policy.paused) {
    return { action: "reject", reason: "policy_paused" };
  }
  if (policy.denylist.includes(ctx.stellarAddress)) {
    return { action: "reject", reason: "destination_denylisted" };
  }

  let amountUsdc: number;
  try {
    amountUsdc = await sendSideUsdcValue(input.from_asset, input.amount);
  } catch (error) {
    return {
      action: "reject",
      reason:
        error instanceof Error ? error.message : "xlm_usd_price_unavailable",
    };
  }

  // Self-swap: no outbound destination risk. Auto within per-tx notional;
  // confirm only for large rebalances.
  if (amountUsdc <= policy.microThreshold) {
    return { action: "auto" };
  }
  if (amountUsdc <= policy.perTxCap) {
    return { action: "auto" };
  }
  return {
    action: "confirm",
    amountUsdc,
    reason: "swap_notional_above_per_tx_cap",
  };
}
