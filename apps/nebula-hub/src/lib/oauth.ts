import { createHash, randomBytes } from "node:crypto";

import type { AuthPrincipal } from "@/lib/auth";
import { hashNebulaToken, mintNebulaTokenPlaintext, prisma } from "@/lib/db";
import { runHubTool } from "@/lib/hub-tools";
import { formatToolResultForMcp, listToolsForMcp } from "nebulamcp-core";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function hashOpaque(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function mintAuthorizationCode(): string {
  return `nbl_code_${randomBytes(24).toString("base64url")}`;
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  const digest = createHash("sha256").update(verifier).digest("base64url");
  return digest === challenge;
}

export function parseRedirectUris(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((u): u is string => typeof u === "string" && u.length > 0);
}

/** Issue a Hub MCP token after a successful OAuth code exchange (30-day TTL).
 *  Always bind to an agent so Claude/MCP clients operate that agent's wallet,
 *  never the owner's EOA / account wallet.
 */
export const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function mintOAuthAccessToken(
  userId: string,
  agentId: string,
): Promise<{
  accessToken: string;
  tokenId: string;
  expiresIn: number;
}> {
  const plaintext = mintNebulaTokenPlaintext();
  const expiresAt = new Date(
    Date.now() + OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
  );
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId },
    select: { id: true, name: true },
  });
  if (!agent) {
    throw new Error("oauth_agent_not_found");
  }
  const row = await prisma.nebulaToken.create({
    data: {
      userId,
      agentId: agent.id,
      label: `oauth-mcp:${agent.name}`.slice(0, 64),
      tokenHash: hashNebulaToken(plaintext),
      expiresAt,
    },
  });
  return {
    accessToken: plaintext,
    tokenId: row.id,
    expiresIn: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// MCP HTTP transport (formerly src/lib/mcp-http.ts)
// ---------------------------------------------------------------------------

/** Build a per-request MCP server bound to an authenticated Hub principal. */
export async function handleMcpHttpRequest(
  req: Request,
  principal: AuthPrincipal,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = new Server(
    { name: "nebula", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listToolsForMcp(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = request.params.arguments ?? {};
    const result = await runHubTool(name, args, principal);
    return formatToolResultForMcp(result);
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export function mcpWwwAuthenticate(): string {
  const base = appBaseUrl();
  return `Bearer realm="nebula", resource_metadata="${base}/.well-known/oauth-protected-resource"`;
}
