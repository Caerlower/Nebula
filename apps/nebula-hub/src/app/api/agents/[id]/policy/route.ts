import { NextRequest } from "next/server";
import { z } from "zod";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadEffectiveCaps } from "@/lib/hub-tools/context";
import { bustRouteCache } from "@/lib/route-cache";

/** Per-agent spend caps. Absent row = agent inherits owner cap values. */
const putSchema = z.object({
  microThreshold: z.number().nonnegative().optional(),
  perTxCap: z.number().positive().optional(),
  dailyCap: z.number().positive().optional(),
  paused: z.boolean().optional(),
  catTransfer: z.number().nonnegative().optional(),
  catX402: z.number().nonnegative().optional(),
  catMpp: z.number().nonnegative().optional(),
});

async function ownAgentOr403(req: NextRequest, id: string) {
  const principal = await resolveAuth(req);
  if (!principal || principal.source === "nebula_token") {
    return {
      principal: null,
      response: principal
        ? Response.json(
            { status: "rejected", reason: "dashboard_auth_required" },
            { status: 403 },
          )
        : unauthorized(),
    };
  }
  const agent = await prisma.agent.findFirst({
    where: { id, userId: principal.userId },
    select: { id: true },
  });
  if (!agent) {
    return {
      principal: null,
      response: Response.json(
        { status: "error", reason: "not_found" },
        { status: 404 },
      ),
    };
  }
  return { principal, response: null as Response | null };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { principal, response } = await ownAgentOr403(req, id);
  if (!principal) return response!;

  const [row, caps] = await Promise.all([
    prisma.agentPolicy.findUnique({ where: { agentId: id } }),
    loadEffectiveCaps(principal.userId, id),
  ]);

  return Response.json({
    // Effective caps in force (agent row if set, else inherited owner values).
    policy: caps,
    // Whether this agent has its own caps or is inheriting the owner's.
    custom: Boolean(row),
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { principal, response } = await ownAgentOr403(req, id);
  if (!principal) return response!;

  const body = putSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { status: "error", reason: body.error.message },
      { status: 400 },
    );
  }

  // Seed unset fields from the currently-effective caps so first-time PUT
  // writes a complete, self-consistent row.
  const current = await loadEffectiveCaps(principal.userId, id);
  const merged = {
    microThreshold: body.data.microThreshold ?? current.microThreshold,
    perTxCap: body.data.perTxCap ?? current.perTxCap,
    dailyCap: body.data.dailyCap ?? current.dailyCap,
    paused: body.data.paused ?? current.paused,
    catTransfer: body.data.catTransfer ?? current.catTransfer,
    catX402: body.data.catX402 ?? current.catX402,
    catMpp: body.data.catMpp ?? current.catMpp,
  };
  // Contract invariant: per-call cap never exceeds the daily cap.
  if (merged.perTxCap > merged.dailyCap) {
    merged.perTxCap = merged.dailyCap;
  }

  const updated = await prisma.agentPolicy.upsert({
    where: { agentId: id },
    create: { agentId: id, ...merged },
    update: merged,
  });

  bustRouteCache("agents:");

  return Response.json({
    status: "ok",
    policy: {
      microThreshold: Number(updated.microThreshold),
      perTxCap: Number(updated.perTxCap),
      dailyCap: Number(updated.dailyCap),
      paused: updated.paused,
      catTransfer: Number(updated.catTransfer),
      catX402: Number(updated.catX402),
      catMpp: Number(updated.catMpp),
    },
    custom: true,
  });
}
