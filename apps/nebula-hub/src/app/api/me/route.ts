import { NextRequest } from "next/server";
import { z } from "zod";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Current Hub user — `network` follows request Host (ledger subdomain). */
export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: principal.userId },
    select: { name: true, email: true },
  });

  return Response.json({
    userId: principal.userId,
    email: principal.email ?? user?.email ?? null,
    name: user?.name ?? null,
    source: principal.source,
    stellarAddress: principal.stellarAddress,
    privyWalletId: principal.privyWalletId,
    network: principal.network,
    walletProvisioned: Boolean(
      principal.stellarAddress && principal.privyWalletId,
    ),
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(64),
});

/** Persist display name. */
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

  try {
    const user = await prisma.user.update({
      where: { id: principal.userId },
      data: { name: body.data.name },
      select: { id: true, name: true, email: true },
    });

    return Response.json({
      ok: true,
      userId: user.id,
      name: user.name,
      email: user.email,
      network: principal.network,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[me] PATCH failed", error);
    return Response.json(
      { status: "error", reason: `me_patch_failed:${message}` },
      { status: 500 },
    );
  }
}
