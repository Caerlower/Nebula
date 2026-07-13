import { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";

import { hashOpaque } from "@/lib/oauth";
import { prisma } from "@/lib/db";
import { rateLimitOrThrow } from "@/lib/route-cache";

const registerSchema = z.object({
  client_name: z.string().max(128).optional(),
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  token_endpoint_auth_method: z
    .enum(["none", "client_secret_post"])
    .optional()
    .default("none"),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

type DcrMode = "open" | "restricted" | "disabled";

function dcrMode(): DcrMode {
  const raw = (process.env.OAUTH_DCR_MODE ?? "restricted").trim().toLowerCase();
  if (raw === "open" || raw === "disabled") return raw;
  return "restricted";
}

function allowlistHosts(): Set<string> {
  return new Set(
    (process.env.OAUTH_DCR_REDIRECT_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isLoopbackHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.endsWith(".localhost")
  );
}

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  return false;
}

/** MCP clients often use custom schemes (cursor://, vscode://) or loopback HTTP. */
function redirectUriAllowed(uri: string, mode: DcrMode): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }

  if (parsed.username || parsed.password) return false;

  const protocol = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();

  // Always allow common local / editor MCP redirect patterns.
  if (protocol === "http:" || protocol === "https:") {
    if (isLoopbackHost(host) || isPrivateIpv4(host)) return true;
  }
  if (
    protocol === "cursor:" ||
    protocol === "vscode:" ||
    protocol === "vscode-insiders:"
  ) {
    return true;
  }

  if (mode === "open") {
    return protocol === "https:";
  }

  // restricted: https only when host is on explicit allowlist
  if (protocol !== "https:") return false;
  return allowlistHosts().has(host);
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** RFC 7591 Dynamic Client Registration for MCP connectors. */
export async function POST(req: NextRequest) {
  const mode = dcrMode();
  if (mode === "disabled") {
    return Response.json(
      {
        error: "invalid_client_metadata",
        error_description: "Dynamic client registration is disabled",
      },
      { status: 403 },
    );
  }

  const dcrSecret = process.env.OAUTH_DCR_SECRET?.trim();
  if (dcrSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (bearer !== dcrSecret) {
      return Response.json(
        { error: "invalid_client", error_description: "registration unauthorized" },
        { status: 401 },
      );
    }
  }

  const limited = await rateLimitOrThrow(`oauth_dcr:${clientIp(req)}`, {
    limit: 10,
    window: "1 m",
  });
  if (!limited.success) {
    return Response.json(
      { error: "temporarily_unavailable", error_description: "rate_limited" },
      { status: 429 },
    );
  }

  const body = registerSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      {
        error: "invalid_client_metadata",
        error_description: body.error.message,
      },
      { status: 400 },
    );
  }

  const bad = body.data.redirect_uris.find((u) => !redirectUriAllowed(u, mode));
  if (bad) {
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: `redirect_uri not allowed: ${bad}`,
      },
      { status: 400 },
    );
  }

  const clientId = `nbl_cli_${randomBytes(16).toString("base64url")}`;
  const publicClient = body.data.token_endpoint_auth_method === "none";
  const clientSecret = publicClient
    ? null
    : `nbl_sec_${randomBytes(24).toString("base64url")}`;

  await prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecretHash: clientSecret ? hashOpaque(clientSecret) : null,
      clientName: body.data.client_name ?? null,
      redirectUris: body.data.redirect_uris,
    },
  });

  return Response.json(
    {
      client_id: clientId,
      client_secret: clientSecret ?? undefined,
      client_name: body.data.client_name,
      redirect_uris: body.data.redirect_uris,
      token_endpoint_auth_method: body.data.token_endpoint_auth_method,
      grant_types: body.data.grant_types ?? ["authorization_code"],
      response_types: body.data.response_types ?? ["code"],
    },
    { status: 201 },
  );
}
