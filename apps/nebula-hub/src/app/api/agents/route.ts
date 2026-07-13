import { NextRequest } from "next/server";

import { bustRouteCache, cachedJsonResponse } from "@/lib/route-cache";
import { z } from "zod";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { hashNebulaToken, mintNebulaTokenPlaintext, prisma } from "@/lib/db";

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
  return Response.json({ agents });
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
