import { NextRequest } from "next/server";

import { bustRouteCache, cachedJsonResponse } from "@/lib/route-cache";
import { z } from "zod";

import {
  createStellarWalletForUser,
  resolveAuth,
  unauthorized,
} from "@/lib/auth";
import { hashNebulaToken, mintNebulaTokenPlaintext, prisma } from "@/lib/db";
import { buildMcpConfig } from "@/lib/mcp-config";
import { fetchBalances } from "@/lib/stellar";

const HUB_NETWORK =
  (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
  "testnet";

/** Native XLM balance for an agent's own wallet (0 when unprovisioned). */
async function agentNativeXlm(address: string | null): Promise<number> {
  if (!address) return 0;
  try {
    const balances = await fetchBalances(address, HUB_NETWORK);
    const xlm = balances.find((b) => b.asset === "XLM" || b.asset === "native");
    return xlm ? Number(xlm.balance) : 0;
  } catch {
    return 0;
  }
}

/**
 * Provision the agent's own Nebula-managed (Privy) wallet — its autonomous
 * spending wallet, isolated from the owner and from sibling agents. Awaits
 * briefly so the create response usually carries an address; if Privy is slow,
 * it finishes in the background and the agent row fills in on a later fetch.
 * Returns null when Privy isn't configured (agent falls back to owner wallet).
 */
async function provisionAgentWallet(
  agentId: string,
): Promise<{ walletId: string; address: string } | null> {
  const provision = createStellarWalletForUser(agentId);
  const wallet = await Promise.race([
    provision,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
  ]);
  if (wallet) {
    await prisma.agent.update({
      where: { id: agentId },
      data: { privyWalletId: wallet.walletId, stellarAddress: wallet.address },
    });
    return wallet;
  }
  // Timed out — finish the same in-flight provision in the background.
  void provision
    .then(async (late) => {
      if (!late) return;
      await prisma.agent.update({
        where: { id: agentId },
        data: { privyWalletId: late.walletId, stellarAddress: late.address },
      });
    })
    .catch((error) => {
      console.error("[agents] background wallet provision failed", error);
    });
  return null;
}

const createSchema = z.object({
  name: z.string().min(1).max(64),
  framework: z.enum([
    "claude_desktop",
    "claude_code",
    "cursor",
    "chatgpt",
    "custom",
  ]),
  label: z.string().min(1).max(64).optional(),
});

async function uncachedGET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal || principal.source === "nebula_token") {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "dashboard_auth_required" },
      { status: 403 },
    );
  }

  const agents = await prisma.agent.findMany({
    where: { userId: principal.userId },
    include: {
      tokens: {
        where: { revokedAt: null },
        select: { id: true, label: true, lastUsedAt: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Self-heal: managed agents that never got their own wallet (e.g. an earlier
  // provisioning failure) get one now, so they stop falling back to the owner
  // wallet. Skips external/partner agents (their key lives off-Hub).
  await Promise.all(
    agents
      .filter((a) => !a.stellarAddress && a.accountType !== "external")
      .map(async (a) => {
        const wallet = await provisionAgentWallet(a.id);
        if (wallet) {
          a.privyWalletId = wallet.walletId;
          a.stellarAddress = wallet.address;
        }
      }),
  );

  // Each agent has its own wallet — report its own balance, not the owner's.
  const withBalance = await Promise.all(
    agents.map(async (a) => ({
      ...a,
      balanceXlm: await agentNativeXlm(a.stellarAddress),
    })),
  );
  return Response.json({ agents: withBalance });
}

async function uncachedPOST(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal || principal.source === "nebula_token") {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "dashboard_auth_required" },
      { status: 403 },
    );
  }

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ status: "error", reason: body.error.message }, { status: 400 });
  }

  const agent = await prisma.agent.create({
    data: {
      userId: principal.userId,
      name: body.data.name,
      framework: body.data.framework,
      status: "active",
      reputationScore: 0,
      reputationTier: "unrated",
    },
  });

  const wallet = await provisionAgentWallet(agent.id);
  if (wallet) {
    agent.privyWalletId = wallet.walletId;
    agent.stellarAddress = wallet.address;
  }

  const plaintext = mintNebulaTokenPlaintext();
  const token = await prisma.nebulaToken.create({
    data: {
      userId: principal.userId,
      agentId: agent.id,
      label: body.data.label ?? body.data.name,
      tokenHash: hashNebulaToken(plaintext),
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: principal.userId },
    select: { stellar8004AgentId: true },
  });

  return Response.json({
    agent,
    wallet: {
      address: agent.stellarAddress,
      provisioned: Boolean(agent.stellarAddress),
      note: agent.stellarAddress
        ? "Agent's own wallet. Fund it from your wallet to enable autonomous spends."
        : "Wallet is still provisioning — refresh in a moment.",
    },
    reputation: {
      score: 0,
      tier: "unrated",
      scale: 100,
      stellar8004AgentId: user?.stellar8004AgentId ?? null,
      note:
        user?.stellar8004AgentId != null
          ? "Agent row starts at 0. On-chain Stellar8004 is per wallet — call get_my_reputation to refresh from chain."
          : "Call register_identity (MCP) to mint on-chain Stellar8004 identity for this wallet.",
    },
    token: {
      id: token.id,
      label: token.label,
      token: plaintext,
      warning: "Plaintext shown once. Store safely.",
    },
    // One-click MCP config for this agent — only available now (token is
    // shown once). Paste into Cursor/Claude Code (streamable_http) or Claude
    // Desktop (claude_desktop).
    mcp: buildMcpConfig({ token: plaintext, serverName: agent.name }),
  });
}

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();
  return cachedJsonResponse(`agents:${principal.userId}`, 30000, () => uncachedGET(req));
}

export async function POST(req: NextRequest) {
  const res = await uncachedPOST(req);
  if (res.ok) {
    bustRouteCache("agents:");
  }
  return res;
}
