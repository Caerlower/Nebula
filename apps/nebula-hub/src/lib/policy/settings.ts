/**
 * Network-scoped PolicySettings helpers.
 * Owner treasury defaults are one row per (userId, network).
 */

import { prisma } from "@/lib/db";
import type { HubNetwork } from "@/lib/network";

export async function loadTreasurySettings(
  userId: string,
  network: HubNetwork,
) {
  return (
    (await prisma.policySettings.findUnique({
      where: { userId_network: { userId, network } },
    })) ??
    (await prisma.policySettings.create({
      data: { userId, network },
    }))
  );
}

export async function upsertTreasurySettings(
  userId: string,
  network: HubNetwork,
  data: Record<string, unknown>,
) {
  return prisma.policySettings.upsert({
    where: { userId_network: { userId, network } },
    create: { userId, network, ...data },
    update: data,
  });
}
