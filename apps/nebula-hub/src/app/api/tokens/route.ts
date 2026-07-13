import { NextRequest } from "next/server";
import { z } from "zod";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { hashNebulaToken, mintNebulaTokenPlaintext, prisma } from "@/lib/db";
import { demoPrivyWalletId, demoStellarAddress } from "@/lib/auth";

/** null = never expires. Allowed UI presets: 7 / 30 / 180 days. */
const createSchema = z.object({
  label: z.string().min(1).max(64),
  agentId: z.string().optional(),
  expiresInDays: z
    .union([z.literal(7), z.literal(30), z.literal(180), z.null()])
    .optional()
    .default(30),
});

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal || principal.source === "nebula_token") {
    // Listing tokens requires dashboard session (Privy). Nebula tokens cannot list siblings.
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "dashboard_auth_required" },
      { status: 403 },
    );
  }

  const tokens = await prisma.nebulaToken.findMany({
    where: { userId: principal.userId, revokedAt: null },
    select: {
      id: true,
      label: true,
      agentId: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ tokens });
}

export async function POST(req: NextRequest) {
  const principal = await resolveAuth(req);
  // Privy session, or DEV_MINT_SECRET for local demos (never in prod/Vercel).
  let userId = principal?.userId;
  if (!userId) {
    const devSecret = req.headers.get("x-nebula-dev-mint");
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.VERCEL !== "1" &&
      process.env.DEV_MINT_SECRET &&
      devSecret === process.env.DEV_MINT_SECRET
    ) {
      const email = process.env.DEV_USER_EMAIL ?? "dev@nebula.local";
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          privyUserId: `dev|${email}`,
          email,
          name: "Dev User",
          stellarAddress: demoStellarAddress(),
          privyWalletId: demoPrivyWalletId(),
        },
        update: {
          stellarAddress: demoStellarAddress(),
          privyWalletId: demoPrivyWalletId(),
        },
      });
      userId = user.id;
      await prisma.policySettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
    } else {
      return unauthorized();
    }
  } else if (principal?.source === "nebula_token") {
    return Response.json(
      { status: "rejected", reason: "dashboard_auth_required" },
      { status: 403 },
    );
  }

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { status: "error", reason: body.error.message },
      { status: 400 },
    );
  }

  const expiresInDays = body.data.expiresInDays ?? 30;
  const expiresAt =
    expiresInDays == null
      ? null
      : new Date(Date.now() + expiresInDays * 86_400_000);

  const plaintext = mintNebulaTokenPlaintext();
  const tokenHash = hashNebulaToken(plaintext);
  const row = await prisma.nebulaToken.create({
    data: {
      userId: userId!,
      label: body.data.label,
      agentId: body.data.agentId,
      tokenHash,
      expiresAt,
    },
  });

  return Response.json({
    id: row.id,
    label: row.label,
    token: plaintext,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    warning:
      "This is the only time the plaintext token is shown. Store it safely.",
  });
}
