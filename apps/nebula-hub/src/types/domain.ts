/** Shared Hub domain types (API responses + UI). Not mock data. */

export type TxType =
  | "x402"
  | "mpp"
  | "blend_deposit"
  | "blend_withdraw"
  | "transfer"
  | "swap"
  | "policy_change";
export type TxStatus = "pending" | "confirmed" | "failed";

export interface TxOperation {
  type: string;
  detail: string;
}

export interface Transaction {
  id: string;
  hash: string;
  time: string;
  agentId: string;
  type: TxType;
  from: string;
  to: string;
  amount: number;
  asset: "XLM" | "USDC";
  status: TxStatus;
  fee: number;
  memo: string | null;
  operations: TxOperation[];
}

export type AgentStatus = "active" | "paused" | "offline";
export type Framework = "claude-desktop" | "claude-code" | "custom-mcp" | "openai-sdk";

export interface Agent {
  id: string;
  name: string;
  framework: Framework;
  status: AgentStatus;
  description?: string | null;
  avatarColor?: string | null;
  address: string;
  balanceXLM: number;
  balanceUSDC: number;
  txToday: number;
  lastActive: string;
  createdAt: string;
}

export interface WalletSummary {
  address: string;
  /** Liquid + Blend collateral (spendable + earning). */
  balanceXLM: number;
  change24hPct: number;
  /** Spendable XLM (after fee buffer). */
  liquidXLM: number;
  /** XLM supplied as Blend collateral. */
  blendXLM: number;
  /** @deprecated Prefer blendXLM — kept for older call sites. */
  idleXLM: number;
  /** Blend XLM supply APY as a percent (e.g. 6.5). */
  apyPct: number;
  yield30dXLM: number;
  spendTodayUSD: number;
  /** Live USD per 1 XLM (CoinGecko), when available. */
  usdPerXlm?: number | null;
  /** Optional liquid-band floor (USDC) from treasury settings. */
  liquidityFloorXLM?: number;
  poolName?: string | null;
  /** Hub Stellar network (from /api/wallet). */
  network?: "testnet" | "mainnet";
  /** Circle USDC balance on the Hub wallet. */
  usdcBalance?: number;
}

export interface BalancePoint {
  time: string;
  balance: number;
  /** cumulative yield earned up to this point */
  yield: number;
}

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "all";

export interface BlendPosition {
  id: string;
  pool: string;
  asset: string;
  deposited: number;
  apyPct: number;
  earned: number;
}

export interface TreasurySettings {
  autoYield: boolean;
  /** Band low in USDC — pull from Blend when liquid XLM value falls below this. */
  liquidityFloorXLM: number;
  /** Band high in USDC — park to Blend when liquid XLM value rises above this. */
  liquidityCeilingXLM: number;
}

export interface PolicyEntry {
  id: string;
  address: string;
  label: string;
  kind: "allow" | "deny";
  addedAt: string;
}

export type PolicyCategory = "x402" | "mpp" | "transfer";

export interface Policy {
  contractId: string;
  /** Per-tx spend cap in USDC (field name kept for API compat). */
  perCallCapXLM: number;
  /** Daily spend cap in USDC. */
  dailyCapUSD: number;
  weeklyCapUSD: number;
  monthlyCapUSD: number;
  categories: Record<PolicyCategory, number>;
  entries: PolicyEntry[];
  paused: boolean;
}

export interface AgentPolicyOverride {
  dailyCapUSD: number | null;
  perTxCapUSD: number | null;
  note: string;
}

export type ReputationConfidence =
  | "unrated"
  | "low"
  | "medium"
  | "high"
  | "Emerging"
  | "Established"
  | "Trusted"
  | "Elite";

export interface ReputationComponent {
  key: string;
  label: string;
  score: number;
  max: number;
  explainer: string;
}

export interface ReputationEvent {
  id: string;
  time: string;
  text: string;
  delta: number;
}

export interface Reputation {
  /** Stellar8004 avgScore, 0–100 */
  score: number;
  scoreMax: number;
  confidence: ReputationConfidence;
  /** Alias of confidence for older UI */
  tier: ReputationConfidence;
  registered: boolean;
  feedbackCount: number;
  uniqueClients: number;
  totalScore: number | null;
  averageScore: number | null;
  stellar8004AgentId: number | null;
  explorerUrl: string | null;
  source: string | null;
  deltaWeek: number;
  history: { time: string; score: number }[];
  components: ReputationComponent[];
  events: ReputationEvent[];
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
  agentId: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Member";
  joinedAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  amountUSD: number;
  status: "paid" | "due";
}

export interface BillingInfo {
  plan: "Free" | "Pro" | "Enterprise";
  renewsAt: string;
  mcpCallsUsed: number;
  mcpCallsLimit: number;
  txVolumeUsedUSD: number;
  txVolumeLimitUSD: number;
  paymentMethod: { brand: string; last4: string } | null;
}

export interface NotificationPrefs {
  policyViolations: boolean;
  lowBalance: boolean;
  yieldMilestones: boolean;
  weeklySummary: boolean;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  createdAt: string;
}

export interface AppNotification {
  id: string;
  time: string;
  title: string;
  body: string;
  read: boolean;
}

export interface Workspace {
  name: string;
  network: "testnet" | "mainnet";
}

export interface SessionUser {
  name: string;
  email: string;
  /** Google (or other OAuth) profile photo when available. */
  imageUrl?: string | null;
}
