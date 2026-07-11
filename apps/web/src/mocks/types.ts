export type TxType = "x402" | "mpp" | "blend_deposit" | "blend_withdraw" | "transfer";
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
  address: string;
  balanceXLM: number;
  txToday: number;
  lastActive: string;
  createdAt: string;
}

export interface WalletSummary {
  address: string;
  balanceXLM: number;
  change24hPct: number;
  idleXLM: number;
  apyPct: number;
  yield30dXLM: number;
  spendTodayUSD: number;
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
  liquidityFloorXLM: number;
}

export interface PolicyEntry {
  id: string;
  address: string;
  label: string;
  kind: "allow" | "deny";
  addedAt: string;
}

export type PolicyCategory = "x402" | "mpp" | "blend" | "transfer";

export interface Policy {
  contractId: string;
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

export type ReputationTier = "Emerging" | "Established" | "Trusted" | "Elite";

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
  score: number;
  tier: ReputationTier;
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
