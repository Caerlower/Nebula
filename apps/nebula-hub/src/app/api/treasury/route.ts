import { NextRequest } from "next/server";

import { cachedJsonResponse } from "@/lib/route-cache";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { getTreasuryBalances, fetchBlendSupplyRates } from "@/lib/blend";
import { prisma } from "@/lib/db";

async function uncachedGET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const settings = await prisma.policySettings.findUnique({
    where: { userId: principal.userId },
  });

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  let liquid: number | null = null;
  let blendDeposited: number | null = null;
  let supplyApy: number | null = null;
  let poolId: string | null = null;
  let poolName: string | null = null;
  let feeBuffer: number | null = null;
  let rawNativeXlm: number | null = null;
  let note: string | undefined;

  if (principal.stellarAddress) {
    try {
      const balances = await getTreasuryBalances(
        principal.stellarAddress,
        network,
      );
      liquid = balances.liquid;
      blendDeposited = balances.blendDeposited;
      supplyApy = balances.supplyApy;
      poolId = balances.poolId;
      poolName = balances.poolName;
      feeBuffer = balances.feeBuffer;
      rawNativeXlm = balances.rawNativeXlm;
    } catch (error) {
      note =
        error instanceof Error
          ? error.message
          : "Failed to load Blend balances";
      // Fall back to rates-only if position load fails
      try {
        const rates = await fetchBlendSupplyRates(network);
        if (rates.ok) {
          const xlm = rates.pools[0]?.reserves.find(
            (r) => r.symbol === "XLM" || r.symbol === "native",
          );
          supplyApy = xlm?.supplyApyFloat ?? null;
          poolId = rates.pools[0]?.pool.poolId ?? null;
          poolName = rates.pools[0]?.poolName ?? null;
        }
      } catch {
        // ignore
      }
    }
  } else {
    note = "Wallet not provisioned yet.";
  }

  return Response.json({
    asset: "XLM",
    liquid,
    blendDeposited,
    supplyApy,
    poolId,
    poolName,
    feeBuffer,
    rawNativeXlm,
    autoYield: settings?.autoYield ?? true,
    liquidThreshold: settings ? Number(settings.liquidThreshold) : 2,
    liquidHigh: settings ? Number(settings.liquidHigh) : 10,
    paused: settings?.paused ?? false,
    ...(note ? { note } : {}),
  });
}

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();
  return cachedJsonResponse(`treasury:${principal.userId}`, 30000, () => uncachedGET(req));
}
