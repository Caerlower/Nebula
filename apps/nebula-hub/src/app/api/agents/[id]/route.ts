import { NextRequest } from "next/server";

import { bustRouteCache } from "@/lib/route-cache";
import { z } from "zod";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchBalances } from "@/lib/stellar";

const HUB_NETWORK =
  (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
  "testnet";

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

const patchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  status: z.enum(["active", "paused", "offline"]).optional(),
  framework: z
    .enum([
      "claude_desktop",
      "claude_code",
      "cursor",
      "chatgpt",
      "custom",
    ])
    .optional(),
});

async function loadOwnedAgent(userId: string, id: string) {
  return prisma.agent.findFirst({
    where: { id, userId },
    include: {
      tokens: {
        where: { revokedAt: null },
        select: { id: true, label: true, lastUsedAt: true, createdAt: true },
      },
    },
  });
}

export async function GET(
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
  const agent = await loadOwnedAgent(principal.userId, id);
  if (!agent) {
    return Response.json({ status: "error", reason: "not_found" }, { status: 404 });
  }
  return Response.json({
    agent: { ...agent, balanceXlm: await agentNativeXlm(agent.stellarAddress) },
  });
}

async function uncachedPATCH(
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
  const existing = await loadOwnedAgent(principal.userId, id);
  if (!existing) {
    return Response.json({ status: "error", reason: "not_found" }, { status: 404 });
  }

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { status: "error", reason: body.error.message },
      { status: 400 },
    );
  }

  const agent = await prisma.agent.update({
    where: { id },
    data: body.data,
    include: {
      tokens: {
        where: { revokedAt: null },
        select: { id: true, label: true, lastUsedAt: true, createdAt: true },
      },
    },
  });

  return Response.json({ agent });
}

async function uncachedDELETE(
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
  const existing = await loadOwnedAgent(principal.userId, id);
  if (!existing) {
    return Response.json({ status: "error", reason: "not_found" }, { status: 404 });
  }

  await prisma.nebulaToken.updateMany({
    where: { agentId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.agent.delete({ where: { id } });

  return Response.json({ status: "ok", id });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const res = await uncachedPATCH(req, ctx);
  if (res.ok) {
    bustRouteCache("agents:");
  }
  return res;
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const res = await uncachedDELETE(req, ctx);
  if (res.ok) {
    bustRouteCache("agents:");
  }
  return res;
}
