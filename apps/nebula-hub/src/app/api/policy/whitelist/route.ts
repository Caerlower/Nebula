import { NextRequest } from "next/server";

import { bustRouteCache, cachedJsonResponse, rateLimitOrThrow } from "@/lib/route-cache";
import { z } from "zod";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  address: z.string().min(56).max(56),
  label: z.string().min(1).max(64),
});

async function uncachedGET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const entries = await prisma.whitelistEntry.findMany({
    where: { userId: principal.userId },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ whitelist: entries });
}

async function uncachedPOST(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal || !isDashboardAuth(principal)) {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "mcp_tokens_cannot_mutate_policy" },
      { status: 403 },
    );
  }

  const limited = await rateLimitOrThrow(`whitelist:${principal.userId}`);
  if (!limited.success) {
    return Response.json(
      { status: "error", reason: "rate_limited" },
      { status: 429 },
    );
  }

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { status: "error", reason: body.error.message },
      { status: 400 },
    );
  }

  const entry = await prisma.whitelistEntry.upsert({
    where: {
      userId_address: {
        userId: principal.userId,
        address: body.data.address,
      },
    },
    create: {
      userId: principal.userId,
      address: body.data.address,
      label: body.data.label,
    },
    update: { label: body.data.label },
  });

  return Response.json({ status: "ok", entry });
}

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();
  return cachedJsonResponse(`wl:${principal.userId}`, 15000, () => uncachedGET(req));
}

export async function POST(req: NextRequest) {
  const res = await uncachedPOST(req);
  if (res.ok) {
    bustRouteCache("policy:");
    bustRouteCache("wl:");
    bustRouteCache("dl:");
  }
  return res;
}
