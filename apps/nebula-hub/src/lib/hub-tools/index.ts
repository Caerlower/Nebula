import {
  evaluateConfirmation,
  getTool,
  type ToolResult,
} from "@nebula/core";

import type { AuthPrincipal } from "../auth";
import {
  fetchBlendSupplyRates,
  getTreasuryBalances,
} from "../blend";
import { prisma } from "../db";
import { liquidBandToXlm, sumSpendUsdcSince, xlmToUsdc } from "../fx";
import {
  ensurePolicyInitialized,
  onchainSetTreasuryBand,
  policyContractConfigured,
} from "../policy-onchain";
import { explorerTxUrl, fetchBalances } from "../stellar";
import { executeX402Tool } from "../x402/execute";
import {
  executeMppCloseSession,
  executeMppFetch,
  executeMppOpenSession,
  executeMppPay,
  executeMppStatus,
} from "../mpp/execute";

import {
  APP_URL,
  formatAmt,
  ledgerAsset,
  loadPolicySnapshot,
  loadTreasurySettings,
  buildToolContext,
  MIN_AUTO_REBALANCE,
} from "./context";
import {
  executeBlendDeposit,
  executeBlendWithdraw,
  executeOptimizeTreasury,
  scheduleAutoRebalance,
} from "./treasury";
import { executeTransfer } from "./transfer";
import {
  decideSwapConfirmation,
  executeGetSwapQuote,
  executeSwap,
} from "./swap";
import {
  executeGetMyReputation,
  executeRegisterIdentity,
} from "./identity";

export { SPEND_TX_TYPES, loadPolicySnapshot, buildToolContext } from "./context";

