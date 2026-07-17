import type { ToolContext, ToolResult } from "nebulamcp-core";

import type { AuthPrincipal } from "../auth";
import { privyConfigured } from "../auth";
import { blendWithdrawAndPay } from "../blend";
import { prisma } from "../db";
import { xlmToUsdc } from "../fx";
import { onchainCheckSpend } from "../policy-onchain";
import { resolveSigner } from "../signing";
import {
  buildPaymentXdr,
  explorerTxUrl,
  signAndSubmit,
} from "../stellar";
import {
  formatAmt,
  loadOnchainPolicyInit,
  MIN_AUTO_REBALANCE,
  MIN_TREASURY_MOVE,
  requireNotPaused,
} from "./context";
import {
  computeSpendTopUp,
  ensureLiquidForSpendSequential,
  scheduleAutoRebalance,
} from "./treasury";

export async function executeTransfer(
  input: {
    destination: string;
    amount_xlm: number;
    memo?: string;
    reason: string;
  },
  principal: AuthPrincipal,
  ctx: ToolContext,
  confirmationId?: string,
): Promise<ToolResult> {
  if (!privyConfigured() && principal.privyWalletId === "dev-wallet") {
    const fakeHash = `dev_${Date.now().toString(16)}`;
    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: principal.agentId,
        type: "transfer",
        destination: input.destination,
        amountXlm: input.amount_xlm,
        memo: input.memo,
        reason: input.reason,
        txHash: fakeHash,
        status: "confirmed",
        confirmationId,
      },
    });
    return {
      status: "ok",
      tx_hash: fakeHash,
      explorer_url: explorerTxUrl(ctx.network, fakeHash),
      message:
        "Dev dry-run transfer (no Privy). Set PRIVY_APP_ID/SECRET for real custody.",
    };
  }

  // On-chain policy gate — amounts are USDC stroops (same 7-decimal scaler).
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
  // Nebula's on-chain policy contract is a custodial (Privy) feature. Partner
  // accounts (e.g. Tael cards) enforce caps on their side at signing time, so
  // we rely on Nebula's soft DB caps + the partner's hard check instead.
  const chain =
    principal.signerStrategy === "privy"
      ? await onchainCheckSpend({
          walletId: ctx.privyWalletId,
          stellarAddress: ctx.stellarAddress,
          network: ctx.network,
          category: "transfer",
          amountXlm: amountUsdc,
          init: await loadOnchainPolicyInit(
            principal.userId,
            principal.agentId,
          ),
        })
      : ({ ok: true } as const);
  if (!chain.ok) {
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
    return {
      status: "rejected",
      reason: `onchain_policy:${chain.error}`,
    };
  }

  const topUp = await computeSpendTopUp(principal, ctx, input.amount_xlm);
  if (!topUp.ok) {
    return { status: "error", reason: topUp.reason };
  }

  // Prefer one on-chain tx: Blend withdraw + classic payment (no memo — Soroban rule).
  if (topUp.withdrawAmount >= MIN_TREASURY_MOVE && !input.memo) {
    const paused = await requireNotPaused(principal.userId, principal.agentId);
    if (paused) return paused;

    const bundled = await blendWithdrawAndPay({
      publicKey: ctx.stellarAddress,
      walletId: ctx.privyWalletId,
      withdrawAmount: topUp.withdrawAmount,
      destination: input.destination,
      payAmount: input.amount_xlm,
      network: ctx.network,
    });

    if (bundled.ok) {
      await prisma.transaction.create({
        data: {
          userId: principal.userId,
          agentId: principal.agentId,
          type: "transfer",
          destination: input.destination,
          amountXlm: input.amount_xlm,
          reason: `${input.reason}; bundled_blend_withdraw:${formatAmt(bundled.withdrawAmount)}`,
          txHash: bundled.hash,
          status: "confirmed",
          confirmationId,
        },
      });

      scheduleAutoRebalance(principal, ctx, "after_transfer", {
        depositOnly: true,
        minMove: MIN_AUTO_REBALANCE,
      });

      return {
        status: "ok",
        tx_hash: bundled.hash,
        explorer_url: explorerTxUrl(ctx.network, bundled.hash),
        data: {
          bundled: true,
          blend_withdraw_xlm: bundled.withdrawAmount,
          paid_xlm: bundled.payAmount,
        },
        message: `Transferred ${input.amount_xlm} XLM (bundled Blend withdraw ${formatAmt(bundled.withdrawAmount)} XLM)`,
      };
    }

    console.error(
      "[treasury] bundled withdraw+pay failed, falling back to sequential:",
      bundled.error,
    );
    const seq = await ensureLiquidForSpendSequential(
      principal,
      ctx,
      topUp.withdrawAmount,
      input.amount_xlm,
    );
    if (seq) return seq;
  } else if (topUp.withdrawAmount >= MIN_TREASURY_MOVE && input.memo) {
    // Memo forces sequential path (Soroban txs cannot include memos).
    const seq = await ensureLiquidForSpendSequential(
      principal,
      ctx,
      topUp.withdrawAmount,
      input.amount_xlm,
    );
    if (seq) return seq;
  }

  const { unsignedXdr, hashHex } = await buildPaymentXdr({
    source: ctx.stellarAddress,
    destination: input.destination,
    amount: input.amount_xlm,
    amountXlm: input.amount_xlm,
    memo: input.memo,
    network: ctx.network,
  });

  const txHash = await signAndSubmit({
    unsignedXdr,
    hashHex,
    signer: resolveSigner(principal),
    sourceAddress: ctx.stellarAddress,
    network: ctx.network,
  });

  await prisma.transaction.create({
    data: {
      userId: principal.userId,
      agentId: principal.agentId,
      type: "transfer",
      destination: input.destination,
      amountXlm: input.amount_xlm,
      memo: input.memo,
      reason: input.reason,
      txHash,
      status: "confirmed",
      confirmationId,
    },
  });

  scheduleAutoRebalance(principal, ctx, "after_transfer", {
    depositOnly: true,
    minMove: MIN_AUTO_REBALANCE,
  });

  return {
    status: "ok",
    tx_hash: txHash,
    explorer_url: explorerTxUrl(ctx.network, txHash),
    message: `Transferred ${input.amount_xlm} XLM`,
  };
}
