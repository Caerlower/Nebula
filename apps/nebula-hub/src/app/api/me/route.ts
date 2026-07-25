import { NextRequest } from "next/server";
import { z } from "zod";

import {
  invalidateAuthPrincipalCache,
  resolveAuth,
  unauthorized,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  mainnetPreferenceAllowed,
  networkFromPrincipal,
  parseHubNetwork,
} from "@/lib/network";

/** Current Hub user from Privy access token or Nebula MCP token. */
export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: principal.userId },
    select: { name: true, email: true, preferredNetwork: true },
  });

  const network = networkFromPrincipal({
    network:
      parseHubNetwork(user?.preferredNetwork) ?? principal.network ?? null,
  });

  return Response.json({
    userId: principal.userId,
    email: principal.email ?? user?.email ?? null,
    name: user?.name ?? null,
    source: principal.source,
    stellarAddress: principal.stellarAddress,
    privyWalletId: principal.privyWalletId,
    network,
    walletProvisioned: Boolean(
      principal.stellarAddress && principal.privyWalletId,
    ),
  });
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(64).optional(),
    network: z.enum(["testnet", "mainnet"]).optional(),
  })
  .refine((b) => b.name !== undefined || b.network !== undefined, {
    message: "name or network required",
  });

/** Persist display name and/or preferred Stellar network. */
export async function PATCH(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal || principal.source === "nebula_token") {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "dashboard_auth_required" },
      { status: 403 },
    );
  }

  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { status: "error", reason: body.error.message },
      { status: 400 },
    );
  }

  const data: { name?: string; preferredNetwork?: string } = {};
  if (body.data.name !== undefined) data.name = body.data.name;
  if (body.data.network !== undefined) {
    if (body.data.network === "mainnet" && !mainnetPreferenceAllowed()) {
      return Response.json(
        {
          status: "rejected",
          reason: "mainnet_disabled: set MAINNET_ENABLED=1 to allow mainnet preference",
        },
        { status: 403 },
      );
    }
    data.preferredNetwork = body.data.network;
  }

  try {
    const user = await prisma.user.update({
      where: { id: principal.userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        preferredNetwork: true,
      },
    });

    if (body.data.network !== undefined) {
      invalidateAuthPrincipalCache();
    }

    return Response.json({
      ok: true,
      userId: user.id,
      name: user.name,
      email: user.email,
      network: networkFromPrincipal({
        network: parseHubNetwork(user.preferredNetwork),
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[me] PATCH failed", error);
    // Stale Prisma client / missing column usually show up as Unknown argument.
    if (/preferredNetwork|Unknown argument/i.test(message)) {
      return Response.json(
        {
          status: "error",
          reason:
            "preferredNetwork_unavailable: run `pnpm --filter nebula-hub db:push` then `db:generate` and restart the Hub",
        },
        { status: 500 },
      );
    }
    return Response.json(
      { status: "error", reason: `me_patch_failed:${message}` },
      { status: 500 },
    );
  }
}
