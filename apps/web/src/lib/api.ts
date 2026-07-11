/**
 * Mock API façade. Every screen talks to these typed functions and nothing
 * else — swapping to real endpoints later means changing only this file.
 * All functions resolve after a realistic artificial delay and operate on an
 * in-memory copy of the fixtures (state survives route changes, resets on
 * refresh — by design).
 */

import * as fixtures from "@/mocks/fixtures";
import type {
  Agent,
  AgentPolicyOverride,
  ApiKey,
  AppNotification,
  BalancePoint,
  BillingInfo,
  BlendPosition,
  Framework,
  Invoice,
  NotificationPrefs,
  Policy,
  PolicyCategory,
  PolicyEntry,
  Reputation,
  TeamMember,
  TimeRange,
  Transaction,
  TreasurySettings,
  TxStatus,
  TxType,
  WalletSummary,
  Webhook,
  Workspace,
} from "@/mocks/types";

/* --------------------------------- db --------------------------------- */

const db = {
  wallet: structuredClone(fixtures.wallet),
  balanceHistory: structuredClone(fixtures.balanceHistory),
  agents: structuredClone(fixtures.agents),
  transactions: structuredClone(fixtures.transactions),
  blendPositions: structuredClone(fixtures.blendPositions),
  treasurySettings: structuredClone(fixtures.treasurySettings),
  policy: structuredClone(fixtures.policy),
  agentPolicyOverrides: structuredClone(fixtures.agentPolicyOverrides) as Record<
    string,
    AgentPolicyOverride
  >,
  reputation: structuredClone(fixtures.reputation),
  apiKeys: structuredClone(fixtures.apiKeys),
  team: structuredClone(fixtures.team),
  billing: structuredClone(fixtures.billing),
  invoices: structuredClone(fixtures.invoices),
  notificationPrefs: structuredClone(fixtures.notificationPrefs),
  webhooks: structuredClone(fixtures.webhooks),
  notifications: structuredClone(fixtures.notifications),
  workspace: structuredClone(fixtures.workspace),
};

function delay(ms?: number): Promise<void> {
  const wait = ms ?? 200 + Math.random() * 400;
  return new Promise((resolve) => setTimeout(resolve, wait));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

let idCounter = 1000;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function randomHex(length: number): string {
  const hexAlphabet = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += hexAlphabet[Math.floor(Math.random() * 16)];
  }
  return out;
}

