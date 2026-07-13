import { NextRequest } from "next/server";

import { resolveAuth } from "@/lib/auth";
import {
  appBaseUrl,
  handleMcpHttpRequest,
  mcpWwwAuthenticate,
} from "@/lib/oauth";
import { rateLimitOrThrow } from "@/lib/route-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function mcp(req: NextRequest): Promise<Response> {
  const principal = await resolveAuth(req);
  if (!principal) {
    return Response.json(
      {
        error: "unauthorized",
        message:
          "Bearer nbl_live_… token required (mint at /connect), or complete OAuth.",
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": mcpWwwAuthenticate(),
        },
      },
    );
  }

  const limited = await rateLimitOrThrow(`mcp:${principal.userId}`);
  if (!limited.success) {
    return Response.json(
      { error: "rate_limited", message: "Too many MCP requests" },
      { status: 429 },
    );
  }

  return handleMcpHttpRequest(req, principal);
}

export async function POST(req: NextRequest) {
  return mcp(req);
}

export async function GET(req: NextRequest) {
  // Discovery / health without auth.
  if (!req.headers.get("authorization")) {
    return Response.json({
      name: "nebula",
      transport: "streamable-http",
      status: "ok",
      mcp: `${appBaseUrl()}/mcp`,
      auth: "Bearer nbl_live_… or OAuth access token",
    });
  }
  return mcp(req);
}

export async function DELETE(req: NextRequest) {
  return mcp(req);
}
