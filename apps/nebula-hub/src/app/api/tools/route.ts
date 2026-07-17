import { NextRequest } from "next/server";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { runHubTool } from "@/lib/hub-tools";
import { rateLimitOrThrow } from "@/lib/route-cache";

/**
 * Generic single-URL tool dispatch for plain HTTP callers (e.g. Tael).
 *
 * Unlike /api/tools/[tool] (tool in the path), this reads the tool name and
 * arguments from the body — the shape partner gateways send per operation:
 *
 *   POST /api/tools
 *   Authorization: Bearer nbl_live_…
 *   { "tool": "check_balance", "arguments": { … } }
 */
export async function POST(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) {
    return unauthorized();
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const tool = typeof record.tool === "string" ? record.tool.trim() : "";
  if (!tool) {
    return Response.json(
      { status: "error", reason: "missing_tool" },
      { status: 400 },
    );
  }
  const args =
    record.arguments && typeof record.arguments === "object"
      ? (record.arguments as Record<string, unknown>)
      : {};

  const limited = await rateLimitOrThrow(`tool:${principal.userId}:${tool}`);
  if (!limited.success) {
    return Response.json(
      { status: "error", reason: "rate_limited" },
      { status: 429 },
    );
  }

  const result = await runHubTool(tool, args, principal);
  const status =
    result.status === "rejected"
      ? 403
      : result.status === "error"
        ? 400
        : 200;
  return Response.json(result, { status });
}
