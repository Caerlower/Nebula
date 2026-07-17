import { NextRequest } from "next/server";
import { z } from "zod";

import { privyConfigured, resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { privySigner } from "@/lib/signing";
import {
  buildPaymentXdr,
  ensureUsdcTrustline,
  explorerTxUrl,
  hasUsdcTrustline,
  signAndSubmit,
} from "@/lib/stellar";

/**
 * Top up an agent's own wallet from the owner's wallet. Each agent has an
 * isolated spending wallet; this is the own-user "fund my agent" action.
 *
 *  - Privy owner  → Nebula signs the payment owner → agent and submits.
 *  - EOA owner    → returns the agent address for a manual Freighter send
 *                   (the Hub never holds the EOA key).
 */
const bodySchema = z.object({
  amount: z.number().positive(),
  asset: z.enum(["XLM", "USDC"]).default("XLM"),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const principal = await resolveAuth(req);
  if (!principal || principal.source === "nebula_token") {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "dashboard_auth_required" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { status: "error", reason: parsed.error.message },
      { status: 400 },
    );
  }
  const { amount, asset } = parsed.data;

  const agent = await prisma.agent.findFirst({
    where: { id, userId: principal.userId },
  });
  if (!agent) {
    return Response.json(
      { status: "error", reason: "not_found" },
      { status: 404 },
    );
  }
  if (!agent.stellarAddress) {
    return Response.json(
      { status: "error", reason: "agent_wallet_not_provisioned" },
      { status: 400 },
    );
  }

  const owner = await prisma.user.findUnique({
    where: { id: principal.userId },
    select: {
      stellarAddress: true,
      privyWalletId: true,
      signerStrategy: true,
    },
  });
  if (!owner?.stellarAddress) {
    return Response.json(
      { status: "error", reason: "owner_wallet_not_provisioned" },
      { status: 400 },
    );
  }
  if (owner.stellarAddress === agent.stellarAddress) {
    return Response.json(
      { status: "error", reason: "agent_shares_owner_wallet" },
      { status: 400 },
    );
  }

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  // USDC needs a trustline on the agent side before it can receive funds.
  if (asset === "USDC" && !(await hasUsdcTrustline(agent.stellarAddress, network))) {
    const managed =
      agent.signerStrategy === "privy" &&
      Boolean(agent.privyWalletId) &&
      agent.privyWalletId !== "dev-wallet" &&
      privyConfigured();
    if (!managed) {
      return Response.json(
        {
          status: "error",
          reason: "agent_missing_usdc_trustline",
          agent_address: agent.stellarAddress,
          note: "Open a USDC trustline on the agent wallet before funding USDC.",
        },
        { status: 400 },
      );
    }
    try {
      await ensureUsdcTrustline({
        address: agent.stellarAddress,
        signer: privySigner(agent.privyWalletId!, agent.stellarAddress),
        network,
      });
    } catch (error) {
      return Response.json(
        {
          status: "error",
          reason: `agent_trustline_failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        { status: 400 },
      );
    }
  }

  const ownerCanSign =
    owner.signerStrategy === "privy" &&
    Boolean(owner.privyWalletId) &&
    owner.privyWalletId !== "dev-wallet" &&
    privyConfigured();

  // Non-custodial (EOA) owner: the Hub can't sign for them. Return the deposit
  // address so they can send from their own wallet (Freighter).
  if (!ownerCanSign) {
    return Response.json({
      status: "manual_funding_required",
      agent_id: agent.id,
      agent_address: agent.stellarAddress,
      amount,
      asset,
      note: `Send ${amount} ${asset} from your wallet to the agent address above.`,
    });
  }

  try {
    const { unsignedXdr, hashHex } = await buildPaymentXdr({
      source: owner.stellarAddress,
      destination: agent.stellarAddress,
      amount,
      asset: asset === "USDC" ? "USDC" : "native",
      network,
    });
    const txHash = await signAndSubmit({
      unsignedXdr,
      hashHex,
      signer: privySigner(owner.privyWalletId!, owner.stellarAddress),
      sourceAddress: owner.stellarAddress,
      network,
    });

    // Ledger entry only — type "fund" is not a spend category, so it never
    // counts toward the agent's daily caps.
    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        agentId: agent.id,
        type: "fund",
        destination: agent.stellarAddress,
        amountXlm: amount,
        reason: `fund_agent:${asset}`,
        txHash,
        status: "confirmed",
      },
    });

    return Response.json({
      status: "ok",
      agent_id: agent.id,
      agent_address: agent.stellarAddress,
      amount,
      asset,
      tx_hash: txHash,
      explorer_url: explorerTxUrl(network, txHash),
      message: `Funded agent with ${amount} ${asset}`,
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        reason: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}
