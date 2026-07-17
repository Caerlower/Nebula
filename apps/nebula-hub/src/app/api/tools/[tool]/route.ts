import { NextRequest } from "next/server";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { runHubTool } from "@/lib/hub-tools";
import { rateLimitOrThrow } from "@/lib/route-cache";

type Params = { params: Promise<{ tool: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const principal = await resolveAuth(req);
  if (!principal) {
    return unauthorized();
  }

  const { tool } = await params;
  const limited = await rateLimitOrThrow(
    `tool:${principal.userId}:${tool}`,
  );
  if (!limited.success) {
    return Response.json(
      { status: "error", reason: "rate_limited" },
      { status: 429 },
    );
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Accept both a bare-arguments body and the { tool, arguments } envelope that
  // partner gateways (Tael) forward, so the same sample body works whether it
  // lands here (tool in the path) or at the generic /api/tools route.
  const record = (body ?? {}) as Record<string, unknown>;
  const args =
    record.arguments && typeof record.arguments === "object"
      ? (record.arguments as Record<string, unknown>)
      : record;

  const result = await runHubTool(tool, args, principal);
  const status =
    result.status === "rejected"
      ? 403
      : result.status === "error"
        ? 400
        : 200;
  return Response.json(result, { status });
}
