import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  mintWalletSessionToken,
  sessionCookie,
  verifyChallenge,
} from "@/lib/wallet-auth";

const schema = z.object({
  address: z.string().min(56).max(56),
  message: z.string().min(1),
  signature: z.string().min(1),
  challengeToken: z.string().min(1),
});

/**
 * Verify a signed SIWS challenge, upsert the wallet-native (external) account,
 * and mint an httpOnly session cookie. Mirrors Privy sign-in but for a
 * self-custody wallet — the account is keyed by its Stellar address.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { status: "error", reason: "invalid_request" },
      { status: 400 },
    );
  }

  const result = verifyChallenge(parsed.data);
  if (!result.ok) {
    return Response.json(
      { status: "rejected", reason: result.reason },
      { status: 401 },
    );
  }

  const address = parsed.data.address;
  const user = await prisma.user.upsert({
    where: { stellarAddress: address },
    create: {
      stellarAddress: address,
      accountType: "external",
      signerStrategy: "client_side",
    },
    update: {
      accountType: "external",
      signerStrategy: "client_side",
    },
  });

  await prisma.policySettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  const { token, expiresAt } = mintWalletSessionToken({
    userId: user.id,
    address,
  });

  return Response.json(
    {
      status: "ok",
      userId: user.id,
      address,
      expiresAt,
    },
    { headers: { "Set-Cookie": sessionCookie(token) } },
  );
}
