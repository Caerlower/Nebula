import type {
  AppNotification,
  BillingInfo,
  Invoice,
  NotificationPrefs,
  TeamMember,
  Webhook,
  Workspace,
} from "@/types/domain";

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

export async function inviteMember(
  _email: string,
  _role: TeamMember["role"],
): Promise<TeamMember> {
  throw new Error("Team invites are not available yet.");
}

export async function updateMemberRole(
  _id: string,
  _role: TeamMember["role"],
): Promise<TeamMember> {
  throw new Error("Team roles are not available yet.");
}

export async function removeMember(_id: string): Promise<void> {
  throw new Error("Team management is not available yet.");
}

/* ------------------------------- billing ------------------------------ */

export async function getBilling(): Promise<BillingInfo> {
  return {
    plan: "Free",
    renewsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    mcpCallsUsed: 0,
    mcpCallsLimit: 10_000,
    txVolumeUsedUSD: 0,
    txVolumeLimitUSD: 1_000,
    paymentMethod: null,
  };
}

export async function getInvoices(): Promise<Invoice[]> {
  return [];
}

/* ---------------------------- notifications ---------------------------- */

const defaultNotifPrefs: NotificationPrefs = {
  policyViolations: true,
  lowBalance: true,
  yieldMilestones: true,
  weeklySummary: false,
};

let notifPrefs: NotificationPrefs = { ...defaultNotifPrefs };

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  return { ...notifPrefs };
}

export async function updateNotificationPrefs(
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  notifPrefs = { ...notifPrefs, ...patch };
  return { ...notifPrefs };
}

export async function getNotifications(): Promise<AppNotification[]> {
  return [];
}

export async function markNotificationsRead(): Promise<void> {
  /* no-op until notification store ships */
}

/* ------------------------------ webhooks ------------------------------- */

export async function getWebhooks(): Promise<Webhook[]> {
  return [];
}

export async function addWebhook(
  _url: string,
  _events: string[],
): Promise<Webhook> {
  throw new Error("Webhooks are not available yet.");
}

export async function removeWebhook(_id: string): Promise<void> {
  throw new Error("Webhooks are not available yet.");
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

export async function deleteWorkspace(): Promise<void> {
  throw new Error("Workspace deletion is not available yet.");
}

export async function updateAccount(_patch: {
  name?: string;
}): Promise<{ ok: true }> {
  return { ok: true };
}
