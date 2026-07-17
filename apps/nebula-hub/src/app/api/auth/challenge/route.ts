import { NextRequest } from "next/server";
import { z } from "zod";

import { buildChallenge } from "@/lib/wallet-auth";

const schema = z.object({
  address: z.string().min(56).max(56),
});

/** Issue a Sign-In-With-Stellar challenge for a Freighter/EOA wallet. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { status: "error", reason: "invalid_address" },
      { status: 400 },
    );
  }

  const challenge = buildChallenge(parsed.data.address);
  if (!challenge) {
    return Response.json(
      { status: "error", reason: "invalid_address" },
      { status: 400 },
    );
  }

  return Response.json(challenge);
}
