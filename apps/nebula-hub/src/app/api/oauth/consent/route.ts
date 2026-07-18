import { NextRequest } from "next/server";
import { z } from "zod";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  hashOpaque,
  mintAuthorizationCode,
  parseRedirectUris,
} from "@/lib/oauth";

const consentSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(16),
  code_challenge_method: z.literal("S256").default("S256"),
  state: z.string().optional(),
  scope: z.string().optional(),
  /** Agent whose managed wallet this connector will operate. */
  agent_id: z.string().min(1),
});

/**
 * Human consent after dashboard login. Issues an authorization code bound to
 * a specific agent so the resulting MCP token operates that agent's wallet —
 * never the owner's EOA / account wallet.
 */
export async function POST(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal || !isDashboardAuth(principal)) {
    if (!principal) return unauthorized();
    return Response.json(
      { error: "access_denied", error_description: "dashboard_session_required" },
      { status: 403 },
    );
  }

  const body = consentSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "invalid_request", error_description: body.error.message },
      { status: 400 },
    );
  }

  const agent = await prisma.agent.findFirst({
    where: { id: body.data.agent_id, userId: principal.userId },
    select: { id: true, name: true, stellarAddress: true },
  });
  if (!agent) {
    return Response.json(
      { error: "invalid_request", error_description: "agent_not_found" },
      { status: 400 },
    );
  }
  if (!agent.stellarAddress) {
    return Response.json(
      {
        error: "invalid_request",
        error_description:
          "agent_wallet_not_ready — open the agent in the Hub and wait for provisioning",
      },
      { status: 400 },
    );
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: body.data.client_id },
  });
  if (!client) {
    return Response.json(
      { error: "invalid_client", error_description: "unknown_client_id" },
      { status: 400 },
    );
  }

  const uris = parseRedirectUris(client.redirectUris);
  if (!uris.includes(body.data.redirect_uri)) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri_not_registered",
      },
      { status: 400 },
    );
  }

  const code = mintAuthorizationCode();
  await prisma.oAuthAuthorizationCode.create({
    data: {
      codeHash: hashOpaque(code),
      clientId: client.clientId,
      userId: principal.userId,
      agentId: agent.id,
      redirectUri: body.data.redirect_uri,
      codeChallenge: body.data.code_challenge,
      codeChallengeMethod: body.data.code_challenge_method,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const redirect = new URL(body.data.redirect_uri);
  redirect.searchParams.set("code", code);
  if (body.data.state) redirect.searchParams.set("state", body.data.state);

  return Response.json({ redirect_to: redirect.toString() });
}
