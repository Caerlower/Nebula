import {
  evaluateConfirmation,
  type PolicySnapshot,
  type ToolContext,
  type ToolResult,
} from "nebulamcp-core";

import type { AuthPrincipal } from "../auth";
import { prisma } from "../db";
import { resolveSigner } from "../signing";
import {
  TrustLineHubClient,
  trustlineConfigured,
} from "../trustline/client";
import {
  appUrl,
  formatAmt,
} from "./context";

function requireTrustline(
  ctx: ToolContext,
  principal: AuthPrincipal,
): TrustLineHubClient | ToolResult {
  if (!trustlineConfigured()) {
    return {
      status: "rejected",
      reason:
        "trustline_disabled (TRUSTLINE_ENABLED=0)",
    };
  }
  if (ctx.network !== "testnet") {
    return {
      status: "rejected",
      reason:
        "fianza_testnet_only: Fianza credit is unavailable on mainnet until the pubnet API ships. Switch to testnet to use borrow/repay.",
    };
  }
  try {
    const signer = resolveSigner(principal);
    return new TrustLineHubClient(ctx.stellarAddress, signer, ctx.network);
  } catch (e) {
    return {
      status: "error",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function executeTrustlineStatus(
  ctx: ToolContext,
  principal: AuthPrincipal,
): Promise<ToolResult> {
  const client = requireTrustline(ctx, principal);
  if (!("address" in client)) return client;

  try {
    const [terms, available, vault, usdc, revenue] = await Promise.all([
      client.creditLine().catch((e) => ({
        error: e instanceof Error ? e.message : String(e),
      })),
      client.availableCreditUsdc().catch(() => null),
      client.vaultState().catch((e) => ({
        error: e instanceof Error ? e.message : String(e),
      })),
      client.usdcBalanceUsdc().catch(() => null),
      client.revenue().catch(() => null),
    ]);

    return {
      status: "ok",
      data: {
        address: ctx.stellarAddress,
        network: "testnet",
        docs: "https://docs.0xtrustline.online",
        credit_line: terms,
        available_credit_usdc: available,
        vault,
        wallet_usdc: usdc,
        revenue,
      },
      message: [
        `TrustLine status (${ctx.stellarAddress})`,
        typeof terms === "object" && terms && "limitUsdc" in terms
          ? `  limit ${terms.limitUsdc} USDC · APR ${terms.aprBps} bps · tier ${terms.tier}`
          : `  credit_line: ${JSON.stringify(terms)}`,
        available != null ? `  available ${available} USDC` : null,
        usdc != null ? `  wallet USDC ${usdc}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  } catch (e) {
    return {
      status: "error",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function executeTrustlineOnboard(
  input: { skip_proof?: boolean; from_ledger?: number },
  ctx: ToolContext,
  principal: AuthPrincipal,
  policy: PolicySnapshot,
): Promise<ToolResult> {
  if (policy.paused) {
    return { status: "rejected", reason: "policy_paused" };
  }

  const client = requireTrustline(ctx, principal);
  if (!("address" in client)) return client;

  try {
    const result = await client.onboard({
      // Opt-in skip; default runs zkTLS path when TrustLine supports it.
      skipProof: input.skip_proof ?? false,
      fromLedger: input.from_ledger,
    });
    const already =
      result.register &&
      typeof result.register === "object" &&
      "alreadyRegistered" in result.register &&
      result.register.alreadyRegistered === true;
    const txHash =
      !already && result.register && "txHash" in result.register
        ? result.register.txHash
        : undefined;
    const explorerUrl =
      !already && result.register && "explorerUrl" in result.register
        ? result.register.explorerUrl
        : undefined;

    const score =
      result.underwrite &&
      typeof result.underwrite === "object" &&
      result.underwrite !== null &&
      "score" in result.underwrite
        ? (
            result.underwrite as {
              score?: { score?: number; tier?: string; limitUsdc?: number };
            }
          ).score
        : undefined;

    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: principal.agentId,
        network: principal.network,
        type: "trustline_onboard",
        destination: ctx.stellarAddress,
        amountXlm: 0,
        reason: already
          ? "re-underwrite (already registered)"
          : "register + underwrite",
        txHash: txHash ?? null,
        status: "confirmed",
      },
    });

    return {
      status: "ok",
      ...(txHash ? { tx_hash: txHash } : {}),
      ...(explorerUrl ? { explorer_url: explorerUrl } : {}),
      data: {
        register: result.register,
        underwrite: result.underwrite,
        already_registered: already,
      },
      message: already
        ? `Already registered on TrustLine — ran underwrite again.${
            score
              ? ` Score ${score.score ?? "?"} / ${score.tier ?? "?"} / limit ${score.limitUsdc ?? 0} USDC.`
              : ""
          } Zero limit means Unrated / insufficient independent revenue — not “not onboarded”. Call trustline_status for live terms.`
        : `TrustLine onboarded. Register tx ${txHash}. Call trustline_status for live terms. Zero limit after onboard is normal until independent revenue scores high enough.`,
    };
  } catch (e) {
    return {
      status: "error",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

type CreditMutationInput = { amount_usdc: number; reason: string };

async function gateTrustlineCredit(params: {
  toolName: "trustline_borrow" | "trustline_repay";
  input: CreditMutationInput;
  principal: AuthPrincipal;
  ctx: ToolContext;
  policy: PolicySnapshot;
  vaultId: string;
  /** TrustLine borrow/repay are provider-limited, not Nebula spend categories. */
  countsAsSpend: boolean;
  skipConfirmation?: boolean;
}): Promise<ToolResult | null> {
  const { policy, input, principal, vaultId, toolName } = params;

  if (policy.paused) {
    return { status: "rejected", reason: "policy_paused" };
  }

  // Spend caps intentionally skipped: credit line size is the TrustLine
  // provider's job. Nebula only pauses the agent and may ask for confirmation.

  const decision = evaluateConfirmation({
    destination: vaultId,
    amountUsdc: input.amount_usdc,
    policy,
    ignoreSpendCaps: !params.countsAsSpend,
  });

  if (decision.action === "reject") {
    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: principal.agentId,
        network: principal.network,
        type: toolName,
        destination: vaultId,
        amountXlm: input.amount_usdc,
        reason: `${input.reason}; rejected:${decision.reason}`,
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
        network: principal.network,
        toolName,
        input: {
          ...input,
          _agentId: principal.agentId,
          _vaultId: vaultId,
        },
        summary:
          toolName === "trustline_borrow"
            ? `TrustLine borrow ${formatAmt(input.amount_usdc)} USDC (${decision.reason})`
            : `TrustLine repay ${formatAmt(input.amount_usdc)} USDC to vault (${decision.reason})`,
        status: "pending",
        expiresAt,
      },
    });
    return {
      status: "confirmation_required",
      confirmation_id: conf.id,
      approve_url: `${appUrl()}/approve/${conf.id}`,
      expires_in: 15 * 60,
      summary: conf.summary,
    };
  }

  return null;
}

export async function executeTrustlineBorrow(
  input: CreditMutationInput,
  ctx: ToolContext,
  principal: AuthPrincipal,
  policy: PolicySnapshot,
  opts?: { skipConfirmation?: boolean; confirmationId?: string },
): Promise<ToolResult> {
  const client = requireTrustline(ctx, principal);
  if (!("address" in client)) return client;

  try {
    const vaultId = await client.vaultContractId();
    const gate = await gateTrustlineCredit({
      toolName: "trustline_borrow",
      input,
      principal,
      ctx,
      policy,
      vaultId,
      countsAsSpend: false,
      skipConfirmation: opts?.skipConfirmation,
    });
    if (gate) return gate;

    const available = await client.availableCreditUsdc().catch(() => null);
    if (available != null && input.amount_usdc > available) {
      return {
        status: "rejected",
        reason: `amount_exceeds_available_credit: need ≤ ${available} USDC (requested ${input.amount_usdc})`,
      };
    }
    const result = await client.borrow(input.amount_usdc);
    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: principal.agentId,
        network: principal.network,
        type: "trustline_borrow",
        destination: vaultId,
        amountXlm: input.amount_usdc,
        reason: input.reason,
        txHash: result.txHash,
        status: "confirmed",
        confirmationId: opts?.confirmationId ?? null,
      },
    });
    return {
      status: "ok",
      tx_hash: result.txHash,
      explorer_url: result.explorerUrl,
      data: {
        amount_usdc: input.amount_usdc,
        reason: input.reason,
        ...result,
      },
      message: `Borrowed ${input.amount_usdc} USDC from TrustLine. ${result.explorerUrl}`,
    };
  } catch (e) {
    return {
      status: "error",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function executeTrustlineRepay(
  input: CreditMutationInput,
  ctx: ToolContext,
  principal: AuthPrincipal,
  policy: PolicySnapshot,
  opts?: { skipConfirmation?: boolean; confirmationId?: string },
): Promise<ToolResult> {
  const client = requireTrustline(ctx, principal);
  if (!("address" in client)) return client;

  try {
    const vaultId = await client.vaultContractId();
    const gate = await gateTrustlineCredit({
      toolName: "trustline_repay",
      input,
      principal,
      ctx,
      policy,
      vaultId,
      // Repay is not discretionary spend — provider credit + pause/confirm only.
      countsAsSpend: false,
      skipConfirmation: opts?.skipConfirmation,
    });
    if (gate) return gate;

    const result = await client.repay(input.amount_usdc);

    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: principal.agentId,
        network: principal.network,
        type: "trustline_repay",
        destination: vaultId,
        amountXlm: input.amount_usdc,
        reason: input.reason,
        txHash: result.txHash,
        status: "confirmed",
        confirmationId: opts?.confirmationId ?? null,
      },
    });
    return {
      status: "ok",
      tx_hash: result.txHash,
      explorer_url: result.explorerUrl,
      data: {
        amount_usdc: input.amount_usdc,
        reason: input.reason,
        ...result,
      },
      message: `Repaid ${input.amount_usdc} USDC on TrustLine. ${result.explorerUrl}`,
    };
  } catch (e) {
    return {
      status: "error",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
