import { NextRequest } from "next/server";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const principal = await resolveAuth(req);
  const { id } = await params;
  const conf = await prisma.confirmation.findUnique({ where: { id } });
  if (!conf) {
    return Response.json({ status: "error", reason: "not_found" }, { status: 404 });
  }
  // Allow dashboard session OR public fetch by confirmation id.
  // can fetch by id (token in URL is the confirmation id). Still require login for approve.
  if (principal && principal.userId !== conf.userId) {
    return Response.json({ status: "error", reason: "forbidden" }, { status: 403 });
  }

  return Response.json({
    id: conf.id,
    toolName: conf.toolName,
    summary: conf.summary,
    status: conf.status,
    expiresAt: conf.expiresAt.toISOString(),
    input: conf.input,
    txHash: conf.txHash,
  });
}

export async function POST(
  req: NextRequest,
  { params }: Params,
) {
  // POST without subpath not used — see approve/reject routes
  void req;
  void params;
  return Response.json({ status: "error", reason: "use /approve or /reject" }, { status: 405 });
}
