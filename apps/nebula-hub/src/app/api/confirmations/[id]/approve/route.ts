import { NextRequest } from "next/server";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { executeApprovedConfirmation } from "@/lib/hub-tools";
import { rateLimitOrThrow } from "@/lib/route-cache";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const principal = await resolveAuth(req);
  if (!principal || !isDashboardAuth(principal)) {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "human_approval_required" },
      { status: 403 },
    );
  }

  const limited = await rateLimitOrThrow(`approve:${principal.userId}`);
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
  if (conf.expiresAt.getTime() < Date.now()) {
    await prisma.confirmation.update({
      where: { id },
      data: { status: "expired" },
    });
    return Response.json({ status: "error", reason: "expired" }, { status: 400 });
  }

  // Claim atomically so concurrent approves cannot both execute.
  const claimed = await prisma.confirmation.updateMany({
    where: {
      id,
      userId: principal.userId,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    data: { status: "executing" },
  });
  if (claimed.count !== 1) {
    return Response.json(
      { status: "error", reason: "already_executing" },
      { status: 409 },
    );
  }

  const result = await executeApprovedConfirmation(id);

  if (result.status === "ok") {
    await prisma.confirmation.update({
      where: { id },
      data: {
        status: "approved",
        approvedAt: new Date(),
        txHash: result.tx_hash ?? undefined,
      },
    });
  } else {
    // Allow retry on failure / rejection.
    await prisma.confirmation.update({
      where: { id },
      data: { status: "pending" },
    });
  }

  const status =
    result.status === "rejected"
      ? 403
      : result.status === "error"
        ? 400
        : 200;
  return Response.json(result, { status });
}
