import { NextRequest } from "next/server";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const principal = await resolveAuth(req);
  if (!principal || principal.source === "nebula_token") {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "dashboard_auth_required" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const existing = await prisma.nebulaToken.findFirst({
    where: { id, userId: principal.userId },
  });
  if (!existing) {
    return Response.json({ status: "error", reason: "not_found" }, { status: 404 });
  }

  await prisma.nebulaToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return Response.json({ status: "ok", id });
}
