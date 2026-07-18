import { StrKey } from "@stellar/stellar-sdk";
import type { NetworkId } from "@stellar/mpp";
import {
  evaluateConfirmation,
  type PolicySnapshot,
  type ToolContext,
  type ToolResult,
} from "nebulamcp-core";

import type { AuthPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { onchainCheckSpend } from "@/lib/policy-onchain";
import { privyConfigured } from "@/lib/auth";
import { resolveSigner } from "@/lib/signing";
import { explorerTxUrl } from "@/lib/stellar";
import { loadOnchainPolicyInit } from "@/lib/hub-tools/context";
import { scheduleParkExcessAfterActivity } from "@/lib/hub-tools/treasury";
import { fetchUsdcBalance } from "@/lib/x402/fetch";

import {
  closeStartMppChannel,
  deployPaymentChannel,
  mppFetchUrl,
  refundMppChannel,
} from "./channel";
import {
  createMppSession,
  generateCommitmentKeypair,
  getMppNetworkId,
  getOpenMppSession,
  getOpenOrClosingMppSession,
  markMppSessionClosed,
  markMppSessionClosing,
  requireOpenMppSession,
  stroopsToUsdc,
  updateMppCumulative,
  usdcToStroops,
} from "./session";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://nebulaonchain.xyz"
).replace(/\/$/, "");

