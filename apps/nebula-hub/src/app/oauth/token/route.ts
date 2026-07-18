import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  hashOpaque,
  mintOAuthAccessToken,
  parseRedirectUris,
  verifyPkceS256,
} from "@/lib/oauth";

const tokenSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().min(1),
  code_verifier: z.string().min(43),
  client_secret: z.string().optional(),
});

function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** OAuth token endpoint — exchanges auth code (+ PKCE) for nbl_live_ access token. */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let raw: Record<string, string>;
  if (contentType.includes("application/json")) {
    raw = (await req.json().catch(() => ({}))) as Record<string, string>;
  } else {
    raw = formToObject(await req.formData());
  }

  const body = tokenSchema.safeParse(raw);
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
    return Response.json({ error: "invalid_client" }, { status: 401 });
  }

  if (client.clientSecretHash) {
    if (
      !body.data.client_secret ||
      hashOpaque(body.data.client_secret) !== client.clientSecretHash
    ) {
      return Response.json({ error: "invalid_client" }, { status: 401 });
    }
  }

  const uris = parseRedirectUris(client.redirectUris);
  if (!uris.includes(body.data.redirect_uri)) {
    return Response.json(
      { error: "invalid_grant", error_description: "redirect_uri_mismatch" },
      { status: 400 },
    );
  }

  const codeHash = hashOpaque(body.data.code);
  const row = await prisma.oAuthAuthorizationCode.findUnique({
    where: { codeHash },
  });
  if (
    !row ||
    row.usedAt ||
    row.clientId !== body.data.client_id ||
    row.redirectUri !== body.data.redirect_uri ||
    row.expiresAt.getTime() < Date.now()
  ) {
    return Response.json(
      { error: "invalid_grant", error_description: "code_invalid_or_expired" },
      { status: 400 },
    );
  }

  if (
    row.codeChallengeMethod !== "S256" ||
    !verifyPkceS256(body.data.code_verifier, row.codeChallenge)
  ) {
    return Response.json(
      { error: "invalid_grant", error_description: "pkce_failed" },
      { status: 400 },
    );
  }

  await prisma.oAuthAuthorizationCode.update({
    where: { codeHash },
    data: { usedAt: new Date() },
  });

  if (!row.agentId) {
    return Response.json(
      {
        error: "invalid_grant",
        error_description:
          "legacy_code_missing_agent — reconnect the connector and pick an agent",
      },
      { status: 400 },
    );
  }

  let accessToken: string;
  let expiresIn: number;
  try {
    ({ accessToken, expiresIn } = await mintOAuthAccessToken(
      row.userId,
      row.agentId,
    ));
  } catch {
    return Response.json(
      { error: "invalid_grant", error_description: "agent_not_found" },
      { status: 400 },
    );
  }

  return Response.json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresIn,
    scope: "mcp",
  });
}
