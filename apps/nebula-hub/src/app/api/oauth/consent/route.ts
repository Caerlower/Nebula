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
});

/**
 * Human consent after Privy login. Issues an authorization code and returns
 * the redirect URL the browser should navigate to.
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
