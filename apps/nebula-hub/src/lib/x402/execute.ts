import type { PolicySnapshot, ToolContext, ToolResult } from "nebulamcp-core";
import { evaluateConfirmation } from "nebulamcp-core";

import type { AuthPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { onchainCheckSpend } from "@/lib/policy-onchain";
import { privyConfigured } from "@/lib/auth";
import { explorerTxUrl } from "@/lib/stellar";
import { scheduleParkExcessAfterActivity } from "@/lib/hub-tools/treasury";

import { fetchUsdcBalance, payX402Challenge, probeX402Url } from "./fetch";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://nebulaonchain.xyz"
).replace(/\/$/, "");

async function loadPolicySettings(userId: string) {
  return (
    (await prisma.policySettings.findUnique({ where: { userId } })) ??
    (await prisma.policySettings.create({ data: { userId } }))
  );
}

export type X402ToolInput = {
  url: string;
  max_amount_usdc?: number;
  amount_usdc?: number;
  /** @deprecated use max_amount_usdc */
  max_amount_xlm?: number;
  /** @deprecated use amount_usdc */
  amount_xlm?: number;
};

/**
 * Execute x402_fetch / x402_pay. Amounts are USDC (optional legacy *_xlm aliases).
 */
export async function executeX402Tool(params: {
  toolName: "x402_fetch" | "x402_pay";
  input: X402ToolInput;
  principal: AuthPrincipal;
  ctx: ToolContext;
  policy: PolicySnapshot;
  skipConfirmation?: boolean;
  confirmationId?: string;
}): Promise<ToolResult> {
  const { toolName, input, principal, ctx, policy } = params;
  const amountUsdcExpected = input.amount_usdc ?? input.amount_xlm;
  const maxAmountUsdc = input.max_amount_usdc ?? input.max_amount_xlm;

  if (policy.paused) {
    return { status: "rejected", reason: "policy_paused" };
  }

  if (!privyConfigured() && principal.privyWalletId === "dev-wallet") {
    return {
      status: "error",
      reason:
        "x402 requires Privy custody signing. Configure PRIVY_APP_ID / PRIVY_APP_SECRET / PRIVY_AUTHORIZATION_PRIVATE_KEY.",
    };
  }

  const probe = await probeX402Url(input.url);
  if (probe.kind === "error") {
    return { status: "error", reason: probe.error };
  }

  if (probe.kind === "free") {
    return {
      status: "ok",
      data: {
        paid: false,
        status: probe.status,
        content_type: probe.contentType,
        body: probe.body,
      },
      message: `HTTP ${probe.status} (no payment required)\n\n${probe.body}`,
    };
  }

  const amountUsdc = probe.amountUsdc;
  const payTo = probe.payTo;
  const settings = await loadPolicySettings(principal.userId);
  const policyMax = Math.min(
    Number(settings.perTxCap),
    Number(settings.catX402),
  );

  if (toolName === "x402_pay" && amountUsdcExpected !== undefined) {
    if (Math.abs(amountUsdc - amountUsdcExpected) > 1e-7) {
      return {
        status: "error",
        reason: `amount_mismatch: challenge wants ${amountUsdc} USDC, tool was given ${amountUsdcExpected}`,
      };
    }
  }

  // Optional per-call cap; default to Hub policy so agents need not pass max every time.
  const effectiveMax =
    toolName === "x402_fetch" ? (maxAmountUsdc ?? policyMax) : policyMax;
  if (amountUsdc > effectiveMax + 1e-9) {
    return {
      status: "rejected",
      reason: `exceeds_max_amount: challenge ${amountUsdc} USDC > max ${effectiveMax}`,
    };
  }

  const catSpentAgg = await prisma.transaction.aggregate({
    where: {
      userId: principal.userId,
      type: "x402",
      status: "confirmed",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    _sum: { amountXlm: true },
  });
  const catSpent = Number(catSpentAgg._sum.amountXlm ?? 0);
  const catRemaining = Math.max(Number(settings.catX402) - catSpent, 0);
  // Soft Hub gate before paying (on-chain check_spend only after success).
  if (policy.dailySpentUsdc + amountUsdc > policy.dailyCap + 1e-9) {
    return {
      status: "rejected",
      reason: `exceeds_daily_cap: need ${amountUsdc}, daily remaining ${Math.max(policy.dailyCap - policy.dailySpentUsdc, 0)}`,
    };
  }
  if (amountUsdc > Number(settings.perTxCap) + 1e-9) {
    return {
      status: "rejected",
      reason: `exceeds_per_tx_cap: ${amountUsdc} > ${settings.perTxCap}`,
    };
  }
  if (amountUsdc > catRemaining + 1e-9) {
    return {
      status: "rejected",
      reason: `exceeds_category_cap:x402 remaining ${catRemaining}`,
    };
  }

  const decision = evaluateConfirmation({
    destination: payTo,
    amountUsdc,
    policy,
  });

  if (decision.action === "reject") {
    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: principal.agentId,
        type: "x402",
        destination: payTo,
        amountXlm: amountUsdc,
        reason: `${toolName}:${decision.reason}`,
        status: "rejected",
      },
    });
    return { status: "rejected", reason: decision.reason };
  }

  if (decision.action === "confirm" && !params.skipConfirmation) {
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const conf = await prisma.confirmation.create({
      data: {
        userId: principal.userId,
        toolName,
        input: {
          url: input.url,
          max_amount_usdc: maxAmountUsdc,
          amount_usdc: amountUsdcExpected ?? amountUsdc,
          pay_to: payTo,
        },
        summary: `x402 pay ${amountUsdc} USDC to ${payTo.slice(0, 4)}…${payTo.slice(-4)} for ${input.url} (${decision.reason})`,
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

  const usdcBal = await fetchUsdcBalance(ctx.stellarAddress, ctx.network);
  if (usdcBal + 1e-9 < amountUsdc) {
    return {
      status: "error",
      reason: `insufficient_usdc: need ${amountUsdc}, have ${usdcBal}. Open a Circle USDC trustline on Connect (Hub), then fund via the Circle faucet (testnet).`,
    };
  }

  const paid = await payX402Challenge({
    url: input.url,
    walletId: ctx.privyWalletId,
    stellarAddress: ctx.stellarAddress,
    network: ctx.network,
    paymentRequired: probe.paymentRequired,
  });

  if (paid.kind === "error") {
    return { status: "error", reason: paid.error };
  }
  if (paid.kind === "free") {
    return {
      status: "ok",
      data: {
        paid: false,
        status: paid.status,
        content_type: paid.contentType,
        body: paid.body,
      },
      message: `HTTP ${paid.status} (no payment required)\n\n${paid.body}`,
    };
  }

  // Record on-chain spend only after a successful payment.
  const chain = await onchainCheckSpend({
    walletId: ctx.privyWalletId,
    stellarAddress: ctx.stellarAddress,
    network: ctx.network,
    category: "x402",
    amountXlm: paid.amountUsdc,
    init: {
      maxPerCallXlm: Number(settings.perTxCap),
      maxPerDayXlm: Number(settings.dailyCap),
      categories: {
        transfer: Number(settings.catTransfer),
        x402: Number(settings.catX402),
        mpp: Number(settings.catMpp),
      },
      liquidLowXlm: Number(settings.liquidThreshold),
      liquidHighXlm: Number(settings.liquidHigh),
      autoYield: settings.autoYield,
    },
  });
  if (!chain.ok) {
    console.error(
      "[x402] payment succeeded but onchain check_spend failed",
      chain.error,
    );
  }

  const txHash = paid.settlementTx ?? `x402_${Date.now().toString(16)}`;
  await prisma.transaction.create({
    data: {
      userId: principal.userId,
      agentId: principal.agentId,
      type: "x402",
      destination: paid.payTo || payTo,
      amountXlm: paid.amountUsdc,
      reason: `${toolName}:${input.url}`,
      txHash,
      status: "confirmed",
      confirmationId: params.confirmationId,
    },
  });

  scheduleParkExcessAfterActivity(principal, ctx, "after_x402");

  return {
    status: "ok",
    tx_hash: paid.settlementTx,
    explorer_url: paid.settlementTx
      ? explorerTxUrl(ctx.network, paid.settlementTx)
      : undefined,
    data: {
      paid: true,
      amount_usdc: paid.amountUsdc,
      pay_to: paid.payTo,
      status: paid.status,
      content_type: paid.contentType,
      body: paid.body,
      max_applied: effectiveMax,
    },
    message: [
      `Paid ${paid.amountUsdc} USDC via x402 → HTTP ${paid.status}`,
      paid.settlementTx ? `Settlement: ${paid.settlementTx}` : "",
      "",
      paid.body,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
