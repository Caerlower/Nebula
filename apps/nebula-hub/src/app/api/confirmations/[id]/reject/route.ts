import { NextRequest } from "next/server";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitOrThrow } from "@/lib/route-cache";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const principal = await resolveAuth(req);
  if (!principal || !isDashboardAuth(principal)) {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "human_rejection_required" },
      { status: 403 },
    );
  }

  const limited = await rateLimitOrThrow(`reject:${principal.userId}`);
  if (!limited.success) {
    return Response.json(
      { status: "error", reason: "rate_limited" },
      { status: 429 },
    );
  }

  const { id } = await params;
  const conf = await prisma.confirmation.findUnique({ where: { id } });
  if (!conf) {
    return Response.json({ status: "error", reason: "not_found" }, { status: 404 });
  }
  if (conf.userId !== principal.userId) {
    return Response.json({ status: "error", reason: "forbidden" }, { status: 403 });
  }

  if (conf.status === "executing") {
    return Response.json(
      { status: "error", reason: "already_executing" },
      { status: 409 },
    );
  }
  if (conf.status !== "pending") {
    return Response.json(
      { status: "error", reason: `already_${conf.status}` },
      { status: 400 },
    );
  }

  const rejected = await prisma.confirmation.updateMany({
    where: { id, userId: principal.userId, status: "pending" },
    data: { status: "rejected" },
  });
  if (rejected.count !== 1) {
    return Response.json(
      { status: "error", reason: "already_executing" },
      { status: 409 },
    );
  }

  return Response.json({ status: "ok" });
}