export async function runHubTool(
  toolName: string,
  rawInput: unknown,
  principal: AuthPrincipal,
): Promise<ToolResult> {
  const tool = getTool(toolName);
  if (!tool) {
    return { status: "error", reason: `unknown_tool:${toolName}` };
  }
  if (tool.dashboardOnly && principal.source === "nebula_token") {
    return {
      status: "rejected",
      reason: "mcp_tokens_cannot_mutate_policy",
    };
  }

  const parsed = tool.schema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return {
      status: "error",
      reason: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const ctx = buildToolContext(principal);

  if (toolName === "ping") {
    return tool.handler(
      parsed.data,
      ctx ?? {
        userId: principal.userId,
        agentId: principal.agentId,
        tokenId: principal.tokenId,
        stellarAddress: principal.stellarAddress ?? "",
        privyWalletId: principal.privyWalletId ?? "",
        network: "testnet",
        signTransactionXdr: async () => {
          throw new Error("no_wallet");
        },
        submitTransactionXdr: async () => {
          throw new Error("no_wallet");
        },
      },
    );
  }

  if (toolName === "help") {
    return tool.handler(
      parsed.data,
      ctx ?? {
        userId: principal.userId,
        agentId: principal.agentId,
        tokenId: principal.tokenId,
        stellarAddress: principal.stellarAddress ?? "",
        privyWalletId: principal.privyWalletId ?? "",
        network: "testnet",
        signTransactionXdr: async () => {
          throw new Error("no_wallet");
        },
        submitTransactionXdr: async () => {
          throw new Error("no_wallet");
        },
      },
    );
  }

  if (toolName === "await_confirmation") {
    const input = parsed.data as {
      confirmation_id: string;
      timeout_seconds?: number;
    };
    return executeAwaitConfirmation(input, principal);
  }

  // Policy reads do not need a wallet (and must work even if ctx is thin).
  if (toolName === "spending_report" || toolName === "get_policy_status") {
    return executePolicyReadTools(toolName, principal);
  }

  if (!ctx) {
    return { status: "error", reason: "wallet_not_provisioned" };
  }

  if (toolName === "get_address") {
    return tool.handler(parsed.data, ctx);
  }

  if (toolName === "request_funding") {
    const result = await tool.handler(parsed.data, ctx);
    if (result.status === "ok") {
      scheduleAutoRebalance(principal, ctx, "after_funding", {
        minMove: MIN_AUTO_REBALANCE,
      });
    }
    return result;
  }

  if (toolName === "check_balance") {
    const balances = await fetchBalances(ctx.stellarAddress, ctx.network);
    return {
      status: "ok",
      data: { address: ctx.stellarAddress, network: ctx.network, balances },
      message: balances.length
        ? balances.map((b) => `${b.asset}: ${b.balance}`).join("\n")
        : "Account not funded yet.",
    };
  }

  if (toolName === "transfer") {
    const input = parsed.data as {
      destination: string;
      amount_xlm: number;
      memo?: string;
      reason: string;
    };
    const policy = await loadPolicySnapshot(principal.userId);
    let amountUsdc: number;
    try {
      amountUsdc = await xlmToUsdc(input.amount_xlm);
    } catch (error) {
      return {
        status: "error",
        reason:
          error instanceof Error
            ? error.message
            : "xlm_usd_price_unavailable",
      };
    }
    const decision = evaluateConfirmation({
      destination: input.destination,
      amountUsdc,
      policy,
    });
    if (decision.action === "reject") {
      await prisma.transaction.create({
        data: {
          userId: principal.userId,
          agentId: principal.agentId,
          type: "transfer",
          destination: input.destination,
          amountXlm: input.amount_xlm,
          memo: input.memo,
          reason: input.reason,
          status: "rejected",
        },
      });
      return { status: "rejected", reason: decision.reason };
    }
    if (decision.action === "confirm") {
      const expiresAt = new Date(Date.now() + 15 * 60_000);
      const conf = await prisma.confirmation.create({
        data: {
          userId: principal.userId,
          toolName,
          input,
          summary: `Transfer ${input.amount_xlm} XLM (≈ $${formatAmt(amountUsdc)} USDC) to ${input.destination.slice(0, 4)}…${input.destination.slice(-4)} (${decision.reason})`,
          status: "pending",
          expiresAt,
        },
      });
      return {
        status: "confirmation_required",
        confirmation_id: conf.id,
        approve_url: `${APP_URL}/approve/${conf.id}`,
        expires_in: 15 * 60,
        summary: conf.summary,
      };
    }
    return executeTransfer(input, principal, ctx);
  }

  if (toolName === "get_swap_quote") {
    const input = parsed.data as {
      from_asset: "XLM" | "USDC";
      to_asset: "XLM" | "USDC";
      amount: number;
    };
    return executeGetSwapQuote(input, ctx);
  }

  if (toolName === "swap") {
    const input = parsed.data as {
      from_asset: "XLM" | "USDC";
      to_asset: "XLM" | "USDC";
      amount: number;
      max_slippage_bps?: number;
      reason: string;
    };
    const decision = await decideSwapConfirmation(input, principal, ctx);
    if (decision.action === "reject") {
      await prisma.transaction.create({
        data: {
          userId: principal.userId,
          agentId: principal.agentId,
          type: "swap",
          destination: ctx.stellarAddress,
          amountXlm: input.amount,
          reason: `${input.reason}; rejected:${decision.reason}`,
          status: "rejected",
        },
      });
      return { status: "rejected", reason: decision.reason };
    }
    if (decision.action === "confirm") {
      const expiresAt = new Date(Date.now() + 15 * 60_000);
      const conf = await prisma.confirmation.create({
        data: {
          userId: principal.userId,
          toolName,
          input,
          summary:
            `Swap ${input.amount} ${input.from_asset} → ${input.to_asset} ` +
            `(≈ $${formatAmt(decision.amountUsdc)} USDC notional; ${decision.reason})`,
          status: "pending",
          expiresAt,
        },
      });
      return {
        status: "confirmation_required",
        confirmation_id: conf.id,
        approve_url: `${APP_URL}/approve/${conf.id}`,
        expires_in: 15 * 60,
        summary: conf.summary,
      };
    }
    return executeSwap(input, principal, ctx);
  }

  if (toolName === "blend_check_rates") {
    const rates = await fetchBlendSupplyRates(ctx.network);
    if (!rates.ok) {
      return { status: "error", reason: rates.error };
    }
    const lines: string[] = [`Blend rates (${rates.network})`];
    for (const pool of rates.pools) {
      lines.push(`\n${pool.poolName} (${pool.pool.poolId})`);
      for (const r of pool.reserves) {
        lines.push(
          `  ${r.symbol}: supply APY ${r.supplyApy}, util ${r.utilization}`,
        );
      }
    }
    if (rates.errors.length) {
      lines.push("\nWarnings:", ...rates.errors.map((e) => `  • ${e}`));
    }
    return {
      status: "ok",
      data: rates,
      message: lines.join("\n"),
    };
  }

  if (toolName === "get_treasury_status") {
    const settings = await loadTreasurySettings(principal.userId);
    try {
      const balances = await getTreasuryBalances(
        ctx.stellarAddress,
        ctx.network,
      );
      const band = await liquidBandToXlm({
        lowUsdc: Number(settings.liquidThreshold),
        highUsdc: Number(settings.liquidHigh),
      });
      return {
        status: "ok",
        data: {
          asset: "XLM",
          liquid: balances.liquid,
          blend_deposited: balances.blendDeposited,
          supply_apy: balances.supplyApy,
          raw_native_xlm: balances.rawNativeXlm,
          fee_buffer: balances.feeBuffer,
          liquid_low_usdc: band.lowUsdc,
          liquid_high_usdc: band.highUsdc,
          liquid_low_xlm: band.lowXlm,
          liquid_high_xlm: band.highXlm,
          /** @deprecated use liquid_low_usdc */
          liquid_low: band.lowUsdc,
          /** @deprecated use liquid_high_usdc */
          liquid_high: band.highUsdc,
          liquid_threshold: band.lowUsdc,
          auto_yield: settings.autoYield,
          pool_id: balances.poolId,
          pool_name: balances.poolName,
          paused: settings.paused,
        },
        message:
          `Liquid ${formatAmt(balances.liquid)} XLM · ` +
          `Blend ${formatAmt(balances.blendDeposited)} XLM · ` +
          `band $${formatAmt(band.lowUsdc)}–$${formatAmt(band.highUsdc)} USDC ` +
          `(≈ ${formatAmt(band.lowXlm)}–${formatAmt(band.highXlm)} XLM) · ` +
          `APY ${balances.supplyApy != null ? `${(balances.supplyApy * 100).toFixed(2)}%` : "n/a"}`,
      };
    } catch (error) {
      return {
        status: "error",
        reason:
          error instanceof Error
            ? error.message
            : "Failed to load treasury balances",
      };
    }
  }

  if (toolName === "set_liquidity_threshold") {
    const input = parsed.data as { threshold: number };
    const existing = await loadTreasurySettings(principal.userId);
    const liquidHigh = Math.max(Number(existing.liquidHigh), input.threshold);
    const row = await prisma.policySettings.upsert({
      where: { userId: principal.userId },
      create: {
        userId: principal.userId,
        liquidThreshold: input.threshold,
        liquidHigh,
      },
      update: {
        liquidThreshold: input.threshold,
        liquidHigh,
      },
    });

    let onchain: string = "hub_only";
    if (
      policyContractConfigured() &&
      principal.privyWalletId &&
      principal.privyWalletId !== "dev-wallet" &&
      principal.stellarAddress
    ) {
      const network = ctx.network;
      const init = await ensurePolicyInitialized({
        walletId: principal.privyWalletId,
        stellarAddress: principal.stellarAddress,
        network,
        maxPerCallXlm: Number(row.perTxCap),
        maxPerDayXlm: Number(row.dailyCap),
        categories: {
          transfer: Number(row.catTransfer),
          x402: Number(row.catX402),
          mpp: Number(row.catMpp),
        },
        liquidLowXlm: Number(row.liquidThreshold),
        liquidHighXlm: Number(row.liquidHigh),
        autoYield: row.autoYield,
      });
      if (!init.ok) {
        return {
          status: "error",
          reason: `onchain_initialize_failed:${init.error}`,
        };
      }
      if (!init.hash) {
        const band = await onchainSetTreasuryBand({
          walletId: principal.privyWalletId,
          stellarAddress: principal.stellarAddress,
          network,
          liquidLowXlm: Number(row.liquidThreshold),
          liquidHighXlm: Number(row.liquidHigh),
          autoYield: row.autoYield,
        });
        if (!band.ok) {
          return {
            status: "error",
            reason: `onchain_set_treasury_band_failed:${band.error}`,
          };
        }
        onchain = "set_treasury_band_ok";
      } else {
        onchain = "initialize_ok";
      }
    } else if (!policyContractConfigured()) {
      onchain = "skipped_no_contract";
    }

    return {
      status: "ok",
      data: {
        liquid_threshold: Number(row.liquidThreshold),
        liquid_high: Number(row.liquidHigh),
        onchain,
      },
      message: `Liquidity threshold set to $${formatAmt(input.threshold)} USDC (high $${formatAmt(Number(row.liquidHigh))}, ${onchain})`,
    };
  }

  if (toolName === "blend_deposit") {
    return executeBlendDeposit(
      parsed.data as { amount_xlm: number; pool_id?: string },
      principal,
      ctx,
    );
  }

  if (toolName === "blend_withdraw") {
    return executeBlendWithdraw(
      parsed.data as { amount_xlm: number; pool_id?: string },
      principal,
      ctx,
    );
  }

  if (toolName === "optimize_treasury") {
    return executeOptimizeTreasury(principal, ctx);
  }

  if (toolName === "x402_fetch" || toolName === "x402_pay") {
    const input = parsed.data as {
      url: string;
      max_amount_usdc?: number;
      amount_usdc?: number;
      facilitator?: string;
    };
    const policy = await loadPolicySnapshot(principal.userId);
    return executeX402Tool({
      toolName,
      input,
      principal,
      ctx,
      policy,
    });
  }

  if (toolName === "mpp_open_session") {
    const input = parsed.data as { budget_usdc: number; recipient?: string };
    const policy = await loadPolicySnapshot(principal.userId);
    return executeMppOpenSession({ input, principal, ctx, policy });
  }

  if (toolName === "mpp_pay") {
    const input = parsed.data as {
      recipient: string;
      amount_xlm: number;
      streaming?: boolean;
    };
    const policy = await loadPolicySnapshot(principal.userId);
    return executeMppPay({ input, principal, ctx, policy });
  }

  if (toolName === "mpp_fetch") {
    const input = parsed.data as { url: string };
    const policy = await loadPolicySnapshot(principal.userId);
    return executeMppFetch({ input, principal, ctx, policy });
  }

  if (toolName === "mpp_status") {
    return executeMppStatus({ principal });
  }

  if (toolName === "mpp_close_session") {
    return executeMppCloseSession({ principal, ctx });
  }

  if (toolName === "get_my_reputation") {
    return executeGetMyReputation(principal);
  }

  if (toolName === "register_identity") {
    return executeRegisterIdentity(principal);
  }

  return {
    status: "error",
    reason: `${toolName}_not_implemented_yet`,
  };
}

async function executeAwaitConfirmation(
  input: { confirmation_id: string; timeout_seconds?: number },
  principal: AuthPrincipal,
): Promise<ToolResult> {
  // Keep under typical serverless limits; clients re-call while pending.
  const timeoutMs = Math.min(
    Math.max((input.timeout_seconds ?? 15) * 1000, 3_000),
    25_000,
  );
  const pollEvery = 1_500;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const conf = await prisma.confirmation.findUnique({
      where: { id: input.confirmation_id },
    });
    if (!conf) {
      return { status: "error", reason: "confirmation_not_found" };
    }
    if (conf.userId !== principal.userId) {
      return { status: "rejected", reason: "forbidden" };
    }
    if (conf.status === "approved") {
      return {
        status: "ok",
        tx_hash: conf.txHash ?? undefined,
        explorer_url: conf.txHash
          ? explorerTxUrl(
              (process.env.STELLAR_NETWORK as "testnet" | "mainnet") ??
                "testnet",
              conf.txHash,
            )
          : undefined,
        data: {
          confirmation_id: conf.id,
          status: conf.status,
          tool: conf.toolName,
        },
        message: [
          "Confirmation approved.",
          conf.summary,
          conf.txHash ? `Transaction: ${conf.txHash}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
    if (conf.status === "rejected") {
      return { status: "rejected", reason: "confirmation_rejected" };
    }
    if (
      conf.status === "expired" ||
      conf.expiresAt.getTime() < Date.now()
    ) {
      if (conf.status === "pending") {
        await prisma.confirmation.update({
          where: { id: conf.id },
          data: { status: "expired" },
        });
      }
      return { status: "error", reason: "confirmation_expired" };
    }
    await new Promise((r) => setTimeout(r, pollEvery));
  }

  const polledSec = Math.round((Date.now() - started) / 1000);
  return {
    status: "ok",
    data: {
      confirmation_id: input.confirmation_id,
      status: "pending",
      retry: true,
      polled_seconds: polledSec,
      approve_url: `${APP_URL}/approve/${input.confirmation_id}`,
    },
    message: [
      `Still pending after ${polledSec}s.`,
      `Approve at: ${APP_URL}/approve/${input.confirmation_id}`,
      "Call await_confirmation again with the same confirmation_id.",
    ].join("\n"),
  };
}

async function executePolicyReadTools(
  toolName: "spending_report" | "get_policy_status",
  principal: AuthPrincipal,
): Promise<ToolResult> {
  const since = new Date(Date.now() - 24 * 60 * 60_000);

  if (toolName === "spending_report") {
    const rows = await prisma.transaction.findMany({
      where: {
        userId: principal.userId,
        status: "confirmed",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        destination: true,
        amountXlm: true,
        reason: true,
        txHash: true,
        createdAt: true,
      },
    });

    const totalsByType: Record<string, { count: number; amount: number }> = {};
    let totalAmount = 0;
    for (const row of rows) {
      const amt = Number(row.amountXlm);
      totalAmount += amt;
      const bucket = totalsByType[row.type] ?? { count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += amt;
      totalsByType[row.type] = bucket;
    }

    const lines: string[] = [
      `Activity report — last 24h (${rows.length} tx${rows.length === 1 ? "" : "s"}, showing up to 50)`,
      `Total volume (all types, incl. treasury): ${formatAmt(totalAmount)}`,
      `Spend toward daily cap (transfer/x402/mpp only): see get_policy_status`,
      "",
    ];

    if (Object.keys(totalsByType).length) {
      lines.push("Totals by type:");
      for (const [type, t] of Object.entries(totalsByType).sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        lines.push(
          `  ${type}: ${t.count} tx · ${formatAmt(t.amount)} ${ledgerAsset(type)}`,
        );
      }
      lines.push("");
    }

    if (rows.length === 0) {
      lines.push("No confirmed transactions in the last 24 hours.");
    } else {
      lines.push("Recent activity:");
      for (const row of rows) {
        const when = row.createdAt.toISOString().replace("T", " ").slice(0, 19);
        const dest =
          row.destination.length > 12
            ? `${row.destination.slice(0, 4)}…${row.destination.slice(-4)}`
            : row.destination;
        const hash = row.txHash
          ? row.txHash.startsWith("http")
            ? row.txHash
            : row.txHash.slice(0, 18)
          : "—";
        const unit = ledgerAsset(row.type);
        lines.push(
          `  ${when}  ${row.type.padEnd(14)}  ${formatAmt(Number(row.amountXlm)).padStart(12)} ${unit}  → ${dest}  ${hash}`,
        );
      }
    }

    lines.push("", "For caps and remaining budget, call get_policy_status.");

    return {
      status: "ok",
      data: {
        window_hours: 24,
        count: rows.length,
        total_amount: totalAmount,
        totals_by_type: totalsByType,
        transactions: rows.map((row) => ({
          id: row.id,
          type: row.type,
          amount: Number(row.amountXlm),
          asset: ledgerAsset(row.type),
          destination: row.destination,
          reason: row.reason,
          tx_hash: row.txHash,
          at: row.createdAt.toISOString(),
        })),
      },
      message: lines.join("\n"),
    };
  }

  // get_policy_status — caps / band / lists only (all spend caps in USDC)
  const settings = await loadTreasurySettings(principal.userId);
  const policy = await loadPolicySnapshot(principal.userId);
  const [spend, whitelistCount, denylistCount] = await Promise.all([
    sumSpendUsdcSince(principal.userId, since),
    prisma.whitelistEntry.count({ where: { userId: principal.userId } }),
    prisma.denylistEntry.count({ where: { userId: principal.userId } }),
  ]);

  const catCaps = {
    transfer: Number(settings.catTransfer),
    x402: Number(settings.catX402),
    mpp: Number(settings.catMpp),
  };
  const catSpent = {
    transfer: spend.byType.transfer ?? 0,
    x402: spend.byType.x402 ?? 0,
    mpp: spend.byType.mpp ?? 0,
  };

  let xlmUsd: number | null = null;
  try {
    const { getUsdPerXlm } = await import("../fx");
    xlmUsd = await getUsdPerXlm();
  } catch {
    xlmUsd = null;
  }

  const data = {
    unit: "USDC" as const,
    paused: policy.paused,
    micro_threshold: policy.microThreshold,
    per_tx_cap: policy.perTxCap,
    daily_cap: policy.dailyCap,
    daily_spent: policy.dailySpentUsdc,
    daily_remaining: Math.max(policy.dailyCap - policy.dailySpentUsdc, 0),
    xlm_usd: xlmUsd,
    categories: {
      transfer: {
        cap: catCaps.transfer,
        spent_24h: catSpent.transfer,
        remaining: Math.max(catCaps.transfer - catSpent.transfer, 0),
      },
      x402: {
        cap: catCaps.x402,
        spent_24h: catSpent.x402,
        remaining: Math.max(catCaps.x402 - catSpent.x402, 0),
      },
      mpp: {
        cap: catCaps.mpp,
        spent_24h: catSpent.mpp,
        remaining: Math.max(catCaps.mpp - catSpent.mpp, 0),
      },
    },
    liquid_low: Number(settings.liquidThreshold),
    liquid_high: Number(settings.liquidHigh),
    auto_yield: settings.autoYield,
    whitelist_count: whitelistCount,
    denylist_count: denylistCount,
  };

  return {
    status: "ok",
    data,
    message: [
      `Policy: ${data.paused ? "PAUSED" : "active"} (caps in USDC)`,
      `Limits: micro $${formatAmt(data.micro_threshold)} · per-tx $${formatAmt(data.per_tx_cap)} · daily $${formatAmt(data.daily_cap)}`,
      `Daily usage: $${formatAmt(data.daily_spent)} spent · $${formatAmt(data.daily_remaining)} remaining`,
      data.xlm_usd != null
        ? `XLM/USD rate: $${formatAmt(data.xlm_usd)} (transfers convert at this rate)`
        : "XLM/USD rate: unavailable",
      "Category caps (USDC):",
      `  transfer  cap $${formatAmt(catCaps.transfer)} · used $${formatAmt(catSpent.transfer)} · left $${formatAmt(data.categories.transfer.remaining)}`,
      `  x402      cap $${formatAmt(catCaps.x402)} · used $${formatAmt(catSpent.x402)} · left $${formatAmt(data.categories.x402.remaining)}`,
      `  mpp       cap $${formatAmt(catCaps.mpp)} · used $${formatAmt(catSpent.mpp)} · left $${formatAmt(data.categories.mpp.remaining)}`,
      `Treasury band (USDC → XLM via rate): $${formatAmt(data.liquid_low)}–$${formatAmt(data.liquid_high)} · auto_yield=${data.auto_yield}`,
      `Lists: whitelist ${data.whitelist_count} · denylist ${data.denylist_count}`,
      "Daily spend counts transfer / x402 / mpp only — Blend yield moves are excluded.",
      "Edit caps in the Hub dashboard. For a txn list, call spending_report.",
    ].join("\n"),
  };
}

/** Called after human approval of a pending confirmation. */
export async function executeApprovedConfirmation(
  confirmationId: string,
): Promise<ToolResult> {
  const conf = await prisma.confirmation.findUnique({
    where: { id: confirmationId },
    include: { user: true },
  });
  if (!conf || (conf.status !== "pending" && conf.status !== "executing")) {
    return {
      status: "error",
      reason:
        conf?.status === "approved"
          ? "confirmation_already_approved"
          : "confirmation_not_pending",
    };
  }
  if (
    conf.toolName !== "transfer" &&
    conf.toolName !== "swap" &&
    conf.toolName !== "x402_fetch" &&
    conf.toolName !== "x402_pay" &&
    conf.toolName !== "mpp_open_session" &&
    conf.toolName !== "mpp_fetch"
  ) {
    return { status: "error", reason: "unsupported_confirmation_tool" };
  }

  const principal: AuthPrincipal = {
    userId: conf.userId,
    agentId: null,
    tokenId: null,
    source: "privy_session",
    email: conf.user.email,
    stellarAddress: conf.user.stellarAddress,
    privyWalletId: conf.user.privyWalletId,
  };
  const ctx = buildToolContext(principal);
  if (!ctx) {
    return { status: "error", reason: "wallet_not_provisioned" };
  }

  if (conf.toolName === "x402_fetch" || conf.toolName === "x402_pay") {
    const input = conf.input as {
      url: string;
      max_amount_xlm?: number;
      amount_xlm?: number;
    };
    const policy = await loadPolicySnapshot(conf.userId);
    const result = await executeX402Tool({
      toolName: conf.toolName,
      input,
      principal,
      ctx,
      policy,
      skipConfirmation: true,
      confirmationId,
    });
    if (result.status === "ok" && result.tx_hash) {
      await prisma.confirmation.update({
        where: { id: confirmationId },
        data: { txHash: result.tx_hash },
      });
    }
    return result;
  }

  if (conf.toolName === "mpp_open_session") {
    const input = conf.input as { budget_usdc: number; recipient?: string };
    const policy = await loadPolicySnapshot(conf.userId);
    const result = await executeMppOpenSession({
      input,
      principal,
      ctx,
      policy,
      skipConfirmation: true,
      confirmationId,
    });
    if (result.status === "ok" && result.tx_hash) {
      await prisma.confirmation.update({
        where: { id: confirmationId },
        data: { txHash: result.tx_hash },
      });
    }
    return result;
  }

  if (conf.toolName === "mpp_fetch") {
    const input = conf.input as { url: string };
    const policy = await loadPolicySnapshot(conf.userId);
    const result = await executeMppFetch({
      input,
      principal,
      ctx,
      policy,
      skipConfirmation: true,
      confirmationId,
    });
    return result;
  }

  if (conf.toolName === "swap") {
    const input = conf.input as {
      from_asset: "XLM" | "USDC";
      to_asset: "XLM" | "USDC";
      amount: number;
      max_slippage_bps?: number;
      reason: string;
    };
    const result = await executeSwap(input, principal, ctx, confirmationId);
    if (result.status === "ok" && result.tx_hash) {
      await prisma.confirmation.update({
        where: { id: confirmationId },
        data: { txHash: result.tx_hash },
      });
    }
    return result;
  }

  const input = conf.input as {
    destination: string;
    amount_xlm: number;
    memo?: string;
    reason: string;
  };

  const result = await executeTransfer(input, principal, ctx, confirmationId);
  if (result.status === "ok" && result.tx_hash) {
    await prisma.confirmation.update({
      where: { id: confirmationId },
      data: { txHash: result.tx_hash },
    });
  }
  return result;
}

