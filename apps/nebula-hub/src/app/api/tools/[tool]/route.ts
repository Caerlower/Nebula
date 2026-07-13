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

  const result = await runHubTool(tool, body, principal);
  const status =
    result.status === "rejected"
      ? 403
      : result.status === "error"
        ? 400
        : 200;
  return Response.json(result, { status });
}
