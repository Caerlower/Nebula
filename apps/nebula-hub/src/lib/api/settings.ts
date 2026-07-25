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
  try {
    const me = await hubJson<{ network?: string }>("/api/me");
    if (me.network === "mainnet" || me.network === "testnet") {
      return { name: "Nebula", network: me.network };
    }
  } catch {
    /* fall through to wallet */
  }
  const wallet = await hubJson<HubWallet>("/api/wallet");
  return {
    name: "Nebula",
    network: wallet.network === "mainnet" ? "mainnet" : "testnet",
  };
}

/** Persist preferred Stellar network for this account (drives Hub + MCP). */
export async function setNetwork(
  network: Workspace["network"],
): Promise<Workspace> {
  const res = await hubJson<{ ok: true; network: string }>("/api/me", {
    method: "PATCH",
    body: JSON.stringify({ network }),
  });
  return {
    name: "Nebula",
    network: res.network === "mainnet" ? "mainnet" : "testnet",
  };
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