/** Hub confirmation / pause only — does not record on-chain spend. */
async function gateMppConfirmation(params: {
  principal: AuthPrincipal;
  amountUsdc: number;
  destination: string;
  policy: PolicySnapshot;
  toolName: string;
  skipConfirmation?: boolean;
  input: unknown;
  /** Channel open locks budget; spend caps apply on mpp_fetch deltas only. */
  ignoreSpendCaps?: boolean;
}): Promise<ToolResult | null> {
  if (params.policy.paused) {
    return { status: "rejected", reason: "policy_paused" };
  }

  const decision = evaluateConfirmation({
    destination: params.destination,
    amountUsdc: params.amountUsdc,
    policy: params.policy,
    ignoreSpendCaps: params.ignoreSpendCaps,
  });

  if (decision.action === "reject") {
    return { status: "rejected", reason: decision.reason };
  }

  if (decision.action === "confirm" && !params.skipConfirmation) {
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const conf = await prisma.confirmation.create({
      data: {
        userId: params.principal.userId,
        toolName: params.toolName,
        input: params.input as object,
        summary: `${params.toolName}: ${params.amountUsdc} USDC → ${params.destination.slice(0, 4)}… (${decision.reason})`,
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

  return null;
}

/** Reject MPP for accounts that cannot sign a channel deploy server-side. */
function assertMppSignable(principal: AuthPrincipal): ToolResult | null {
  if (principal.signerStrategy === "privy") {
    if (!privyConfigured() || principal.privyWalletId === "dev-wallet") {
      return { status: "error", reason: "mpp_requires_privy_custody" };
    }
    return null;
  }
  if (principal.signerStrategy === "client_side") {
    // EOA users can't autonomously sign the multi-tx deploy/close in one call.
    return { status: "error", reason: "mpp_requires_server_side_signing" };
  }
  return null;
}

/** Record category spend on-chain (after Hub confirmation / before signing). */
async function gateMppOnchainSpend(params: {
  principal: AuthPrincipal;
  ctx: ToolContext;
  amountUsdc: number;
}): Promise<ToolResult | null> {
  // Nebula's on-chain policy contract is a custodial (Privy) feature. Partner
  // accounts enforce caps on their side at signing time.
  if (params.principal.signerStrategy !== "privy") {
    return null;
  }
  const chain = await onchainCheckSpend({
    walletId: params.ctx.privyWalletId,
    stellarAddress: params.ctx.stellarAddress,
    network: params.ctx.network,
    category: "mpp",
    amountXlm: params.amountUsdc,
    init: await loadOnchainPolicyInit(
      params.principal.userId,
      params.principal.agentId,
    ),
  });
  if (!chain.ok) {
    return { status: "rejected", reason: `onchain_policy:${chain.error}` };
  }
  return null;
}

export async function executeMppOpenSession(params: {
  input: { budget_usdc: number; recipient?: string };
  principal: AuthPrincipal;
  ctx: ToolContext;
  policy: PolicySnapshot;
  skipConfirmation?: boolean;
  confirmationId?: string;
}): Promise<ToolResult> {
  const { principal, ctx, policy, input } = params;

  const signable = assertMppSignable(principal);
  if (signable) return signable;

  const existing = await getOpenOrClosingMppSession(
    principal.userId,
    principal.agentId,
  );
  if (existing) {
    return {
      status: "error",
      reason:
        existing.status === "closing"
          ? "mpp_session_closing: call mpp_close_session again to finish refund before opening another"
          : "mpp_session_already_open: call mpp_close_session before opening another",
    };
  }

  const recipient =
    input.recipient?.trim() ||
    process.env.MPP_RECIPIENT?.trim() ||
    "";
  if (!recipient || !StrKey.isValidEd25519PublicKey(recipient)) {
    return {
      status: "error",
      reason:
        "recipient_required: pass recipient (G…) or set MPP_RECIPIENT",
    };
  }

  // Deposit locks USDC in the channel; category spend is recorded on attested
  // mpp_fetch deltas only (avoids double-counting the full budget).
  const gate = await gateMppConfirmation({
    principal,
    amountUsdc: input.budget_usdc,
    destination: recipient,
    policy,
    toolName: "mpp_open_session",
    skipConfirmation: params.skipConfirmation,
    input,
    ignoreSpendCaps: true,
  });
  if (gate) return gate;

  const usdcBal = await fetchUsdcBalance(ctx.stellarAddress, ctx.network);
  if (usdcBal + 1e-9 < input.budget_usdc) {
    return {
      status: "error",
      reason: `insufficient_usdc: need ${input.budget_usdc}, have ${usdcBal}`,
    };
  }

  const { secretHex, pubkeyHex } = generateCommitmentKeypair();
  const budgetStroops = usdcToStroops(input.budget_usdc);
  const networkId = getMppNetworkId(ctx.network);

  const deployed = await deployPaymentChannel({
    signer: resolveSigner(principal),
    stellarAddress: ctx.stellarAddress,
    network: ctx.network,
    networkId,
    recipient,
    budgetStroops,
    commitmentPubkeyHex: pubkeyHex,
  });
  if (!deployed.ok) {
    return { status: "error", reason: deployed.error };
  }

  const session = await createMppSession({
    userId: principal.userId,
    agentId: principal.agentId,
    channel: deployed.contractId,
    recipient,
    budgetUsdc: input.budget_usdc,
    budgetStroops,
    commitmentSecretHex: secretHex,
    commitmentPubkeyHex: pubkeyHex,
    networkId,
    deployWasmHash: deployed.wasmHash,
  });

  await prisma.transaction.create({
    data: {
      userId: principal.userId,
      agentId: principal.agentId,
      type: "mpp_open",
      destination: recipient,
      amountXlm: input.budget_usdc,
      reason: `mpp_open_session:${deployed.contractId}`,
      txHash: `mpp_open_${session.id}`,
      status: "confirmed",
      confirmationId: params.confirmationId,
    },
  });

  // Auto-park excess into Blend is a custodial (Privy) treasury feature.
  if (principal.signerStrategy === "privy") {
    scheduleParkExcessAfterActivity(principal, ctx, "after_mpp_open");
  }

  return {
    status: "ok",
    data: {
      channel: session.channel,
      recipient: session.recipient,
      budget_usdc: session.budgetUsdc,
      commitment_pubkey_hex: session.commitmentPubkeyHex,
      network_id: session.networkId,
      demo_url: `${APP_URL}/api/mpp-demo/${session.channel}`,
    },
    message: [
      "MPP session opened",
      `Channel: ${session.channel}`,
      `Recipient: ${session.recipient}`,
      `Budget: ${session.budgetUsdc} USDC`,
      `Commitment pubkey (hex): ${session.commitmentPubkeyHex}`,
      "",
      `Demo merchant (no local server): ${APP_URL}/api/mpp-demo/${session.channel}`,
      "Call mpp_fetch with that URL, then mpp_close_session when done.",
    ].join("\n"),
  };
}

/**
 * Disabled as a cumulative writer: agents must not inflate settlement via
 * client-supplied amounts. Use mpp_fetch (attested channel progress) instead.
 */
export async function executeMppPay(_params: {
  input: { recipient: string; amount_xlm: number; streaming?: boolean };
  principal: AuthPrincipal;
  ctx: ToolContext;
  policy: PolicySnapshot;
  skipConfirmation?: boolean;
  confirmationId?: string;
}): Promise<ToolResult> {
  return {
    status: "rejected",
    reason:
      "mpp_pay_disabled: cumulative spend may only advance via mpp_fetch channel attestations. Use mpp_fetch, then mpp_close_session.",
  };
}

export async function executeMppFetch(params: {
  input: { url: string };
  principal: AuthPrincipal;
  ctx: ToolContext;
  policy: PolicySnapshot;
  skipConfirmation?: boolean;
  confirmationId?: string;
}): Promise<ToolResult> {
  if (params.policy.paused) {
    return { status: "rejected", reason: "policy_paused" };
  }

  const sessionState = await requireOpenMppSession(
    params.principal.userId,
    params.principal.agentId,
  );
  if (!sessionState.ok) {
    return { status: "error", reason: sessionState.error };
  }
  const { session } = sessionState;
  const networkId = session.networkId as NetworkId;
  const baseline = session.cumulativeStroops;

  // Hub demo merchant has a fixed price — gate once, then a single signed fetch
  // (avoids the old probe pass that produced two 402s before 200).
  const demoPriceUsdc = Number(process.env.MPP_DEMO_PRICE?.trim() ?? "0.01");
  const isHubDemo = /\/api\/mpp-demo\//.test(params.input.url);

  let approvedCumulative = baseline;
  let deltaUsdc = 0;

  if (isHubDemo && Number.isFinite(demoPriceUsdc) && demoPriceUsdc > 0) {
    const delta = usdcToStroops(demoPriceUsdc);
    const next = baseline + delta;
    if (next > session.budgetStroops) {
      return {
        status: "rejected",
        reason: `exceeds_session_budget: need ${demoPriceUsdc} USDC more`,
      };
    }
    deltaUsdc = demoPriceUsdc;
    const confGate = await gateMppConfirmation({
      principal: params.principal,
      amountUsdc: deltaUsdc,
      destination: session.recipient,
      policy: params.policy,
      toolName: "mpp_fetch",
      skipConfirmation: params.skipConfirmation,
      input: params.input,
    });
    if (confGate) return confGate;

    const spendGate = await gateMppOnchainSpend({
      principal: params.principal,
      ctx: params.ctx,
      amountUsdc: deltaUsdc,
    });
    if (spendGate) return spendGate;

    approvedCumulative = next;
  } else {
    // Unknown merchant: discover challenge amount, then pay in a second request.
    const probe = await mppFetchUrl({
      session,
      networkId,
      url: params.input.url,
      approvedCumulativeStroops: baseline,
      persistCumulative: false,
    });

    if (probe.ok) {
      return {
        status: "ok",
        data: {
          status: probe.status,
          cumulative_usdc: stroopsToUsdc(probe.cumulativeStroops),
          body: probe.body,
        },
        message: [
          `HTTP ${probe.status}`,
          `Session cumulative: ${stroopsToUsdc(probe.cumulativeStroops)} USDC`,
          "",
          probe.body,
        ].join("\n"),
      };
    }

    if (!probe.pending) {
      return { status: "error", reason: probe.error };
    }

    deltaUsdc = stroopsToUsdc(probe.pending.deltaStroops);
    const confGate = await gateMppConfirmation({
      principal: params.principal,
      amountUsdc: deltaUsdc,
      destination: session.recipient,
      policy: params.policy,
      toolName: "mpp_fetch",
      skipConfirmation: params.skipConfirmation,
      input: params.input,
    });
    if (confGate) return confGate;

    const spendGate = await gateMppOnchainSpend({
      principal: params.principal,
      ctx: params.ctx,
      amountUsdc: deltaUsdc,
    });
    if (spendGate) return spendGate;

    approvedCumulative = probe.pending.cumulativeStroops;
    session.cumulativeStroops = baseline;
  }

  const paid = await mppFetchUrl({
    session,
    networkId,
    url: params.input.url,
    approvedCumulativeStroops: approvedCumulative,
    persistCumulative: false,
  });
  if (!paid.ok) {
    return { status: "error", reason: paid.error };
  }

  const paidDelta = stroopsToUsdc(paid.cumulativeStroops - baseline);
  await updateMppCumulative(session.id, paid.cumulativeStroops);

  await prisma.transaction.create({
    data: {
      userId: params.principal.userId,
      agentId: params.principal.agentId,
      type: "mpp",
      destination: session.recipient,
      amountXlm: paidDelta > 0 ? paidDelta : deltaUsdc,
      reason: `mpp_fetch:${params.input.url}`,
      txHash: `mpp_fetch_${session.id}_${Date.now().toString(16)}`,
      status: "confirmed",
      confirmationId: params.confirmationId,
    },
  });

  // Micropayments are frequent — park on open/close instead of every fetch.
  return {
    status: "ok",
    data: {
      status: paid.status,
      cumulative_usdc: stroopsToUsdc(paid.cumulativeStroops),
      body: paid.body,
    },
    message: [
      `HTTP ${paid.status}`,
      `Session cumulative: ${stroopsToUsdc(paid.cumulativeStroops)} USDC`,
      "",
      paid.body,
    ].join("\n"),
  };
}

export async function executeMppStatus(params: {
  principal: AuthPrincipal;
}): Promise<ToolResult> {
  const session = await getOpenMppSession(
    params.principal.userId,
    params.principal.agentId,
  );
  if (!session) {
    return {
      status: "ok",
      data: { open: false },
      message: "No open MPP session.",
    };
  }
  const spent = stroopsToUsdc(session.cumulativeStroops);
  const remaining = Math.max(session.budgetUsdc - spent, 0);
  return {
    status: "ok",
    data: {
      open: true,
      channel: session.channel,
      recipient: session.recipient,
      budget_usdc: session.budgetUsdc,
      committed_usdc: spent,
      remaining_usdc: remaining,
      commitment_pubkey_hex: session.commitmentPubkeyHex,
      opened_at: session.openedAt.toISOString(),
    },
    message: [
      `Channel: ${session.channel}`,
      `Recipient: ${session.recipient}`,
      `Budget: ${session.budgetUsdc} USDC`,
      `Committed: ${spent} USDC`,
      `Remaining: ${remaining} USDC`,
      `Commitment pubkey: ${session.commitmentPubkeyHex}`,
    ].join("\n"),
  };
}

export async function executeMppCloseSession(params: {
  principal: AuthPrincipal;
  ctx: ToolContext;
}): Promise<ToolResult> {
  const session = await getOpenOrClosingMppSession(
    params.principal.userId,
    params.principal.agentId,
  );
  if (!session) {
    return {
      status: "error",
      reason:
        "No MPP session is open. Call mpp_open_session first (one session at a time).",
    };
  }

  const signable = assertMppSignable(params.principal);
  if (signable) return signable;

  const signer = resolveSigner(params.principal);
  const networkId = session.networkId as NetworkId;
  const common = {
    channel: session.channel,
    signer,
    stellarAddress: params.ctx.stellarAddress,
    network: params.ctx.network,
    networkId,
  };

  // Phase 1: funder close_start (recipient-only `close` cannot be called by us).
  if (session.status === "open") {
    const started = await closeStartMppChannel(common);
    if (!started.ok) {
      return { status: "error", reason: started.error };
    }
    await markMppSessionClosing({
      sessionId: session.id,
      closeTxHash: started.txHash,
    });

    // Try refund immediately (works when waiting period has already elapsed /
    // is 0–few ledgers). If not ready yet, ask the client to retry.
    const early = await refundMppChannel(common);
    if (early.ok) {
      await markMppSessionClosed({
        sessionId: session.id,
        closeTxHash: early.txHash,
      });
      const settled = stroopsToUsdc(session.cumulativeStroops);
      const refunded = Math.max(session.budgetUsdc - settled, 0);
      await prisma.transaction.create({
        data: {
          userId: params.principal.userId,
          agentId: params.principal.agentId,
          type: "mpp_close",
          destination: session.recipient,
          amountXlm: settled,
          reason: `mpp_close:refunded=${refunded}`,
          txHash: early.txHash,
          status: "confirmed",
        },
      });
      if (params.principal.signerStrategy === "privy") {
        scheduleParkExcessAfterActivity(
          params.principal,
          params.ctx,
          "after_mpp_close",
        );
      }
      return {
        status: "ok",
        tx_hash: early.txHash,
        explorer_url: explorerTxUrl(params.ctx.network, early.txHash),
        data: {
          settled_usdc: settled,
          refunded_usdc: refunded,
          channel: session.channel,
        },
        message: [
          "MPP session closed (funder close_start + refund)",
          `Committed to recipient (off-chain): ${settled} USDC`,
          `Refunded to agent wallet: remaining channel balance`,
          `Tx: ${early.txHash}`,
        ].join("\n"),
      };
    }

    if (early.error.startsWith("mpp_refund_waiting")) {
      return {
        status: "ok",
        data: {
          phase: "closing",
          channel: session.channel,
          close_start_tx: started.txHash,
        },
        message: [
          "MPP close started on-chain (close_start).",
          "The funder must wait a short ledger window before reclaiming USDC.",
          "Call mpp_close_session again in ~30–60 seconds to finish the refund.",
          `close_start tx: ${started.txHash}`,
        ].join("\n"),
      };
    }

    return { status: "error", reason: early.error };
  }

  // Phase 2: refund after waiting period.
  const refundedTx = await refundMppChannel(common);
  if (!refundedTx.ok) {
    return { status: "error", reason: refundedTx.error };
  }

  await markMppSessionClosed({
    sessionId: session.id,
    closeTxHash: refundedTx.txHash,
  });

  const settled = stroopsToUsdc(session.cumulativeStroops);
  const refunded = Math.max(session.budgetUsdc - settled, 0);

  await prisma.transaction.create({
    data: {
      userId: params.principal.userId,
      agentId: params.principal.agentId,
      type: "mpp_close",
      destination: session.recipient,
      amountXlm: settled,
      reason: `mpp_close:refunded=${refunded}`,
      txHash: refundedTx.txHash,
      status: "confirmed",
    },
  });

  if (params.principal.signerStrategy === "privy") {
    scheduleParkExcessAfterActivity(
      params.principal,
      params.ctx,
      "after_mpp_close",
    );
  }

  return {
    status: "ok",
    tx_hash: refundedTx.txHash,
    explorer_url: explorerTxUrl(params.ctx.network, refundedTx.txHash),
    data: {
      settled_usdc: settled,
      refunded_usdc: refunded,
      channel: session.channel,
    },
    message: [
      "MPP session closed — USDC refunded to agent wallet",
      `Committed (off-chain) to recipient: ${settled} USDC`,
      `Tx: ${refundedTx.txHash}`,
    ].join("\n"),
  };
}
