import { NextRequest } from "next/server";

import { cachedJsonResponse } from "@/lib/route-cache";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function uncachedGET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const agentId = url.searchParams.get("agentId") ?? undefined;

  const rows = await prisma.transaction.findMany({
    where: { userId: principal.userId, ...(agentId ? { agentId } : {}) },
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  return Response.json({
    transactions: rows,
    nextCursor: rows.length === take ? rows[rows.length - 1]?.id : null,
  });
}

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();
  return cachedJsonResponse(`txs:${principal.userId}:${new URL(req.url).search}`, 10000, () => uncachedGET(req));
}