function randomStrkey(prefix: "G" | "C"): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let out = prefix;
  for (let i = 0; i < 55; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function randomKeySecret(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "nbl_live_";
  for (let i = 0; i < 40; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/* -------------------------------- auth -------------------------------- */

export interface SessionUser {
  name: string;
  email: string;
}

function userFromEmail(email: string): SessionUser {
  const local = email.split("@")[0] ?? "there";
  const name = local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
  return { name: name || "Nebula User", email };
}

export async function login(email: string, _password: string): Promise<SessionUser> {
  await delay();
  return userFromEmail(email);
}

export async function oauthLogin(provider: "google" | "github"): Promise<SessionUser> {
  await delay(800);
  return userFromEmail(provider === "google" ? "manav@gmail.com" : "manav@users.github.com");
}

export async function signup(email: string, _password: string): Promise<{ email: string }> {
  await delay();
  return { email };
}

export async function verifyCode(_code: string): Promise<{ ok: true }> {
  await delay();
  return { ok: true };
}

export async function resendCode(): Promise<{ ok: true }> {
  await delay();
  return { ok: true };
}

export async function requestPasswordReset(_email: string): Promise<{ ok: true }> {
  await delay();
  return { ok: true };
}

export async function resetPassword(_password: string): Promise<{ ok: true }> {
  await delay();
  return { ok: true };
}

/* ------------------------------ onboarding ----------------------------- */

export async function generateFundingAddress(): Promise<string> {
  // Keypair generation is the only place the Stellar SDK runs client-side;
  // loaded lazily so it never lands in shared bundles.
  const { Keypair } = await import("@stellar/stellar-sdk");
  await delay(250);
  return Keypair.random().publicKey();
}

/* ------------------------------- wallet ------------------------------- */

export async function getWallet(): Promise<WalletSummary> {
  await delay();
  return clone(db.wallet);
}

export async function getBalanceHistory(range: TimeRange): Promise<BalancePoint[]> {
  await delay();
  const history = db.balanceHistory;
  const slice = (count: number, step: number) => {
    const start = Math.max(0, history.length - count);
    return history.slice(start).filter((_, i) => i % step === 0);
  };
  switch (range) {
    case "24h":
      return clone(slice(25, 1));
    case "7d":
      return clone(slice(7 * 24 + 1, 2));
    case "30d":
      return clone(slice(30 * 24 + 1, 12));
    case "90d":
    case "all":
      return clone(slice(history.length, 24));
  }
}

/* ---------------------------- transactions ---------------------------- */

export interface TxFilter {
  search?: string;
  agentIds?: string[];
  types?: TxType[];
  statuses?: TxStatus[];
  from?: string;
  to?: string;
}

export async function getTransactions(filter?: TxFilter): Promise<Transaction[]> {
  await delay();
  let rows = db.transactions;
  if (filter) {
    const search = filter.search?.trim().toLowerCase();
    rows = rows.filter((tx) => {
      if (search) {
        const haystack = `${tx.hash} ${tx.from} ${tx.to}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (filter.agentIds?.length && !filter.agentIds.includes(tx.agentId)) return false;
      if (filter.types?.length && !filter.types.includes(tx.type)) return false;
      if (filter.statuses?.length && !filter.statuses.includes(tx.status)) return false;
      if (filter.from && tx.time < filter.from) return false;
      if (filter.to && tx.time > filter.to) return false;
      return true;
    });
  }
  return clone(rows);
}

export async function getRecentTransactions(count: number): Promise<Transaction[]> {
  await delay();
  return clone(db.transactions.slice(0, count));
}

export async function getAgentTransactions(agentId: string): Promise<Transaction[]> {
  await delay();
  return clone(db.transactions.filter((tx) => tx.agentId === agentId));
}

/* ------------------------------- agents ------------------------------- */

export async function getAgents(): Promise<Agent[]> {
  await delay();
  return clone(db.agents);
}

export async function getAgent(id: string): Promise<Agent | null> {
  await delay();
  const agent = db.agents.find((a) => a.id === id);
  return agent ? clone(agent) : null;
}

export interface CreateAgentInput {
  name: string;
  framework: Framework;
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  await delay();
  const agent: Agent = {
    id: nextId("agt"),
    name: input.name,
    framework: input.framework,
    status: "active",
    address: randomStrkey("G"),
    balanceXLM: 0,
    txToday: 0,
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.agents.unshift(agent);
  return clone(agent);
}

export async function updateAgent(
  id: string,
  patch: Partial<Pick<Agent, "name" | "status">>,
): Promise<Agent> {
  await delay();
  const agent = db.agents.find((a) => a.id === id);
  if (!agent) throw new Error("Agent not found");
  Object.assign(agent, patch);
  return clone(agent);
}

export async function deleteAgent(id: string): Promise<void> {
  await delay();
  db.agents = db.agents.filter((a) => a.id !== id);
}

export async function rotateAgentKeys(id: string): Promise<{ prefix: string }> {
  await delay(900);
  const key = db.apiKeys.find((k) => k.agentId === id);
  const prefix = `nbl_live_${randomHex(4)}`;
  if (key) key.prefix = prefix;
  return { prefix };
}

export async function getAgentPolicyOverride(agentId: string): Promise<AgentPolicyOverride> {
  await delay();
  return clone(
    db.agentPolicyOverrides[agentId] ?? {
      dailyCapUSD: null,
      perTxCapUSD: null,
      note: "Inherits the global policy.",
    },
  );
}

export async function updateAgentPolicyOverride(
  agentId: string,
  patch: Partial<AgentPolicyOverride>,
): Promise<AgentPolicyOverride> {
  await delay();
  const current = db.agentPolicyOverrides[agentId] ?? {
    dailyCapUSD: null,
    perTxCapUSD: null,
    note: "",
  };
  const next = { ...current, ...patch };
  db.agentPolicyOverrides[agentId] = next;
  return clone(next);
}

/* ------------------------------ treasury ------------------------------ */

export async function getBlendPositions(): Promise<BlendPosition[]> {
  await delay();
  return clone(db.blendPositions);
}

export async function getTreasurySettings(): Promise<TreasurySettings> {
  await delay();
  return clone(db.treasurySettings);
}

export async function updateTreasurySettings(
  patch: Partial<TreasurySettings>,
): Promise<TreasurySettings> {
  await delay();
  Object.assign(db.treasurySettings, patch);
  return clone(db.treasurySettings);
}

export async function deposit(amountXLM: number): Promise<{ txHash: string }> {
  await delay(900);
  db.wallet.balanceXLM = Math.round((db.wallet.balanceXLM + amountXLM) * 100) / 100;
  return { txHash: randomHex(64) };
}

export async function withdraw(amountXLM: number): Promise<{ txHash: string }> {
  await delay(900);
  if (amountXLM > db.wallet.balanceXLM) throw new Error("Insufficient balance");
  db.wallet.balanceXLM = Math.round((db.wallet.balanceXLM - amountXLM) * 100) / 100;
  return { txHash: randomHex(64) };
}

export async function withdrawPosition(positionId: string): Promise<{ txHash: string }> {
  await delay(1_200);
  const position = db.blendPositions.find((p) => p.id === positionId);
  if (!position) throw new Error("Position not found");
  db.blendPositions = db.blendPositions.filter((p) => p.id !== positionId);
  db.wallet.balanceXLM = Math.round((db.wallet.balanceXLM + position.deposited) * 100) / 100;
  return { txHash: randomHex(64) };
}

/* ------------------------------- policy ------------------------------- */

/** On-chain writes resolve after ~3s to simulate Soroban finality. */
const ONCHAIN_MS = 3_000;

export async function getPolicy(): Promise<Policy> {
  await delay();
  return clone(db.policy);
}

export async function updatePolicyLimits(patch: {
  dailyCapUSD?: number;
  weeklyCapUSD?: number;
  monthlyCapUSD?: number;
}): Promise<{ policy: Policy; txHash: string }> {
  await delay(ONCHAIN_MS);
  Object.assign(db.policy, patch);
  return { policy: clone(db.policy), txHash: randomHex(64) };
}

export async function updateCategoryLimit(
  category: PolicyCategory,
  capUSD: number,
): Promise<{ policy: Policy; txHash: string }> {
  await delay(ONCHAIN_MS);
  db.policy.categories[category] = capUSD;
  return { policy: clone(db.policy), txHash: randomHex(64) };
}

export async function addPolicyEntry(
  entry: Omit<PolicyEntry, "id" | "addedAt">,
): Promise<{ entry: PolicyEntry; txHash: string }> {
  await delay(ONCHAIN_MS);
  const created: PolicyEntry = {
    ...entry,
    id: nextId("pe"),
    addedAt: new Date().toISOString(),
  };
  db.policy.entries.unshift(created);
  return { entry: clone(created), txHash: randomHex(64) };
}

export async function removePolicyEntry(id: string): Promise<{ txHash: string }> {
  await delay(ONCHAIN_MS);
  db.policy.entries = db.policy.entries.filter((e) => e.id !== id);
  return { txHash: randomHex(64) };
}

export async function setPolicyPaused(paused: boolean): Promise<{ txHash: string }> {
  await delay(ONCHAIN_MS);
  db.policy.paused = paused;
  return { txHash: randomHex(64) };
}

export async function revokeAgentAccess(): Promise<{ txHash: string }> {
  await delay(ONCHAIN_MS);
  db.agents = db.agents.map((a) => ({ ...a, status: "offline" as const }));
  return { txHash: randomHex(64) };
}

/* ----------------------------- reputation ----------------------------- */

export async function getReputation(): Promise<Reputation> {
  await delay();
  return clone(db.reputation);
}

/* ------------------------------ api keys ------------------------------ */

export async function getApiKeys(): Promise<ApiKey[]> {
  await delay();
  return clone(db.apiKeys);
}

export async function createApiKey(input: {
  name: string;
  expiresInDays: number | null;
}): Promise<{ key: ApiKey; secret: string }> {
  await delay();
  const secret = randomKeySecret();
  const key: ApiKey = {
    id: nextId("key"),
    name: input.name,
    prefix: secret.slice(0, 13),
    createdAt: new Date().toISOString(),
    lastUsed: null,
    expiresAt: input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null,
    agentId: null,
  };
  db.apiKeys.unshift(key);
  return { key: clone(key), secret };
}

export async function revokeApiKey(id: string): Promise<void> {
  await delay();
  db.apiKeys = db.apiKeys.filter((k) => k.id !== id);
}

export async function testConnection(_framework: Framework): Promise<{ latencyMs: number }> {
  await delay(1_600);
  return { latencyMs: Math.round(40 + Math.random() * 90) };
}

/* -------------------------------- team -------------------------------- */

export async function getTeam(): Promise<TeamMember[]> {
  await delay();
  return clone(db.team);
}

export async function inviteMember(email: string, role: TeamMember["role"]): Promise<TeamMember> {
  await delay();
  const member: TeamMember = {
    id: nextId("mem"),
    name: email.split("@")[0] ?? email,
    email,
    role,
    joinedAt: new Date().toISOString(),
  };
  db.team.push(member);
  return clone(member);
}

export async function updateMemberRole(
  id: string,
  role: TeamMember["role"],
): Promise<TeamMember> {
  await delay();
  const member = db.team.find((m) => m.id === id);
  if (!member) throw new Error("Member not found");
  member.role = role;
  return clone(member);
}

export async function removeMember(id: string): Promise<void> {
  await delay();
  db.team = db.team.filter((m) => m.id !== id);
}

/* ------------------------------- billing ------------------------------ */

export async function getBilling(): Promise<BillingInfo> {
  await delay();
  return clone(db.billing);
}

export async function getInvoices(): Promise<Invoice[]> {
  await delay();
  return clone(db.invoices);
}

/* ---------------------------- notifications ---------------------------- */

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  await delay();
  return clone(db.notificationPrefs);
}

export async function updateNotificationPrefs(
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  await delay();
  Object.assign(db.notificationPrefs, patch);
  return clone(db.notificationPrefs);
}

export async function getNotifications(): Promise<AppNotification[]> {
  await delay();
  return clone(db.notifications);
}

export async function markNotificationsRead(): Promise<void> {
  await delay(200);
  db.notifications = db.notifications.map((n) => ({ ...n, read: true }));
}

/* ------------------------------ webhooks ------------------------------- */

export async function getWebhooks(): Promise<Webhook[]> {
  await delay();
  return clone(db.webhooks);
}

export async function addWebhook(url: string, events: string[]): Promise<Webhook> {
  await delay();
  const webhook: Webhook = {
    id: nextId("wh"),
    url,
    events,
    createdAt: new Date().toISOString(),
  };
  db.webhooks.push(webhook);
  return clone(webhook);
}

export async function removeWebhook(id: string): Promise<void> {
  await delay();
  db.webhooks = db.webhooks.filter((w) => w.id !== id);
}

/* ------------------------------ workspace ------------------------------ */

export async function getWorkspace(): Promise<Workspace> {
  await delay();
  return clone(db.workspace);
}

export async function setNetwork(network: Workspace["network"]): Promise<Workspace> {
  await delay(400);
  db.workspace.network = network;
  return clone(db.workspace);
}

export async function deleteWorkspace(): Promise<void> {
  await delay(1_200);
}

export async function updateAccount(patch: {
  name?: string;
  twoFactor?: boolean;
}): Promise<{ ok: true }> {
  await delay();
  void patch;
  return { ok: true };
}

export async function changePassword(_current: string, _next: string): Promise<{ ok: true }> {
  await delay();
  return { ok: true };
}
