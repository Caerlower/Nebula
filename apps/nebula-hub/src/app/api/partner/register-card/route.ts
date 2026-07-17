import { NextRequest } from "next/server";
import { z } from "zod";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { hashNebulaToken, mintNebulaTokenPlaintext, prisma } from "@/lib/db";
import { buildMcpConfig } from "@/lib/mcp-config";
import { appBaseUrl } from "@/lib/oauth";
import { bustRouteCache } from "@/lib/route-cache";
import { partnerSignerConfigFromEnv } from "@/lib/signing";
import { isStellarPublicKey } from "@/lib/wallet-auth";

/**
 * Register a partner (Tael) card as a Nebula agent. The card is non-custodial:
 * Nebula never holds its key — spends are signed via the partner's /partner/sign
 * callback (signerStrategy = "partner_callback"). Authenticated with the
 * partner's company Nebula token (Bearer nbl_live_…).
 *
 * Idempotent per (company account, card address): re-registering returns the
 * same agent and mints a fresh token.
 */
const bodySchema = z.object({
  card_address: z.string(),
  name: z.string().min(1).max(64).optional(),
  token_label: z.string().min(1).max(64).optional(),
  caps: z
    .object({
      microThreshold: z.number().nonnegative().optional(),
      perTxCap: z.number().positive().optional(),
      dailyCap: z.number().positive().optional(),
      paused: z.boolean().optional(),
      catTransfer: z.number().nonnegative().optional(),
      catX402: z.number().nonnegative().optional(),
      catMpp: z.number().nonnegative().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { status: "error", reason: parsed.error.message },
      { status: 400 },
    );
  }
  const { card_address, name, token_label, caps } = parsed.data;
  if (!isStellarPublicKey(card_address)) {
    return Response.json(
      { status: "error", reason: "invalid_card_address" },
      { status: 400 },
    );
  }

  // Reuse an existing card agent for this company account if present.
  let agent = await prisma.agent.findFirst({
    where: { userId: principal.userId, stellarAddress: card_address },
  });
  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        userId: principal.userId,
        name: name ?? `Tael card ${card_address.slice(0, 4)}…${card_address.slice(-4)}`,
        framework: "custom",
        status: "active",
        stellarAddress: card_address,
        accountType: "external",
        signerStrategy: "partner_callback",
      },
    });
  } else if (
    agent.signerStrategy !== "partner_callback" ||
    agent.accountType !== "external"
  ) {
    agent = await prisma.agent.update({
      where: { id: agent.id },
      data: { signerStrategy: "partner_callback", accountType: "external" },
    });
  }

  if (caps) {
    await prisma.agentPolicy.upsert({
      where: { agentId: agent.id },
      create: { agentId: agent.id, ...caps },
      update: caps,
    });
  }

  const plaintext = mintNebulaTokenPlaintext();
  const token = await prisma.nebulaToken.create({
    data: {
      userId: principal.userId,
      agentId: agent.id,
      label: token_label ?? name ?? "tael-card",
      tokenHash: hashNebulaToken(plaintext),
    },
  });

  bustRouteCache("agents:");

  return Response.json({
    status: "ok",
    agent_id: agent.id,
    card_address,
    // Bind this token to the card, or reuse the company token + x-tael-agent header.
    token: {
      id: token.id,
      token: plaintext,
      warning: "Plaintext shown once. Store safely.",
    },
    mcp: buildMcpConfig({ token: plaintext, serverName: agent.name }),
    mcp_url: `${appBaseUrl()}/mcp`,
    tools_url: `${appBaseUrl()}/api/tools/{tool}`,
    // Whether Nebula is configured to call the partner sign endpoint.
    signer_ready: partnerSignerConfigFromEnv() != null,
  });
}
