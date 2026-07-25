import type { TeamMember, Workspace } from "@/types/domain";

import { hubJson, type HubWallet } from "./client";

/* -------------------------------- team -------------------------------- */

export async function getTeam(): Promise<TeamMember[]> {
  try {
    const me = await hubJson<{
      email: string | null;
      name?: string | null;
    }>("/api/me");
    return [
      {
        id: "you",
        name: me.name?.trim() || me.email?.split("@")[0] || "You",
        email: me.email ?? "you@nebula.dev",
        role: "Owner",
        joinedAt: new Date().toISOString(),
      },
    ];
  } catch {
    return [];
  }
}

/* ------------------------------ workspace ------------------------------ */

export async function getWorkspace(): Promise<Workspace> {
  const wallet = await hubJson<HubWallet>("/api/wallet");
  return {
    name: "Nebula",
    network: wallet.network === "mainnet" ? "mainnet" : "testnet",
  };
}

export async function setNetwork(
  network: Workspace["network"],
): Promise<Workspace> {
  // Network is env-driven on the Hub today.
  return { name: "Nebula", network };
}

export async function updateAccount(patch: {
  name?: string;
}): Promise<{ ok: true; name: string }> {
  if (!patch.name?.trim()) {
    throw new Error("Name is required");
  }
  const res = await hubJson<{ ok: true; name: string | null }>("/api/me", {
    method: "PATCH",
    body: JSON.stringify({ name: patch.name.trim() }),
  });
  return { ok: true, name: res.name?.trim() || patch.name.trim() };
}
