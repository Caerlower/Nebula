import { NextRequest } from "next/server";

import { bustRouteCache, rateLimitOrThrow } from "@/lib/route-cache";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function uncachedDELETE(req: NextRequest, { params }: Params) {
  const principal = await resolveAuth(req);
  if (!principal || !isDashboardAuth(principal)) {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "mcp_tokens_cannot_mutate_policy" },
      { status: 403 },
    );
  }

  const limited = await rateLimitOrThrow(`denylist_del:${principal.userId}`);
  if (!limited.success) {
    return Response.json(
      { status: "error", reason: "rate_limited" },
      { status: 429 },
    );
  }

  const { id } = await params;
  const existing = await prisma.denylistEntry.findFirst({
    where: { id, userId: principal.userId },
  });
  if (!existing) {
    return Response.json({ status: "error", reason: "not_found" }, { status: 404 });
  }

  await prisma.denylistEntry.delete({ where: { id } });
  return Response.json({ status: "ok" });
}

export async function DELETE(req: NextRequest, ctx: Params) {
  const res = await uncachedDELETE(req, ctx);
  if (res.ok) {
    bustRouteCache("policy:");
    bustRouteCache("wl:");
    bustRouteCache("dl:");
  }
  return res;
}
